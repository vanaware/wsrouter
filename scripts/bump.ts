#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write
/**
 * @file bump.ts
 * @description Pure TypeScript script for bumping versions in deno.jsonc (and package.json), updating CHANGELOG.md, and tagging releases.
 */

import { parseArgs } from "@std/cli/parse-args";

console.log("🚀 Running bump task...");

const args = parseArgs(Deno.args, {
  boolean: ["major", "minor", "patch", "help"],
  default: { patch: true },
});

if (args.help) {
  console.log("Usage: deno task bump [--major] [--minor] [--patch]");
  console.log("Options:");
  console.log("  --major  Increment major version");
  console.log("  --minor  Increment minor version");
  console.log("  --patch  Increment patch version (default)");
  Deno.exit(0);
}

async function runCmd(cmd: string[], allowFail = false): Promise<{ success: boolean; output: string }> {
  const binary = cmd[0];
  if (!binary) return { success: false, output: "" };
  try {
    const command = new Deno.Command(binary, {
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
    const result = await command.output();
    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    if (!result.success && !allowFail) {
      console.error(`❌ Command failed: ${cmd.join(" ")}\n${stderr}`);
      Deno.exit(1);
    }
    return { success: result.success, output: stdout.trim() };
  } catch (err) {
    if (!allowFail) {
      console.error(`❌ Failed to execute command ${cmd.join(" ")}:`, err);
      Deno.exit(1);
    }
    return { success: false, output: "" };
  }
}

console.log("🔍 Running verification checks (check, lint, fmt, test)...");
await runCmd(["deno", "task", "check-all"]);

// Read current version from deno.jsonc or deno.json
const configFile = (await Deno.stat("deno.jsonc").catch(() => null)) ? "deno.jsonc" : "deno.json";
const configRaw = await Deno.readTextFile(configFile);
const configData = JSON.parse(configRaw);
const currentVersion: string = configData.version || "0.1.0";

const parts = currentVersion
  .replace(/^v/, "")
  .split(".")
  .map(Number);
let major = parts[0] ?? 0;
let minor = parts[1] ?? 1;
let patch = parts[2] ?? 0;

if (args.major) {
  major += 1;
  minor = 0;
  patch = 0;
} else if (args.minor) {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`📦 Bumping version: v${currentVersion} ➔ v${newVersion}`);

// 1. Update deno.jsonc / deno.json
configData.version = newVersion;
await Deno.writeTextFile(configFile, JSON.stringify(configData, null, 2) + "\n");

// 2. Keep VERSION file in sync if it exists
try {
  await Deno.writeTextFile("VERSION", newVersion + "\n");
} catch {
  // Ignore if VERSION was removed
}

// 3. Keep package.json bridge in sync if present
try {
  const pkgRaw = await Deno.readTextFile("package.json");
  const pkgData = JSON.parse(pkgRaw);
  pkgData.version = newVersion;
  await Deno.writeTextFile("package.json", JSON.stringify(pkgData, null, 2) + "\n");
} catch {
  // Ignore if package.json not present
}

// 4. Generate CHANGELOG entry if git is available
const gitLogResult = await runCmd(
  ["git", "log", "--pretty=format:%h %s", `v${currentVersion}..HEAD`],
  true,
);

const logOutput = gitLogResult.output;
const changelog = `## v${newVersion} (${new Date().toISOString().slice(0, 10)})\n\n${
  logOutput.trim()
    ? logOutput.split("\n").map((line) => "- " + line).join("\n")
    : "- Architectural enhancements and documentation update"
}`;

const changelogHeader = await Deno.readTextFile("CHANGELOG.md").catch(() => "");
await Deno.writeTextFile("CHANGELOG.md", `${changelog}\n\n${changelogHeader}`);

// 5. Format updated files
await runCmd(["deno", "fmt"]);

// 6. Commit and tag if git repository exists
const gitCheck = await runCmd(["git", "rev-parse", "--is-inside-work-tree"], true);
if (gitCheck.success) {
  await runCmd(["git", "add", "."]);
  await runCmd(["git", "commit", "-m", `release: v${newVersion}`], true);
  await runCmd(["git", "tag", `v${newVersion}`], true);
  console.log(`🏷️ Git tag v${newVersion} created.`);
}

console.log(`✅ Version successfully updated to v${newVersion}!`);
