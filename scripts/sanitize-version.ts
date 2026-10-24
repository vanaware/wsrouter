/// <reference lib="deno.ns" />

/**
 * @file sanitize-version.ts
 * @description Semantic version sanitization CLI for deno.json[c].
 * Normalizes the "version" field to the strict semver format (MAJOR.MINOR.PATCH).
 */

import { sanitizeVersionCli, } from "@vanaware/buildit/cli/sanitize-version";

if (import.meta.main) {
  const cli = sanitizeVersionCli();
  await cli.parse(Deno.args,);
}
