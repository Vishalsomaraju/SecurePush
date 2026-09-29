import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import { Decision } from "./review";
import { passesShrinkGuard } from "../safety/fileShrinkGuard";
import { writeSecretToEnv, ensureEnvIgnored } from "./envRemediation";

export async function applyAcceptedFixes(
  decisions: Decision[],
  repoRoot: string,
  maxShrinkPct: number = 30
): Promise<string[]> {
  const modifiedFiles = new Set<string>();
  const byFile = new Map<string, Decision[]>();

  for (const d of decisions) {
    if (!d.accepted) continue;
    const list = byFile.get(d.finding.file) ?? [];
    list.push(d);
    byFile.set(d.finding.file, list);
  }

  for (const [file, fileDecisions] of byFile) {
    const fullPath = path.join(repoRoot, file);
    const original = await fs.readFile(fullPath, "utf-8");
    const lines = original.split(/\r?\n/);

    // Apply by exact line number (finding.line is 1-indexed from the diff), not
    // string matching — originalLine text is not guaranteed unique in the file,
    // and String.prototype.replace only touches the first match, which can
    // silently patch the wrong occurrence when a line repeats (e.g. a common
    // console.log). Re-validate the line still matches what was scanned before
    // touching it, in case an earlier accepted fix on the same file shifted things.
    for (const { finding } of fileDecisions) {
      let idx = finding.line - 1;

      // Robust line resolution:
      // If finding.line is off or line content doesn't match, search by originalLine or secret content
      if (idx < 0 || idx >= lines.length || lines[idx].trim() !== finding.originalLine.trim()) {
        const foundIdx = lines.findIndex((l) => l.trim() === finding.originalLine.trim());
        if (foundIdx !== -1) {
          idx = foundIdx;
        } else if (finding.extractedSecret) {
          const secretIdx = lines.findIndex((l) => l.includes(finding.extractedSecret!));
          if (secretIdx !== -1) {
            idx = secretIdx;
          }
        }
      }

      if (idx < 0 || idx >= lines.length) {
        console.log(
          chalk.red(
            `  ✗ ${file}:${finding.line} — line content changed since scan, skipping this fix (re-run to rescan).`
          )
        );
        continue;
      }

      // Preserve indentation of original line
      const indent = lines[idx].match(/^(\s*)/)?.[1] || "";
      const proposedTrimmed = finding.proposedFix.trim();
      lines[idx] = indent + proposedTrimmed;

      if (finding.issue === "hardcoded_secret" && finding.extractedSecret && finding.envVarName) {
        await writeSecretToEnv(repoRoot, finding.envVarName, finding.extractedSecret);
        await ensureEnvIgnored(repoRoot);
        modifiedFiles.add(".env");
        modifiedFiles.add(".gitignore");
      }
    }

    // For Python files: if we moved secrets to .env, ensure dotenv is imported & loaded
    const hadSecretFix = fileDecisions.some((d) => d.finding.issue === "hardcoded_secret");
    if (file.endsWith(".py") && hadSecretFix) {
      const hasLoadDotenv = lines.some((l) => l.includes("load_dotenv"));
      if (!hasLoadDotenv) {
        const dotenvSnippet = [
          "try:",
          "    from dotenv import load_dotenv",
          "    load_dotenv()",
          "except ImportError:",
          "    pass",
        ];
        const importIdx = lines.findIndex((l) => l.startsWith("import ") || l.startsWith("from "));
        if (importIdx !== -1) {
          lines.splice(importIdx + 1, 0, ...dotenvSnippet);
        } else {
          lines.unshift(...dotenvSnippet);
        }
      }
    }

    const updated = lines.join("\n");
    const guard = passesShrinkGuard(original, updated, maxShrinkPct);
    if (!guard.ok) {
      console.log(chalk.red(`  ✗ ${file}: ${guard.reason}`));
      continue;
    }

    await fs.writeFile(fullPath, updated, "utf-8");
    modifiedFiles.add(file);
    console.log(chalk.green(`  ✓ Applied fix to ${file}`));
  }

  return Array.from(modifiedFiles);
}
