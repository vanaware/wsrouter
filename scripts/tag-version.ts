/// <reference lib="deno.ns" />

/**
 * @file tag-version.ts
 * @description CLI to create and publish a git tag based on the deno.json[c] version.
 * Generates tags in the vMAJOR.MINOR format and pushes them to the remote repository.
 */

import { tagVersionCli, }  from "@vanaware/buildit/cli/tag-version";

if (import.meta.main) {
  const cli = tagVersionCli();
  await cli.parse(Deno.args,);
}
