/// <reference lib="deno.ns" />

/**
 * @file export.ts
 * @description Context consolidation CLI for AIs in the BuildIt project.
 * Delegates execution and rules to the @vanaware/buildit library
 * and loads the declarative settings from export.jsonc.
 */

import { exportCli, } from "@vanaware/buildit/cli/export";

if (import.meta.main) {
  const cli = exportCli();
  await cli.parse(Deno.args,);
}
