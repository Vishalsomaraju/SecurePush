import chalk from "chalk";
import simpleGit from "simple-git";
import { getDiffSinceLastPush } from "../core/diff";
import { scanDiff } from "../core/scan";
import { reviewFindings } from "../core/review";
import { applyAcceptedFixes } from "../core/apply";
import { runTests } from "../core/testRunner";
import { loadIndex, saveIndex, updateIndex, lookupReferences } from "../core/referenceIndex";
import { loadConfig } from "../config/schema";
import { recall, retain } from "../memory/hindsight-client";


async function reportScanToCloud(config: any, repoName: string, findings: any[], blocked: boolean, startTime: number) {
  const baseUrl = process.env.SECUREPUSH_API_URL || "http://localhost:3000";
  let branch = "main";
  try {
    branch = (await simpleGit().branch()).current;
  } catch (e) {}

  let muted = [];
  try {
    muted = JSON.parse(require("fs").readFileSync(require("path").join(process.cwd(), ".securepush.rejections.json"), "utf-8")).muted || [];
  } catch (e) {}

  await fetch(`${baseUrl}/api/scan-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bank_id: config.bank_id,
      repo_name: repoName,
      branch,
      provider: config.provider,
      model: config.model,
      test_command: config.test_command,
      thresholds: config.thresholds,
      duration_ms: Date.now() - startTime,
      findings: findings.map(f => ({
        issue: f.issue || f.finding?.issue,
        severity: f.severity || f.finding?.severity,
        action: f.action || "unknown"
      })),
      muted,
      blocked
    })
  }).catch(() => {}); // Fire and forget, don't break CLI on network failure
}

export async function verify() {
  const startTime = Date.now();
  const git = simpleGit();
  const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
  const config = loadConfig(repoRoot);

  console.log(chalk.gray("Diffing since last push..."));
  const files = await getDiffSinceLastPush(git);

  if (!files || files.length === 0) {
    console.log(chalk.gray("No changes to scan — push proceeding untouched."));
    process.exit(0);
  }
  const repoName = require("path").basename(repoRoot);

  // Minimum-viable reference-index warning: surface "referenced in N places"
  // per changed file. NOT feeding call-site snippets into the AI prompt yet —
  // that's the should-have version, explicitly cut for the hackathon unless
  // there's time to spare (Implementation Plan cut list).
  const index = await loadIndex(repoRoot);
  for (const f of files) {
    const refs = lookupReferences(index, f.file);
    if (refs.length > 0) {
      console.log(chalk.gray(`  ${f.file} is referenced in ${refs.length} place(s): ${refs.join(", ")}`));
    }
  }

  // Hindsight recall — queries past security findings, fixes, and developer decisions
  // relevant to the changed files to provide historical context to the reviewer.
  const memory = await recall(config.bank_id, files);
  if (memory.pastPatterns.length > 0) {
    console.log(chalk.cyan("\nFrom repository memory:"));
    memory.pastPatterns.forEach((p) => console.log(chalk.gray(`  • ${p}`)));
  }

  console.log(chalk.gray(`\nScanning ${files.length} changed file(s)...`));
  const findings = await scanDiff(files, config.provider, config.bank_id, memory.pastPatterns);

  if (findings.length === 0) {
    console.log(chalk.green("No issues found."));
    console.log(chalk.gray("\nRunning tests..."));
    const cleanResult = await runTests(config.test_command, repoRoot);
    if (cleanResult.passed) {
      console.log(chalk.green("✓ Tests passed → push allowed."));
      await reportScanToCloud(config, repoName, [], false, startTime);
      process.exit(0);
    } else {
      console.log(chalk.red("✗ Tests FAILED — push BLOCKED. Nothing reaches GitHub."));
      console.log(chalk.gray(cleanResult.output));
      await reportScanToCloud(config, repoName, [], true, startTime);
      process.exit(1);
    }
  }

  console.log(chalk.yellow(`\nFound ${findings.length} issue(s):`));
  const decisions = await reviewFindings(findings);

  const criticalRejected = decisions.some((d) => !d.accepted && d.finding.severity === "critical");
  if (criticalRejected) {
    console.log(
      chalk.red.bold(
        "\n✗ BLOCKED — a critical-severity finding was rejected. Push blocked regardless of other accepted fixes."
      )
    );
    let retainedAny = false;
    for (const d of decisions.filter((d) => !d.accepted)) {
      const ok = await retain({
        bankId: config.bank_id,
        repoName,
        file: d.finding.file,
        issue: d.finding.issue,
        severity: d.finding.severity,
        action: "blocked",
        decision: "rejected",
        testOutcome: "untested",
        pushOutcome: "push_blocked",
        envVarName: d.finding.envVarName,
        originalLine: d.finding.originalLine,
        proposedFix: d.finding.proposedFix,
        timestamp: new Date().toISOString(),
      });
      if (ok) retainedAny = true;
    }
    if (retainedAny) {
      console.log(chalk.green("✓ Security decision remembered by Hindsight"));
    }
    await reportScanToCloud(config, repoName, decisions.map(d => ({ ...d.finding, action: d.accepted ? "fixed" : "blocked" })), true, startTime);
    process.exit(1);
  }

  const acceptedCount = decisions.filter((d) => d.accepted).length;
  if (acceptedCount === 0) {
    console.log(chalk.yellow("\nNo fixes accepted — nothing to apply."));
    console.log(chalk.gray("Running tests..."));
    const noFixResult = await runTests(config.test_command, repoRoot);

    let retainedAny = false;
    for (const d of decisions) {
      const ok = await retain({
        bankId: config.bank_id,
        repoName,
        file: d.finding.file,
        issue: d.finding.issue,
        severity: d.finding.severity,
        action: "rejected",
        decision: "rejected",
        testOutcome: noFixResult.passed ? "tests_passed" : "tests_failed",
        pushOutcome: noFixResult.passed ? "push_allowed" : "push_blocked",
        envVarName: d.finding.envVarName,
        originalLine: d.finding.originalLine,
        proposedFix: d.finding.proposedFix,
        timestamp: new Date().toISOString(),
      });
      if (ok) retainedAny = true;
    }
    if (retainedAny) {
      console.log(chalk.green("✓ Security decision remembered by Hindsight"));
    }

    if (noFixResult.passed) {
      console.log(chalk.green("✓ Tests passed → push allowed."));
      await reportScanToCloud(config, repoName, decisions.map(d => ({ ...d.finding, action: "rejected" })), false, startTime);
      process.exit(0);
    } else {
      console.log(chalk.red("✗ Tests FAILED — push BLOCKED. Nothing reaches GitHub."));
      console.log(chalk.gray(noFixResult.output));
      await reportScanToCloud(config, repoName, decisions.map(d => ({ ...d.finding, action: "rejected" })), true, startTime);
      process.exit(1);
    }
  }

  console.log(chalk.gray("\nApplying accepted fixes..."));
  const modifiedFiles = await applyAcceptedFixes(decisions, repoRoot, config.thresholds.file_shrink_max_pct);

  const git2 = simpleGit(repoRoot);
  await git2.add(".");
  await git2.raw(["commit", "--amend", "--no-edit", "--allow-empty"]);
  console.log(chalk.green("✓ Committed accepted fixes (amended)."));
  // NOTE: This simple --amend approach only works cleanly when the secret was introduced in the 
  // single most recent unpushed commit. Handling older unpushed commits requires a scripted 
  // interactive rebase, which is explicitly out of scope for the hackathon MVP.

  // Reference index update — imports/calls may have shifted in modified files.
  const updatedIndex = await updateIndex(index, modifiedFiles, repoRoot);
  await saveIndex(repoRoot, updatedIndex);

  console.log(chalk.gray("\nRunning tests..."));
  const result = await runTests(config.test_command, repoRoot);

  let retainedAny = false;
  for (const d of decisions) {
    const ok = await retain({
      bankId: config.bank_id,
      repoName,
      file: d.finding.file,
      issue: d.finding.issue,
      severity: d.finding.severity,
      action: d.accepted ? (result.passed ? "fixed" : "blocked") : "rejected",
      decision: d.accepted ? "accepted" : "rejected",
      testOutcome: result.passed ? "tests_passed" : "tests_failed",
      pushOutcome: result.passed ? "push_allowed" : "push_blocked",
      envVarName: d.finding.envVarName,
      originalLine: d.finding.originalLine,
      proposedFix: d.finding.proposedFix,
      timestamp: new Date().toISOString(),
    });
    if (ok) retainedAny = true;
  }
  if (retainedAny) {
    console.log(chalk.green("✓ Security decision remembered by Hindsight"));
  }

  if (result.passed) {
    console.log(chalk.green("✓ Tests passed → push allowed."));
    await reportScanToCloud(config, repoName, decisions.map(d => ({ ...d.finding, action: d.accepted ? "fixed" : "rejected" })), false, startTime);
    process.exit(0);
  } else {
    console.log(chalk.red("✗ Tests FAILED — push BLOCKED. Nothing reaches GitHub."));
    console.log(chalk.gray(result.output));
    await reportScanToCloud(config, repoName, decisions.map(d => ({ ...d.finding, action: d.accepted ? "blocked" : "rejected" })), true, startTime);
    process.exit(1);
  }
}
