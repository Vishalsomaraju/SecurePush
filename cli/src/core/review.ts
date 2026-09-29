import chalk from "chalk";
import * as p from "@clack/prompts";
import { Finding } from "./scan";

export interface Decision {
  finding: Finding;
  accepted: boolean;
}

import fs from "fs";
import path from "path";
import simpleGit from "simple-git";

async function getRejectionFile(): Promise<string> {
  const repoRoot = (await simpleGit().revparse(["--show-toplevel"])).trim();
  return path.join(repoRoot, ".securepush.rejections.json");
}

async function hasRejectedFiveTimesInARow(issue: string): Promise<boolean> {
  try {
    const file = await getRejectionFile();
    if (!fs.existsSync(file)) return false;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return (data[issue] || 0) >= 5;
  } catch {
    return false;
  }
}

async function incrementRejection(issue: string): Promise<void> {
  try {
    const file = await getRejectionFile();
    let data: Record<string, number> = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    data[issue] = (data[issue] || 0) + 1;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
}

async function resetRejection(issue: string): Promise<void> {
  try {
    const file = await getRejectionFile();
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data[issue] = 0;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
}
async function muteFinding(issue: string): Promise<void> {
  try {
    const file = await getRejectionFile();
    let data: any = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    const currentMuted = Array.isArray(data.muted) ? data.muted : [];
    if (!currentMuted.includes(issue)) {
      data.muted = [...currentMuted, issue];
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
  } catch {}
}

export async function reviewFindings(findings: Finding[]): Promise<Decision[]> {
  const decisions: Decision[] = [];

  for (const finding of findings) {
    console.log("");
    console.log(chalk.gray(`  ${finding.file}:${finding.line}`));
    console.log(chalk.red(`  - ${finding.originalLine}`));
    console.log(chalk.yellow(`  + ${finding.proposedFix}`));
    console.log(
      chalk.gray(`  finding: `) +
        (finding.severity === "critical" ? chalk.red.bold(finding.issue) : chalk.yellow(finding.issue))
    );

    const choice = await p.select({
      message: "Accept this fix?",
      options: [
        { value: "accept", label: "Accept fix" },
        { value: "reject", label: "Reject (flow continues, logged as warning)" },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel("Review cancelled — push aborted.");
      process.exit(1);
    }

    const accepted = choice === "accept";
    decisions.push({ finding, accepted });

    if (accepted) {
      await resetRejection(finding.issue);
      console.log(chalk.green(`  ✓ Accepted — will be applied, committed, and tested.`));
    } else {
      await incrementRejection(finding.issue);
      console.log(chalk.yellow(`  ⚠ Rejected — logged as a warning, flow continues.`));
      if (finding.severity === "critical") {
        console.log(
          chalk.red.bold(
            `  ⚠ CRITICAL severity — per policy, rejecting this will still block the push regardless of other accepted fixes.`
          )
        );
      }

      if (await hasRejectedFiveTimesInARow(finding.issue)) {
        const mute = await p.confirm({
          message: `You've dismissed "${finding.issue}" findings 5 times in a row — mute this finding type for this repo?`,
          initialValue: false,
        });
        if (!p.isCancel(mute) && mute) {
          await muteFinding(finding.issue);
          console.log(chalk.gray(`  Muted "${finding.issue}" for this repo (saved locally in .securepush.rejections.json).`));
        }
      }
    }
  }

  return decisions;
}
