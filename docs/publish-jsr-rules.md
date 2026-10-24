# Documentation and JSR Publishing Guidelines

> **Note for AI Agents:** This document defines the mandatory standards for documentation (README.md and JSDoc) and the `deno.json` configuration rules for publishing to JSR. Follow these guidelines rigorously when generating or refactoring code in this repository.

---

## 📌 Table of Contents

1. [Overview](#-overview)
2. [README.md Standards](#-readmemd-standards)
3. [JSDoc Comment Standards](#-jsdoc-comment-standards)
4. [Usage and Quality Recommendations](#-usage-and-quality-recommendations)
5. [`publish: false` Configuration in Workspaces](#-publish-false-configuration-in-workspaces)
6. [`publish.include` and `publish.exclude` Configuration](#-publishinclude-and-publishexclude-configuration)
7. [Pre-Publish Checklist](#-pre-publish-checklist)

---

## 🎯 Overview

Every package published to JSR must have **two documentation layers**:

| Layer | File/Location | Purpose | Target Audience |
| :--- | :--- | :--- | :--- |
| **Quick Guide** | `README.md` at the root | Explain *why* to use the package and how to get started. | Developers evaluating whether to adopt the package. |
| **API Reference** | JSDoc comments in the code | Document *how* to use each exported symbol. | Developers already using the package. |

Both layers directly impact the **JSR quality score** and the end-user experience (including editor autocompletion).

---

## 📝 README.md Standards

### Location and Format
- **File:** `README.md` 
- **Location:** Mandatory, at the package root. It is not the same README as the workspace root — each package to be published needs its own README.
- **Syntax:** Standard Markdown (GFM - GitHub Flavored Markdown).
- **Language:** English (maintain consistency and use the same language across all documentation to be published).

### Mandatory Structure

The README **must** contain, at minimum, the following sections in this order:

1. **Title** (`# Package Name`) — use the real package name, without the scope.
2. **Short description** — one or two sentences explaining what the package does.
3. **Installation** — code block with the `deno add` command.
4. **Basic Usage** — a functional code block showing import + real usage is **mandatory**.
5. **Documentation** — link to the package page on JSR (API reference).

### Recommended Structure (Additional)

- **Features** — bullet list of the main capabilities.
- **API Overview** — table or list of the main exports.
- **Advanced Examples** — use cases beyond "hello world".

### Template Example

````markdown
# package-name

A brief one- or two-sentence description of what this package does.

## Installation

```bash
deno add jsr:@your-scope/package-name
```

## Usage

```ts
import { mainFunction } from "jsr:@your-scope/package-name";

const result = mainFunction({ option: "value" });
console.log(result);
```

## Features

- ✅ Feature A
- ✅ Feature B
- ✅ Feature C

## Documentation

For the complete API reference, visit the
[package page on JSR](https://jsr.io/@vanaware/package-name).

````

### ⚠️ Critical Rules
- **NEVER** leave the README empty or with only the title.
- **ALWAYS** include a code block in the README — JSR uses it to score the package.
- **DO NOT** duplicate all JSDoc documentation here; the README is an overview, not a reference.

---

## 📚 JSDoc Comment Standards

### General Rules
- **Location:** Immediately above **every exported symbol** (function, class, interface, type, constant).
- **Syntax:** `/** ... */` block with each inner line starting with `*`.
- **Language:** Keep the same language as the README.
- **Requirement:** Every `export` **must** have JSDoc. No exceptions.

### Block Structure

1. **Summary** (first line) — short, imperative sentence. Appears in editor tooltips.
2. **Detailed description** (optional) — additional paragraph(s) with context.
3. **Tags** — in order: `@param`, `@returns`, `@throws`, `@example`, `@see`.
4. **Example** — whenever the function is not trivial.

### Complete Example — Function

````ts
/**
 * Searches records in the database using the provided query.
 *
 * Performs input normalization and applies a default limit when none
 * is specified, avoiding overload from very broad queries.
 *
 * @param query - Textual query. Must be between 1 and 50 characters.
 * @param limit - Maximum number of items to return. Default: `20`.
 * @returns Array with the found records. Empty if nothing matches.
 * @throws {Error} If `query` is empty or exceeds 50 characters.
 *
 * @example
 * ```ts
 * const results = search("Deno");
 * console.log(results); // ["Deno", "Deno Deploy"]
 * ```
 *
 * @see {@link normalizeQuery} for normalization details.
 */
export function search(query: string, limit: number = 20): string[] {
  // ...
}
````

### Complete Example — Interface / Type

````ts
/**
 * Options accepted by the HTTP client.
 */
export interface ClientOptions {
  /** Base URL for all requests. */
  baseUrl: string;

  /** Timeout in milliseconds. Default: `5000`. */
  timeout?: number;

  /** Additional headers sent with every request. */
  headers?: Record<string, string>;
}
````

### Complete Example — Class

````ts
/**
 * Lightweight HTTP client with automatic retry support.
 *
 * @example
 * ```ts
 * const client = new Client({ baseUrl: "https://api.example.com" });
 * const data = await client.get("/users");
 * ```
 */
export class Client {
  /**
   * Creates a new client instance.
   *
   * @param options - Client configuration.
   */
  constructor(options: ClientOptions) {
    // ...
  }

  /**
   * Performs a GET request.
   *
   * @param path - Path relative to `baseUrl`.
   * @returns Response parsed as JSON.
   */
  async get<T>(path: string): Promise<T> {
    // ...
  }
}
````

### Supported Tags and When to Use Them

| Tag | Usage |
| :--- | :--- |
| `@param` | Describe **each** parameter. Use `-` after the name. |
| `@returns` | Describe the return value (omit only for `void`). |
| `@throws` | Types and conditions of thrown errors. |
| `@example` | Executable code block. Always inside ` ```ts ` fences. |
| `@see` | Cross reference. Combine with `{@link Symbol}`. |
| `@deprecated` | Mark obsolete symbols and indicate the replacement. |
| `@since` | Version in which the symbol was introduced. |

### Internal Links
Use `{@link <Symbol>}` to create clickable links between symbols in the generated documentation:

```ts
/**
 * Shortcut for {@link Client.get} with a custom timeout.
 */
export function quickGet(path: string) { /* ... */ }
```

### ⚠️ Critical Rules
- **DO NOT** use JSDoc for internal line comments — use `//`.
- **DO NOT** document non-exported symbols (unless they are useful for context).
- **ALWAYS** place `@example` **after** `@returns`/`@throws`.
- **NEVER** write "TODO" inside JSDoc; use regular comments.

---

## ✅ Usage and Quality Recommendations

1. **README and JSDoc are complementary** — one never replaces the other.
2. **Write real examples** — avoid `foo`/`bar`; use names that reflect the domain.
3. **Keep the README short** — if it exceeds ~150 lines, create a `docs/` folder inside the package directory.
4. **Validate before committing:**
   ```bash
   deno doc --lint mod.ts
   ```
   This flags exports without JSDoc and malformed tags.
5. **Validate before publishing:**
   ```bash
   deno publish --dry-run
   ```
   Inspect the output to confirm only the intended files will be uploaded.
6. **Update the JSDoc when refactoring** — never let documentation diverge from the code.
7. **Use `@deprecated`** instead of abruptly removing symbols — break consumers with a warning.

---

## 🏢 `publish: false` Configuration in Workspaces

In a **Deno workspace** (defined by `workspace` in the root `deno.json`), the `deno publish` command attempts to publish **every member** that has `name` and `exports`.

To **exclude an internal member** (shared utility packages, build tooling, etc.), set `"publish": false` in that member's `deno.json`.

### Actual Structure in WorkerDB

In the WorkerDB monorepo, we have multiple published packages and application/internal-infrastructure packages:

```
/
├── deno.jsonc                 # root workspace
├── packages/
│   ├── worker-db/             # published to JSR as @vanaware/workerdb
│   │   └── deno.jsonc
│   ├── service-worker/        # published to JSR as @vanaware/opfs-explorer
│   │   └── deno.jsonc
│   ├── ui/                    # frontend app (publish: false)
│   │   └── deno.jsonc
│   ├── server/                # Deno dev/prod server (publish: false)
│   │   └── deno.jsonc
│   └── utils/                 # bundling/build scripts (publish: false)
│       └── deno.jsonc
```

The CI/CD workflow in `.github/workflows/jsr-publish.yml` runs the automated publish matrix for `packages/worker-db` and `packages/service-worker`.

### Generic Example Structure

```
/
├── deno.json              # root workspace
├── packages/
│   ├── core/
│   │   └── deno.json      # published to JSR
│   ├── utils-internal/
│   │   └── deno.json      # NOT published
│   └── cli/
│       └── deno.json      # published to JSR
```

### Root `deno.json` (workspace)

```json
{
  "workspace": [
    "./packages/core",
    "./packages/utils-internal",
    "./packages/cli"
  ]
}
```

### `packages/core/deno.json` (published)

```json
{
  "name": "@your-scope/core",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT"
}
```
> **Important:** If the `license` and `version` fields are not configured in the package's `deno.jsonc` (or `deno.json`), set them to the same values found in the workspace root `deno.jsonc`.

### `packages/utils-internal/deno.json` (NOT published)

```json
{
  "name": "@your-scope/utils-internal",
  "version": "0.0.0",
  "exports": "./mod.ts",
  "publish": false
}
```

> **Important:** Even with `publish: false`, the package can still be imported by other workspace members via `jsr:@your-scope/utils-internal` during development. It simply will not be uploaded to the registry.

> **Fundamental rule:** If any function from a package that will not be published is in use by a package that will be published, the developer must be alerted and a BUG document must be created listing all affected functions, which must be analyzed and properly handled before the package is published.

---

## 🗂️ `publish.include` and `publish.exclude` Configuration

### Basic Rules
- Patterns are evaluated **relative to the package root** (where the `deno.json` of the package to be published lives).
- Use **POSIX globs** with `/` as the separator (works on Windows too).
- **`publish.include`** — whitelist. If set, **only** matching files are published.
- **`publish.exclude`** — blacklist. Applied **after** `include`.
- If only `exclude` is defined, everything is included by default and then filtered.
- **NEVER** put `deno.json` in `exclude` — it is always published automatically.

### Recommended Globs

#### Include only publishable source code

```json
{
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ]
  }
}
```

#### Exclude development files

```json
{
  "publish": {
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "tests/",
      "test/",
      "bench/",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "TODO.md",
      "CHANGELOG.md",
      ".github/",
      "*.config.ts",
      "build.ts",
      "bundle.ts",
      "deploy.ts",
      "deno.lock",
      ".gitignore"
    ]
  }
}
```

### Recommended Combination (Include + Exclude)

The safest approach is to **combine both**: a restrictive `include` that defines what is code, and an `exclude` to sweep leftovers.

```json
{
  "name": "@your-scope/your-package",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT",
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ],
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "src/**/__mocks__/**",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "CHANGELOG.md",
      ".github/"
    ]
  }
}
```

### Decision Map: Include or Exclude?

| File/Folder | Action | Rationale |
| :--- | :--- | :--- |
| `src/**/*.ts` | ✅ Include | Main source code. |
| `mod.ts` | ✅ Include | Main entry point. |
| `README.md` | ✅ Include | Displayed on JSR. |
| `**/*_test.ts` | ❌ Exclude | Tests do not go to the registry. |
| `tests/`, `test/` | ❌ Exclude | Same. |
| `examples/` | ❌ Exclude | Large or non-API examples. |
| `scripts/` | ❌ Exclude | Build/deploy scripts. |
| `build.ts`, `bundle.ts`, `deploy.ts` | ❌ Exclude | Dev tooling. |
| `docs/` | ❌ Excluding the root docs; the package subset may be included | Extended documentation at the workspace root stays in the repo; a reduced essential documentation for the package may be included. |
| `planning/` | ❌ Exclude | Internal planning. |
| `AGENTS.md`, `CURRENT.md` | ❌ Exclude | Metadata for AI agents. |
| `CHANGELOG.md` | ⚠️ Exclude | Useful for consumers, but increases package size. |
| `deno.lock` | ❌ Exclude | Rebuilt by the consumer. |
| `.github/` | ❌ Exclude | CI/CD. |
| `deno.json` | 🚫 Never list | Always published automatically. |

### Reference Glob Patterns

| Pattern | Matches |
| :--- | :--- |
| `src/**/*.ts` | All `.ts` files in `src/` recursively. |
| `**/*_test.ts` | Any file ending in `_test.ts`. |
| `**/*.test.ts` | Any file ending in `.test.ts`. |
| `test/` | The entire `test/` directory. |
| `**/__mocks__/**` | Any `__mocks__` directory at any level. |
| `scripts/**` | Everything inside `scripts/`. |
| `*.config.ts` | `.config.ts` files at the root. |

### ⚠️ Common Mistakes to Avoid
- **Do not** use `./` at the beginning of patterns (`"./src/**"` ❌ → `"src/**"` ✅).
- **Do not** use `\` as a separator — always `/`.
- **Do not** put `deno.json` in `exclude` — it breaks publishing.
- **Do not** use contradictory `include` and `exclude` (e.g. include `src/**` and exclude `src/`).
- **Always** validate with `deno publish --dry-run` before actually publishing.

---

## ✅ Pre-Publish Checklist

Run in order:

- [ ] `deno fmt --check` — consistent formatting.
- [ ] `deno lint` — no warnings.
- [ ] `deno check mod.ts` — no type errors.
- [ ] `deno test` — all tests passing.
- [ ] `deno doc --lint mod.ts` — no exports without JSDoc.
- [ ] `README.md` reviewed and containing an example code block.
- [ ] `deno.jsonc` with correct `name`, `version`, `exports`, `license`.
- [ ] `publish.include` and `publish.exclude` reviewed.
- [ ] `deno publish --dry-run` — inspect the listed files.
- [ ] Version incremented per SemVer; we have a sanitization script to be run before publishing.
- [ ] `deno publish` — actually publish.

---

## 📎 References

- [Official JSR documentation](https://jsr.io/docs)
- [Writing documentation for JSR](https://jsr.io/docs/writing-docs)
- [`deno.jsonc` configuration](https://docs.deno.com/runtime/fundamentals/configuration/)
- [Globs in Deno](https://docs.deno.com/runtime/fundamentals/configuration/#glob-patterns)
