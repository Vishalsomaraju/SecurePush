import { FileDiff } from "./diff";
import { Provider } from "../config/schema";
import { reviewWithGroq } from "../providers/groq";
import { reviewWithGemini } from "../providers/gemini";
import { reviewWithOllama } from "../providers/ollama";
import { reviewWithOpenRouter } from "../providers/openrouter";
import { reviewWithCloud } from "../providers/cloud";

export interface Finding {
  file: string;
  line: number;
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
  originalLine: string;
  proposedFix: string;
  extractedSecret?: string;
  envVarName?: string;
}

export async function scanDiff(files: FileDiff[], provider: Provider, bankId?: string, pastPatterns: string[] = []): Promise<Finding[]> {
  const raw = await routeToProvider(files, provider, bankId, pastPatterns);

  // dedup by file+line — keep this, it caught a real bug in the scratch test
  const seen = new Set<string>();
  const deduped: Finding[] = [];
  for (const finding of raw) {
    const key = `${finding.file}:${finding.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }
  return deduped;
}

async function routeToProvider(files: FileDiff[], provider: Provider, bankId?: string, pastPatterns: string[] = []): Promise<Finding[]> {
  switch (provider) {
    case "groq":
      return reviewWithGroq(files, pastPatterns); // already has its own Ollama fallback on hard failure
    case "gemini": {
      const result = await reviewWithGemini(files, pastPatterns);
      if (result !== null) return result;
      return failClosedOrFallback(files, pastPatterns);
    }
    case "openrouter": {
      const result = await reviewWithOpenRouter(files, pastPatterns);
      if (result !== null) return result;
      return failClosedOrFallback(files, pastPatterns);
    }
    case "ollama": {
      const result = await reviewWithOllama(files, pastPatterns);
      if (result !== null) return result;
      // Ollama IS the fallback for everyone else — if it's the primary and it
      // fails, there's nowhere further to fall back to. Fail closed.
      console.log("Ollama unreachable — is it running? Scan could not complete, push blocked.");
      process.exit(1);
    }
    case "cloud": {
      if (!bankId) {
        console.log("bank_id is required for cloud provider");
        process.exit(1);
      }
      const result = await reviewWithCloud(files, bankId, pastPatterns);
      if (result !== null) return result;
      console.log("Cloud scan could not complete — push blocked.");
      process.exit(1);
    }
  }
}

async function failClosedOrFallback(files: FileDiff[], pastPatterns: string[] = []): Promise<Finding[]> {
  console.log("Provider failed — retrying against local Ollama fallback...");
  const fallback = await reviewWithOllama(files, pastPatterns);
  if (fallback !== null) return fallback;
  console.log("Scan could not complete — provider unreachable. Push blocked.");
  process.exit(1);
}
