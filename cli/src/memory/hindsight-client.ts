import chalk from "chalk";
import { HindsightClient } from "@vectorize-io/hindsight-client";

/**
 * Returns a configured HindsightClient instance.
 * Reads HINDSIGHT_HOST and HINDSIGHT_API_KEY from environment variables.
 * Default host is used only for local development. Never hardcodes an API key.
 */
export function getClient(): HindsightClient {
  const baseUrl = process.env.HINDSIGHT_HOST || "http://localhost:8888";
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim();

  return new HindsightClient({
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  });
}

/**
 * Cache of initialized memory banks to avoid redundant ensureBank API calls.
 */
const knownBanks = new Set<string>();

/**
 * Ensures that the repository-specific memory bank exists.
 * Creates the bank with an appropriate mission if missing, safely handling
 * "already exists" or race conditions without failing.
 */
export async function ensureBank(bankId: string): Promise<boolean> {
  if (!bankId || knownBanks.has(bankId)) return true;

  try {
    const client = getClient();
    try {
      await client.getBankProfile(bankId);
      knownBanks.add(bankId);
      return true;
    } catch {
      // Bank doesn't exist yet, create it
      try {
        await client.createBank(bankId, {
          name: bankId,
          mission: "SecurePush repository memory: tracking recurring vulnerabilities, fixes, and developer decisions.",
        });
        knownBanks.add(bankId);
        return true;
      } catch (createErr: any) {
        const msg = String(createErr?.message || createErr);
        if (msg.includes("already exists") || createErr?.statusCode === 409) {
          knownBanks.add(bankId);
          return true;
        }
        throw createErr;
      }
    }
  } catch (err: any) {
    console.warn(chalk.yellow(`[Hindsight] Warning: Could not initialize memory bank "${bankId}": ${err?.message || err}`));
    return false;
  }
}

export interface RecallContext {
  pastPatterns: string[];
}

/**
 * Sanitizes any raw secret strings or tokens from a line of code or message.
 * Replaces high-entropy secrets, API keys, bearer tokens, passwords, and connection strings.
 */
