import { HindsightClient } from "@vectorize-io/hindsight-client";

export function getClient(): HindsightClient {
  const baseUrl = process.env.HINDSIGHT_HOST || "http://localhost:8888";
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim();
  return new HindsightClient({
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  });
}

export interface InsightCallout {
  text: string;
  pattern: string;
}

export async function getSmartInsight(bankId: string): Promise<InsightCallout | null> {
  try {
    const client = getClient();
    const res = await client.reflect(bankId, "What is the most recurring security vulnerability or bad pattern in this repository? Be concise and identify the single most prominent pattern.");
    
    // We expect reflect to give a summarized text. We can try to extract a pattern label if needed,
    // or just return the text.
    if (res && res.text) {
      return {
        text: res.text,
        pattern: "Recurring Pattern" // Fallback label
      };
    }
  } catch (err) {
    console.error("Hindsight reflect error:", err);
  }
  return null;
}

export async function getHistory(bankId: string) {
  try {
    const client = getClient();
    const res = await client.recall(bankId, "all past security blocks and fixes");
    return res.results.map(r => ({
      text: r.text,
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    console.error("Hindsight recall error:", err);
    return [];
  }
}
