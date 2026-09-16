#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env
/**
 * @file publish.ts
 * @description Pure TypeScript script for validating and publishing the package to JSR.
 */

console.log("🔍 Running full verification suite before publication...");
const testCmd = new Deno.Command("deno", {
  args: ["task", "check-all"],
  stdout: "inherit",
  stderr: "inherit",
});
const testStatus = await testCmd.spawn().status;
if (!testStatus.success) {
  console.error("❌ Pre-publish checks failed! Aborting publication.");
  Deno.exit(1);
}

console.log("📦 Publishing package to JSR (jsr publish)...");
const publishCmd = new Deno.Command("deno", {
  args: ["publish", ...Deno.args],
  stdout: "inherit",
  stderr: "inherit",
});
const publishStatus = await publishCmd.spawn().status;

if (publishStatus.success) {
  console.log("✅ Successfully published to JSR!");
} else {
  console.error("❌ JSR publication encountered errors.");
  Deno.exit(publishStatus.code);
}
