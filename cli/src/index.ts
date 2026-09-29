#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// Load environment variables with fallback hierarchy:
// 1. Repo-level .env (current working directory)
dotenv.config();

// 2. Global user ~/.securepush/.env
const userGlobalEnv = path.join(os.homedir(), ".securepush", ".env");
if (fs.existsSync(userGlobalEnv)) {
  dotenv.config({ path: userGlobalEnv });
}

// 3. CLI root .env (for linked development CLI)
const cliBundleEnv = path.resolve(__dirname, "../.env");
if (fs.existsSync(cliBundleEnv)) {
  dotenv.config({ path: cliBundleEnv });
}
import { Command } from "commander";
import { init } from "./commands/init";
import { verify } from "./commands/verify";

const program = new Command();

program
  .name("securepush")
  .description("Git pre-push hook for AI-written code — verifies AI-agent-generated diffs before they leave your machine.");

program
  .command("init")
  .description("Install the pre-push hook, choose a provider, and build the baseline reference index for this repo.")
  .action(init);

program
  .command("verify")
  .description("Run the scan/review/fix/test/push pipeline. Normally invoked automatically by the pre-push hook, not run directly.")
  .action(verify);

import { login } from "./commands/login";
import { config } from "./commands/config";

program
  .command("login")
  .description("Link this CLI to a SecurePush Cloud account.")
  .action(login);

program
  .command("config")
  .description("Edit an existing .securepush.yml without running a full init scan.")
  .action(config);

program.parse(process.argv);
