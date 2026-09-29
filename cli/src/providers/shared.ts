import { FileDiff } from "../core/diff";
import { Finding } from "../core/scan";

export function buildSystemPrompt(pastPatterns: string[] = []): string {
  const hindsightContext = pastPatterns.length > 0 
    ? `\n\nRELEVANT REPOSITORY MEMORY:
These are memories retrieved from previous SecurePush reviews of this repository.
Use them as historical context only.
Do not assume a previous finding is present in the current diff.
Verify every issue against the current code.
Give priority to the current diff over historical memory.

Previous repository memories:
${pastPatterns.map(p => `- ${p}`).join("\n")}`
    : "";

  return `You are a security and code-quality reviewer for a git pre-push hook called SecurePush. You review diffs of code that may have been written by an AI coding agent (Claude Code, Cursor, Codex, Copilot).

Review the given diff for:
- Hardcoded secrets (API keys, tokens, passwords, connection strings)
- SQL injection and other injection vulnerabilities
- Hallucinated dependencies (imports of packages that plausibly don't exist)
- Insecure authentication or authorization patterns
- Other clear security or correctness risks${hindsightContext}

For each issue found, propose a minimal, safe fix matching the language of the file (e.g. for Python use os.getenv("VAR", "") or os.environ.get("VAR"), for JS/TS use process.env.VAR) — do not rewrite unrelated code.

Respond with ONLY a JSON array (no prose, no markdown fences) matching this exact shape:
[
  {
    "file": "path/to/file.ts",
    "line": 42,
    "issue": "hardcoded_secret",
    "severity": "critical",
    "originalLine": "<exact original line content, unmodified>",
    "proposedFix": "<the replacement line content>",
    "extractedSecret": "<literal secret value if hardcoded_secret, else null>",
    "envVarName": "<suggested environment variable name if hardcoded_secret, else null>"
  }
]

Valid "issue" values: "hardcoded_secret", "sql_injection", "hallucinated_dependency", "insecure_auth", "other".
Valid "severity" values: "critical", "high", "medium", "low".
If there are no issues, respond with exactly: []`;
}

export function buildDiffPrompt(files: FileDiff[]): string {
  const sections = files.map((f) => {
    const lines = f.addedLines.map((l) => `${l.lineNumber}: ${l.content}`).join("\n");
    return `--- ${f.file} ---\n${lines}`;
  });
  return sections.join("\n\n");
}

/**
 * A malformed/non-JSON response is treated as zero findings rather than crashing —
 * a parsing failure must never silently skip the scan without telling the user,
 * so the caller (verify.ts / the provider itself) is responsible for logging when
 * this returns [] because parsing failed vs. because the model genuinely found nothing.
 */
function cleanFindingsList(parsed: any[]): Finding[] {
  return parsed
    .filter(
      (f: any) =>
        typeof f?.file === "string" &&
        (typeof f?.line === "number" || typeof f?.line === "string") &&
        typeof f?.issue === "string" &&
        typeof f?.severity === "string" &&
        typeof f?.originalLine === "string" &&
        typeof f?.proposedFix === "string"
    )
    .map((f: any) => ({
      file: f.file,
      line: typeof f.line === "number" ? f.line : parseInt(f.line, 10) || 1,
      issue: f.issue,
      severity: f.severity,
      originalLine: f.originalLine,
      proposedFix: f.proposedFix,
      extractedSecret: typeof f.extractedSecret === "string" ? f.extractedSecret : undefined,
      envVarName: typeof f.envVarName === "string" ? f.envVarName : undefined,
    }));
}

/**
 * A malformed/non-JSON response is treated as zero findings rather than crashing —
 * a parsing failure must never silently skip the scan without telling the user,
 * so the caller (verify.ts / the provider itself) is responsible for logging when
 * this returns [] because parsing failed vs. because the model genuinely found nothing.
 */
export function parseFindingsResponse(raw: string): { findings: Finding[]; parseFailed: boolean } {
  if (!raw || !raw.trim()) return { findings: [], parseFailed: false };

  let text = raw.trim();

  // Strip <think> reasoning tags (from DeepSeek, Nemotron, etc.)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 1. Direct parse attempt
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { findings: cleanFindingsList(parsed), parseFailed: false };
    }
    if (Array.isArray(parsed?.findings)) {
      return { findings: cleanFindingsList(parsed.findings), parseFailed: false };
    }
  } catch {}

  // 2. Extract markdown code blocks ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) {
        return { findings: cleanFindingsList(parsed), parseFailed: false };
      }
      if (Array.isArray(parsed?.findings)) {
        return { findings: cleanFindingsList(parsed.findings), parseFailed: false };
      }
    } catch {}
  }

  // 3. Extract JSON array anywhere in text: [ { ... } ] or empty []
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/) || text.match(/\[\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return { findings: cleanFindingsList(parsed), parseFailed: false };
      }
    } catch {}
  }

  // 4. Extract JSON object containing "findings": [ ... ]
  const objMatch = text.match(/\{[\s\S]*"findings"\s*:\s*\[[\s\S]*?\][\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (Array.isArray(parsed?.findings)) {
        return { findings: cleanFindingsList(parsed.findings), parseFailed: false };
      }
    } catch {}
  }

  return { findings: [], parseFailed: true };
}