export function sanitizeSecretText(text: string): string {
  if (!text) return "";
  return text
    // Replace common API keys/tokens (OpenAI, Anthropic, Groq, GitHub, JWT, Stripe, etc.)
    .replace(/(?:gsk_|sk-[a-zA-Z0-9_-]{10,}|ghp_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]{10,}|AKIA[0-9A-Z]{16})[^\s"']*/gi, "[REDACTED_API_KEY]")
    // Replace assignments with literal strings: = "..." or : "..."
    .replace(/(=|:)\s*["'`][^"'`\s]{8,}["'`]/g, '$1 "[REDACTED_SECRET]"')
    // Replace connection strings
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_CREDENTIALS]@host/db")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "mongodb://[REDACTED_CREDENTIALS]@host/db");
}

/**
 * Creates a clear, descriptive remediation phrase without exposing raw values.
 */
export function buildRemediationSummary(issue: string, file: string, envVarName?: string): string {
  switch (issue) {
    case "hardcoded_secret":
      return envVarName
        ? `moved hardcoded secret in ${file} to environment variable ${envVarName}`
        : `moved hardcoded credential in ${file} to an environment variable`;
    case "sql_injection":
      return `parameterized query in ${file} to prevent SQL injection`;
    case "hallucinated_dependency":
      return `removed or replaced non-existent dependency in ${file}`;
    case "insecure_auth":
      return `hardened insecure authentication/authorization logic in ${file}`;
    default:
      return `remediated ${issue} in ${file}`;
  }
}

export interface RetainEvent {
  bankId: string;
  repoName?: string;
  file: string;
  issue: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  action?: "fixed" | "rejected" | "blocked";
  decision?: "accepted" | "rejected";
  testOutcome?: "tests_passed" | "tests_failed" | "untested";
  pushOutcome?: "push_allowed" | "push_blocked";
  remediationSummary?: string;
  envVarName?: string;
  originalLine?: string;
  proposedFix?: string;
  timestamp?: string;
}

/**
 * Builds structured, natural language memory content ensuring zero raw secrets.
 */
export function buildMemoryContent(event: RetainEvent): string {
  const file = event.file;
  const issue = event.issue;
  const severity = event.severity;
  const decision = event.decision ?? (event.action === "rejected" || event.action === "blocked" ? "rejected" : "accepted");
  const remediation = event.remediationSummary || buildRemediationSummary(issue, file, event.envVarName);

  if (decision === "accepted") {
    if (event.testOutcome === "tests_failed" || event.pushOutcome === "push_blocked") {
      return `Developer accepted remediation (${remediation}) for ${issue} (${severity}) in ${file}, but tests failed and push was blocked.`;
    }
    return `Developer accepted remediation (${remediation}) for ${issue} (${severity}) in ${file}. Tests passed and push was allowed.`;
  } else {
    // Rejected decision
    if (event.pushOutcome === "push_blocked") {
      const reason = severity === "critical"
        ? "critical-severity finding policy"
        : event.testOutcome === "tests_failed"
          ? "subsequent test failure"
          : "push blocked policy";
      return `Developer rejected the proposed remediation for ${issue} (${severity}) in ${file}. The finding was not automatically applied; push was blocked due to ${reason}.`;
    }
    return `Developer rejected the proposed remediation for ${issue} (${severity}) in ${file}. The finding was not applied; tests passed and push was allowed.`;
  }
}

/**
 * Queries Hindsight for memories relevant to the currently changed files.
 * Mentions changed file paths, previous findings, fixes, rejected fixes, and recurring patterns.
 * Fails gracefully if Hindsight is unavailable.
 */
export async function recall(
  bankId: string,
  files?: Array<{ file: string }> | string[]
): Promise<RecallContext> {
  if (!bankId) return { pastPatterns: [] };

  try {
    const client = getClient();
    await ensureBank(bankId);

    const changedFiles = (files || [])
      .map((f) => (typeof f === "string" ? f : f.file))
      .filter(Boolean);

    const query = changedFiles.length > 0
      ? `Find previous security findings, fixes, rejected fixes, and recurring security patterns relevant to these changed files: ${changedFiles.join(", ")}. Pay particular attention to secrets, authentication, injection vulnerabilities, dependencies, and previous developer decisions.`
      : `Find previous security findings, fixes, rejected fixes, and recurring security patterns for this repository. Pay particular attention to secrets, authentication, injection vulnerabilities, dependencies, and previous developer decisions.`;

    const response = await client.recall(bankId, query, {
      budget: "low",
      maxTokens: 1024,
    });

    const results = (response?.results || [])
      .map((r: any) => (typeof r.text === "string" ? sanitizeSecretText(r.text.trim()) : ""))
      .filter(Boolean);

    // Deduplicate and take concise set of top memories
    const unique = Array.from(new Set(results)).slice(0, 5);
    return { pastPatterns: unique };
  } catch (err: any) {
    console.warn(chalk.yellow(`[Hindsight] Warning: Memory recall unavailable (${err?.message || err}). Proceeding without historical context.`));
    return { pastPatterns: [] };
  }
}

/**
 * Retains a structured security review outcome in Hindsight.
 * Sanitizes all secrets and records decisions, test outcomes, and push results.
 * Never throws or interrupts the push flow on failure.
 */
export async function retain(event: RetainEvent): Promise<boolean> {
  if (!event.bankId) return false;

  try {
    const client = getClient();
    await ensureBank(event.bankId);

    const rawContent = buildMemoryContent(event);
    const content = sanitizeSecretText(rawContent);
    const decision = event.decision ?? (event.action === "rejected" || event.action === "blocked" ? "rejected" : "accepted");

    await client.retain(event.bankId, content, {
      context: "SecurePush security review",
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      metadata: {
        repository: event.repoName || "repository",
        file: event.file,
        issue: event.issue,
        severity: event.severity,
        decision,
        testOutcome: event.testOutcome || (event.action === "fixed" ? "tests_passed" : "untested"),
        pushOutcome: event.pushOutcome || (event.action === "blocked" ? "push_blocked" : "push_allowed"),
        action: event.action || (decision === "accepted" ? "fixed" : "rejected"),
      },
    });

    return true;
  } catch (err: any) {
    console.warn(chalk.yellow(`[Hindsight] Warning: Could not retain review memory to Hindsight: ${err?.message || err}`));
    return false;
  }
}
