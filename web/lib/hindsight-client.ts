import { HindsightClient } from "@vectorize-io/hindsight-client";

export function getClient(): HindsightClient {
  const baseUrl = process.env.HINDSIGHT_HOST || "http://localhost:8888";
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim();
  return new HindsightClient({
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  });
}

/**
 * Sanitizes any raw secret strings or tokens from memory text.
 * Ensures the web UI never displays raw credentials, keys, or tokens.
 */
export function sanitizeSecretText(text: string): string {
  if (!text) return "";
  return text
    .replace(/(?:gsk_|sk-[a-zA-Z0-9_-]{10,}|ghp_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]{10,}|AKIA[0-9A-Z]{16})[^\s"']*/gi, "[REDACTED_API_KEY]")
    .replace(/(=|:)\s*["'`][^"'`\s]{8,}["'`]/g, '$1 "[REDACTED_SECRET]"')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_CREDENTIALS]@host/db")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "mongodb://[REDACTED_CREDENTIALS]@host/db");
}

export interface SecurityMemory {
  id?: string;
  text: string;
  timestamp?: string;
  context?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStats {
  totalMemories: number;
  decisions: number;
  accepted: number;
  rejected: number;
}

export interface MemoryResult {
  memories: SecurityMemory[];
  stats?: MemoryStats;
  isUnavailable?: boolean;
  error?: string;
}

/**
 * Retrieves real security memories from Hindsight for a repository bank.
 * Preserves real metadata and timestamps if the SDK response provides them.
 * Never invents or assigns current timestamps to old memories.
 * Fails gracefully without throwing if Hindsight is unreachable.
 */
export async function getSecurityMemories(bankId: string): Promise<MemoryResult> {
  if (!bankId) {
    return { memories: [] };
  }

  try {
    const client = getClient();
    
    // Recall all security memories for this bank
    const res = await client.recall(
      bankId,
      "all security reviews, findings, fixes, and developer decisions for this repository",
      {
        budget: "low",
        maxTokens: 4096,
      }
    );

    const rawResults = res?.results || [];
    const memories: SecurityMemory[] = rawResults.map((r: any) => {
      // If SDK exposes a real timestamp (occurred_start, mentioned_at, or metadata.timestamp), preserve it.
      // Otherwise leave undefined (do NOT invent one).
      const rawTimestamp = r.occurred_start || r.mentioned_at || r.metadata?.timestamp;
      const timestamp = rawTimestamp ? String(rawTimestamp) : undefined;

      return {
        id: r.id ? String(r.id) : undefined,
        text: sanitizeSecretText(r.text || ""),
        timestamp,
        context: r.context ? String(r.context) : undefined,
        type: r.type ? String(r.type) : undefined,
        metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : undefined,
      };
    }).filter(m => Boolean(m.text));

    // Calculate real stats from real memories
    let accepted = 0;
    let rejected = 0;
    let decisions = 0;

    for (const m of memories) {
      const dec = m.metadata?.decision || m.metadata?.action;
      const textLower = m.text.toLowerCase();
      if (dec === "accepted" || dec === "fixed" || textLower.includes("developer accepted")) {
        accepted++;
        decisions++;
      } else if (dec === "rejected" || dec === "blocked" || textLower.includes("developer rejected")) {
        rejected++;
        decisions++;
      }
    }

    return {
      memories,
      stats: {
        totalMemories: memories.length,
        decisions,
        accepted,
        rejected,
      },
    };
  } catch (err: any) {
    console.error("Hindsight getSecurityMemories error:", err?.message || err);
    return {
      memories: [],
      isUnavailable: true,
      error: "Memory temporarily unavailable",
    };
  }
}

/**
 * Backwards-compatible getHistory implementation that does not assign current timestamps.
 */
export async function getHistory(bankId: string) {
  const result = await getSecurityMemories(bankId);
  return result.memories.map((m) => ({
    id: m.id,
    text: m.text,
    timestamp: m.timestamp, // preserves real timestamp or undefined, NOT new Date().toISOString()
    metadata: m.metadata,
  }));
}

export interface InsightCallout {
  text: string;
  pattern: string;
}

export async function getSmartInsight(bankId: string): Promise<InsightCallout | null> {
  try {
    const client = getClient();
    const res = await client.reflect(
      bankId,
      "What is the most recurring security vulnerability or bad pattern in this repository? Be concise and identify the single most prominent pattern."
    );
    if (res && res.text) {
      return {
        text: sanitizeSecretText(res.text),
        pattern: "Recurring Pattern",
      };
    }
  } catch (err) {
    console.error("Hindsight reflect error:", err);
  }
  return null;
}
