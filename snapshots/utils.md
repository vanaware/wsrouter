> **AI INSTRUCTION:** 
> The text below contains the code of the @vanaware/buildit library
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project WorkerDB - Mode: UTILS

Automatically generated at: 2026-10-24T20:20:08.355Z

---

## File: `scripts/export.jsonc`

```json
{
  "$schema": "https://vanaware.github.io/buildit/schema/export.json",
  "project": "WorkerDB",
  "modes": {
    "example": {
      "outputFile": "snapshots/example.md",
      "includes": [
        "example/**/*.{tsx,jsx,js,ts,css,html,manifest,json,jsonc,md}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "includeVersion": true,
      "customInstruction": "The text below contains the main SOURCE CODE files of the example application (example).",
      "default": true
    },
    "docs": {
      "outputFile": "snapshots/docs.md",
      "includes": [
        "docs/**/*.{md,txt}",
        "{README.md,LICENSE,.tool-versions,CHANGELOG.md}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "includeVersion": false,
      "customInstruction": "The text below contains the project DOCUMENTATION and architectural guidelines.",
      "default": true
    },
    "server": {
      "outputFile": "snapshots/server.md",
      "includes": [
        "{src,tests}/**/*.{tsx,jsx,js,ts,css,html,json,jsonc,yaml,yml,md}",
        "{deno.json,deno.jsonc,README.md,.env.example,.tools-versions,CHANGELOG.md}",
        ".github/workflows/**/*.{yaml,yml}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "includeVersion": true,
      "customInstruction": "The text below contains the configuration and runtime files of WSROUTER @vanaware/wsrouter and CI/CD.",
      "default": true
    },
    "utils": {
      "outputFile": "snapshots/utils.md",
      "includes": [
        "scripts/**/*.{ts,jsonc}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "includeVersion": false,
      "customInstruction": "The text below contains the code of the @vanaware/buildit library",
      "default": true
    }
  }
}

```

---

## File: `scripts/export.ts`

```ts
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

```

---

## File: `scripts/sanitize-version.ts`

```ts
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

```

---

## File: `scripts/tag-version.ts`

```ts
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

```

---

## File: `scripts/update-version.ts`

```ts
import {
    ensureVersionFiles,
    processFilesWithDefines,
    readProjectVersion,
    incrementProjectVersion
} from "@vanaware/buildit"
import { join } from "@std/path/join";

async function newProjectVersion(denoJsonPath : string, baseDir: string) { 
    return incrementProjectVersion({
        denoJsonPath,
        baseDir
    });
}
async function syncVersionFiles() {
    const baseDir = "./"
    const fileList = [
            "src/version.ts",
            "example/version.ts",
            "example/public/version.js"
        ]
    for (const file of fileList) {
        try {
            await Deno.remove(join(baseDir, file));
            console.log(`✅ File deleted ${join(baseDir, file)}`);
        } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
                console.log(`✅ Skipped (does not exist) ${join(baseDir, file)}`);
            } else {
                throw err; // any other error must interrupt
            }
        }
    }
    const files = await ensureVersionFiles(
        fileList,
        baseDir,
        "__APP_VERSION__"
    );
    const version = await newProjectVersion("deno.jsonc",baseDir)
    console.log(`\n📦 Syncing version "${version}" across ${files.length} file(s)...\n`);
    const results = await processFilesWithDefines(
        files,
        {
            "__APP_VERSION__": JSON.stringify(version),
        },
    );
    for (const path of files) {
        console.log(`✅ processed  ${path}`);
    }
    console.log(`\n🎉 Done: ${files.length} file(s) synced to v${version}.\n`);
}


if (import.meta.main) {
    try {
        await syncVersionFiles();
    } catch (err) {
        console.error("❌ Failed to sync version:", err);
        Deno.exit(1);
    }
}
```

---

