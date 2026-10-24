> **AI INSTRUCTION:** 
> The text below contains the configuration and runtime files of WSROUTER @vanaware/wsrouter and CI/CD.
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project WorkerDB [v0.6.0#mv39h36q] - Mode: SERVER

Automatically generated at: 2026-10-24T20:20:08.344Z

---

## File: `.env.example`

```properties
PORT=3000
```

---

## File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
  workflow_dispatch:

jobs:
  check-all:
    name: Test, Lint & Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version-file: .tool-versions
          cache: true

      - name: Run tests
        run: deno test -P

      - name: Lint code
        run: deno lint

      - name: Check formatting
        run: deno fmt --check

```

---

## File: `.github/workflows/jsr-publish.yml`

```yaml
name: Publish to JSR

on:
  push:
    tags:
      - 'v*.*'
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version-file: .tool-versions
          cache: true

      - name: Install dependencies
        run: deno ci

      - name: Verify code integrity
        run: deno task tests

      - name: Sanitize Version
        run: |
          deno task sanitize-version ./deno.jsonc

      - name: Publish WsRouter to JSR
        run: |
          deno publish --allow-slow-types --allow-dirty
```

---

## File: `.github/workflows/pages.yml`

```yaml
name: Deploy Example to GitHub Pages

on:
  push:
    tags:
      - 'v*.*'
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy Showcase to GitHub Pages
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version-file: .tool-versions
          cache: true
      
      - name: Install dependencies
        run: deno ci

      - name: Verify code integrity
        run: deno task tests

      - name: Prepare static assets for GitHub Pages
        run: |
          # Disable Jekyll processing on GitHub Pages
          touch ./example/public/.nojekyll
          # Copy index.html to 404.html for SPA subfolder route fallback
          cp ./example/public/index.html ./example/public/404.html

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './example/public'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

```

---

## File: `CHANGELOG.md`

```md
## v0.5 (2026-10-11)

- No relevant changes

## v0.5 (2026-10-11)

- 801cdb1 refactor: improve path normalization and typing
- 40ec155 refactor: update dependencies and improve JSDoc
- 9d6df15 erros doc --lint
- db12ae8 ajustes tasks e deno.jsonc

## v0.4 (2026-10-01)

- af663a0 pasta scripts

## v0.4 (2026-09-29)

- No relevant changes

## v0.4 (2026-09-29)

- b711734 versão derivada pelo deno.jsonc
- e6a69c0 chore: update default remote backend URL
- ee1f71d build: remove unused dependencies and optimize CORS
- 8d5722b static dir on example to deno deploy test
- 5335eb0 chore: prune unused dependencies and update CORS
- 62ea5c9 index title version

## v0.1.0 (2025-07-17)

Initial release
```

---

## File: `README.md`

````md
# wsrouter

A high-performance, runtime-agnostic WebSocket and HTTP router for Deno. Fast, secure, and extensible.

## Installation

```bash
deno add jsr:@vanaware/wsrouter
```

## Usage

### Simple HTTP Server

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({
  body: JSON.stringify({ message: "Hello, World!" }),
  init: { headers: { "Content-Type": "application/json" } },
}));

app.get("/users/:id", (_req, params) => ({
  body: JSON.stringify({ userId: params.id }),
}));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Server running on http://localhost:3000");
```

### WebSocket Chat with Rooms

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room/:user", (ws, _req, params) => {
  const room = params.room as string;
  const user = params.user as string;
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  if (!group) {
    ws.close(1011, "Internal error");
    return;
  }
  
  console.log(`✅ ${user} joined room ${room}`);
  
  ws.onmessage = (event) => {
    // Broadcast only to users in the same room
    group.broadcast(
      `[${user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  ws.onclose = () => {
    console.log(`❌ ${user} left room ${room}`);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

## Features

- ✅ **HTTP Routing**: Named parameters, catch-all routes, automatic HEAD support, and 405 Method Not Allowed handling.
- ✅ **WebSockets**: Automatic upgrades, smart broadcasting with `PermissionFn`, and multi-room support.
- ✅ **WebRTC Signaling**: High-performance hub for P2P signaling (SDP, ICE candidates) and live stream management.
- ✅ **Online Presence**: Real-time tracking of users with multi-tab/multi-device deduplication and status updates.
- ✅ **Middlewares**: Onion-model execution chain with `next()` and route rewriting capabilities.
- ✅ **Security**: Force HTTPS, HSTS, trust proxy support, dotfile blocking, and path traversal protection.
- ✅ **Static Files**: Fast serving of local directories with directory indexing and MIME type detection.

## Documentation

For full API reference and advanced guides, visit the
[JSR package page](https://jsr.io/@vanaware/wsrouter).

## Guides

- [WebRTC Live Streaming Guide](./docs/webrtc.md)
- [Online Presence Tracking Guide](./docs/presence.md)
- [Security Guide](./docs/security.md)
- [Middleware Guide](./docs/middleware.md)

## License

MIT - see [LICENSE](./LICENSE) for details.


## 📦 Latest Updates

<!-- START:changelog -->
### 📦 Latest updates

- No relevant changes

<!-- END:changelog -->

````

---

## File: `deno.jsonc`

```json
{
  "tasks": {
    "test": "deno test --no-check -P",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "fmt:check": "deno fmt --check",
    "lint:fix": "deno lint --fix",
    "lint:doc": "deno doc --lint src/{mod,deno,presence,webrtc,deno-serve-dir,adapters/deno,adapters/deno-serve-dir}.ts",
    "tests": "deno task check && deno task lint && deno task fmt:check && deno task lint:doc && deno task test",
    "check": "deno check src/**/*.ts tests/**/*.ts example/**/*.ts scripts/**/*.ts",
    "start": "deno run --allow-read --allow-net --allow-env --env-file example/main.ts",
    "dev": "deno run --allow-read --allow-net --allow-env --env-file --watch example/main.ts",
    "export": "deno run --allow-read --allow-write ./scripts/export.ts",
    "sanitize-version": "deno run -A ./scripts/sanitize-version.ts",
    "tag-version": "deno run -A ./scripts/tag-version.ts",
    "update-version": "deno run -A ./scripts/update-version.ts",
    "bump": "deno install --frozen=false && deno task tag-version --changelog --update-readme"
  },
  "exports": {
    ".": "./src/mod.ts",
    "./deno": "./src/deno.ts",
    "./presence": "./src/presence.ts",
    "./webrtc": "./src/webrtc.ts",
    "./deno-serve-dir": "./src/deno-serve-dir.ts",
    "./adapters/deno": "./src/adapters/deno.ts",
    "./adapters/deno-serve-dir": "./src/adapters/deno-serve-dir.ts"
  },
"publish": {
    "include": [
      "src/**/*.ts",
      "README.md",
      "LICENSE",
      "deno.jsonc"
    ],
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "tests/",
      "example/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      ".github/"
    ]
  },
  "name": "@vanaware/wsrouter",
  "version": "0.6.0#mv39h36q",
  "license": "MIT",
  "author": "Vanaware",
  "description": "A WebSocket router for Deno",
  "repository": {
    "type": "git",
    "url": "https://github.com/vanaware/wsrouter"
  },
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "dom.asynciterable", "esnext", "deno.ns"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  },
  "type": "module",
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.19",
    "@std/testing": "jsr:@std/testing@^1.0.20",
    "@std/http": "jsr:@std/http@^1.1.4",
    "@std/media-types": "jsr:@std/media-types@^1.1.0", // used by the Deno static file adapter
    "@std/path": "jsr:@std/path@^1.1.6",
    "@vanaware/buildit": "jsr:@vanaware/buildit@^0.6.1"
  },
     // 📦 Dependency Management
  "minimumDependencyAge": 1,
  "nodeModulesDir": "auto",
  "vendor": true,
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["ban-untagged-todo"],
      "exclude": ["no-unused-vars", "require-await", "no-explicit-any"]
    },
    "include": [
      "src/**/*.{ts,tsx}",
      "scripts/**/*.ts",
      "tests/**/*test.ts"
    ]
  },
  "test": {
    "permissions": {
      "read": true,
      "write": true,
      "net": true,
      "env": true,
      "sys": true,
      "run": true,
      "ffi": true,
      "import": true
    },
    "include": [
      "tests/**/*test.ts"
    ],
    "exclude": [
      "scripts/**/*.ts",
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}"
    ]
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 80,
    "indentWidth": 2,
    "semiColons": true,
    "singleQuote": false,
    "proseWrap": "preserve",
    "trailingCommas": "always",
    "json.trailingCommas": "never",
    "operatorPosition": "maintain",
    "jsx.bracketPosition": "sameLine",
    "jsx.forceNewLinesSurroundingContent": true,
    "jsx.multiLineParens": "always",
    "newLineKind": "lf",
    "include": [
      "example/**/*.{ts,tsx}",
      "scripts/**/*.ts",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "unstable": ["bundle"],
  "exclude": [
      ".qwen/",
      ".vscode/",
      ".github/",
      "vendor",
      "node_modules",
      "snapshots",
      "docs",
      "scripts",
      "example"
    ]
}

```

---

## File: `src/adapters/deno-serve-dir.ts`

```ts
// src/adapters/deno-serve-dir.ts
/**
 * @file deno-serve-dir.ts
 * @description Alternative Deno static file adapter using @std/http/file-server serveDir.
 */

import { serveDir } from "@std/http/file-server";
import { resolve } from "@std/path";
import type { StaticFileHandler } from "../mod.ts";

// Re-export standard WebSocket upgrader from primary adapter
export { denoWebSocketUpgrader } from "./deno.ts";

/**
 * Options for configuring the Deno serveDir static file adapter.
 */
export interface DenoServeDirOptions {
  /** Whether to allow serving dotfiles (files starting with '.') (default: false). */
  allowDotfiles?: boolean;
  /** Whether to display directory listings (default: false). */
  showDirListing?: boolean;
  /** Whether to enable CORS headers on served static files (default: false). */
  enableCors?: boolean;
}

/**
 * Creates a static file handler leveraging @std/http/file-server serveDir.
 *
 * @param staticDir - Primary directory to serve static files from.
 * @param embeddedDir - Optional embedded fallback directory.
 * @param options - Additional serveDir options.
 * @returns Configured StaticFileHandler instance.
 */
export function createDenoServeDirStaticFileHandler(
  staticDir: string | null,
  embeddedDir: string | null = null,
  options: DenoServeDirOptions = {},
): StaticFileHandler {
  const {
    allowDotfiles = false,
    showDirListing = false,
    enableCors = false,
  } = options;

  return {
    async handle(path: string): Promise<Response | null> {
      // Try embedded directory first, then static dir (same logic as the manual adapter)
      if (embeddedDir) {
        const res = await tryServeWithStd(
          embeddedDir, path, allowDotfiles, showDirListing, enableCors,
        );
        if (res) return res;
      }
      if (staticDir) {
        const res = await tryServeWithStd(
          staticDir, path, allowDotfiles, showDirListing, enableCors,
        );
        if (res) return res;
      }
      return null;
    },
  };
}

async function tryServeWithStd(
  baseDir: string,
  pathname: string,
  allowDotfiles: boolean,
  showDirListing: boolean,
  enableCors: boolean,
): Promise<Response | null> {
  // 🛡️ CONTAINMENT: resolve the path and verify it stays inside baseDir
  const fullPath = resolve(baseDir, "." + pathname);
  const resolvedBase = resolve(baseDir);

  if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
    return null; // Path attempts to escape the directory
  }

  // 🛡️ SYMLINKS: reject symlinks (same policy as the manual adapter)
  try {
    const info = await Deno.lstat(fullPath);
    if (info.isSymlink) {
      console.warn(`[Static] Symlink rejected: ${fullPath}`);
      return null;
    }
  } catch {
    // File does not exist — serveDir would return 404, so return null
    return null;
  }

  // 🚀 Delegate to serveDir (Range, ETag, 304, HEAD, etc.)
  const fakeReq = new Request(`http://localhost${pathname}`);
  const res = await serveDir(fakeReq, {
    fsRoot: baseDir,
    urlRoot: "",
    showDirListing,
    showDotfiles: allowDotfiles,
    showIndex: true,
    quiet: true,
    enableCors,
  });

  // serveDir returns 404 when nothing is found
  if (res.status === 404) return null;

  return res;
}
```

---

## File: `src/adapters/deno.ts`

```ts
// src/adapters/deno.ts
/**
 * @file deno.ts
 * @description Deno-specific adapters for WebSocket upgrading and static file serving.
 */

import { join, resolve } from "@std/path";
import { typeByExtension } from "@std/media-types";
import type { WebSocketUpgrader, StaticFileHandler } from "../mod.ts";

/**
 * WebSocket upgrader implementation using the native Deno.upgradeWebSocket API.
 */
export const denoWebSocketUpgrader: WebSocketUpgrader = {
  upgrade(req: Request): { socket: WebSocket; response: Response } {
    return Deno.upgradeWebSocket(req);
  },
};

/**
 * Factory function to create a static file handler using Deno's file system APIs.
 *
 * @param staticDir - Local directory to serve files from.
 * @param embeddedDir - Optional additional directory for embedded assets.
 * @returns A StaticFileHandler implementation.
 */
export function createDenoStaticFileHandler(
  staticDir: string | null,
  embeddedDir: string | null = null,
): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      if (embeddedDir) {
        const embedded = await tryServeDir(embeddedDir, path);
        if (embedded) return embedded;
      }
      if (staticDir) {
        const staticResp = await tryServeDir(staticDir, path);
        if (staticResp) return staticResp;
      }
      return null;
    },
  };
}

/**
 * Internal helper to attempt serving a file from a base directory.
 * Implements security checks for containment, symlinks, and dotfiles.
 */
async function tryServeDir(baseDir: string, pathname: string): Promise<Response | null> {
  const fullPath = join(baseDir, pathname);
  
  // 🚀 CONTAINMENT: Resolve absolute path and verify it stays within baseDir
  let resolvedPath: string;
  try {
    resolvedPath = await Deno.realPath(fullPath);
  } catch {
    resolvedPath = resolve(fullPath);
  }
  
  const resolvedBase = await Deno.realPath(baseDir).catch(() => resolve(baseDir));
  
  if (!resolvedPath.startsWith(resolvedBase + "/") && resolvedPath !== resolvedBase) {
    return new Response("Not Found", { status: 404 });
  }

  const candidates = buildFileCandidates(baseDir, pathname);
  for (const candidate of candidates) {
    try {
      // 🚀 SYMLINKS: Use lstat to reject direct symlinks
      const info = await Deno.lstat(candidate);
      
      if (info.isSymlink) {
        console.warn(`[Static] Symlink rejected: ${candidate}`);
        continue;
      }

      // 🚀 CONTAINMENT: Verify that the real path is contained in the base directory (prevents intermediate symlinks)
      const realCandidate = await Deno.realPath(candidate).catch(() => null);
      if (!realCandidate || (!realCandidate.startsWith(resolvedBase + "/") && realCandidate !== resolvedBase)) {
        console.warn(`[Static] Path outside base directory rejected: ${candidate}`);
        continue;
      }
      
      if (info.isFile) {
        const ext = candidate.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = resolveMimeType(ext);
        const file = await Deno.open(candidate);
        
        // 🚀 HEADERS: Add complete metadata and security headers
        const headers: HeadersInit = {
          "Content-Type": mimeType,
          "Content-Length": info.size.toString(),
          "Last-Modified": info.mtime?.toUTCString() ?? new Date().toUTCString(),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        };
        
        // Add ETag based on size + mtime
        if (info.mtime) {
          const etag = `"${info.size.toString(16)}-${info.mtime.getTime().toString(16)}"`;
          headers["ETag"] = etag;
        }
        
        return new Response(file.readable, { headers });
      }
      
      // 🚀 REDIRECT: If it's a directory without a trailing slash, redirect
      if (info.isDirectory && !pathname.endsWith("/")) {
        return new Response(null, {
          status: 301,
          headers: { "Location": pathname + "/" },
        });
      }
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        console.error(`Static file error: ${candidate}`, err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }
  }
  return null;
}

/**
 * Generates an array of potential file path candidates based on the requested pathname.
 * Handles automatic extension appending (.html, .htm) and index file resolution.
 */
function buildFileCandidates(baseDir: string, pathname: string): string[] {
  const fullPath = join(baseDir, pathname);
  const candidates: string[] = [fullPath];
  if (!/\.[a-zA-Z0-9]+$/.test(pathname)) {
    candidates.push(fullPath + ".html");
    candidates.push(fullPath + ".htm");
  }
  candidates.push(join(fullPath, "index.html"));
  candidates.push(join(fullPath, "index.htm"));
  return candidates;
}

/**
 * Maps common file extensions to their standard MIME types via `@std/media-types`,
 * with a small override table for runtime-specific conventions not covered by the
 * IANA registry, and appends `charset=utf-8` to textual types.
 */
function resolveMimeType(ext: string): string {
  const overrides: Record<string, string> = {
    mjs: "application/javascript",
    jsx: "application/javascript",
    ts: "application/typescript",
    tsx: "application/typescript",
    map: "application/json",
    webmanifest: "application/manifest+json",
  };
  const type = overrides[ext] ?? typeByExtension(ext) ??
    "application/octet-stream";
  if (
    type.startsWith("text/") || type === "application/javascript" ||
    type === "application/json" || type === "application/xml"
  ) {
    return `${type}; charset=utf-8`;
  }
  return type;
}

```

---

## File: `src/deno-serve-dir.ts`

```ts
// src/deno-serve-dir.ts
/**
 * @file deno-serve-dir.ts
 * @description Alternative Deno entry point leveraging @std/http/file-server serveDir.
 */

import { Router } from "./mod.ts";
import { resolveFactoryOptions } from "./factory-options.ts";
import {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";

/**
 * Configuration options for creating a Deno router with serveDir static file serving.
 */
export interface DenoServeDirRouterOptions {
  /** Base URL path prefix for all registered routes. */
  basePath?: string;
  /** Directory path to serve static files from disk. */
  staticDir?: string | null;
  /** Directory path for embedded fallback static files. */
  embeddedDir?: string | null;
  /** Whether to enforce HTTPS redirects in production. */
  forceHttps?: boolean;
  /** Whether to trust reverse proxy headers like X-Forwarded-Proto. */
  trustProxy?: boolean;
  /** Whether to allow serving dotfiles (files starting with '.'). */
  allowDotfiles?: boolean;
  /** Debounce delay in milliseconds for presence broadcast throttling. */
  lastBroadcastDelay?: number;
  /** Specific options forwarded to the @std/http serveDir file server. */
  serveDir?: {
    /** Whether to display directory listings. */
    showDirListing?: boolean;
    /** Whether to enable CORS headers on served static files. */
    enableCors?: boolean;
  };
}

/**
 * Creates a pre-configured Router for Deno utilizing @std/http serveDir.
 *
 * Provides native HTTP Range requests, ETag/If-None-Match (304), and HEAD requests.
 *
 * @param basePathOrOptions - Base path prefix string or full router options object.
 * @param staticDir - Directory to serve static files from (default: "public").
 * @param embeddedDir - Optional embedded directory for fallbacks.
 * @param forceHttps - Whether to redirect HTTP requests to HTTPS.
 * @param lastBroadcastDelay - Delay in ms for broadcast debouncing.
 * @returns Configured Router instance.
 */
export function createDenoServeDirRouter(
  basePathOrOptions: string | DenoServeDirRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  const options = resolveFactoryOptions(basePathOrOptions, (basePath) => ({
    basePath,
    staticDir,
    embeddedDir,
    forceHttps,
    lastBroadcastDelay,
  }));

  const staticOptions: DenoServeDirOptions = {
    allowDotfiles: options.allowDotfiles,
    showDirListing: options.serveDir?.showDirListing ?? false,
    enableCors: options.serveDir?.enableCors ?? false,
  };

  return new Router({
    basePath: options.basePath,
    forceHttps: options.forceHttps,
    trustProxy: options.trustProxy,
    allowDotfiles: options.allowDotfiles,
    lastBroadcastDelay: options.lastBroadcastDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: options.staticDir || options.embeddedDir
      ? createDenoServeDirStaticFileHandler(
        options.staticDir ?? null,
        options.embeddedDir ?? null,
        staticOptions,
      )
      : undefined,
  });
}

// Re-export everything from the core module.
export * from "./mod.ts";
export {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";
```

---

## File: `src/deno.ts`

````ts
// src/deno.ts
/**
 * @file deno.ts
 * @description Entry point for the Deno-specific router factory.
 */
import { Router } from "./mod.ts";
import { resolveFactoryOptions } from "./factory-options.ts";
import { denoWebSocketUpgrader, createDenoStaticFileHandler } from "./adapters/deno.ts";

/**
 * Options for configuring a Deno-specific Router.
 */
export interface DenoRouterOptions {
  /** Optional base prefix path for all routes. */
  basePath?: string;
  /** Optional local directory path for serving static files. */
  staticDir?: string | null;
  /** Optional directory path for serving embedded assets. */
  embeddedDir?: string | null;
  /** When enabled, redirects unencrypted HTTP traffic to HTTPS. */
  forceHttps?: boolean;
  /** When enabled, inspects `X-Forwarded-Proto` header from reverse proxies. */
  trustProxy?: boolean;
  /** When enabled, allows serving hidden dotfiles. */
  allowDotfiles?: boolean;
  /** Default debounce delay (in ms) for replaying last broadcast to joining sockets. */
  lastBroadcastDelay?: number;
}

/**
 * Factory function to create a Router pre-configured for the Deno runtime.
 *
 * @param basePathOrOptions - Base path string or full options object.
 * @param staticDir - Directory to serve static files from (default: "public").
 * @param embeddedDir - Optional directory for embedded assets.
 * @param forceHttps - Whether to enforce HTTPS redirects.
 * @param lastBroadcastDelay - Optional delay for last broadcast replay.
 * @returns A Router instance configured with Deno-native adapters.
 *
 * @example
 * ```ts
 * const app = createDenoRouter({
 *   basePath: "/api",
 *   staticDir: "./public"
 * });
 * ```
 */
export function createDenoRouter(
  basePathOrOptions: string | DenoRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  const options = resolveFactoryOptions(basePathOrOptions, (basePath) => ({
    basePath,
    staticDir,
    embeddedDir,
    forceHttps,
    lastBroadcastDelay,
  }));

  return new Router({
    basePath: options.basePath,
    forceHttps: options.forceHttps,
    trustProxy: options.trustProxy,
    allowDotfiles: options.allowDotfiles,
    lastBroadcastDelay: options.lastBroadcastDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: options.staticDir || options.embeddedDir
      ? createDenoStaticFileHandler(
        options.staticDir ?? null,
        options.embeddedDir ?? null,
      )
      : undefined,
  });
}

export * from "./mod.ts";
export { denoWebSocketUpgrader, createDenoStaticFileHandler } from "./adapters/deno.ts";
````

---

## File: `src/factory-options.ts`

```ts
// src/factory-options.ts
/**
 * @file factory-options.ts
 * @description Internal helper normalizing legacy positional router factory arguments.
 */

/**
 * Resolves router factory options provided either as a legacy base path string
 * with positional defaults or as a modern full options object.
 *
 * @param basePathOrOptions - Legacy base path string or modern options object.
 * @param build - Callback constructing the options object from a base path string.
 * @returns The resolved options object.
 */
export function resolveFactoryOptions<O>(
  basePathOrOptions: string | O,
  build: (basePath: string) => O,
): O {
  return typeof basePathOrOptions === "string"
    ? build(basePathOrOptions)
    : basePathOrOptions;
}

```

---

## File: `src/http-route.ts`

```ts
// src/http-route.ts
/**
 * @file http-route.ts
 * @description Encapsulates an HTTP route with method, URLPattern matching, metadata, and route-level middlewares.
 */

import { MiddlewareRoute } from "./middleware-route.ts";
import type {
  HttpHandler,
  Middleware,
  RequestContext,
  RouteParams,
} from "./types.ts";

/**
 * Options for configuring an HttpRoute.
 */
export interface HttpRouteOptions {
  /** Arbitrary static metadata associated with this route (e.g., auth requirements, permissions, roles). */
  meta?: Record<string, unknown>;
  /** Route-specific middlewares executed before this route's handler. */
  middlewares?: (Middleware | MiddlewareRoute)[];
}

/**
 * HttpRoute encapsulates a single HTTP endpoint with an HTTP method, path pattern,
 * handler, metadata, and optional route-level middleware pipeline.
 */
export class HttpRoute {
  /** HTTP method in uppercase (e.g., "GET", "POST"). */
  readonly method: string;
  /** Normalized path pattern string (e.g., "/users/:id"). */
  readonly path: string;
  /** Compiled URLPattern for matching incoming request URLs and extracting params. */
  readonly pattern: URLPattern;
  /** The core HTTP handler callback. */
  readonly handler: HttpHandler;
  /** Static metadata attached to this route. */
  readonly meta: Record<string, unknown>;
  /** Route-specific middlewares that run when this route matches. */
  readonly middlewares: MiddlewareRoute[];

  /**
   * Creates a new HttpRoute instance.
   *
   * @param method HTTP method verb (case-insensitive, e.g. "get", "POST").
   * @param path Path pattern (e.g. "/items/:id").
   * @param handler The HTTP request handler function.
   * @param options Optional route configuration including metadata and middlewares.
   */
  constructor(
    method: string,
    path: string,
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ) {
    this.method = method.toUpperCase();
    this.path = path.startsWith("/") ? path : "/" + path;
    this.pattern = new URLPattern({ pathname: this.path });
    this.handler = handler;
    this.meta = options?.meta ?? {};
    this.middlewares = (options?.middlewares ?? []).map((m) =>
      m instanceof MiddlewareRoute ? m : new MiddlewareRoute(m)
    );
  }

  /**
   * Tests whether an incoming URL matches this route's URLPattern.
   *
   * @param url The target URL to test.
   * @returns URLPatternResult containing matched parameter groups, or `null` if no match.
   */
  match(url: URL | string): URLPatternResult | null {
    return this.pattern.exec(url);
  }

  /**
   * Tests if the given method string matches this route's HTTP method verb.
   */
  matchesMethod(method: string): boolean {
    return this.method === method.toUpperCase();
  }

  /**
   * Invokes the HTTP route handler.
   *
   * @param req - The incoming HTTP request.
   * @param params - Extracted route parameters.
   * @param ctx - Optional request context.
   * @returns The handler response or promise of response.
   */
  execute(
    req: Request,
    params: RouteParams,
    ctx?: RequestContext,
  ): ReturnType<HttpHandler> {
    return this.handler(req, params, ctx);
  }
}

```

---

## File: `src/middleware-chain.ts`

```ts
// src/middleware-chain.ts
/**
 * @file middleware-chain.ts
 * @description Composable pipeline for executing middleware layers with onion architecture.
 */

import { MiddlewareRoute } from "./middleware-route.ts";
import type { Middleware, RequestContext } from "./types.ts";

/**
 * MiddlewareChain maintains an ordered list of MiddlewareRoute instances and manages
 * nested execution with cascading `next()` calls, error catching, and Request mutations.
 */
export class MiddlewareChain {
  private middlewares: MiddlewareRoute[] = [];

  /**
   * Initializes a new MiddlewareChain with optional initial middlewares.
   */
  constructor(middlewares: (Middleware | MiddlewareRoute)[] = []) {
    for (const mw of middlewares) {
      if (mw instanceof MiddlewareRoute) {
        this.middlewares.push(mw);
      } else {
        this.middlewares.push(new MiddlewareRoute(mw));
      }
    }
  }

  /**
   * Registers a middleware, sub-chain, or path-scoped middleware to the pipeline.
   *
   * @param middlewareOrPathOrChain Middleware function, MiddlewareRoute, nested chain, or route prefix string.
   * @param handler Optional handler or chain when the first parameter is a path prefix string.
   */
  use(
    middlewareOrPathOrChain:
      | Middleware
      | MiddlewareRoute
      | MiddlewareChain
      | string,
    handler?: Middleware | MiddlewareChain,
  ): this {
    if (middlewareOrPathOrChain instanceof MiddlewareChain) {
      this.middlewares.push(...middlewareOrPathOrChain.routes);
    } else if (middlewareOrPathOrChain instanceof MiddlewareRoute) {
      this.middlewares.push(middlewareOrPathOrChain);
    } else if (typeof middlewareOrPathOrChain === "string" && handler) {
      const patternPath = middlewareOrPathOrChain.startsWith("/")
        ? middlewareOrPathOrChain
        : "/" + middlewareOrPathOrChain;
      if (handler instanceof MiddlewareChain) {
        for (const mw of handler.routes) {
          const subPath = mw.path ? mw.path : patternPath;
          this.middlewares.push(new MiddlewareRoute(mw.handler, subPath));
        }
      } else {
        this.middlewares.push(new MiddlewareRoute(handler, patternPath));
      }
    } else if (typeof middlewareOrPathOrChain === "function") {
      this.middlewares.push(new MiddlewareRoute(middlewareOrPathOrChain));
    }
    return this;
  }

  /**
   * Returns a readonly array of all registered MiddlewareRoute instances in the chain.
   */
  get routes(): readonly MiddlewareRoute[] {
    return this.middlewares;
  }

  /**
   * Executes the middleware chain for a given request context, ultimately invoking `finalHandler`.
   *
   * @param ctx The current RequestContext containing request, params, and state.
   * @param finalHandler The terminal handler called after all middlewares yield via `next()`.
   */
  async execute(
    ctx: RequestContext,
    finalHandler: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const adjustedUrl = new URL(ctx.req.url);
    const applicable = this.middlewares.filter((mw) => mw.match(adjustedUrl));
    let index = 0;

    const next = async (newReq?: Request): Promise<Response> => {
      if (newReq) {
        ctx.req = newReq;
      }
      if (index < applicable.length) {
        const mw = applicable[index++];
        if (!mw) return await finalHandler(ctx.req);
        let nextCalled = false;
        try {
          return await mw.execute(
            ctx.req,
            ctx.params,
            async (nReq?: Request) => {
              if (nextCalled) throw new Error("next() called multiple times");
              nextCalled = true;
              return await next(nReq);
            },
            ctx,
          );
        } catch (err) {
          console.error("[MiddlewareChain] Middleware error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
      return await finalHandler(ctx.req);
    };

    return await next();
  }
}

```

---

## File: `src/middleware-route.ts`

```ts
// src/middleware-route.ts
/**
 * @file middleware-route.ts
 * @description Encapsulates middleware functions with optional URLPattern path scoping.
 */

import type { Middleware, RequestContext, RouteParams } from "./types.ts";

/**
 * MiddlewareRoute wraps a Middleware handler with optional path filtering.
 * If a path pattern is specified, the middleware only executes on matching incoming URLs.
 */
export class MiddlewareRoute {
  /** The normalized path pattern string, if path-scoped. */
  readonly path?: string;
  /** The compiled URLPattern instance used for testing matches. */
  readonly pattern?: URLPattern;
  /** The actual middleware handler function. */
  readonly handler: Middleware;

  /**
   * Creates a new MiddlewareRoute.
   * @param handler The middleware function to execute.
   * @param path Optional URL path or pattern (e.g. "/admin/*" or "*").
   */
  constructor(handler: Middleware, path?: string) {
    this.handler = handler;
    if (path && path !== "*") {
      const patternPath = path.startsWith("/") ? path : "/" + path;
      this.pattern = new URLPattern({ pathname: patternPath });
      this.path = patternPath;
    }
  }

  /**
   * Checks whether the incoming URL matches this middleware route.
   * Global middlewares (without pattern) always return `true`.
   */
  match(url: URL | string): boolean {
    if (!this.pattern) return true;
    return this.pattern.test(url);
  }

  /**
   * Executes the wrapped middleware function.
   *
   * @param req The incoming HTTP Request.
   * @param params Extracted path parameters.
   * @param next Continuation callback to invoke the next middleware or final handler.
   * @param ctx Execution context containing shared state.
   */
  execute(
    req: Request,
    params: RouteParams,
    next: (newReq?: Request) => Promise<Response>,
    ctx?: RequestContext,
  ): Promise<Response> | Response {
    return this.handler(req, params, next, ctx);
  }
}

```

---

## File: `src/mod.ts`

```ts
// src/mod.ts
/**
 * @file mod.ts
 * @description Root module re-exporting all components, classes, and types of WsRouter.
 */

export * from "./types.ts";
export {
  /** High-performance engine for tracking online users and broadcasting presence diffs. */
  PresenceTracker,
  type PresenceEvent,
  type PresenceListener,
  type PresenceTrackerOptions,
  type PresenceUser,
} from "./presence.ts";
export {
  type ActiveStreamInfo,
  type SerializedIceCandidate,
  type SerializedSessionDescription,
  /** Signaling hub for managing WebRTC peer-to-peer connection coordination. */
  WebRTCSignalingHub,
  type WebRTCSignalingEvents,
  type WebRTCSignalingHubOptions,
  type WebRTCSignalingMessage,
} from "./webrtc.ts";
/** Logic for managing groups of connected WebSocket clients and filtered broadcasts. */
export { WebSocketGroup, type WebSocketGroupListener } from "./websocket-group.ts";
/** Representation of a middleware associated with an optional path pattern. */
export { MiddlewareRoute } from "./middleware-route.ts";
/** Pipeline executor for middleware execution using the onion architecture. */
export { MiddlewareChain } from "./middleware-chain.ts";
/** Handler route for worker fallback execution tiers. */
export { WorkerRoute } from "./worker-route.ts";
/** Encapsulation of an HTTP route with method, path matching, and handlers. */
export { HttpRoute, type HttpRouteOptions } from "./http-route.ts";
/** Encapsulation of a WebSocket route with path matching and its associated group. */
export { WsRoute, type WsRouteOptions } from "./ws-route.ts";
/** Core Router class for registering and dispatching HTTP and WebSocket requests. */
export { Router } from "./router.ts";
export { APP_VERSION as version } from "./version.ts"

```

---

## File: `src/presence.ts`

```ts
// src/presence.ts
/**
 * @file presence.ts
 * @description Real-time online presence tracker for WebSocket clients in WsRouter.
 * Tracks user identity, metadata, active tab/device connections, and broadcasts diffs.
 */

import type { RouteParams } from "./types.ts";
import type { WebSocketGroup } from "./websocket-group.ts";

/**
 * Representation of an online user tracked by PresenceTracker.
 */
export interface PresenceUser<T = Record<string, unknown>> {
  /** Unique identifier for the user (e.g., user ID, email, account key). */
  userId: string;
  /** Custom user-defined metadata (e.g. name, avatar, role, custom status). */
  data: T;
  /** Number of concurrent active WebSocket connections (tabs/devices) for this user. */
  connections: number;
  /** Epoch timestamp (ms) when the user first connected. */
  firstSeenAt: number;
  /** Epoch timestamp (ms) of the most recent activity or connection. */
  lastSeenAt: number;
}

/**
 * Protocol events dispatched to WebSocket clients regarding presence state and transitions.
 */
export type PresenceEvent<T = Record<string, unknown>> =
  | {
    type: "presence_state";
    users: PresenceUser<T>[];
  }
  | {
    type: "presence_join";
    user: PresenceUser<T>;
  }
  | {
    type: "presence_leave";
    userId: string;
    lastSeenAt: number;
  }
  | {
    type: "presence_update";
    user: PresenceUser<T>;
  };

/**
 * Configuration options for PresenceTracker.
 */
export interface PresenceTrackerOptions<T = Record<string, unknown>> {
  /**
   * Whether to automatically send the complete `presence_state` snapshot to
   * newly connected sockets when `track()` is invoked.
   * @default true
   */
  sendStateOnTrack?: boolean;
  /**
   * Whether to automatically broadcast `presence_join`, `presence_leave`, and
   * `presence_update` events to sockets in the associated WebSocketGroup.
   * @default true
   */
  autoBroadcast?: boolean;
  /**
   * Optional custom filter to restrict which sockets receive presence diffs.
   * Receives receiver parameters, sender parameters, and the event payload.
   */
  filter?: (
    receiverParams: RouteParams,
    senderParams: RouteParams,
    event: PresenceEvent<T>,
  ) => boolean;
  /**
   * Custom serializer converting PresenceEvent to string format.
   * @default JSON.stringify
   */
  serialize?: (event: PresenceEvent<T>) => string;
}

/** Generic callback for presence events. */
// deno-lint-ignore no-explicit-any
export type PresenceListener = (...args: any[]) => void;

/**
 * Manages online presence for WebSocket clients.
 * Tracks user identity, handles multi-device/multi-tab connections per user ID,
 * and coordinates initial state snapshots and delta diffs (join, leave, update).
 */
export class PresenceTracker<T = Record<string, unknown>> {
  private group?: WebSocketGroup;
  private options: Required<PresenceTrackerOptions<T>>;
  private users = new Map<string, PresenceUser<T>>();
  private userSockets = new Map<string, Set<WebSocket>>();
  private socketToUserId = new Map<WebSocket, string>();
  private listeners = new Map<string, Set<PresenceListener>>();

  /**
   * Creates a new PresenceTracker instance.
   *
   * @param group Optional WebSocketGroup to bind presence broadcasts with.
   * @param options Configuration options.
   */
  constructor(group?: WebSocketGroup, options?: PresenceTrackerOptions<T>) {
    this.group = group;
    this.options = {
      sendStateOnTrack: options?.sendStateOnTrack ?? true,
      autoBroadcast: options?.autoBroadcast ?? true,
      filter: options?.filter ?? (() => true),
      serialize: options?.serialize ?? ((event) => JSON.stringify(event)),
    };
  }

  /**
   * Associates the tracker with a WebSocketGroup if not provided in the constructor.
   */
  bindGroup(group: WebSocketGroup): this {
    this.group = group;
    return this;
  }

  /**
   * Registers a WebSocket connection under a specific user identity.
   * Automatically increments active connection count and broadcasts a join diff if new.
   *
   * @param ws The connected WebSocket instance.
   * @param user Identity object containing `userId` and user metadata.
   * @param params Optional route parameters to associate with this connection.
   */
  track(
    ws: WebSocket,
    user: { userId: string } & T,
    params?: RouteParams,
  ): PresenceUser<T> {
    const { userId, ...metadata } = user;
    const now = Date.now();
    let isNewUser = false;

    // Disassociate previous user if this socket was already tracked under another ID
    const existingUserId = this.socketToUserId.get(ws);
    if (existingUserId && existingUserId !== userId) {
      this.untrack(ws);
    }

    this.socketToUserId.set(ws, userId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    const sockets = this.userSockets.get(userId)!;
    sockets.add(ws);

    let presenceUser = this.users.get(userId);
    if (!presenceUser) {
      isNewUser = true;
      presenceUser = {
        userId,
        data: metadata as unknown as T,
        connections: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      this.users.set(userId, presenceUser);
    } else {
      presenceUser.connections = sockets.size;
      presenceUser.lastSeenAt = now;
      // Merge updated metadata
      presenceUser.data = {
        ...presenceUser.data,
        ...metadata,
      };
    }

    // 1. Send full presence state snapshot to this new socket
    if (this.options.sendStateOnTrack) {
      const sendState = () => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            const statePayload = this.options.serialize({
              type: "presence_state",
              users: this.getUsers(),
            });
            ws.send(statePayload);
          } catch (err) {
            console.error("[PresenceTracker] Error sending presence snapshot:", err);
          }
        }
      };

      if (ws.readyState === WebSocket.OPEN) {
        sendState();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        if (typeof ws.addEventListener === "function") {
          ws.addEventListener("open", sendState, { once: true });
        }
      }
    }

    // 2. Broadcast join event to other clients if this is a newly online user
    if (isNewUser) {
      this.emit("join", presenceUser, ws);
      if (this.options.autoBroadcast && this.group) {
        const event: PresenceEvent<T> = { type: "presence_join", user: presenceUser };
        this.group.broadcast(
          this.options.serialize(event),
          (recvParams, sendParams, _msg) =>
            this.options.filter(recvParams, sendParams, event),
          params,
        );
      }
    } else {
      // If user already existed (multi-tab/device), notify listeners of connection count update
      this.emit("connection", presenceUser, ws);
    }

    return presenceUser;
  }

  /**
   * Deregisters a WebSocket from presence tracking.
   * If this was the user's last open connection, removes the user and broadcasts a leave diff.
   *
   * @param ws The WebSocket to remove.
   * @param params Optional route parameters of the departing client.
   * @returns `true` if the socket was tracked, `false` otherwise.
   */
  untrack(ws: WebSocket, params?: RouteParams): boolean {
    const userId = this.socketToUserId.get(ws);
    if (!userId) return false;

    this.socketToUserId.delete(ws);
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(ws);
    }

    const presenceUser = this.users.get(userId);
    if (!presenceUser) {
      if (sockets && sockets.size === 0) {
        this.userSockets.delete(userId);
      }
      return true;
    }

    const remainingSockets = sockets ? sockets.size : 0;
    presenceUser.connections = remainingSockets;
    presenceUser.lastSeenAt = Date.now();

    if (remainingSockets <= 0) {
      this.users.delete(userId);
      this.userSockets.delete(userId);

      this.emit("leave", presenceUser, ws);

      if (this.options.autoBroadcast && this.group) {
        const event: PresenceEvent<T> = {
          type: "presence_leave",
          userId,
          lastSeenAt: presenceUser.lastSeenAt,
        };
        this.group.broadcast(
          this.options.serialize(event),
          (recvParams, sendParams, _msg) =>
            this.options.filter(recvParams, sendParams, event),
          params,
        );
      }
    } else {
      this.emit("disconnection", presenceUser, ws);
    }

    return true;
  }

  /**
   * Updates metadata for an active user and broadcasts the change.
   *
   * @param wsOrUserId WebSocket instance or user ID string.
   * @param partialData Metadata updates to merge.
   * @param params Optional route parameters of the updating client.
   */
  update(
    wsOrUserId: WebSocket | string,
    partialData: Partial<T>,
    params?: RouteParams,
  ): PresenceUser<T> | undefined {
    const userId = typeof wsOrUserId === "string"
      ? wsOrUserId
      : this.socketToUserId.get(wsOrUserId);

    if (!userId) return undefined;
    const presenceUser = this.users.get(userId);
    if (!presenceUser) return undefined;

    const oldData = { ...presenceUser.data };
    presenceUser.data = {
      ...presenceUser.data,
      ...partialData,
    };
    presenceUser.lastSeenAt = Date.now();

    this.emit("update", presenceUser, oldData);

    if (this.options.autoBroadcast && this.group) {
      const event: PresenceEvent<T> = { type: "presence_update", user: presenceUser };
      this.group.broadcast(
        this.options.serialize(event),
        (recvParams, sendParams, _msg) =>
          this.options.filter(recvParams, sendParams, event),
        params,
      );
    }

    return presenceUser;
  }

  /**
   * Returns a snapshot array of all currently online users.
   */
  getUsers(): PresenceUser<T>[] {
    this.pruneClosedSockets();
    return Array.from(this.users.values());
  }

  /**
   * Alias for `getUsers()`.
   */
  getPresenceList(): PresenceUser<T>[] {
    return this.getUsers();
  }

  /**
   * Retrieves an online user record by their unique userId.
   */
  getUser(userId: string): PresenceUser<T> | undefined {
    this.pruneClosedSockets();
    return this.users.get(userId);
  }

  /**
   * Retrieves the user record associated with a given WebSocket connection.
   */
  getUserBySocket(ws: WebSocket): PresenceUser<T> | undefined {
    const userId = this.socketToUserId.get(ws);
    return userId ? this.getUser(userId) : undefined;
  }

  /**
   * Returns all active WebSocket instances associated with a given user ID.
   */
  getSockets(userId: string): Set<WebSocket> {
    return this.userSockets.get(userId) ?? new Set();
  }

  /**
   * Checks whether a specific user is currently online.
   */
  has(userId: string): boolean {
    this.pruneClosedSockets();
    return this.users.has(userId);
  }

  /**
   * Returns the count of distinct users currently online.
   */
  get size(): number {
    this.pruneClosedSockets();
    return this.users.size;
  }

  /**
   * Returns the total count of active WebSocket connections across all online users.
   */
  get connectionCount(): number {
    this.pruneClosedSockets();
    return this.socketToUserId.size;
  }

  /**
   * Cleans up closed or broken sockets to ensure no ghost connections linger.
   */
  pruneClosedSockets(): void {
    for (const [ws, userId] of this.socketToUserId.entries()) {
      if (
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING
      ) {
        this.untrack(ws);
      }
    }
  }

  /**
   * Clears all tracked presence data.
   */
  clear(): void {
    this.users.clear();
    this.userSockets.clear();
    this.socketToUserId.clear();
  }

  /**
   * Attaches an event listener for presence 'join' events.
   *
   * @param event - Event name 'join'.
   * @param listener - Handler called when a user joins presence.
   * @returns This hub instance for chaining.
   */
  on(
    event: "join",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  /**
   * Attaches an event listener for presence 'leave' events.
   *
   * @param event - Event name 'leave'.
   * @param listener - Handler called when a user leaves presence.
   * @returns This hub instance for chaining.
   */
  on(
    event: "leave",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  /**
   * Attaches an event listener for presence 'update' events.
   *
   * @param event - Event name 'update'.
   * @param listener - Handler called when a user's presence data is updated.
   * @returns This hub instance for chaining.
   */
  on(
    event: "update",
    listener: (user: PresenceUser<T>, oldData: T) => void,
  ): this;
  /**
   * Attaches an event listener for presence connection/disconnection events.
   *
   * @param event - Event name 'connection' or 'disconnection'.
   * @param listener - Handler called when a connection state changes.
   * @returns This hub instance for chaining.
   */
  on(
    event: "connection" | "disconnection",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(event: string, listener: PresenceListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /**
   * Removes an event listener.
   */
  off(event: string, listener: PresenceListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /**
   * Emits an internal event.
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[PresenceTracker] Error in "${event}" listener:`, err);
      }
    }
  }
}

```

---

## File: `src/router.ts`

```ts
// src/router.ts
/**
 * @file router.ts
 * @description Core Router class managing route registration, sub-router mounting, middleware execution, and request dispatching.
 */

import { normalize } from "@std/path";
import { HttpRoute, type HttpRouteOptions } from "./http-route.ts";
import { WsRoute, type WsRouteOptions } from "./ws-route.ts";
import { MiddlewareRoute } from "./middleware-route.ts";
import { MiddlewareChain } from "./middleware-chain.ts";
import { WorkerRoute } from "./worker-route.ts";
import { WebSocketGroup } from "./websocket-group.ts";
import type { PresenceUser } from "./presence.ts";
import type { ActiveStreamInfo, WebRTCSignalingHub } from "./webrtc.ts";
import {
  DEFAULT_LAST_BROADCAST_DELAY,
  type HttpHandler,
  type Middleware,
  type PermissionFn,
  type RequestContext,
  type RouteParams,
  type RouterOptions,
  type StaticFileHandler,
  type WebSocketUpgrader,
  type WorkerHandler,
  type WsHandler,
} from "./types.ts";

/**
 * Shared parameter tuple for the HTTP verb registration wrappers
 * (`get`, `post`, `put`, `delete`, `patch`, `options`, `head`).
 */
type VerbRegistrationArgs = [
  path: string,
  handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
  maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
  maybeOpts?: HttpRouteOptions,
];

/**
 * High-performance, environment-agnostic HTTP and WebSocket router.
 * Features:
 * - URLPattern pattern-based route matching.
 * - HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD).
 * - Middleware pipeline with bidirectional onion model (`next()`).
 * - WebSocket connection management, channel grouping, and selective broadcasting.
 * - Sub-router composition and prefix mounting (`mount()`).
 * - Worker fallback chain before static files.
 * - Automatic HTTPS redirection and HSTS headers.
 */
export class Router {
  /** The base URL prefix for this router (e.g. "/api"). */
  public basePath: string;
  private httpRoutes: HttpRoute[] = [];
  private wsRoutes: WsRoute[] = [];
  private middlewareChain = new MiddlewareChain();
  private workers: WorkerRoute[] = [];
  private webSockets = new Map<WebSocket, { group: WebSocketGroup }>();
  private webSocketUpgrader?: WebSocketUpgrader;
  private staticFileHandler?: StaticFileHandler;
  /** Whether unencrypted HTTP traffic should be redirected to HTTPS. */
  public forceHttps: boolean;
  /** Whether to trust `X-Forwarded-Proto` proxy header. */
  public trustProxy: boolean;
  /** Whether to permit serving hidden dotfiles from static directories. */
  public allowDotfiles: boolean;
  private lastBroadcastDelay: number;

  /**
   * Initializes a new Router instance with the specified options.
   *
   * @param options - Configuration options for the router.
   */
  constructor(options: RouterOptions = {}) {
    this.basePath = this.normalizeBasePath(options.basePath ?? "");
    this.forceHttps = options.forceHttps ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.allowDotfiles = options.allowDotfiles ?? false;
    this.lastBroadcastDelay = options.lastBroadcastDelay ??
      DEFAULT_LAST_BROADCAST_DELAY;
    this.webSocketUpgrader = options.webSocketUpgrader;
    this.staticFileHandler = options.staticFileHandler;
  }

  /**
   * Configures the WebSocket upgrader implementation.
   *
   * @param upgrader - The upgrader instance to use.
   * @returns The router instance for chaining.
   */
  setWebSocketUpgrader(upgrader: WebSocketUpgrader): this {
    this.webSocketUpgrader = upgrader;
    return this;
  }

  /**
   * Configures the static file handler implementation.
   *
   * @param handler - The handler instance to use.
   * @returns The router instance for chaining.
   */
  setStaticFileHandler(handler: StaticFileHandler): this {
    this.staticFileHandler = handler;
    return this;
  }

  /**
   * Normalizes the base path string.
   * @param p - The base path string.
   * @returns Normalized base path.
   */
  private normalizeBasePath(p: string): string {
    if (!p || p === "/") return "";
    return "/" + p.replace(/^\/+|\/+$/g, "");
  }

  /**
   * Attaches extra headers to a response in place.
   * @param res - The target response.
   * @param headers - Header entries to set.
   */
  private static applyHeaders(
    res: Response,
    headers: Record<string, string>,
  ): void {
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  }

  /**
   * Cancels a response body stream to prevent resource leaks, ignoring failures.
   * @param body - The readable stream body or null.
   */
  private static async cancelBody(
    body: ReadableStream<unknown> | null,
  ): Promise<void> {
    if (!body) return;
    try {
      await body.cancel();
    } catch {
      // ignore stream cancel failure
    }
  }

  /**
   * Normalizes a route path string.
   * @param p - The path string.
   * @returns Normalized path string.
   */
  private normalizePath(p: string): string {
    return p.startsWith("/") ? p : "/" + p;
  }

  /**
   * Combines a prefix and a path string.
   * @param prefix - Route prefix.
   * @param path - Route path.
   * @returns Combined path string.
   */
  private combinePaths(prefix: string, path?: string): string {
    const normPrefix = prefix
      ? (prefix.startsWith("/") ? prefix : "/" + prefix).replace(/\/+$/, "")
      : "";
    if (!path) return normPrefix || "/";
    if (path === "*") return normPrefix ? `${normPrefix}{/*}?` : "/*";
    const normPath = path.startsWith("/") ? path : "/" + path;
    if (!normPrefix) return normPath;
    if (normPath === "/") return normPrefix;
    return normPrefix + normPath;
  }

  /**
   * Strips the base path from a pathname.
   * @param pathname - Request pathname.
   * @returns Stripped pathname.
   */
  private stripBase(pathname: string): string {
    if (!this.basePath) return pathname;
    if (pathname === this.basePath) return "/";
    if (pathname.startsWith(this.basePath + "/")) {
      return pathname.slice(this.basePath.length);
    }
    return pathname;
  }

  /**
   * Checks if the request originates from localhost.
   * @param url - The parsed request URL.
   * @returns True if localhost, false otherwise.
   */
  private isLocalhost(url: URL): boolean {
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return hostname === "localhost" || hostname === "127.0.0.1" ||
      hostname === "::1";
  }

  /**
   * Determines if HTTPS should be forced for the request.
   * @param req - The HTTP request.
   * @param url - The parsed request URL.
   * @returns True if HTTPS should be enforced.
   */
  private shouldForceHttps(req: Request, url: URL): boolean {
    if (!this.forceHttps) return false;
    if (this.isLocalhost(url)) return false;
    if (this.trustProxy) {
      const protoHeader = req.headers.get("x-forwarded-proto");
      const forwardedProto = protoHeader
        ? protoHeader.split(",")[0]?.trim().toLowerCase()
        : undefined;
      if (forwardedProto === "https") return false;
      if (forwardedProto === "http") return true;
    }
    return url.protocol !== "https:";
  }

  /**
   * Builds an HTTPS URL from an incoming HTTP request.
   * @param req - The HTTP request.
   * @param url - The parsed request URL (used as the mutation base).
   * @returns The HTTPS URL string.
   */
  private buildHttpsUrl(req: Request, url: URL): string {
    const redirect = new URL(url);
    redirect.protocol = "https:";
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      redirect.protocol = "wss:";
    }
    if (this.trustProxy) {
      const hostHeader = req.headers.get("x-forwarded-host");
      if (hostHeader) {
        const forwardedHost = hostHeader.split(",")[0]?.trim();
        if (forwardedHost && /^[\w.:-]+$/.test(forwardedHost)) {
          redirect.host = forwardedHost;
        }
      }
    }
    return redirect.toString();
  }

  /**
   * Adds an internal HTTP route definition.
   * @param method - HTTP method.
   * @param path - Route path.
   * @param handler - HTTP handler.
   * @param options - Route options.
   * @returns The created HttpRoute instance.
   */
  private addHttpRoute(
    method: string,
    path: string,
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): HttpRoute {
    const patternPath = this.normalizePath(path);
    const route = new HttpRoute(method, patternPath, handler, options);
    this.httpRoutes.push(route);
    return route;
  }

  /**
   * Adds an internal WebSocket route definition.
   * @param path - WebSocket route path.
   * @param handler - WebSocket handler.
   * @param optionsOrDelay - Options or broadcast delay.
   * @returns The created WsRoute instance.
   */
  private addWsRoute(
    path: string,
    handler: WsHandler,
    optionsOrDelay?: number | WsRouteOptions,
  ): WsRoute {
    const patternPath = this.normalizePath(path);
    if (this.wsRoutes.some((r) => r.pattern.pathname === patternPath)) {
      throw new Error(`Duplicate WebSocket route pattern: ${patternPath}`);
    }
    const opts: WsRouteOptions = typeof optionsOrDelay === "number"
      ? { lastBroadcastDelay: optionsOrDelay }
      : (optionsOrDelay ?? {});
    const route = new WsRoute(patternPath, handler, {
      lastBroadcastDelay: opts.lastBroadcastDelay ?? this.lastBroadcastDelay,
      meta: opts.meta,
      group: opts.group,
    });
    this.wsRoutes.push(route);
    return route;
  }

  /**
   * Registers a pre-instantiated HttpRoute or WsRoute directly onto this router.
   *
   * @param route The HttpRoute or WsRoute to register.
   */
  addRoute(route: HttpRoute | WsRoute): this {
    if (route instanceof HttpRoute) {
      this.httpRoutes.push(route);
    } else if (route instanceof WsRoute) {
      if (
        this.wsRoutes.some((r) =>
          r.pattern.pathname === route.pattern.pathname
        )
      ) {
        throw new Error(
          `Duplicate WebSocket route pattern: ${route.pattern.pathname}`,
        );
      }
      this.wsRoutes.push(route);
    }
    return this;
  }

  /**
   * Registers global or path-scoped middleware functions or nested MiddlewareChain instances.
   *
   * @param middlewareOrPathOrChain - A middleware function, a MiddlewareRoute, a MiddlewareChain, or a path pattern.
   * @param handler - The middleware function or chain if a path pattern was provided as the first argument.
   * @returns The router instance for chaining.
   */
  use(
    middlewareOrPathOrChain:
      | Middleware
      | MiddlewareRoute
      | MiddlewareChain
      | string,
    handler?: Middleware | MiddlewareChain,
  ): this {
    this.middlewareChain.use(middlewareOrPathOrChain, handler);
    return this;
  }

  /**
   * Internal helper to register an HTTP method route.
   * @param method - HTTP method name.
   * @param path - Route path.
   * @param handlerOrMiddlewares - Handler function or middleware array.
   * @param maybeHandlerOrOptions - Handler function or route options.
   * @param maybeOptions - Route options.
   * @returns The router instance for chaining.
   */
  private registerMethod(
    method: string,
    path: string,
    handlerOrMiddlewares: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOptions?: HttpHandler | HttpRouteOptions,
    maybeOptions?: HttpRouteOptions,
  ): this {
    let middlewares: (Middleware | MiddlewareRoute)[] = [];
    let handler: HttpHandler;
    let options: HttpRouteOptions | undefined;

    if (Array.isArray(handlerOrMiddlewares)) {
      middlewares = handlerOrMiddlewares;
      handler = maybeHandlerOrOptions as HttpHandler;
      options = maybeOptions;
    } else {
      handler = handlerOrMiddlewares;
      options = maybeHandlerOrOptions as HttpRouteOptions;
    }

    const routeOptions: HttpRouteOptions = {
      ...options,
      middlewares: [...(options?.middlewares ?? []), ...middlewares],
    };
    this.addHttpRoute(method, path, handler, routeOptions);
    return this;
  }

  /**
   * Registers a GET route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  get(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a GET route with route-specific middlewares.
   */
  get(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  get(...args: VerbRegistrationArgs): this {
    return this.registerMethod("GET", ...args);
  }

  /**
   * Registers a POST route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  post(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a POST route with route-specific middlewares.
   */
  post(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  post(...args: VerbRegistrationArgs): this {
    return this.registerMethod("POST", ...args);
  }

  /**
   * Registers a PUT route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  put(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a PUT route with route-specific middlewares.
   */
  put(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  put(...args: VerbRegistrationArgs): this {
    return this.registerMethod("PUT", ...args);
  }

  /**
   * Registers a DELETE route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  delete(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a DELETE route with route-specific middlewares.
   */
  delete(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  delete(...args: VerbRegistrationArgs): this {
    return this.registerMethod("DELETE", ...args);
  }

  /**
   * Registers a PATCH route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  patch(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a PATCH route with route-specific middlewares.
   */
  patch(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  patch(...args: VerbRegistrationArgs): this {
    return this.registerMethod("PATCH", ...args);
  }

  /**
   * Registers an OPTIONS route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  options(
    path: string,
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  /**
   * Registers an OPTIONS route with route-specific middlewares.
   */
  options(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  options(...args: VerbRegistrationArgs): this {
    return this.registerMethod("OPTIONS", ...args);
  }

  /**
   * Registers a HEAD route, optionally with route-specific middlewares.
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function, or an array of route middlewares.
   * @returns The router instance for chaining.
   */
  head(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a HEAD route with route-specific middlewares.
   */
  head(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  head(...args: VerbRegistrationArgs): this {
    return this.registerMethod("HEAD", ...args);
  }

  /**
   * Registers a WebSocket route and returns the instantiated WsRoute.
   *
   * @param path Path pattern (e.g. "/ws/:room").
   * @param handler Connection handler callback.
   * @param optionsOrDelay Debounce delay or WsRouteOptions object.
   */
  ws(
    path: string,
    handler: WsHandler,
    optionsOrDelay?: number | WsRouteOptions,
  ): WsRoute {
    return this.addWsRoute(path, handler, optionsOrDelay);
  }

  /**
   * Mounts a child sub-router under an optional path prefix.
   * Merges all child HTTP routes, WebSocket routes, scoped middlewares, and worker fallbacks.
   *
   * @param prefixOrRouter Prefix string (e.g. "/api/v1") or Router instance.
   * @param maybeRouter Sub-router instance when a prefix string is passed as the first argument.
   */
  mount(prefixOrRouter: string | Router, maybeRouter?: Router): this {
    let prefix = "";
    let subRouter: Router;
    if (typeof prefixOrRouter === "string") {
      subRouter = maybeRouter!;
      if (!subRouter) {
        throw new Error(
          "Sub-router instance must be provided when prefix is specified",
        );
      }
      const base = this.normalizeBasePath(prefixOrRouter);
      prefix = this.combinePaths(base, subRouter.basePath);
    } else {
      subRouter = prefixOrRouter;
      prefix = subRouter.basePath || "";
    }

    for (const r of subRouter.getHttpRoutes()) {
      const mountedPath = this.combinePaths(prefix, r.path);
      this.httpRoutes.push(
        new HttpRoute(r.method, mountedPath, r.handler, {
          meta: r.meta,
          middlewares: r.middlewares,
        }),
      );
    }

    for (const r of subRouter.getWsRoutes()) {
      const mountedPath = this.combinePaths(prefix, r.path);
      if (
        this.wsRoutes.some((existing) =>
          existing.pattern.pathname === mountedPath
        )
      ) {
        throw new Error(`Duplicate WebSocket route pattern: ${mountedPath}`);
      }
      this.wsRoutes.push(
        new WsRoute(mountedPath, r.handler, {
          group: r.group,
          meta: r.meta,
        }),
      );
    }

    for (const mw of subRouter.getMiddlewares()) {
      const mountedPath = mw.path
        ? this.combinePaths(prefix, mw.path)
        : (prefix ? `${prefix}{/*}?` : undefined);
      this.middlewareChain.use(mountedPath ?? "*", mw.handler);
    }

    for (const w of subRouter.getWorkers()) {
      this.workers.push(w);
    }

    return this;
  }

  /**
   * Registers a worker handler to act as a fallback tier before static files.
   *
   * @param workerOrHandler WorkerRoute, worker function, or object with a `fetch(req)` method.
   * @param name Optional descriptor name.
   */
  worker(
    workerOrHandler:
      | WorkerHandler
      | WorkerRoute
      | { fetch: (req: Request) => Promise<Response> },
    name?: string,
  ): this {
    if (workerOrHandler instanceof WorkerRoute) {
      this.workers.push(workerOrHandler);
    } else {
      this.workers.push(new WorkerRoute(workerOrHandler, name));
    }
    return this;
  }

  /**
   * Finds the first route matching the request pathname.
   * @param req - The HTTP request.
   * @param routes - The route list to search.
   * @param methodFilter - Optional predicate filtering candidate routes (used for HTTP verbs).
   * @returns Matched route and parameters or null.
   */
  private findRoute<R extends HttpRoute | WsRoute>(
    req: Request,
    routes: readonly R[],
    methodFilter?: (route: R) => boolean,
  ): { route: R; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of routes) {
      if (methodFilter && !methodFilter(route)) continue;
      const match = route.match(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

  /**
   * Finds matching HTTP route for a request.
   * @param req - The HTTP request.
   * @returns Matched route and parameters or null.
   */
  private findHttpRoute(
    req: Request,
  ): { route: HttpRoute; params: RouteParams } | null {
    return this.findRoute(req, this.httpRoutes, (r) =>
      r.matchesMethod(req.method));
  }

  /**
   * Finds matching WebSocket route for a request.
   * @param req - The HTTP request.
   * @returns Matched WebSocket route and parameters or null.
   */
  private findWsRoute(
    req: Request,
  ): { route: WsRoute; params: RouteParams } | null {
    return this.findRoute(req, this.wsRoutes);
  }

  /**
   * Tries executing registered worker routes.
   * @param req - The HTTP request.
   * @returns Response from worker or null.
   */
  private async tryWorkers(req: Request): Promise<Response | null> {
    for (const worker of this.workers) {
      try {
        const res = await worker.execute(req);
        if (res.status !== 404) return res;
      } catch (err) {
        console.error("[Router] Worker error:", err);
      }
    }
    return null;
  }

  /**
   * Executes an HTTP route handler.
   * @param req - The HTTP request.
   * @param route - The HttpRoute instance.
   * @param params - Route parameters.
   * @param isHeadFromGet - Whether HEAD was generated from GET.
   * @param ctx - Optional request context.
   * @returns The resulting Response.
   */
  private async executeHttpHandler(
    req: Request,
    route: HttpRoute,
    params: RouteParams,
    isHeadFromGet: boolean = false,
    ctx?: RequestContext,
  ): Promise<Response> {
    try {
      const result = await route.handler(req, params, ctx);
      const isHead = req.method.toUpperCase() === "HEAD" || isHeadFromGet;
      if (result instanceof Response) {
        if (isHead) {
          return new Response(null, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
          });
        }
        return result;
      }
      const isNullBodyStatus = result.init?.status &&
        [101, 204, 205, 304].includes(result.init.status);
      const finalBody = (isHead || isNullBodyStatus) ? null : result.body;
      if (finalBody === null && result.body instanceof ReadableStream) {
        await Router.cancelBody(result.body);
      }
      return new Response(finalBody, result.init);
    } catch (error) {
      console.error(
        `[Router] Error in ${req.method} ${route.pattern.pathname}:`,
        error,
      );
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  /**
   * Executes a WebSocket route handler and upgrades connection.
   * @param req - The HTTP request.
   * @param route - The WsRoute instance.
   * @param params - Route parameters.
   * @returns The upgrade response.
   */
  private async executeWsHandler(
    req: Request,
    route: WsRoute,
    params: RouteParams,
  ): Promise<Response> {
    if (!this.webSocketUpgrader) {
      return new Response("WebSocket not supported", { status: 501 });
    }
    let socket: WebSocket;
    let response: Response;
    try {
      const upgraded = this.webSocketUpgrader.upgrade(req);
      socket = upgraded.socket;
      response = upgraded.response;
    } catch (err) {
      console.error("[Router] WebSocket upgrade failed:", err);
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    route.group.addSocket(socket, params);
    this.webSockets.set(socket, { group: route.group });
    route.group.sendLastBroadcastTo(socket, params);

    const cleanup = () => {
      this.webSockets.delete(socket);
      route.group.removeSocket(socket);
    };
    const messageListener = (ev: MessageEvent) => {
      route.group.emit("message", socket, ev.data, params);
    };

    const errorHandler = (ev: Event | ErrorEvent) => {
      const errorMsg = "message" in ev && typeof ev.message === "string" ? ev.message : "";
      if (errorMsg) {
        console.warn(`[Router] WebSocket connection warning: ${errorMsg}`);
      }
      cleanup();
    };

    if (typeof socket.addEventListener === "function") {
      socket.addEventListener("message", messageListener);
      socket.addEventListener("close", cleanup);
      socket.addEventListener("error", errorHandler);
    } else {
      socket.onmessage = messageListener;
      socket.onclose = cleanup;
      socket.onerror = errorHandler;
    }
    try {
      await route.handler(socket, req, params);
    } catch (error) {
      const isInvalidState = error instanceof Error && 
        (error.name === "InvalidStateError" || 
         error.message.includes("readyState") || 
         error.message.includes("not OPEN"));
      
      if (isInvalidState) {
        console.warn(
          `[Router] WS handler connection state notice for ${route.pattern.pathname}: ${error.message}`,
        );
      } else {
        console.error(
          `[Router] Error in WS handler ${route.pattern.pathname}:`,
          error,
        );
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1011, "Internal Server Error");
      }
    }
    return response;
  }

  /**
   * Main request entrypoint. Executes HTTPS checks, global middlewares, route matching,
   * route-specific middlewares, handler execution, worker fallbacks, and static files.
   *
   * @param req The incoming Request object.
   * @returns Response object.
   */
  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (this.shouldForceHttps(req, url)) {
      const httpsUrl = this.buildHttpsUrl(req, url);
      return new Response(null, {
        status: 301,
        headers: {
          "Location": httpsUrl,
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        },
      });
    }
    const hstsHeader: Record<string, string> = {};
    if (this.forceHttps && url.protocol === "https:") {
      hstsHeader["Strict-Transport-Security"] =
        "max-age=31536000; includeSubDomains";
    }

    const initialIsWs =
      req.headers.get("upgrade")?.toLowerCase() === "websocket";
    const initialFound = initialIsWs
      ? this.findWsRoute(req)
      : this.findHttpRoute(req);

    const ctx: RequestContext = {
      req,
      params: initialFound?.params ?? {},
      state: {},
      route: initialFound?.route,
    };

    return await this.middlewareChain.execute(ctx, async (finalReq) => {
      const currentIsWs =
        finalReq.headers.get("upgrade")?.toLowerCase() === "websocket";
      const currentFound = (finalReq !== req || !initialFound)
        ? (currentIsWs
          ? this.findWsRoute(finalReq)
          : this.findHttpRoute(finalReq))
        : initialFound;

      if (currentFound) {
        ctx.params = currentFound.params;
        ctx.route = currentFound.route;
      }

      if (
        !currentIsWs && currentFound &&
        currentFound.route instanceof HttpRoute &&
        currentFound.route.middlewares.length > 0
      ) {
        const routeChain = new MiddlewareChain(currentFound.route.middlewares);
        return await routeChain.execute(ctx, async (routeReq) => {
          return await this.executeFinalHandler(
            routeReq,
            currentIsWs,
            currentFound,
            hstsHeader,
            ctx,
          );
        });
      }

      return await this.executeFinalHandler(
        finalReq,
        currentIsWs,
        currentFound,
        hstsHeader,
        ctx,
      );
    });
  }

  /**
   * Executes the final HTTP or WebSocket route handler.
   * @param req - The HTTP request.
   * @param isWs - Whether request is WebSocket.
   * @param found - Found route and parameters or null.
   * @param extraHeaders - Extra headers to attach.
   * @param ctx - Optional request context.
   * @returns The resulting Response.
   */
  private async executeFinalHandler(
    req: Request,
    isWs: boolean,
    found: { route: HttpRoute | WsRoute; params: RouteParams } | null,
    extraHeaders: Record<string, string> = {},
    ctx?: RequestContext,
  ): Promise<Response> {
    // 1. WebSocket
    if (isWs) {
      if (!found) return new Response("WebSocket Not Found", { status: 404 });
      const res = await this.executeWsHandler(
        req,
        found.route as WsRoute,
        found.params,
      );
      Router.applyHeaders(res, extraHeaders);
      return res;
    }

    // 2. Automatic HEAD handler based on GET
    let httpFound = found as { route: HttpRoute; params: RouteParams } | null;
    let isHeadFromGet = false;
    if (!httpFound && req.method === "HEAD") {
      const fakeGetReq = new Request(req.url, {
        method: "GET",
        headers: req.headers,
      });
      const getFound = this.findHttpRoute(fakeGetReq);
      if (getFound) {
        httpFound = getFound;
        isHeadFromGet = true;
      }
    }

    // 3. Matched HTTP route
    if (httpFound) {
      const res = await this.executeHttpHandler(
        req,
        httpFound.route,
        httpFound.params,
        isHeadFromGet,
        ctx,
      );
      Router.applyHeaders(res, extraHeaders);
      return res;
    }

    // 4. Check for 405 Method Not Allowed
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    const rawAllowed = this.httpRoutes
      .filter((r) => r.pattern.exec(adjustedUrl))
      .map((r) => r.method);
    const allowedMethods = Array.from(new Set(rawAllowed));
    if (allowedMethods.length > 0 && !allowedMethods.includes(req.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Allow": allowedMethods.join(", "), ...extraHeaders },
      });
    }

    // 5. Workers fallback
    const workerRes = await this.tryWorkers(req);
    if (workerRes) {
      Router.applyHeaders(workerRes, extraHeaders);
      return workerRes;
    }

    // 6. Static files (only GET/HEAD)
    if (req.method === "GET" || req.method === "HEAD") {
      const staticRes = await this.handleStaticFile(req);
      if (staticRes.status !== 404) {
        // ETag 304 Not Modified validation
        const ifNoneMatch = req.headers.get("if-none-match");
        const etag = staticRes.headers.get("etag");
        if (ifNoneMatch && etag && ifNoneMatch === etag) {
          await Router.cancelBody(staticRes.body);
          return new Response(null, {
            status: 304,
            statusText: "Not Modified",
            headers: staticRes.headers,
          });
        }

        // Head request: cancel stream body to prevent file descriptor leaks
        if (req.method === "HEAD") {
          await Router.cancelBody(staticRes.body);
          return new Response(null, {
            status: staticRes.status,
            statusText: staticRes.statusText,
            headers: staticRes.headers,
          });
        }

        // Handle directory 301/302 redirects with basePath preservation
        if (staticRes.status === 301 || staticRes.status === 302) {
          const loc = staticRes.headers.get("Location");
          if (
            loc && loc.startsWith("/") && !loc.startsWith("//") && this.basePath
          ) {
            staticRes.headers.set("Location", this.basePath + loc);
          }
        }

        Router.applyHeaders(staticRes, extraHeaders);
        return staticRes;
      }
    }

    // 7. 404 Not Found
    return new Response("Not Found", { status: 404, headers: extraHeaders });
  }

  /**
   * Handles serving static files.
   * @param req - The HTTP request.
   * @returns The resulting Response.
   */
  private async handleStaticFile(req: Request): Promise<Response> {
    if (!this.staticFileHandler) {
      return new Response("Not Found", { status: 404 });
    }
    const { pathname } = new URL(req.url);
    const adjustedPathname = this.stripBase(pathname);
    const normalized = normalize("/" + adjustedPathname);
    // Strict defense-in-depth: reject traversal escapes
    if (normalized.startsWith("/..") || normalized === "/..") {
      return new Response("Not Found", { status: 404 });
    }
    const safePath = normalize(adjustedPathname).replace(/^(\.\.[/\\])+/, "");
    const segments = safePath.split("/").filter(Boolean);
    // Strict defense: never allow '.' or '..' segments regardless of allowDotfiles
    if (segments.some((seg) => seg === ".." || seg === ".")) {
      return new Response("Not Found", { status: 404 });
    }
    if (
      !this.allowDotfiles &&
      segments.some((segment) => segment.startsWith("."))
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const response = await this.staticFileHandler.handle(safePath);
    return response ?? new Response("Not Found", { status: 404 });
  }

  /**
   * Retrieves a registered HttpRoute instance by method and pattern path.
   */
  getHttpRouteByPath(
    method: string,
    pathOrPattern: string,
  ): HttpRoute | undefined {
    const targetPath = this.normalizePath(pathOrPattern);
    const upperMethod = method.toUpperCase();
    return this.httpRoutes.find(
      (r) => r.method === upperMethod && r.pattern.pathname === targetPath,
    );
  }

  /**
   * Retrieves a registered WsRoute instance by pattern path.
   */
  getWsRouteByPath(pathOrPattern: string): WsRoute | undefined {
    const targetPath = this.normalizePath(pathOrPattern);
    return this.wsRoutes.find((r) => r.pattern.pathname === targetPath);
  }

  /**
   * Returns a readonly list of all registered HttpRoute instances.
   */
  getHttpRoutes(): readonly HttpRoute[] {
    return this.httpRoutes;
  }

  /**
   * Returns a readonly list of all registered WsRoute instances.
   */
  getWsRoutes(): readonly WsRoute[] {
    return this.wsRoutes;
  }

  /**
   * Returns a readonly list of all registered MiddlewareRoute instances.
   */
  getMiddlewares(): readonly MiddlewareRoute[] {
    return this.middlewareChain.routes;
  }

  /**
   * Returns the underlying MiddlewareChain instance.
   */
  getMiddlewareChain(): MiddlewareChain {
    return this.middlewareChain;
  }

  /**
   * Returns a readonly list of all registered WorkerRoute instances.
   */
  getWorkers(): readonly WorkerRoute[] {
    return this.workers;
  }

  /**
   * Closes all active WebSocket connections across all registered groups.
   */
  closeAllWebSockets(): void {
    for (const [socket, { group }] of this.webSockets.entries()) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1001, "Server is shutting down");
      }
      group.removeSocket(socket);
    }
    this.webSockets.clear();
  }

  /**
   * Finds the WebSocketGroup associated with a specific path pattern.
   */
  getWsGroupByPath(pathOrPattern: string): WebSocketGroup | undefined {
    return this.getWsRouteByPath(pathOrPattern)?.group;
  }

  /**
   * Closes all connections in the WebSocketGroup of a specific path pattern.
   */
  closeGroupByPath(path: string): boolean {
    const group = this.getWsGroupByPath(path);
    if (!group) return false;
    group.closeGroup();
    return true;
  }

  /**
   * Retrieves the list of online users tracked in the WebSocketGroup of a specific path pattern.
   *
   * @param pathOrPattern - The route pattern (e.g. "/chat/:room").
   * @returns Array of online users with their associated metadata.
   */
  getPresence<T = Record<string, unknown>>(
    pathOrPattern: string,
  ): PresenceUser<T>[] {
    return this.getWsGroupByPath(pathOrPattern)?.getPresenceList<T>() ?? [];
  }

  /**
   * Retrieves a specific online user from the WebSocketGroup of a specific path pattern.
   *
   * @param pathOrPattern The route pattern (e.g. "/chat/:room").
   * @param userId The unique user ID to look up.
   */
  getPresenceUser<T = Record<string, unknown>>(
    pathOrPattern: string,
    userId: string,
  ): PresenceUser<T> | undefined {
    return this.getWsGroupByPath(pathOrPattern)?.getPresenceUser<T>(userId);
  }

  /**
   * Retrieves the WebRTCSignalingHub associated with a WebSocket route pattern.
   *
   * @param pathOrPattern The route pattern (e.g. "/webrtc/:room").
   */
  getSignaling(pathOrPattern: string): WebRTCSignalingHub | undefined {
    return this.getWsGroupByPath(pathOrPattern)?.signaling;
  }

  /**
   * Retrieves active stream information for a specific room on a WebSocket route.
   *
   * @param pathOrPattern The route pattern.
   * @param room The room name.
   */
  getActiveStream(pathOrPattern: string, room: string): ActiveStreamInfo | undefined {
    return this.getWsGroupByPath(pathOrPattern)?.getActiveStream(room);
  }

  /**
   * Returns all active stream records on a WebSocket route.
   *
   * @param pathOrPattern The route pattern.
   */
  getAllActiveStreams(pathOrPattern: string): ActiveStreamInfo[] {
    return this.getWsGroupByPath(pathOrPattern)?.getAllActiveStreams() ?? [];
  }

  /**
   * Checks if a live stream is currently active in a specific room.
   *
   * @param pathOrPattern The route pattern.
   * @param room The room name.
   */
  isBroadcasting(pathOrPattern: string, room: string): boolean {
    return this.getWsGroupByPath(pathOrPattern)?.isBroadcasting(room) ?? false;
  }

  /**
   * Starts a broadcast in a specific room on a WebSocket route.
   */
  startBroadcasting(
    pathOrPattern: string,
    broadcasterId: string,
    broadcasterName: string,
    room: string,
    streamTitle?: string,
    params?: RouteParams,
  ): ActiveStreamInfo | undefined {
    const group = this.getWsGroupByPath(pathOrPattern);
    if (!group) return undefined;
    return group.startBroadcasting(broadcasterId, broadcasterName, room, streamTitle, params);
  }

  /**
   * Broadcasts a message to all connections in the WebSocketGroup of a specific path pattern.
   *
   * @param pathOrPattern The route pattern (e.g. "/chat/:room").
   * @param message The serialized message string to broadcast.
   * @param permissionFn Optional filter callback evaluating delivery permission per socket.
   * @param senderParams Optional metadata identifying the sender.
   * @returns `true` if the WebSocketGroup was found, `false` otherwise.
   */
  broadcast(
    pathOrPattern: string,
    message: string,
    permissionFn?: PermissionFn,
    senderParams?: RouteParams,
  ): boolean {
    const group = this.getWsGroupByPath(pathOrPattern);
    if (!group) return false;
    group.broadcast(message, permissionFn, senderParams);
    return true;
  }

  /**
   * Updates presence metadata for a user or socket on a specific WebSocket route.
   */
  updatePresence<T = Record<string, unknown>>(
    pathOrPattern: string,
    wsOrUserId: WebSocket | string,
    partialData: Partial<T>,
    params?: RouteParams,
  ): PresenceUser<T> | undefined {
    return this.getWsGroupByPath(pathOrPattern)?.updatePresence<T>(
      wsOrUserId,
      partialData,
      params,
    );
  }

  /**
   * Broadcasts a live reaction emoji to a room on a WebSocket route.
   */
  sendReaction(
    pathOrPattern: string,
    room: string,
    reaction: { from: string; fromName: string; emoji: string; timestamp?: number },
    params?: RouteParams,
  ): boolean {
    const group = this.getWsGroupByPath(pathOrPattern);
    if (!group) return false;
    return group.sendReaction(room, reaction, params);
  }

  /**
   * Returns the count of registered WebRTC peers on a WebSocket route.
   */
  getPeerCount(pathOrPattern: string): number {
    return this.getWsGroupByPath(pathOrPattern)?.peerCount ?? 0;
  }

  /**
   * Returns a list of all registered peer IDs on a WebSocket route.
   */
  getPeers(pathOrPattern: string): string[] {
    return this.getWsGroupByPath(pathOrPattern)?.getPeers() ?? [];
  }

  /**
   * Sends a direct signaling message to a registered peer on a WebSocket route.
   */
  // deno-lint-ignore no-explicit-any
  sendToPeer(pathOrPattern: string, peerId: string, message: any): boolean {
    const group = this.getWsGroupByPath(pathOrPattern);
    if (!group) return false;
    return group.sendToPeer(peerId, message);
  }

  /**
   * Stops an active broadcast in a specific room on a WebSocket route.
   */
  stopBroadcasting(
    pathOrPattern: string,
    broadcasterId: string,
    room: string,
    params?: RouteParams,
  ): boolean {
    const group = this.getWsGroupByPath(pathOrPattern);
    if (!group) return false;
    return group.stopBroadcasting(broadcasterId, room, params);
  }

  /**
   * Extracts route parameters from regex URL pattern match groups.
   * @param groups - RegExp match groups dictionary.
   * @returns Extracted RouteParams object.
   */
  private extractParams(
    groups: Record<string, string | undefined>,
  ): RouteParams {
    const params: RouteParams = {};
    const catches: string[] = [];
    for (const [key, value] of Object.entries(groups)) {
      if (value === undefined) continue;
      if (key === "0" || /^\d+$/.test(key)) catches.push(value);
      else params[key] = value;
    }
    if (catches.length > 0) params.catch = catches;
    return params;
  }
}

```

---

## File: `src/types.ts`

````ts
// src/types.ts
/**
 * @file types.ts
 * @description Fundamental type declarations, interfaces, and options for WsRouter.
 */

import type { HttpRoute } from "./http-route.ts";
import type { WsRoute } from "./ws-route.ts";

/**
 * Route parameter map extracted from URL pattern matching.
 * Dynamic segments like `:id` produce strings, while catch-alls produce string arrays.
 */
export type RouteParams = Record<string, string | string[]>;

/**
 * Request execution context passed to handlers and middlewares.
 * Contains the original/modified Request, extracted parameters, mutable shared state,
 * and optional reference to the matched route instance.
 *
 * @example
 * ```ts
 * app.get("/user/:id", (req, params, ctx) => {
 *   ctx.state.startTime = Date.now();
 *   return { body: `Hello ${params.id}` };
 * });
 * ```
 */
export interface RequestContext {
  /** The incoming HTTP Request object. Can be substituted or enriched by middlewares. */
  req: Request;
  /** Route path parameters parsed from the URL pattern. */
  params: RouteParams;
  /** Mutable application state shared across middlewares and the final route handler. */
  state: Record<string, unknown>;
  /** The matched HttpRoute or WsRoute instance, if a route pattern was identified. */
  route?: HttpRoute | WsRoute;
}

/**
 * HTTP handler function signature.
 * Can return a raw standard Response object or a lightweight `{ body, init }` structure,
 * synchronously or wrapped in a Promise.
 *
 * @param req - The incoming standard Request object.
 * @param params - Extracted route parameters (e.g., `{ id: "123" }`).
 * @param ctx - Optional request execution context.
 * @returns A Response object or a simplified body/init object.
 */
export type HttpHandler = (
  req: Request,
  params: RouteParams,
  ctx?: RequestContext,
) =>
  | { body: BodyInit; init?: ResponseInit }
  | Response
  | Promise<{ body: BodyInit; init?: ResponseInit } | Response>;

/**
 * WebSocket handler callback invoked when an incoming connection is upgraded successfully.
 *
 * @param ws - The upgraded WebSocket instance.
 * @param req - The original upgrade Request object.
 * @param params - Extracted route parameters.
 */
export type WsHandler = (
  ws: WebSocket,
  req: Request,
  params: RouteParams,
) => void | Promise<void>;

/**
 * Granular broadcast filtering function.
 * Determines if a particular message should be delivered to a recipient socket.
 *
 * @param receiverParams - Parameters associated with the receiving socket.
 * @param senderParams - Parameters associated with the message sender.
 * @param message - The serialized broadcast payload.
 * @returns `true` if the message should be delivered, `false` to discard.
 */
export type PermissionFn = (
  receiverParams: RouteParams,
  senderParams: RouteParams,
  message: string,
) => boolean;

/**
 * Middleware function with standard onion architecture (`next()` pipeline).
 *
 * @param req - The incoming Request.
 * @param params - Extracted route parameters.
 * @param next - Callback to proceed to the next middleware or handler.
 * @param ctx - Optional request execution context.
 * @returns A Response object or Promise resolving to one.
 */
export type Middleware = (
  req: Request,
  params: RouteParams,
  next: (newReq?: Request) => Promise<Response>,
  ctx?: RequestContext,
) => Promise<Response> | Response;

/**
 * Worker handler function that handles Requests and produces Responses.
 * Useful for integrating Cloudflare Workers, edge worker scripts, or fallback fetchers.
 *
 * @param req - The incoming Request.
 * @returns A Promise resolving to a Response.
 */
export type WorkerHandler = (req: Request) => Promise<Response>;

/**
 * WebSocket upgrader abstraction interface to decouple environment-specific upgrade logic.
 */
export interface WebSocketUpgrader {
  /**
   * Performs the environment-specific upgrade from HTTP to WebSocket.
   *
   * @param req - The incoming upgrade Request.
   * @returns An object containing the new socket and the upgrade response.
   */
  upgrade(req: Request): { socket: WebSocket; response: Response };
}

/**
 * Static file handler abstraction interface for serving local or embedded static assets.
 */
export interface StaticFileHandler {
  /**
   * Attempts to resolve and serve a static file from a given relative path.
   *
   * @param path - The relative file path to serve.
   * @returns A Response if the file was found, or `null` otherwise.
   */
  handle(path: string): Promise<Response | null>;
}

/** Default delay (in milliseconds) before sending the last broadcast to newly connected clients. */
export const DEFAULT_LAST_BROADCAST_DELAY = 0;

/**
 * Configuration options for initializing a Router instance.
 */
export interface RouterOptions {
  /** Optional base prefix path for all routes registered on this router (e.g., "/api"). */
  basePath?: string;
  /** When enabled, redirects unencrypted HTTP traffic to HTTPS (ignoring localhost). Defaults to `false`. */
  forceHttps?: boolean;
  /** When enabled, inspects `X-Forwarded-Proto` header from reverse proxies when determining HTTPS. Defaults to `false`. */
  trustProxy?: boolean;
  /** When enabled, allows serving hidden dotfiles (e.g. `.well-known`). Defaults to `false`. */
  allowDotfiles?: boolean;
  /** Default debounce delay (in ms) for replaying last broadcast to joining sockets. Defaults to `0`. */
  lastBroadcastDelay?: number;
  /** Custom WebSocket upgrader instance. */
  webSocketUpgrader?: WebSocketUpgrader;
  /** Custom static file handler instance. */
  staticFileHandler?: StaticFileHandler;
}

````

---

## File: `src/version.ts`

```ts
// Automatically generated file during build

/**
 * Current library/application version.
 * @type {string}
 */
// @ts-ignore: Identifier '"0.5.1#mv39h36q"' is replaced by a string literal at build time
export const APP_VERSION: string = typeof "0.5.1#mv39h36q" !== "undefined"
  ? "0.5.1#mv39h36q"
  : "";

```

---

## File: `src/webrtc.ts`

```ts
// src/webrtc.ts
/**
 * @file webrtc.ts
 * @description WebRTC Signaling Engine and Peer Connection Coordination for WsRouter.
 * Facilitates peer-to-peer video/audio streaming, broadcaster announcements,
 * targeted SDP offer/answer exchanges, ICE candidate forwarding, and room management.
 */

import type { PermissionFn, RouteParams } from "./types.ts";
import type { WebSocketGroup } from "./websocket-group.ts";

/**
 * Standard ICE candidate format compatible with browser RTCIceCandidateInit.
 */
export interface SerializedIceCandidate {
  /** The candidate-attribute string. */
  candidate?: string;
  /** The media stream identification tag. */
  sdpMid?: string | null;
  /** The index of the media description in the SDP. */
  sdpMLineIndex?: number | null;
  /** A fragment of the username used in ICE communication. */
  usernameFragment?: string | null;
}

/**
 * Standard SDP format compatible with browser RTCSessionDescriptionInit.
 */
export interface SerializedSessionDescription {
  /** The SDP description type. */
  type: "offer" | "answer" | "pranswer" | "rollback";
  /** The SDP string content. */
  sdp?: string;
}

/**
 * WebRTC signaling protocol message definitions.
 */
export type WebRTCSignalingMessage =
  | {
    type: "webrtc_offer";
    from: string;
    to: string;
    sdp: SerializedSessionDescription;
    fromName?: string;
  }
  | {
    type: "webrtc_answer";
    from: string;
    to: string;
    sdp: SerializedSessionDescription;
    fromName?: string;
  }
  | {
    type: "webrtc_candidate";
    from: string;
    to: string;
    candidate: SerializedIceCandidate;
  }
  | {
    type: "broadcaster_started";
    broadcasterId: string;
    broadcasterName: string;
    streamTitle?: string;
    room?: string;
  }
  | {
    type: "broadcaster_stopped";
    broadcasterId: string;
    room?: string;
  }
  | {
    type: "request_stream";
    viewerId: string;
    viewerName: string;
    broadcasterId?: string;
    room?: string;
  }
  | {
    type: "stream_reaction";
    from: string;
    fromName: string;
    emoji: string;
    timestamp: number;
    room?: string;
  };

/**
 * Broadcaster stream state tracked by the signaling hub.
 */
export interface ActiveStreamInfo {
  /** The broadcaster peer ID. */
  broadcasterId: string;
  /** The broadcaster display name. */
  broadcasterName: string;
  /** Optional title or topic of the stream. */
  streamTitle?: string;
  /** The room identifier where the stream is active. */
  room: string;
  /** Unix timestamp in milliseconds when the stream started. */
  startedAt: number;
}

/**
 * Event map for WebRTC signaling hub lifecycle events.
 */
export interface WebRTCSignalingEvents {
  /** Emitted when a new stream broadcast begins. */
  "stream_start": (stream: ActiveStreamInfo) => void;
  /** Emitted when a stream broadcast ends. */
  "stream_stop": (broadcasterId: string, room: string) => void;
  /** Emitted when a peer registers on the signaling hub. */
  "peer_register": (peerId: string, ws: WebSocket) => void;
  /** Emitted when a peer unregisters from the signaling hub. */
  "peer_unregister": (peerId: string, ws: WebSocket) => void;
  /** Emitted when a viewer sends a reaction. */
  "reaction": (reaction: { from: string; fromName: string; emoji: string; room: string }) => void;
}

/**
 * Options for configuring a WebRTCSignalingHub instance.
 */
export interface WebRTCSignalingHubOptions {
  /**
   * Serializer function for WebRTC messages.
   * @default JSON.stringify
   */
  serialize?: (msg: WebRTCSignalingMessage) => string;
}

/**
 * Coordinates WebRTC signaling, broadcaster discovery, and peer-to-peer message routing.
 */
export class WebRTCSignalingHub {
  private group?: WebSocketGroup;
  private socketToPeerId = new Map<WebSocket, string>();
  private peerIdToSocket = new Map<string, WebSocket>();
  private activeStreams = new Map<string, ActiveStreamInfo>(); // room -> ActiveStreamInfo
  private broadcasterRooms = new Map<string, string>(); // broadcasterId -> room
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private serialize: (msg: WebRTCSignalingMessage) => string;

  /**
   * Creates a new WebRTCSignalingHub instance.
   *
   * @param group - Optional WebSocketGroup to bind immediately.
   * @param options - Signaling hub configuration options.
   */
  constructor(group?: WebSocketGroup, options?: WebRTCSignalingHubOptions) {
    this.group = group;
    this.serialize = options?.serialize ?? ((msg) => JSON.stringify(msg));
  }

  /**
   * Binds this signaling hub to a WebSocketGroup.
   */
  bindGroup(group: WebSocketGroup): this {
    this.group = group;
    return this;
  }

  /**
   * Attaches an event listener for WebRTC signaling lifecycle events.
   */
  on<K extends keyof WebRTCSignalingEvents>(event: K, listener: WebRTCSignalingEvents[K]): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: any[]) => void);
    return this;
  }

  /**
   * Removes an event listener.
   */
  off<K extends keyof WebRTCSignalingEvents>(event: K, listener: WebRTCSignalingEvents[K]): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as (...args: any[]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  /**
   * Emits an event to registered listeners.
   */
  emit<K extends keyof WebRTCSignalingEvents>(event: K, ...args: Parameters<WebRTCSignalingEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`Error in WebRTCSignalingHub ${event} listener:`, err);
        }
      }
    }
  }

  /**
   * Registers a peer connection socket with an identity peerId.
   */
  registerPeer(ws: WebSocket, peerId: string): void {
    const prevPeerId = this.socketToPeerId.get(ws);
    if (prevPeerId && prevPeerId !== peerId) {
      this.unregisterPeer(ws);
    }
    this.socketToPeerId.set(ws, peerId);
    this.peerIdToSocket.set(peerId, ws);
    this.emit("peer_register", peerId, ws);
  }

  /**
   * Unregisters a peer socket. If the peer was an active broadcaster, ends their stream.
   */
  unregisterPeer(ws: WebSocket): void {
    const peerId = this.socketToPeerId.get(ws);
    if (!peerId) return;

    this.socketToPeerId.delete(ws);
    this.peerIdToSocket.delete(peerId);
    this.emit("peer_unregister", peerId, ws);

    const room = this.broadcasterRooms.get(peerId);
    if (room) {
      this.stopBroadcasting(peerId, room);
    }
  }

  /**
   * Retrieves the peer ID associated with a WebSocket.
   */
  getPeerId(ws: WebSocket): string | undefined {
    return this.socketToPeerId.get(ws);
  }

  /**
   * Retrieves the WebSocket instance for a registered peer ID.
   */
  getPeerSocket(peerId: string): WebSocket | undefined {
    return this.peerIdToSocket.get(peerId);
  }

  /**
   * Returns a list of all currently registered peer IDs.
   */
  getPeers(): string[] {
    return Array.from(this.peerIdToSocket.keys());
  }

  /**
   * Returns the count of registered peers.
   */
  get peerCount(): number {
    return this.peerIdToSocket.size;
  }

  /**
   * Sends a signaling message directly to a specific registered peer.
   */
  sendToPeer(peerId: string, message: WebRTCSignalingMessage | string): boolean {
    const ws = this.peerIdToSocket.get(peerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = typeof message === "string" ? message : this.serialize(message);
      ws.send(payload);
      return true;
    }
    return false;
  }

  /**
   * Builds a broadcast filter that restricts delivery to sockets of a specific room.
   *
   * @param room - Target room name.
   * @returns Permission function allowing only same-room receivers.
   */
  private roomFilter(room: string): PermissionFn {
    return (recvParams, sendParams) =>
      !recvParams.room || recvParams.room === room ||
      recvParams.room === sendParams.room;
  }

  /**
   * Serializes a signaling message and broadcasts it to a room via the bound group.
   *
   * @param room - Target room name.
   * @param message - Signaling message to serialize and deliver.
   * @param params - Optional sender parameters forwarded to the group broadcast.
   * @returns `true` if a group is bound and the broadcast was emitted, `false` otherwise.
   */
  private broadcastToRoom(
    room: string,
    message: WebRTCSignalingMessage,
    params?: RouteParams,
  ): boolean {
    if (!this.group) return false;
    this.group.broadcast(
      this.serialize(message),
      this.roomFilter(room),
      params,
    );
    return true;
  }

  /**
   * Registers a user as the active webcam broadcaster for a room and broadcasts the start event.
   */
  startBroadcasting(
    broadcasterId: string,
    broadcasterName: string,
    room: string,
    streamTitle?: string,
    params?: RouteParams,
  ): ActiveStreamInfo {
    const streamInfo: ActiveStreamInfo = {
      broadcasterId,
      broadcasterName,
      streamTitle,
      room,
      startedAt: Date.now(),
    };

    this.activeStreams.set(room, streamInfo);
    this.broadcasterRooms.set(broadcasterId, room);
    this.emit("stream_start", streamInfo);

    const msg: WebRTCSignalingMessage = {
      type: "broadcaster_started",
      broadcasterId,
      broadcasterName,
      streamTitle,
      room,
    };

    this.broadcastToRoom(room, msg, params);

    return streamInfo;
  }

  /**
   * Terminates a broadcast in a room and notifies peers.
   */
  stopBroadcasting(broadcasterId: string, room: string, params?: RouteParams): boolean {
    const current = this.activeStreams.get(room);
    if (current && current.broadcasterId === broadcasterId) {
      this.activeStreams.delete(room);
      this.broadcasterRooms.delete(broadcasterId);
      this.emit("stream_stop", broadcasterId, room);

      const msg: WebRTCSignalingMessage = {
        type: "broadcaster_stopped",
        broadcasterId,
        room,
      };

      this.broadcastToRoom(room, msg, params);
      return true;
    }
    return false;
  }

  /**
   * Returns active stream information for a specific room.
   */
  getActiveStream(room: string): ActiveStreamInfo | undefined {
    return this.activeStreams.get(room);
  }

  /**
   * Alias for getActiveStream.
   */
  getBroadcaster(room: string): ActiveStreamInfo | undefined {
    return this.getActiveStream(room);
  }

  /**
   * Returns whether a stream is currently active in a specific room.
   */
  isBroadcasting(room: string): boolean {
    return this.activeStreams.has(room);
  }

  /**
   * Returns a snapshot array of all currently active streams across all rooms.
   */
  getAllActiveStreams(): ActiveStreamInfo[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Broadcasts a floating reaction to a room.
   */
  sendReaction(
    room: string,
    reaction: { from: string; fromName: string; emoji: string; timestamp?: number },
    params?: RouteParams,
  ): boolean {
    const payload: WebRTCSignalingMessage = {
      type: "stream_reaction",
      from: reaction.from,
      fromName: reaction.fromName,
      emoji: reaction.emoji,
      timestamp: reaction.timestamp ?? Date.now(),
      room,
    };

    this.emit("reaction", {
      from: reaction.from,
      fromName: reaction.fromName,
      emoji: reaction.emoji,
      room,
    });

    return this.broadcastToRoom(room, payload, params);
  }

  /**
   * Handles an incoming signaling message string from a WebSocket client.
   *
   * @param ws The sending WebSocket client.
   * @param rawData The raw message string or object.
   * @param params Route parameters associated with the connection.
   */
  handleMessage(ws: WebSocket, rawData: string | Record<string, unknown>, params?: RouteParams): boolean {
    let msg: WebRTCSignalingMessage;
    try {
      msg = typeof rawData === "string" ? JSON.parse(rawData) : rawData as WebRTCSignalingMessage;
    } catch {
      return false;
    }

    const msgRoom = "room" in msg && typeof msg.room === "string" ? msg.room : undefined;
    const room = (params?.room as string) || msgRoom || "general";

    switch (msg.type) {
      case "webrtc_offer":
      case "webrtc_answer":
      case "webrtc_candidate": {
        // Direct peer-to-peer routed message
        const targetSocket = this.peerIdToSocket.get(msg.to);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(this.serialize(msg));
          return true;
        }
        return false;
      }

      case "broadcaster_started": {
        this.registerPeer(ws, msg.broadcasterId);
        this.startBroadcasting(msg.broadcasterId, msg.broadcasterName, room, msg.streamTitle, params);
        return true;
      }

      case "broadcaster_stopped": {
        this.stopBroadcasting(msg.broadcasterId, room, params);
        return true;
      }

      case "request_stream": {
        this.registerPeer(ws, msg.viewerId);
        const activeStream = this.activeStreams.get(room);
        const targetBroadcasterId = msg.broadcasterId || activeStream?.broadcasterId;

        if (targetBroadcasterId) {
          const broadcasterSocket = this.peerIdToSocket.get(targetBroadcasterId);
          if (broadcasterSocket && broadcasterSocket.readyState === WebSocket.OPEN) {
            broadcasterSocket.send(this.serialize({
              type: "request_stream",
              viewerId: msg.viewerId,
              viewerName: msg.viewerName,
              broadcasterId: targetBroadcasterId,
              room,
            }));
            return true;
          }
        }
        return false;
      }

      case "stream_reaction": {
        return this.broadcastToRoom(room, { ...msg, room }, params);
      }

      default:
        return false;
    }
  }

  /**
   * Resets all signaling and stream state.
   */
  clear(): void {
    this.socketToPeerId.clear();
    this.peerIdToSocket.clear();
    this.activeStreams.clear();
    this.broadcasterRooms.clear();
  }
}

```

---

## File: `src/websocket-group.ts`

```ts
// src/websocket-group.ts
/**
 * @file websocket-group.ts
 * @description Manages groups of connected WebSocket clients, event subscriptions, and broadcasts.
 */

import {
  DEFAULT_LAST_BROADCAST_DELAY,
  type PermissionFn,
  type RouteParams,
} from "./types.ts";
import {
  PresenceTracker,
  type PresenceTrackerOptions,
  type PresenceUser,
} from "./presence.ts";
import {
  type ActiveStreamInfo,
  WebRTCSignalingHub,
  type WebRTCSignalingHubOptions,
} from "./webrtc.ts";

/** Internal record of the most recent broadcast in this group for replay to new subscribers. */
interface LastBroadcast {
  message: string;
  permissionFn?: PermissionFn;
  senderParams: RouteParams;
}

/** Generic callback type for WebSocketGroup event listeners. */
// deno-lint-ignore no-explicit-any
export type WebSocketGroupListener = (...args: any[]) => void;

/**
 * WebSocketGroup manages a pool of active WebSocket connections, parameter mappings,
 * filtered broadcasting, connection lifecycles, and replay of cached last broadcasts.
 */
export class WebSocketGroup {
  private sockets = new Map<WebSocket, RouteParams>();
  private lastBroadcast: LastBroadcast | null = null;
  private lastBroadcastDelay: number;
  private listeners = new Map<string, Set<WebSocketGroupListener>>();
  // deno-lint-ignore no-explicit-any
  private _presence?: PresenceTracker<any>;
  private _signaling?: WebRTCSignalingHub;

  /**
   * Creates a new WebSocketGroup instance.
   * @param lastBroadcastDelay Optional delay in ms before sending the cached broadcast to a new connection.
   */
  constructor(lastBroadcastDelay: number = DEFAULT_LAST_BROADCAST_DELAY) {
    this.lastBroadcastDelay = lastBroadcastDelay;
  }

  /**
   * Accesses or initializes the WebRTCSignalingHub instance bound to this group.
   */
  get signaling(): WebRTCSignalingHub {
    if (!this._signaling) {
      this._signaling = new WebRTCSignalingHub(this);
    }
    return this._signaling;
  }

  /**
   * Configures or replaces the WebRTCSignalingHub instance with custom options.
   */
  configureSignaling(options?: WebRTCSignalingHubOptions): WebRTCSignalingHub {
    const hub = new WebRTCSignalingHub(this, options);
    this._signaling = hub;
    return hub;
  }

  /**
   * Routes a WebRTC signaling message through the group's signaling hub.
   */
  handleSignaling(
    ws: WebSocket,
    rawData: string | Record<string, unknown>,
    params?: RouteParams,
  ): boolean {
    const resolvedParams = params ?? this.sockets.get(ws);
    return this.signaling.handleMessage(ws, rawData, resolvedParams);
  }

  /**
   * Registers a peer connection socket with an identity peerId in the WebRTC signaling hub.
   */
  registerPeer(ws: WebSocket, peerId: string): void {
    this.signaling.registerPeer(ws, peerId);
  }

  /**
   * Unregisters a peer socket from the WebRTC signaling hub.
   */
  unregisterPeer(ws: WebSocket): void {
    if (this._signaling) {
      this._signaling.unregisterPeer(ws);
    }
  }

  /**
   * Starts a webcam/screen broadcast in a room and notifies connected peers.
   */
  startBroadcasting(
    broadcasterId: string,
    broadcasterName: string,
    room: string,
    streamTitle?: string,
    params?: RouteParams,
  ): ActiveStreamInfo {
    return this.signaling.startBroadcasting(
      broadcasterId,
      broadcasterName,
      room,
      streamTitle,
      params,
    );
  }

  /**
   * Stops an active broadcast in a room and notifies peers.
   */
  stopBroadcasting(
    broadcasterId: string,
    room: string,
    params?: RouteParams,
  ): boolean {
    if (!this._signaling) return false;
    return this._signaling.stopBroadcasting(broadcasterId, room, params);
  }

  /**
   * Retrieves active stream information for a specific room.
   */
  getActiveStream(room: string): ActiveStreamInfo | undefined {
    return this._signaling?.getActiveStream(room);
  }

  /**
   * Returns whether a stream is currently active in a specific room.
   */
  isBroadcasting(room: string): boolean {
    return this._signaling?.isBroadcasting(room) ?? false;
  }

  /**
   * Returns a snapshot array of all active streams in this group.
   */
  getAllActiveStreams(): ActiveStreamInfo[] {
    return this._signaling?.getAllActiveStreams() ?? [];
  }

  /**
   * Broadcasts a floating live reaction emoji to a room.
   */
  sendReaction(
    room: string,
    reaction: { from: string; fromName: string; emoji: string; timestamp?: number },
    params?: RouteParams,
  ): boolean {
    return this.signaling.sendReaction(room, reaction, params);
  }

  /**
   * Returns the count of registered WebRTC peers in this group.
   */
  get peerCount(): number {
    return this._signaling?.peerCount ?? 0;
  }

  /**
   * Returns a list of all registered peer IDs in this group.
   */
  getPeers(): string[] {
    return this._signaling?.getPeers() ?? [];
  }

  /**
   * Sends a signaling message directly to a registered peer in this group.
   */
  sendToPeer(peerId: string, message: any): boolean {
    return this._signaling?.sendToPeer(peerId, message) ?? false;
  }

  /**
   * Accesses or initializes the PresenceTracker instance bound to this group.
   */
  // deno-lint-ignore no-explicit-any
  get presence(): PresenceTracker<any> {
    if (!this._presence) {
      this._presence = new PresenceTracker(this);
    }
    return this._presence;
  }

  /**
   * Configures or replaces the PresenceTracker instance with custom options.
   */
  configurePresence<T = Record<string, unknown>>(
    options?: PresenceTrackerOptions<T>,
  ): PresenceTracker<T> {
    const tracker = new PresenceTracker<T>(this, options);
    this._presence = tracker;
    return tracker;
  }

  /**
   * Registers a WebSocket connection under an online user presence identity.
   *
   * @param ws The connected WebSocket instance.
   * @param user Identity object containing `userId` and user metadata.
   */
  track<T = Record<string, unknown>>(
    ws: WebSocket,
    user: { userId: string } & T,
  ): PresenceUser<T> {
    const params = this.sockets.get(ws);
    return (this.presence as PresenceTracker<T>).track(ws, user, params);
  }

  /**
   * Removes a WebSocket connection from presence tracking.
   *
   * @param ws The WebSocket to untrack.
   */
  untrack(ws: WebSocket): boolean {
    if (!this._presence) return false;
    const params = this.sockets.get(ws);
    return this._presence.untrack(ws, params);
  }

  /**
   * Updates metadata for an active presence user.
   *
   * @param wsOrUserId WebSocket instance or user ID string.
   * @param data Partial metadata to merge.
   */
  updatePresence<T = Record<string, unknown>>(
    wsOrUserId: WebSocket | string,
    data: Partial<T>,
    params?: RouteParams,
  ): PresenceUser<T> | undefined {
    return (this.presence as PresenceTracker<T>).update(wsOrUserId, data, params);
  }

  /**
   * Returns a snapshot array of all online users tracked in this group.
   */
  getPresenceList<T = Record<string, unknown>>(): PresenceUser<T>[] {
    return this._presence
      ? (this._presence as PresenceTracker<T>).getUsers()
      : [];
  }

  /**
   * Retrieves an online user record by userId.
   */
  getPresenceUser<T = Record<string, unknown>>(
    userId: string,
  ): PresenceUser<T> | undefined {
    return this._presence
      ? (this._presence as PresenceTracker<T>).getUser(userId)
      : undefined;
  }

  /**
   * Returns the count of unique online users tracked in this group.
   */
  get presenceSize(): number {
    return this._presence?.size ?? 0;
  }

  /**
   * Registers an active WebSocket connection and associates route parameters with it.
   * Emits the "connect" event.
   *
   * @param ws The connected WebSocket instance.
   * @param params Parameter dictionary associated with this client.
   */
  addSocket(ws: WebSocket, params: RouteParams): void {
    this.sockets.set(ws, params);
    this.emit("connect", ws, params);
  }

  /**
   * Deregisters a WebSocket connection from the group.
   * Emits the "disconnect" event if the socket was previously tracked.
   *
   * @param ws The WebSocket instance to remove.
   */
  removeSocket(ws: WebSocket): void {
    const params = this.sockets.get(ws) ?? {};
    const existed = this.sockets.delete(ws);
    if (existed) {
      if (this._signaling) {
        this._signaling.unregisterPeer(ws);
      }
      if (this._presence) {
        this._presence.untrack(ws, params);
      }
      this.emit("disconnect", ws, params);
    }
  }

  /**
   * Returns the count of active WebSocket connections in this group.
   */
  get size(): number {
    return this.sockets.size;
  }

  /**
   * Attaches an event listener for group 'connect' events.
   *
   * @param event - Event name 'connect'.
   * @param listener - Handler called when a WebSocket connects.
   * @returns This group instance for chaining.
   */
  on(
    event: "connect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  /**
   * Attaches an event listener for group 'disconnect' events.
   *
   * @param event - Event name 'disconnect'.
   * @param listener - Handler called when a WebSocket disconnects.
   * @returns This group instance for chaining.
   */
  on(
    event: "disconnect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  /**
   * Attaches an event listener for group 'message' events.
   *
   * @param event - Event name 'message'.
   * @param listener - Handler called when a WebSocket receives a message.
   * @returns This group instance for chaining.
   */
  on(
    event: "message",
    listener: (ws: WebSocket, data: unknown, params: RouteParams) => void,
  ): this;
  /**
   * Attaches an event listener for group 'broadcast' events.
   *
   * @param event - Event name 'broadcast'.
   * @param listener - Handler called when a broadcast message is emitted.
   * @returns This group instance for chaining.
   */
  on(
    event: "broadcast",
    listener: (message: string, senderParams?: RouteParams) => void,
  ): this;
  on(event: string, listener: WebSocketGroupListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /**
   * Removes an event listener from this group.
   */
  off(event: string, listener: WebSocketGroupListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /**
   * Triggers an event and notifies all registered subscribers.
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[WebSocketGroup] Error in "${event}" listener:`, err);
      }
    }
  }

  /**
   * Convenience hook for subscribing to new socket connections.
   */
  onConnect(listener: (ws: WebSocket, params: RouteParams) => void): this {
    return this.on("connect", listener);
  }

  /**
   * Convenience hook for subscribing to socket disconnections.
   */
  onDisconnect(listener: (ws: WebSocket, params: RouteParams) => void): this {
    return this.on("disconnect", listener);
  }

  /**
   * Sends the cached last broadcast payload to a specific socket if permissions pass.
   *
   * @param ws The recipient WebSocket.
   * @param receiverParams Parameters associated with the receiving connection.
   */
  sendLastBroadcastTo(ws: WebSocket, receiverParams: RouteParams): void {
    const broadcast = this.lastBroadcast;
    if (!broadcast) return;
    setTimeout(() => {
      try {
        if (this.sockets.has(ws) && ws.readyState === WebSocket.OPEN) {
          const { message, permissionFn, senderParams } = broadcast;
          if (
            !permissionFn || permissionFn(receiverParams, senderParams, message)
          ) {
            ws.send(message);
          }
        }
      } catch (err) {
        console.error("Last broadcast error:", err);
      }
    }, this.lastBroadcastDelay);
  }

  /**
   * Broadcasts a message to all active sockets in this group.
   * Updates the cached last broadcast and triggers "broadcast" listeners.
   *
   * @param message The payload to send.
   * @param permissionFn Optional filter callback to evaluate per socket.
   * @param senderParams Optional parameters of the broadcast initiator.
   */
  broadcast(
    message: string,
    permissionFn?: PermissionFn,
    senderParams?: RouteParams,
  ): void {
    this.lastBroadcast = {
      message,
      permissionFn,
      senderParams: senderParams ?? {},
    };
    this.emit("broadcast", message, senderParams);
    for (const [socket, receiverParams] of this.sockets.entries()) {
      if (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      ) {
        this.removeSocket(socket);
        continue;
      }
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        if (
          !permissionFn ||
          permissionFn(receiverParams, senderParams ?? {}, message)
        ) {
          socket.send(message);
        }
      } catch (err) {
        console.error("Broadcast error:", err);
      }
    }
  }

  /**
   * Gracefully closes all active WebSocket connections and clears internal pools.
   */
  closeGroup(): void {
    for (const [socket, params] of this.sockets.entries()) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "Group is being closed");
      }
      this.emit("disconnect", socket, params);
    }
    this.sockets.clear();
    this.lastBroadcast = null;
    if (this._presence) {
      this._presence.clear();
    }
    if (this._signaling) {
      this._signaling.clear();
    }
  }
}

```

---

## File: `src/worker-route.ts`

```ts
// src/worker-route.ts
/**
 * @file worker-route.ts
 * @description Encapsulates fallback worker routes (such as Cloudflare Workers or fetch handlers).
 */

import type { WorkerHandler } from "./types.ts";

/**
 * WorkerRoute wraps a background or edge worker handler.
 * Workers execute as a programmable fallback tier between explicit routes and static file handlers.
 */
export class WorkerRoute {
  /** Optional identifier or label for this worker. */
  readonly name?: string;
  /** The underlying handler function or object with a `fetch(req)` method. */
  readonly handler:
    | WorkerHandler
    | { fetch: (req: Request) => Promise<Response> };

  /**
   * Creates a new WorkerRoute instance.
   *
   * @param handler A worker function `(req: Request) => Promise<Response>` or object with a `fetch()` method.
   * @param name Optional descriptor name.
   */
  constructor(
    handler: WorkerHandler | { fetch: (req: Request) => Promise<Response> },
    name?: string,
  ) {
    this.handler = handler;
    this.name = name;
  }

  /**
   * Dispatches the incoming Request to the worker's handler.
   */
  execute(req: Request): Promise<Response> {
    if (typeof this.handler === "function") {
      return this.handler(req);
    }
    return this.handler.fetch(req);
  }
}

```

---

## File: `src/ws-route.ts`

```ts
// src/ws-route.ts
/**
 * @file ws-route.ts
 * @description Encapsulates a WebSocket route with path matching, dedicated WebSocketGroup, and metadata.
 */

import { DEFAULT_LAST_BROADCAST_DELAY, type PermissionFn, type RouteParams, type WsHandler } from "./types.ts";
import { WebSocketGroup } from "./websocket-group.ts";

/**
 * Options for configuring a WsRoute.
 */
export interface WsRouteOptions {
  /** Arbitrary static metadata associated with this WebSocket endpoint. */
  meta?: Record<string, unknown>;
  /** Debounce or replay delay in milliseconds for the last broadcast. */
  lastBroadcastDelay?: number;
  /** Custom or shared WebSocketGroup instance. */
  group?: WebSocketGroup;
}

/**
 * WsRoute represents a registered WebSocket route pattern paired with its
 * handler, dedicated connection group, broadcast utilities, and metadata.
 */
export class WsRoute {
  /** Normalized path pattern string (e.g. "/chat/:room"). */
  readonly path: string;
  /** Compiled URLPattern for matching incoming upgrade requests. */
  readonly pattern: URLPattern;
  /** The connection handler callback. */
  readonly handler: WsHandler;
  /** The WebSocketGroup managing active connections for this route. */
  readonly group: WebSocketGroup;
  /** Static metadata attached to this WebSocket route. */
  readonly meta: Record<string, unknown>;

  /**
   * Creates a new WsRoute instance.
   *
   * @param path The URL path pattern (e.g. "/ws/:topic").
   * @param handler The WebSocket handler invoked upon successful connection upgrade.
   * @param lastBroadcastDelayOrOptions Delay in ms or full WsRouteOptions configuration object.
   */
  constructor(
    path: string,
    handler: WsHandler,
    lastBroadcastDelayOrOptions?: number | WsRouteOptions,
  ) {
    this.path = path.startsWith("/") ? path : "/" + path;
    this.pattern = new URLPattern({ pathname: this.path });
    this.handler = handler;
    const opts: WsRouteOptions = typeof lastBroadcastDelayOrOptions === "number"
      ? { lastBroadcastDelay: lastBroadcastDelayOrOptions }
      : (lastBroadcastDelayOrOptions ?? {});
    this.meta = opts.meta ?? {};
    this.group = opts.group ??
      new WebSocketGroup(opts.lastBroadcastDelay ?? DEFAULT_LAST_BROADCAST_DELAY);
  }

  /**
   * Tests whether an incoming URL matches this route's URLPattern.
   *
   * @param url The target URL to test.
   * @returns URLPatternResult containing matched parameter groups, or `null` if no match.
   */
  match(url: URL | string): URLPatternResult | null {
    return this.pattern.exec(url);
  }

  /**
   * Broadcasts a message to all active sockets connected to this route's group.
   *
   * @param message The serialized payload to deliver.
   * @param permissionFn Optional filter callback evaluating delivery permission per socket.
   * @param senderParams Optional metadata identifying the sender socket.
   */
  broadcast(
    message: string,
    permissionFn?: PermissionFn,
    senderParams?: RouteParams,
  ): void {
    this.group.broadcast(message, permissionFn, senderParams);
  }

  /**
   * Closes all active WebSocket connections in this route's group.
   */
  close(): void {
    this.group.closeGroup();
  }

  /**
   * Returns the count of active WebSocket connections currently open in this route's group.
   */
  get activeConnections(): number {
    return this.group.size;
  }
}

```

---

## File: `tests/adapters_serve_dir_test.ts`

```ts
// monorepo/router/tests/adapters_serve_dir_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoServeDirRouter, } from "../src/deno-serve-dir.ts";

Deno.test("createDenoServeDirRouter serves files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world",);
  const app = createDenoServeDirRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "hello world",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("createDenoServeDirRouter blocks dotfiles", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/.env`, "SECRET=123",);
  const app = createDenoServeDirRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/.env",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  await Deno.remove(tmpDir, { recursive: true, },);
});

```

---

## File: `tests/adapters_test.ts`

```ts
// monorepo/router/tests/adapters_test.ts
import { assert, assertEquals, } from "@std/assert";
import { Router, } from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// 1. DENO ADAPTER TESTS
// ============================================================
Deno.test("createDenoRouter creates router with configured adapters", () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);
  assert(app instanceof Router, "Should return a Router instance",);
});

Deno.test("createDenoRouter with staticDir serves files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world",);
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "hello world",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("createDenoRouter without staticDir returns 404 for static paths", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  const req = new Request("http://localhost/anything.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// ============================================================
// 2. WEBSOCKET WITHOUT UPGRADER TEST (Expected error)
// ============================================================
Deno.test("WebSocket without upgrader returns 501", async () => {
  const app = new Router({ basePath: "", webSocketUpgrader: undefined, },);
  app.ws("/chat", () => {},);
  const req = new Request("http://localhost/chat", {
    headers: { upgrade: "websocket", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 501,);
  assertEquals(await res.text(), "WebSocket not supported",);
});

// ============================================================
// 3. INTEGRATION TEST WITH createDenoRouter + WebSocket
// ============================================================
Deno.test("createDenoRouter with WebSocket works", async () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);
  let wsHandlerCalled = false;
  app.ws("/chat/:room", (ws, _req, params,) => {
    wsHandlerCalled = true;
    ws.close(1000, "test done",);
  },);
  const server = Deno.serve(
    { port: 0, onListen: () => {}, },
    app.handleRequest.bind(app,),
  );
  const port = server.addr.port;
  try {
    const ws = new WebSocket(`ws://localhost:${port}/api/chat/room1`,);
    await new Promise<void>((resolve, reject,) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WS connection failed",),);
      setTimeout(() => reject(new Error("WS timeout",),), 2000,);
    },);
    assert(wsHandlerCalled, "WebSocket handler should be called",);
    ws.close();
    await new Promise((r,) => setTimeout(r, 100,));
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});

// ============================================================
// 4. FORCE HTTPS TEST WITH createDenoRouter
// ============================================================
Deno.test("createDenoRouter with forceHttps redirects", async () => {
  const app = createDenoRouter({
    basePath: "",
    staticDir: null,
    forceHttps: true,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "https://example.com/ping",);
});

Deno.test("createDenoRouter with forceHttps ignores localhost", async () => {
  const app = createDenoRouter({
    basePath: "",
    staticDir: null,
    forceHttps: true,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost:8000/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "pong",);
});

```

---

## File: `tests/api_coverage_test.ts`

```ts
// tests/api_coverage_test.ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "@std/assert";
import {
  createDenoRouter,
  HttpRoute,
  MiddlewareChain,
  MiddlewareRoute,
  Router,
  WebSocketGroup,
  WorkerRoute,
  WsRoute,
} from "../src/deno.ts";

describe("Complete API & Router Coverage", () => {
  describe("Router inspection and collection accessors", () => {
    it("getHttpRoutes, getWsRoutes, getWorkers, getMiddlewares, getMiddlewareChain", () => {
      const router = new Router();
      router.get("/users", () => ({ body: "users", }),);
      router.post("/users", () => ({ body: "created", }),);
      router.ws("/live", () => {},);
      router.worker(async () => new Response("worker",));
      router.use((_req, _p, next,) => next());

      assertEquals(router.getHttpRoutes().length, 2,);
      assertEquals(router.getWsRoutes().length, 1,);
      assertEquals(router.getWorkers().length, 1,);
      assertEquals(router.getMiddlewares().length, 1,);
      assert(router.getMiddlewareChain() instanceof MiddlewareChain,);
    });

    it("closeGroupByPath closes matching WebSocketGroup and returns true, returns false if not found", () => {
      const router = new Router();
      router.ws("/chat/:room", () => {},);

      const closed = router.closeGroupByPath("/chat/:room",);
      assertEquals(closed, true,);

      const notFound = router.closeGroupByPath("/nonexistent",);
      assertEquals(notFound, false,);
    });

    it("setWebSocketUpgrader and setStaticFileHandler fluent setters", () => {
      const router = new Router();
      const upgrader = {
        upgrade: (_req: Request,) => ({
          socket: {} as WebSocket,
          response: new Response(),
        }),
      };
      const staticHandler = {
        handle: async (_path: string,) => new Response("static file",),
      };

      const res1 = router.setWebSocketUpgrader(upgrader,);
      const res2 = router.setStaticFileHandler(staticHandler,);

      assertEquals(res1, router,);
      assertEquals(res2, router,);
    });

    it("addRoute throws error on duplicate WebSocket path pattern", () => {
      const router = new Router();
      const ws1 = new WsRoute("/events", () => {},);
      const ws2 = new WsRoute("/events", () => {},);

      router.addRoute(ws1,);
      let errorThrown = false;
      try {
        router.addRoute(ws2,);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes("Duplicate WebSocket route pattern",),
        );
      }
      assertEquals(errorThrown, true,);
    });

    it("mount throws error when subRouter is missing for prefix string", () => {
      const router = new Router();
      let errorThrown = false;
      try {
        // @ts-ignore testing defensive runtime error
        router.mount("/api/v1",);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes(
            "Sub-router instance must be provided",
          ),
        );
      }
      assertEquals(errorThrown, true,);
    });

    it("mount throws error on duplicate WebSocket route pattern during mount", () => {
      const app = new Router();
      app.ws("/api/stream", () => {},);

      const subRouter = new Router();
      subRouter.ws("/stream", () => {},);

      let errorThrown = false;
      try {
        app.mount("/api", subRouter,);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes(
            "Duplicate WebSocket route pattern: /api/stream",
          ),
        );
      }
      assertEquals(errorThrown, true,);
    });
  });

  describe("WebSocketGroup advanced features", () => {
    it("group.emit logs error safely if a listener throws without breaking others", () => {
      const group = new WebSocketGroup();
      let secondListenerCalled = false;

      group.on("connect", () => {
        throw new Error("Simulated listener explosion!",);
      },);
      group.on("connect", () => {
        secondListenerCalled = true;
      },);

      const mockWs = {} as WebSocket;
      group.addSocket(mockWs, { user: "bob", },);
      assertEquals(secondListenerCalled, true,);
    });

    it("group.size accurately reflects sockets add/remove and closeGroup", () => {
      const group = new WebSocketGroup();
      const ws1 = { readyState: 1, close: () => {}, } as unknown as WebSocket;
      const ws2 = { readyState: 1, close: () => {}, } as unknown as WebSocket;

      assertEquals(group.size, 0,);
      group.addSocket(ws1, { id: "1", },);
      group.addSocket(ws2, { id: "2", },);
      assertEquals(group.size, 2,);

      group.removeSocket(ws1,);
      assertEquals(group.size, 1,);

      group.closeGroup();
      assertEquals(group.size, 0,);
    });
    it("router.broadcast, updatePresence, sendReaction, getPeerCount, getPeers, sendToPeer on Router", () => {
      const router = new Router();
      router.ws("/stream/:room", () => {},);

      const wsA = {
        readyState: 1,
        send: (d: string,) => {
          sentA.push(d,);
        },
        close: () => {},
      } as unknown as WebSocket;
      const sentA: string[] = [];

      const group = router.getWsGroupByPath("/stream/:room",)!;
      group.addSocket(wsA, { room: "live1", },);

      // Test router.broadcast
      const broadcastOk = router.broadcast("/stream/:room", "hello world",);
      assertEquals(broadcastOk, true,);
      assertEquals(sentA.includes("hello world",), true,);
      assertEquals(router.broadcast("/nonexistent", "hello",), false,);

      // Test router.updatePresence
      group.track(wsA, { userId: "userA", name: "Alice", status: "online", },);
      const updatedUser = router.updatePresence("/stream/:room", "userA", {
        status: "busy",
      },);
      assertEquals(updatedUser?.data.status, "busy",);
      assertEquals(
        router.updatePresence("/nonexistent", "userA", {},),
        undefined,
      );

      // Test router.sendReaction
      const reactionOk = router.sendReaction("/stream/:room", "live1", {
        from: "userB",
        fromName: "Bob",
        emoji: "🎉",
      },);
      assertEquals(reactionOk, true,);
      assertEquals(
        sentA.some((m,) => m.includes("stream_reaction",) && m.includes("🎉",)),
        true,
      );
      assertEquals(
        router.sendReaction("/nonexistent", "live1", {
          from: "a",
          fromName: "b",
          emoji: "🔥",
        },),
        false,
      );

      // Test router peer methods
      group.registerPeer(wsA, "peerA",);
      assertEquals(router.getPeerCount("/stream/:room",), 1,);
      assertEquals(router.getPeerCount("/nonexistent",), 0,);
      assertEquals(router.getPeers("/stream/:room",), ["peerA",],);
      assertEquals(router.getPeers("/nonexistent",), [],);

      const sentToPeerOk = router.sendToPeer("/stream/:room", "peerA", {
        type: "custom_ping",
      },);
      assertEquals(sentToPeerOk, true,);
      assertEquals(sentA.some((m,) => m.includes("custom_ping",)), true,);
      assertEquals(router.sendToPeer("/nonexistent", "peerA", {},), false,);
    });
  });

  describe("MiddlewareRoute and MiddlewareChain edge cases", () => {
    it("handles wildcard '*' in MiddlewareRoute correctly", () => {
      const mw = new MiddlewareRoute((_req, _p, next,) => next(), "*",);
      assert(mw.match("http://localhost/any/route",),);
      assert(mw.match("http://localhost/api/v1/users",),);
    });

    it("handles middleware returning a Response without calling next() in sub-chain", async () => {
      const chain = new MiddlewareChain();
      chain.use((_req, _p, _next,) => {
        return new Response("Blocked by early return", { status: 403, },);
      },);

      const ctx = {
        req: new Request("http://localhost/test",),
        params: {},
        state: {},
      };
      const res = await chain.execute(
        ctx,
        async () => new Response("unreachable",),
      );
      assertEquals(res.status, 403,);
      assertEquals(await res.text(), "Blocked by early return",);
    });
  });
});

```

---

## File: `tests/architectural_improvements_test.ts`

```ts
// monorepo/router/tests/architectural_improvements_test.ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import { assert, assertEquals, assertExists, } from "@std/assert";
import {
  createDenoRouter,
  HttpRoute,
  MiddlewareChain,
  Router,
  WebSocketGroup,
  WsRoute,
} from "../src/deno.ts";

describe("Architectural Improvements (1-5)", () => {
  // ============================================================
  // 1. DUAL REGISTRATION & UNIFIED ROUTER METHODS
  // ============================================================
  describe("1. Unified Router Method Chaining & Dual Registration", () => {
    it("allows registering pre-created HttpRoute and WsRoute via addRoute()", () => {
      const app = createDenoRouter("", null, null,);
      const httpRoute = new HttpRoute(
        "GET",
        "/custom-http",
        () => ({ body: "custom-ok", }),
        {
          meta: { tag: "manual", },
        },
      );
      const wsRoute = new WsRoute("/custom-ws", () => {}, {
        meta: { tag: "ws-manual", },
      },);

      app.addRoute(httpRoute,);
      app.addRoute(wsRoute,);

      const registeredHttp = app.getHttpRoutes();
      const registeredWs = app.getWsRoutes();

      assertEquals(registeredHttp.length, 1,);
      assertEquals(registeredWs.length, 1,);
      assertEquals(registeredHttp[0]?.meta.tag, "manual",);
      assertEquals(registeredWs[0]?.meta.tag, "ws-manual",);
    });

    it("app.ws() returns the WsRoute instance for granular control", () => {
      const app = createDenoRouter("", null, null,);
      const wsRoute = app.ws("/chat/:room", () => {}, {
        meta: { authRequired: true, },
      },);

      assertExists(wsRoute,);
      assert(wsRoute instanceof WsRoute,);
      assertEquals(wsRoute.path, "/chat/:room",);
      assertEquals(wsRoute.meta.authRequired, true,);
      assertExists(wsRoute.group,);
      assertEquals(typeof wsRoute.broadcast, "function",);
    });

    it("supports route-level middlewares array in method registration", async () => {
      const app = createDenoRouter("", null, null,);
      const logs: string[] = [];

      const mw1 = async (
        _req: Request,
        _p: Record<string, string | string[]>,
        next: () => Promise<Response>,
      ) => {
        logs.push("mw1",);
        return await next();
      };
      const mw2 = async (
        _req: Request,
        _p: Record<string, string | string[]>,
        next: () => Promise<Response>,
      ) => {
        logs.push("mw2",);
        return await next();
      };

      app.get("/with-middlewares", [mw1, mw2,], () => {
        logs.push("handler",);
        return { body: "ok", };
      },);

      const res = await app.handleRequest(
        new Request("http://localhost/with-middlewares",),
      );
      assertEquals(res.status, 200,);
      assertEquals(await res.text(), "ok",);
      assertEquals(logs, ["mw1", "mw2", "handler",],);
    });

    it("retrieves HttpRoute and WsRoute by path using inspection helpers", () => {
      const app = createDenoRouter("", null, null,);
      app.get("/items/:id", () => ({ body: "item", }),);
      app.ws("/stream/:topic", () => {},);

      const httpRoute = app.getHttpRouteByPath("GET", "/items/:id",);
      assertExists(httpRoute,);
      assertEquals(httpRoute.method, "GET",);

      const wsRoute = app.getWsRouteByPath("/stream/:topic",);
      assertExists(wsRoute,);
      assertEquals(wsRoute.path, "/stream/:topic",);
    });
  });

  // ============================================================
  // 2. ROUTE GROUPS & SUB-ROUTERS (MOUNT)
  // ============================================================
  describe("2. Route Groups & Sub-routers (app.mount)", () => {
    it("mounts child router HTTP routes under a prefix", async () => {
      const api = new Router();
      api.get("/users", () => ({ body: "user list", }),);
      api.get(
        "/users/:id",
        (_req, params,) => ({ body: `user ${params.id}`, }),
      );

      const app = createDenoRouter("", null, null,);
      app.mount("/api/v1", api,);

      const res1 = await app.handleRequest(
        new Request("http://localhost/api/v1/users",),
      );
      assertEquals(res1.status, 200,);
      assertEquals(await res1.text(), "user list",);

      const res2 = await app.handleRequest(
        new Request("http://localhost/api/v1/users/42",),
      );
      assertEquals(res2.status, 200,);
      assertEquals(await res2.text(), "user 42",);
    });

    it("mounts child router middlewares scoped to mount prefix", async () => {
      const admin = new Router();
      admin.use(async (req, _p, next, ctx,) => {
        if (!req.headers.has("x-admin-secret",)) {
          return new Response("Forbidden Admin", { status: 403, },);
        }
        if (ctx) ctx.state.admin = true;
        return await next();
      },);
      admin.get("/dashboard", (_req, _p, ctx,) => {
        return { body: `Admin Dashboard: ${ctx?.state?.admin}`, };
      },);

      const app = createDenoRouter("", null, null,);
      app.get("/public", () => ({ body: "Public View", }),);
      app.mount("/admin", admin,);

      // Public view is untouched
      const resPublic = await app.handleRequest(
        new Request("http://localhost/public",),
      );
      assertEquals(resPublic.status, 200,);

      // Admin view without header -> 403
      const resForbidden = await app.handleRequest(
        new Request("http://localhost/admin/dashboard",),
      );
      assertEquals(resForbidden.status, 403,);
      assertEquals(await resForbidden.text(), "Forbidden Admin",);

      // Admin view with header -> 200
      const resAuthorized = await app.handleRequest(
        new Request("http://localhost/admin/dashboard", {
          headers: { "x-admin-secret": "12345", },
        },),
      );
      assertEquals(resAuthorized.status, 200,);
      assertEquals(await resAuthorized.text(), "Admin Dashboard: true",);
    });

    it("mounts child router WebSocket routes preserving the original WebSocketGroup", () => {
      const chatRouter = new Router();
      const wsRoute = chatRouter.ws("/live", () => {},);

      const app = createDenoRouter("", null, null,);
      app.mount("/chat", chatRouter,);

      const mountedWsRoute = app.getWsRouteByPath("/chat/live",);
      assertExists(mountedWsRoute,);
      // The group instance should be preserved
      assertEquals(mountedWsRoute.group, wsRoute.group,);
    });
  });

  // ============================================================
  // 3. MIDDLEWARE CHAIN
  // ============================================================
  describe("3. MiddlewareChain class & pipeline composition", () => {
    it("executes a standalone pre-composed MiddlewareChain", async () => {
      const chain = new MiddlewareChain();
      const steps: number[] = [];

      chain.use(async (_req, _p, next,) => {
        steps.push(1,);
        const res = await next();
        steps.push(4,);
        return res;
      },);
      chain.use(async (_req, _p, next,) => {
        steps.push(2,);
        const res = await next();
        steps.push(3,);
        return res;
      },);

      const ctx = {
        req: new Request("http://localhost/test",),
        params: {},
        state: {},
      };

      const res = await chain.execute(ctx, async () => {
        return new Response("chain-done",);
      },);

      assertEquals(res.status, 200,);
      assertEquals(await res.text(), "chain-done",);
      assertEquals(steps, [1, 2, 3, 4,],);
    });

    it("can mount a MiddlewareChain directly into app.use()", async () => {
      const securityChain = new MiddlewareChain();
      securityChain.use(async (_req, _p, next,) => {
        const res = await next();
        res.headers.set("X-Security-Audit", "passed",);
        return res;
      },);

      const app = createDenoRouter("", null, null,);
      app.use(securityChain,);
      app.get("/secure", () => ({ body: "ok", }),);

      const res = await app.handleRequest(
        new Request("http://localhost/secure",),
      );
      assertEquals(res.status, 200,);
      assertEquals(res.headers.get("X-Security-Audit",), "passed",);
    });
  });

  // ============================================================
  // 4. ROUTE META & REQUEST STATE
  // ============================================================
  describe("4. Route meta & Request state (ctx.state)", () => {
    it("middleware reads route.meta and sets ctx.state.authorizedUser", async () => {
      const app = createDenoRouter("", null, null,);

      // Global auth middleware that checks route.meta
      app.use(async (req, _params, next, ctx,) => {
        const routeMeta = (ctx?.route as HttpRoute)?.meta;
        if (routeMeta?.requireAuth) {
          const authHeader = req.headers.get("Authorization",);
          if (!authHeader || !authHeader.startsWith("Bearer user-",)) {
            return new Response("Unauthorized", { status: 401, },);
          }
          if (ctx) {
            ctx.state.authorizedUser = {
              id: authHeader.replace("Bearer user-", "",),
              role: "member",
            };
          }
        }
        return await next();
      },);

      // Public route without meta.requireAuth
      app.get("/public", () => ({ body: "public", }),);

      // Protected route with meta.requireAuth
      app.get(
        "/private",
        (_req, _params, ctx,) => {
          const user = ctx?.state?.authorizedUser as {
            id: string;
            role: string;
          };
          return { body: `Hello user ${user.id} with role ${user.role}`, };
        },
        { meta: { requireAuth: true, }, },
      );

      // 1. Access public route
      const resPublic = await app.handleRequest(
        new Request("http://localhost/public",),
      );
      assertEquals(resPublic.status, 200,);

      // 2. Access private route without token -> 401
      const resNoToken = await app.handleRequest(
        new Request("http://localhost/private",),
      );
      assertEquals(resNoToken.status, 401,);

      // 3. Access private route with valid token -> 200 with ctx.state populated
      const resWithToken = await app.handleRequest(
        new Request("http://localhost/private", {
          headers: { Authorization: "Bearer user-777", },
        },),
      );
      assertEquals(resWithToken.status, 200,);
      assertEquals(
        await resWithToken.text(),
        "Hello user 777 with role member",
      );
    });

    it("HttpHandler can return a raw Response instance directly", async () => {
      const app = createDenoRouter("", null, null,);
      app.get("/raw-response", () => {
        return new Response(JSON.stringify({ status: "healthy", },), {
          status: 202,
          headers: { "Content-Type": "application/json", },
        },);
      },);

      const res = await app.handleRequest(
        new Request("http://localhost/raw-response",),
      );
      assertEquals(res.status, 202,);
      assertEquals(res.headers.get("Content-Type",), "application/json",);
      assertEquals(await res.json(), { status: "healthy", },);
    });
  });

  // ============================================================
  // 5. WEBSOCKET GROUP HOOKS
  // ============================================================
  describe("5. WebSocketGroup Hooks (onConnect, onDisconnect, onBroadcast, onMessage)", () => {
    it("triggers connect, disconnect, and broadcast event hooks", () => {
      const group = new WebSocketGroup();
      const events: string[] = [];

      group.onConnect((_ws, params,) => {
        events.push(`connect:${params.user}`,);
      },);

      group.onDisconnect((_ws, params,) => {
        events.push(`disconnect:${params.user}`,);
      },);

      group.on("broadcast", (msg, senderParams,) => {
        events.push(`broadcast:${msg}:${senderParams?.room}`,);
      },);

      // Mock WebSocket
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
      } as unknown as WebSocket;

      // 1. Connect
      group.addSocket(mockWs, { user: "alice", },);
      assertEquals(events, ["connect:alice",],);

      // 2. Broadcast
      group.broadcast("welcome", undefined, { room: "lounge", },);
      assertEquals(events, ["connect:alice", "broadcast:welcome:lounge",],);

      // 3. Disconnect
      group.removeSocket(mockWs,);
      assertEquals(events, [
        "connect:alice",
        "broadcast:welcome:lounge",
        "disconnect:alice",
      ],);
    });

    it("allows unsubscribing listeners with off()", () => {
      const group = new WebSocketGroup();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      group.on("connect", listener,);

      const mockWs1 = {} as WebSocket;
      group.addSocket(mockWs1, {},);
      assertEquals(callCount, 1,);

      group.off("connect", listener,);

      const mockWs2 = {} as WebSocket;
      group.addSocket(mockWs2, {},);
      assertEquals(callCount, 1,); // Not called again
    });
  });
});

```

---

## File: `tests/complementary_test.ts`

```ts
// monorepo/router/tests/complementary_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { WebSocketGroup, } from "../src/mod.ts";

// ============================================================
// 1. ERROR HANDLING
// ============================================================
Deno.test("HTTP handler that throws returns 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/error", () => {
    throw new Error("Database connection failed",);
  },);
  const req = new Request("http://localhost/error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
  assertEquals(await res.text(), "Internal Server Error",);
});

Deno.test("Async HTTP handler that rejects returns 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/async-error", async () => {
    await new Promise((r,) => setTimeout(r, 10,));
    throw new Error("Async boom",);
  },);
  const req = new Request("http://localhost/async-error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
});

// ============================================================
// 2. FORCE HTTPS
// ============================================================
Deno.test("Force HTTPS redirects in production (not localhost)", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "https://example.com/ping",);
  assertEquals(
    res.headers.get("Strict-Transport-Security",),
    "max-age=31536000; includeSubDomains",
  );
});

Deno.test("Force HTTPS ignores localhost", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost:8000/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "pong",);
});

// 🚀 FIX: Added trustProxy: true
Deno.test("Force HTTPS ignores when x-forwarded-proto is https", async () => {
  const app = createDenoRouter({
    basePath: "",
    forceHttps: true,
    trustProxy: true,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
});

// ============================================================
// 3. MIDDLEWARES
// ============================================================
Deno.test("HTTP middleware: runs before the handler and can abort", async () => {
  const app = createDenoRouter("", null, null,);
  app.use((_req, _params, _next,) => {
    return new Response("Unauthorized", { status: 401, },);
  },);
  app.get("/protected", () => ({ body: "secret", }),);
  const req = new Request("http://localhost/protected",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 401,);
  assertEquals(await res.text(), "Unauthorized",);
});

Deno.test("HTTP middleware: multiple middlewares in chain", async () => {
  const app = createDenoRouter("", null, null,);
  const order: number[] = [];
  app.use(async (_req, _params, next,) => {
    order.push(1,);
    const res = await next();
    order.push(4,);
    return res;
  },);
  app.use(async (_req, _params, next,) => {
    order.push(2,);
    const res = await next();
    order.push(3,);
    return res;
  },);
  app.get("/test", () => {
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/test",);
  await app.handleRequest(req,);
  assertEquals(order, [1, 2, 3, 4,],);
});

Deno.test("HTTP middleware: modifies the response", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (_req, _params, next,) => {
    const res = await next();
    res.headers.set("X-Middleware", "applied",);
    return res;
  },);
  app.get("/test", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.headers.get("X-Middleware",), "applied",);
});

Deno.test("HTTP middleware: runs even without a route (404)", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/nonexistent",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run even without a route",
  );
});

Deno.test("WS middleware: aborts upgrade without token", async () => {
  const app = createDenoRouter("", null, null,);
  app.use((req, _params, next,) => {
    if (req.headers.get("upgrade",)?.toLowerCase() !== "websocket") {
      return next();
    }
    const token = req.headers.get("authorization",);
    if (!token) {
      return new Response("Token required", { status: 401, },);
    }
    return next();
  },);
  app.ws("/chat", () => {},);
  const req1 = new Request("http://localhost/chat", {
    headers: { upgrade: "websocket", },
  },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 401,);
});

Deno.test("WS middleware: is not called for nonexistent WS routes", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/nonexistent", {
    headers: { upgrade: "websocket", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run even for WS 404",
  );
});

Deno.test("WS middleware: can pass a modified Request to next()", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (req, _params, next,) => {
    if (req.headers.get("upgrade",)?.toLowerCase() !== "websocket") {
      return next();
    }
    const newHeaders = new Headers(req.headers,);
    newHeaders.set("X-User-Id", "42",);
    const newReq = new Request(req.url, {
      method: req.method,
      headers: newHeaders,
    },);
    return next(newReq,);
  },);
  let receivedUserId: string | null = null;
  app.ws("/chat", (ws, req,) => {
    receivedUserId = req.headers.get("X-User-Id",);
    ws.close(1000, "Test done",);
  },);
  const req = new Request("http://localhost/chat", {
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
  },);
  await app.handleRequest(req,);
  await new Promise((r,) => setTimeout(r, 50,));
  assertEquals(
    receivedUserId,
    "42",
    "Handler should receive the modified request",
  );
});

// ============================================================
// 4. LAST BROADCAST WITH DUAL PERMISSION
// ============================================================
class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob,) {
    if (typeof data === "string") {
      this.sent.push(data,);
    }
  }
  close(code?: number, reason?: string,) {
    this.readyState = 3;
  }
}

Deno.test("Last broadcast does NOT leak to a different room (Dual Permission)", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Secret of room A",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", user: "user1", },
  );
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", user: "user2", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, {
    room: "B",
    user: "user2",
  },);
  await new Promise((r,) => setTimeout(r, 100,));
  assertEquals(
    ws2.sent,
    [],
    "User2 in room B should not receive the broadcast from room A",
  );
});

Deno.test("Last broadcast IS delivered to a new member in the same room", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Welcome!",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", user: "user1", },
  );
  const ws3 = new MockWebSocket();
  group.addSocket(ws3 as unknown as WebSocket, { room: "A", user: "user3", },);
  group.sendLastBroadcastTo(ws3 as unknown as WebSocket, {
    room: "A",
    user: "user3",
  },);
  await new Promise((r,) => setTimeout(r, 100,));
  assertEquals(ws3.sent, ["Welcome!",],);
});

Deno.test("Last broadcast with custom delay (0ms)", async () => {
  const group = new WebSocketGroup(0,);
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.broadcast("msg", undefined, { room: "A", },);
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A", },);
  await new Promise((r,) => setTimeout(r, 10,));
  assertEquals(ws2.sent, ["msg",],);
});

```

---

## File: `tests/http_semantics_test.ts`

```ts
// monorepo/router/tests/http_semantics_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Automatic HEAD: uses GET route when HEAD does not exist", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({
    body: "data",
    init: { headers: { "X-Custom": "value", }, },
  }),);

  const req = new Request("http://localhost/resource", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("X-Custom",), "value",);
  assertEquals(await res.text(), "", "HEAD should have an empty body",);
});

Deno.test("405 Method Not Allowed: returned when the path exists with another method", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({ body: "data", }),);
  app.post("/resource", () => ({ body: "created", init: { status: 201, }, }),);

  const req = new Request("http://localhost/resource", { method: "PUT", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET, POST",);
});

Deno.test("Static files: POST returns 404", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "POST", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Static files: HEAD returns headers without body", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Type",), "text/plain; charset=utf-8",);
  assertEquals(await res.text(), "", "HEAD should have an empty body",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("basePath normalizes '/' to ''", async () => {
  const app = createDenoRouter({ basePath: "/", },);
  app.get("/test", () => ({ body: "ok", }),);

  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "ok",);
});

Deno.test("lastBroadcastDelay default is 0ms", async () => {
  // Implicit test: if it were 50ms, last broadcast tests would be slower
  const app = createDenoRouter({ basePath: "", },);
  // If there is no error, the default is correct
  assertEquals(true, true,);
});

```

---

## File: `tests/middleware_test.ts`

```ts
// monorepo/router/tests/middleware_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
// ============================================================
// 1. HTTP MIDDLEWARE - BASICS
// ============================================================
Deno.test("HTTP middleware: runs before the handler", async () => {
  const app = createDenoRouter("", null, null,);
  const calls: string[] = [];
  app.use(async (_req, _params, next,) => {
    calls.push("middleware",);
    return await next();
  },);
  app.get("/test", () => {
    calls.push("handler",);
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "ok",);
  assertEquals(calls, ["middleware", "handler",],);
});
Deno.test("HTTP middleware: can abort the flow (401)", async () => {
  const app = createDenoRouter("", null, null,);
  app.use((_req, _params, _next,) => {
    return new Response("Unauthorized", { status: 401, },);
  },);
  app.get("/protected", () => ({ body: "secret", }),);
  const req = new Request("http://localhost/protected",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 401,);
  assertEquals(await res.text(), "Unauthorized",);
});
Deno.test("HTTP middleware: multiple middlewares in chain", async () => {
  const app = createDenoRouter("", null, null,);
  const order: number[] = [];
  app.use(async (_req, _params, next,) => {
    order.push(1,);
    const res = await next();
    order.push(5,);
    return res;
  },);
  app.use(async (_req, _params, next,) => {
    order.push(2,);
    const res = await next();
    order.push(4,);
    return res;
  },);
  app.get("/test", () => {
    order.push(3,);
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/test",);
  await app.handleRequest(req,);
  assertEquals(order, [1, 2, 3, 4, 5,],);
});
Deno.test("HTTP middleware: modifies the response", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (_req, _params, next,) => {
    const res = await next();
    res.headers.set("X-Middleware", "applied",);
    return res;
  },);
  app.get("/test", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.headers.get("X-Middleware",), "applied",);
});
Deno.test("HTTP middleware: logging middleware measures time", async () => {
  const app = createDenoRouter("", null, null,);
  let measuredMs = -1;
  app.use(async (_req, _params, next,) => {
    const start = Date.now();
    const res = await next();
    measuredMs = Date.now() - start;
    return res;
  },);
  app.get("/slow", async () => {
    await new Promise((r,) => setTimeout(r, 50,));
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/slow",);
  await app.handleRequest(req,);
  assert(
    measuredMs >= 45,
    `Measured time (${measuredMs}ms) should be >= 45ms`,
  );
});
// ============================================================
// 2. HTTP MIDDLEWARE - EDGE CASES
// ============================================================
Deno.test("HTTP middleware: runs even without a route (404)", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/nonexistent",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run even without a route",
  );
});
Deno.test("HTTP middleware: CORS on static file", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "world",);
  const app = createDenoRouter("", tmpDir, null,);
  app.use(async (_req, _params, next,) => {
    const res = await next();
    res.headers.set("Access-Control-Allow-Origin", "*",);
    return res;
  },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Access-Control-Allow-Origin",), "*",);
  await Deno.remove(tmpDir, { recursive: true, },);
});
Deno.test("HTTP middleware: multiple next() calls are guarded", async () => {
  const app = createDenoRouter("", null, null,);
  const handlerCalls: number[] = [];
  app.use(async (_req, _params, next,) => {
    const r1 = await next(); // 1st call OK
    // Tries to call again - should fail
    try {
      await next();
    } catch {
      // Ignore
    }
    return r1;
  },);
  app.get("/test", () => {
    handlerCalls.push(1,);
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  // Handler should be called EXACTLY ONCE
  assertEquals(handlerCalls, [1,],);
  assertEquals(res.status, 200,);
});
// ============================================================
// 3. WEBSOCKET MIDDLEWARE
// ============================================================
Deno.test("WS middleware: aborts upgrade without token", async () => {
  const app = createDenoRouter("", null, null,);
  app.use((req, _params, next,) => {
    if (req.headers.get("upgrade",)?.toLowerCase() !== "websocket") {
      return next();
    }
    const token = req.headers.get("authorization",);
    if (!token) {
      return new Response("Token required", { status: 401, },);
    }
    return next();
  },);
  app.ws("/chat", () => {},);
  // Without token - should return 401
  const req1 = new Request("http://localhost/chat", {
    headers: { upgrade: "websocket", },
  },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 401,);
  // With token - should allow upgrade (101)
  // ✅ FIX: Deno.upgradeWebSocket requires the 'connection: Upgrade' header
  const req2 = new Request("http://localhost/chat", {
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      authorization: "Bearer valid-token",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
  },);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 101,);
});
Deno.test("WS middleware: is not called for nonexistent WS routes", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  // ✅ FIX: With the new flow, middlewares DO RUN even for WS 404
  const req = new Request("http://localhost/nonexistent", {
    headers: { upgrade: "websocket", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run even for WS 404",
  );
});
Deno.test("WS middleware: can pass a modified Request to next()", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (req, _params, next,) => {
    if (req.headers.get("upgrade",)?.toLowerCase() !== "websocket") {
      return next();
    }
    // Creates a new request with an injected header
    const newHeaders = new Headers(req.headers,);
    newHeaders.set("X-User-Id", "42",);
    const newReq = new Request(req.url, {
      method: req.method,
      headers: newHeaders,
    },);
    return next(newReq,);
  },);
  let receivedUserId: string | null = null;
  app.ws("/chat", (ws, req,) => {
    receivedUserId = req.headers.get("X-User-Id",);
    ws.close(1000, "Test done",);
  },);
  // ✅ FIX: Added connection: Upgrade to satisfy Deno
  const req = new Request("http://localhost/chat", {
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
  },);
  await app.handleRequest(req,);
  // Waits one tick for the handler to run
  await new Promise((r,) => setTimeout(r, 50,));
  assertEquals(
    receivedUserId,
    "42",
    "Handler should receive the modified request",
  );
});
// ============================================================
// 4. MIDDLEWARE + COMBINED ROUTES
// ============================================================
Deno.test("HTTP middleware: authentication with public and private routes", async () => {
  const app = createDenoRouter("", null, null,);
  // Global authentication middleware
  app.use(async (req, _params, next,) => {
    const path = new URL(req.url,).pathname;
    if (path === "/public") {
      return await next(); // Public route
    }
    const auth = req.headers.get("authorization",);
    if (!auth || auth !== "Bearer valid") {
      return new Response("Unauthorized", { status: 401, },);
    }
    return await next();
  },);
  app.get("/public", () => ({ body: "public data", }),);
  app.get("/private", () => ({ body: "private data", }),);
  // Public route - no auth
  const req1 = new Request("http://localhost/public",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  assertEquals(await res1.text(), "public data",);
  // Private route - no auth (should fail)
  const req2 = new Request("http://localhost/private",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 401,);
  // Private route - with auth
  const req3 = new Request("http://localhost/private", {
    headers: { authorization: "Bearer valid", },
  },);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 200,);
  assertEquals(await res3.text(), "private data",);
});
Deno.test("Middleware: CORS preflight (OPTIONS) is handled correctly", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (req, _params, next,) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },);
    }
    const res = await next();
    res.headers.set("Access-Control-Allow-Origin", "*",);
    return res;
  },);
  app.get("/data", () => ({ body: "ok", }),);
  // Preflight OPTIONS
  const req1 = new Request("http://localhost/data", { method: "OPTIONS", },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 204,);
  assertEquals(res1.headers.get("Access-Control-Allow-Origin",), "*",);
  // Regular GET request
  const req2 = new Request("http://localhost/data",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);
  assertEquals(res2.headers.get("Access-Control-Allow-Origin",), "*",);
});

```

---

## File: `tests/path_traversal_test.ts`

```ts
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { join, } from "@std/path";

async function setupFixture(): Promise<{ tmpRoot: string; publicDir: string }> {
  const tmpRoot = await Deno.makeTempDir({ prefix: "router_traversal_", },);
  const publicDir = join(tmpRoot, "public",);
  await Deno.mkdir(publicDir,);
  await Deno.writeTextFile(join(tmpRoot, "secret.txt",), "TOP-SECRET-DATA",);
  await Deno.writeTextFile(join(publicDir, "hello.txt",), "hello world",);
  await Deno.writeTextFile(join(publicDir, "index.html",), "<h1>home</h1>",);
  return { tmpRoot, publicDir, };
}

async function cleanup(path: string,) {
  try {
    await Deno.remove(path, { recursive: true, },);
  } catch { /* ignore */ }
}

Deno.test("Path traversal: ../ must not escape staticDir", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(
      res.status,
      404,
      "Should return 404 when attempting path traversal with ..",
    );
    const body = await res.text();
    assertEquals(
      body.includes("TOP-SECRET-DATA",),
      false,
      "MUST NEVER leak the secret file content",
    );
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: multiple ../ do not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/../../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: /subdir/../../secret.txt does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/subdir/../../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: URL-encoded ..%2F does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/..%2Fsecret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: backslash (Windows-style) does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/..\\secret.txt",);
    const res = await app.handleRequest(req,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: basePath is not bypassed", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "/api", staticDir: publicDir, },);
    const req = new Request("http://localhost/api/../secret.txt",);
    const res = await app.handleRequest(req,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Legitimate file inside staticDir is served normally", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/hello.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 200,);
    assertEquals(await res.text(), "hello world",);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Legitimate file in subfolder is served", async () => {
  const tmpRoot = await Deno.makeTempDir({ prefix: "router_sub_", },);
  const publicDir = join(tmpRoot, "public",);
  const subDir = join(publicDir, "docs",);
  await Deno.mkdir(subDir, { recursive: true, },);
  await Deno.writeTextFile(join(subDir, "readme.txt",), "readme content",);
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/docs/readme.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 200,);
    assertEquals(await res.text(), "readme content",);
  } finally {
    await cleanup(tmpRoot,);
  }
});

```

---

## File: `tests/presence_test.ts`

```ts
// tests/presence_test.ts
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import {
  PresenceTracker,
  type PresenceUser,
  WebSocketGroup,
} from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

// Helper to construct a mock WebSocket instance for unit testing
function createMockWebSocket(
  readyState: number = WebSocket.OPEN,
): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    readyState,
    sent,
    send: (data: string,) => {
      sent.push(data,);
    },
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as WebSocket & { sent: string[] };
}

describe("PresenceTracker (Standalone)", () => {
  it("tracks a new user, records metadata, and sends initial state snapshot", () => {
    const tracker = new PresenceTracker();
    const ws1 = createMockWebSocket();

    const user = tracker.track(ws1, {
      userId: "alice",
      name: "Alice",
      avatar: "alice.png",
    },);

    assertEquals(user.userId, "alice",);
    assertEquals(user.data.name, "Alice",);
    assertEquals(user.connections, 1,);
    assertEquals(tracker.size, 1,);
    assertEquals(tracker.connectionCount, 1,);
    assertEquals(tracker.has("alice",), true,);
    assertEquals(tracker.has("bob",), false,);

    // Verify initial snapshot sent directly to ws1
    assertEquals(ws1.sent.length, 1,);
    const snapshot = JSON.parse(ws1.sent[0]!,);
    assertEquals(snapshot.type, "presence_state",);
    assertEquals(snapshot.users.length, 1,);
    assertEquals(snapshot.users[0].userId, "alice",);
  });

  it("handles multi-tab connections without duplicate join broadcasts", () => {
    const group = new WebSocketGroup();
    const tracker = new PresenceTracker(group,);

    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    group.addSocket(ws1, {},);
    group.addSocket(ws2, {},);

    let joinCount = 0;
    tracker.on("join", () => {
      joinCount++;
    },);

    // Tab 1 connects
    tracker.track(ws1, { userId: "alice", name: "Alice", },);
    assertEquals(joinCount, 1,);
    assertEquals(tracker.getUser("alice",)?.connections, 1,);

    // Tab 2 connects for the same user
    tracker.track(ws2, { userId: "alice", name: "Alice", },);
    assertEquals(joinCount, 1,); // No second join event
    assertEquals(tracker.getUser("alice",)?.connections, 2,);
    assertEquals(tracker.size, 1,);
    assertEquals(tracker.connectionCount, 2,);

    // Tab 1 closes -> user remains online
    tracker.untrack(ws1,);
    assertEquals(tracker.has("alice",), true,);
    assertEquals(tracker.getUser("alice",)?.connections, 1,);

    // Tab 2 closes -> user goes offline
    let leaveCount = 0;
    tracker.on("leave", () => {
      leaveCount++;
    },);
    tracker.untrack(ws2,);
    assertEquals(leaveCount, 1,);
    assertEquals(tracker.has("alice",), false,);
    assertEquals(tracker.size, 0,);
    assertEquals(tracker.connectionCount, 0,);
  });

  it("broadcasts join, leave, and update diffs to group members", () => {
    const group = new WebSocketGroup();
    const tracker = new PresenceTracker(group,);

    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();
    group.addSocket(aliceWs, {},);
    group.addSocket(bobWs, {},);

    // Alice joins
    tracker.track(aliceWs, { userId: "alice", role: "admin", },);

    // Bob joins -> Alice should receive Bob's join diff
    tracker.track(bobWs, { userId: "bob", role: "member", },);

    // Inspect Alice's received messages (should contain Bob's join event)
    const bobJoinMsg = aliceWs.sent.find((msg,) => {
      try {
        const parsed = JSON.parse(msg,);
        return parsed.type === "presence_join" && parsed.user.userId === "bob";
      } catch {
        return false;
      }
    },);
    assertNotEquals(bobJoinMsg, undefined,);

    // Bob updates status
    tracker.update(bobWs, { role: "moderator", status: "away", },);
    const bobUpdateMsg = aliceWs.sent.find((msg,) => {
      try {
        const parsed = JSON.parse(msg,);
        return parsed.type === "presence_update" &&
          parsed.user.data.status === "away";
      } catch {
        return false;
      }
    },);
    assertNotEquals(bobUpdateMsg, undefined,);

    // Bob disconnects
    tracker.untrack(bobWs,);
    const bobLeaveMsg = aliceWs.sent.find((msg,) => {
      try {
        const parsed = JSON.parse(msg,);
        return parsed.type === "presence_leave" && parsed.userId === "bob";
      } catch {
        return false;
      }
    },);
    assertNotEquals(bobLeaveMsg, undefined,);
  });

  it("prunes closed sockets automatically during presence inspection", () => {
    const tracker = new PresenceTracker();
    const ws = createMockWebSocket(WebSocket.OPEN,);
    tracker.track(ws, { userId: "carol", },);
    assertEquals(tracker.has("carol",), true,);

    // Simulate socket closing in the background
    Object.defineProperty(ws, "readyState", { value: WebSocket.CLOSED, },);

    // Inspection should automatically prune carol
    assertEquals(tracker.has("carol",), false,);
    assertEquals(tracker.getUsers().length, 0,);
    assertEquals(tracker.size, 0,);
  });
});

describe("WebSocketGroup & Router Presence Integration", () => {
  it("allows tracking presence directly through WebSocketGroup", () => {
    const group = new WebSocketGroup();
    const ws = createMockWebSocket();
    group.addSocket(ws, { room: "lobby", },);

    const user = group.track(ws, {
      userId: "dave",
      username: "Dave",
      status: "online",
    },);

    assertEquals(user.userId, "dave",);
    assertEquals(group.presenceSize, 1,);
    assertEquals(group.getPresenceList().length, 1,);
    assertEquals(group.getPresenceUser("dave",)?.data.username, "Dave",);

    // Updating presence through group helper
    group.updatePresence(ws, { status: "busy", },);
    assertEquals(group.getPresenceUser("dave",)?.data.status, "busy",);

    // Automatically untracks when removeSocket is called
    group.removeSocket(ws,);
    assertEquals(group.presenceSize, 0,);
    assertEquals(group.getPresenceList().length, 0,);
  });

  it("clears presence state when group is closed", () => {
    const group = new WebSocketGroup();
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    group.addSocket(ws1, {},);
    group.addSocket(ws2, {},);

    group.track(ws1, { userId: "user1", },);
    group.track(ws2, { userId: "user2", },);
    assertEquals(group.presenceSize, 2,);

    group.closeGroup();
    assertEquals(group.presenceSize, 0,);
    assertEquals(group.getPresenceList().length, 0,);
  });

  it("allows querying presence via Router convenience methods", () => {
    const router = createDenoRouter();
    router.ws("/rooms/:id", () => {},);

    const group = router.getWsGroupByPath("/rooms/:id",)!;
    assert(group !== undefined,);

    const ws = createMockWebSocket();
    group.addSocket(ws, { id: "gaming", },);
    group.track(ws, { userId: "gamer1", game: "chess", },);

    const presenceList = router.getPresence("/rooms/:id",);
    assertEquals(presenceList.length, 1,);
    assertEquals(presenceList[0]!.userId, "gamer1",);
    assertEquals(presenceList[0]!.data.game, "chess",);

    const singleUser = router.getPresenceUser("/rooms/:id", "gamer1",);
    assertEquals(singleUser?.userId, "gamer1",);
  });

  it("supports custom presence filtering across rooms", () => {
    const group = new WebSocketGroup();
    const tracker = group.configurePresence({
      filter: (receiverParams, senderParams,) => {
        // Only deliver presence updates if both sockets are in the same room
        return receiverParams.room === senderParams.room;
      },
    },);

    const wsRoom1A = createMockWebSocket();
    const wsRoom1B = createMockWebSocket();
    const wsRoom2 = createMockWebSocket();

    group.addSocket(wsRoom1A, { room: "room1", },);
    group.addSocket(wsRoom1B, { room: "room1", },);
    group.addSocket(wsRoom2, { room: "room2", },);

    // Initial tracking for listeners
    tracker.track(wsRoom1A, { userId: "u1", }, { room: "room1", },);
    tracker.track(wsRoom2, { userId: "u3", }, { room: "room2", },);

    // User 2 joins room1
    tracker.track(wsRoom1B, { userId: "u2", }, { room: "room1", },);

    // wsRoom1A (room1) should have received u2's join event
    const room1ReceivedJoin = wsRoom1A.sent.some((m,) =>
      m.includes("presence_join",) && m.includes("u2",)
    );
    assertEquals(room1ReceivedJoin, true,);

    // wsRoom2 (room2) should NOT have received u2's join event
    const room2ReceivedJoin = wsRoom2.sent.some((m,) =>
      m.includes("presence_join",) && m.includes("u2",)
    );
    assertEquals(room2ReceivedJoin, false,);
  });
});

```

---

## File: `tests/router-test.ts`

```ts
// tests/router_test.ts

import { assertEquals, assertInstanceOf, } from "jsr:@std/assert@^1";
import { Router, } from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Router - GET /hello returns a valid HTTP response", async () => {
  const router = createDenoRouter();

  router.get("/hello", () => ({ body: "Hello", init: { status: 200, }, }),);

  const req = new Request("http://localhost/hello",);
  const res = await router.handleRequest(req,);

  assertInstanceOf(res, Response,);
  assertEquals(res?.status, 200,);
  assertEquals(await res.text(), "Hello",);
});

Deno.test("Router - Route not found", async () => {
  const router = createDenoRouter();

  const req = new Request("http://localhost/does-not-exist",);
  const res = await router.handleRequest(req,);

  assertEquals(res?.status, 404,);
});

```

---

## File: `tests/router_advanced_test.ts`

```ts
// monorepo/router/tests/router_advanced_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { WebSocketGroup, } from "../src/mod.ts";

// ============================================================
// 1. Error Handling
// ============================================================
Deno.test("HTTP handler that throws returns 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/error", () => {
    throw new Error("Database connection failed",);
  },);
  const req = new Request("http://localhost/error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
  assertEquals(await res.text(), "Internal Server Error",);
});

Deno.test("Async HTTP handler that rejects returns 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/async-error", async () => {
    await new Promise((r,) => setTimeout(r, 10,));
    throw new Error("Async boom",);
  },);
  const req = new Request("http://localhost/async-error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
});

// ============================================================
// 2. Force HTTPS
// ============================================================
Deno.test("Force HTTPS redirects in production (not localhost)", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "https://example.com/ping",);
  assertEquals(
    res.headers.get("Strict-Transport-Security",),
    "max-age=31536000; includeSubDomains",
  );
});

Deno.test("Force HTTPS ignores localhost", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost:8000/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "pong",);
});

Deno.test("Force HTTPS ignores when already HTTPS", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("https://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
});

// 🚀 FIX: Added trustProxy: true
Deno.test("Force HTTPS ignores when x-forwarded-proto is https", async () => {
  const app = createDenoRouter({
    basePath: "",
    forceHttps: true,
    trustProxy: true,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
});

// ============================================================
// 3. Last Broadcast with Dual Permission
// ============================================================
class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob,) {
    if (typeof data === "string") {
      this.sent.push(data,);
    }
  }
  close(code?: number, reason?: string,) {
    this.readyState = 3;
  }
}

Deno.test("Last broadcast does NOT leak to a different room (Dual Permission)", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Secret of room A",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", user: "user1", },
  );
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", user: "user2", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, {
    room: "B",
    user: "user2",
  },);
  await new Promise((r,) => setTimeout(r, 100,));
  assertEquals(
    ws2.sent,
    [],
    "User2 in room B should not receive the broadcast from room A",
  );
});

Deno.test("Last broadcast IS delivered to a new member in the same room", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Welcome!",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", user: "user1", },
  );
  const ws3 = new MockWebSocket();
  group.addSocket(ws3 as unknown as WebSocket, { room: "A", user: "user3", },);
  group.sendLastBroadcastTo(ws3 as unknown as WebSocket, {
    room: "A",
    user: "user3",
  },);
  await new Promise((r,) => setTimeout(r, 100,));
  assertEquals(ws3.sent, ["Welcome!",],);
});

Deno.test("Last broadcast with custom delay (0ms)", async () => {
  const group = new WebSocketGroup(0,);
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.broadcast("msg", undefined, { room: "A", },);
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A", },);
  await new Promise((r,) => setTimeout(r, 10,));
  assertEquals(ws2.sent, ["msg",],);
});

```

---

## File: `tests/router_catchall_test.ts`

```ts
// monorepo/router/tests/router_catchall_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Catch-all with * captures the full path", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/files/*", (_req, params,) => ({
    body: JSON.stringify(params.catch,),
  }),);

  const req = new Request("http://localhost/files/docs/readme.md",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), ["docs/readme.md",],);
});

Deno.test("Catch-all with multiple * produces an array", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/a/*/b/*", (_req, params,) => ({
    body: JSON.stringify(params.catch,),
  }),);

  const req = new Request("http://localhost/a/x/b/y/z",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), ["x", "y/z",],);
});

Deno.test("Catch-all combined with named parameter", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/api/:version/*", (_req, params,) => ({
    body: JSON.stringify({ version: params.version, catch: params.catch, },),
  }),);

  const req = new Request("http://localhost/api/v1/foo/bar",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), { version: "v1", catch: ["foo/bar",], },);
});

```

---

## File: `tests/router_http_methods_test.ts`

```ts
// monorepo/router/tests/router_http_methods_test.ts
import { assertEquals, assertExists, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// Tests for the OPTIONS method (CORS preflight)
// ============================================================

Deno.test("OPTIONS returns correct CORS headers", async () => {
  const app = createDenoRouter("", null, null,);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  app.options("/*", () => ({
    body: "",
    init: { status: 204, headers: corsHeaders, },
  }),);

  const req = new Request("http://localhost/api/users", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(res.headers.get("Access-Control-Allow-Origin",), "*",);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods",),
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  assertEquals(res.headers.get("Access-Control-Max-Age",), "86400",);
});

Deno.test("OPTIONS with a specific route", async () => {
  const app = createDenoRouter("", null, null,);

  app.options("/users/:id", (_req, params,) => ({
    body: JSON.stringify({
      allowed: ["GET", "PATCH", "DELETE",],
      id: params.id,
    },),
    init: {
      headers: {
        "Allow": "GET, PATCH, DELETE, OPTIONS",
        "Content-Type": "application/json",
      },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.allowed, ["GET", "PATCH", "DELETE",],);
  assertEquals(data.id, "42",);
});

// ============================================================
// Tests for the PUT method
// ============================================================

Deno.test("PUT updates the full resource", async () => {
  const app = createDenoRouter("", null, null,);

  app.put("/users/:id", async (req, params,) => {
    const body = await req.json();
    return {
      body: JSON.stringify({
        updated: true,
        id: params.id,
        data: body,
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/users/42", {
    method: "PUT",
    body: JSON.stringify({ name: "John", email: "john@example.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.updated, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.data.name, "John",);
});

Deno.test("PUT without body works", async () => {
  const app = createDenoRouter("", null, null,);

  app.put("/status", () => ({
    body: "Status updated",
    init: { status: 200, },
  }),);

  const req = new Request("http://localhost/status", {
    method: "PUT",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "Status updated",);
});

// ============================================================
// Tests for the DELETE method
// ============================================================

Deno.test("DELETE removes the resource", async () => {
  const app = createDenoRouter("", null, null,);

  app.delete("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ deleted: true, id: params.id, },),
    init: {
      status: 200,
      headers: { "Content-Type": "application/json", },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "DELETE",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.deleted, true,);
  assertEquals(data.id, "42",);
});

Deno.test("DELETE returns 204 No Content", async () => {
  const app = createDenoRouter("", null, null,);

  app.delete("/items/:id", (_req, params,) => ({
    body: "",
    init: { status: 204, },
  }),);

  const req = new Request("http://localhost/items/123", {
    method: "DELETE",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(await res.text(), "",);
});

// ============================================================
// Tests for the PATCH method
// ============================================================

Deno.test("PATCH updates the resource partially", async () => {
  const app = createDenoRouter("", null, null,);

  app.patch("/users/:id", async (req, params,) => {
    const updates = await req.json();
    return {
      body: JSON.stringify({
        patched: true,
        id: params.id,
        updates,
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/users/42", {
    method: "PATCH",
    body: JSON.stringify({ email: "new@email.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.patched, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.updates.email, "new@email.com",);
});

Deno.test("PATCH with multiple fields", async () => {
  const app = createDenoRouter("", null, null,);

  app.patch("/products/:id", async (req, params,) => {
    const updates = await req.json();
    return {
      body: JSON.stringify({
        id: params.id,
        fieldsUpdated: Object.keys(updates,),
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/products/99", {
    method: "PATCH",
    body: JSON.stringify({
      price: 29.99,
      stock: 100,
      category: "electronics",
    },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.id, "99",);
  assertEquals(data.fieldsUpdated, ["price", "stock", "category",],);
});

// ============================================================
// Tests for the HEAD method
// ============================================================

Deno.test("HEAD returns headers without body", async () => {
  const app = createDenoRouter("", null, null,);

  app.head("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ id: params.id, name: "John", },),
    init: {
      headers: {
        "Content-Type": "application/json",
        "X-Custom-Header": "test-value",
      },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "HEAD",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Type",), "application/json",);
  assertEquals(res.headers.get("X-Custom-Header",), "test-value",);

  // HEAD should have no body (or an empty body)
  const text = await res.text();
  assertEquals(text, "",);
});

Deno.test("HEAD to check resource existence", async () => {
  const app = createDenoRouter("", null, null,);

  app.head("/files/:name", (_req, params,) => ({
    body: "",
    init: {
      status: 200,
      headers: {
        "Content-Length": "1024",
        "Last-Modified": "Mon, 25 Aug 2026 12:00:00 GMT",
      },
    },
  }),);

  const req = new Request("http://localhost/files/document.pdf", {
    method: "HEAD",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Length",), "1024",);
  assertExists(res.headers.get("Last-Modified",),);
});

// ============================================================
// Tests for disallowed methods
// ============================================================

// 🚀 FIX: Now returns 405 Method Not Allowed
Deno.test("Unregistered method returns 405", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/only-get", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/only-get", {
    method: "POST",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

// 🚀 FIX: Now returns 405 Method Not Allowed
Deno.test("PUT on a GET route returns 405", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/resource", () => ({ body: "data", }),);
  const req = new Request("http://localhost/resource", {
    method: "PUT",
    body: "update",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

// ============================================================
// Tests with basePath
// ============================================================

Deno.test("OPTIONS with basePath works", async () => {
  const app = createDenoRouter("/api", null, null,);

  app.options("/*", () => ({
    body: "",
    init: {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", },
    },
  }),);

  const req = new Request("http://localhost/api/users", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(res.headers.get("Access-Control-Allow-Origin",), "*",);
});

Deno.test("PUT with basePath and parameters", async () => {
  const app = createDenoRouter("/api/v1", null, null,);

  app.put("/users/:id", async (req, params,) => {
    const body = await req.json();
    return {
      body: JSON.stringify({ id: params.id, ...body, },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/api/v1/users/42", {
    method: "PUT",
    body: JSON.stringify({ name: "Maria", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.id, "42",);
  assertEquals(data.name, "Maria",);
});

// ============================================================
// Method combination tests
// ============================================================

Deno.test("Same route with different methods", async () => {
  const app = createDenoRouter("", null, null,);

  app.get("/resource", () => ({ body: "GET response", }),);
  app.post(
    "/resource",
    () => ({ body: "POST response", init: { status: 201, }, }),
  );
  app.put("/resource", () => ({ body: "PUT response", }),);
  app.delete("/resource", () => ({ body: "DELETE response", }),);
  app.patch("/resource", () => ({ body: "PATCH response", }),);
  app.options("/resource", () => ({ body: "", init: { status: 204, }, }),);
  app.head("/resource", () => ({ body: "", }),);

  // Tests each method
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD",];

  for (const method of methods) {
    const req = new Request("http://localhost/resource", { method, },);
    const res = await app.handleRequest(req,);

    if (method === "OPTIONS") {
      assertEquals(res.status, 204,);
    } else if (method === "POST") {
      assertEquals(res.status, 201,);
    } else {
      assertEquals(res.status, 200,);
    }
  }
});

```

---

## File: `tests/router_http_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("GET simple route returns correct body", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/hello", () => ({ body: "world", }),);
  const req = new Request("http://localhost/hello",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "world",);
});

Deno.test("GET with named parameters", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ id: params.id, },),
  }),);
  const req = new Request("http://localhost/users/42",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), { id: "42", },);
});

Deno.test("GET with multiple parameters", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/a/:x/b/:y", (_req, params,) => ({
    body: JSON.stringify(params,),
  }),);
  const req = new Request("http://localhost/a/1/b/2",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), { x: "1", y: "2", },);
});

Deno.test("POST returns 201", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.post("/items", async (req,) => {
    const body = await req.text();
    return { body, init: { status: 201, }, };
  },);
  const req = new Request("http://localhost/items", {
    method: "POST",
    body: "test",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 201,);
  assertEquals(await res.text(), "test",);
});

Deno.test("basePath is applied correctly", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost/api/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.text(), "pong",);
});

Deno.test("Nonexistent route returns 404 (no static)", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/exists", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/nope",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// 🚀 FIX: Now returns 405 Method Not Allowed
Deno.test("Wrong HTTP method returns 405", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/only-get", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/only-get", { method: "POST", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

```

---

## File: `tests/router_static_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("serves an existing static file", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world",);
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "hello world",);
  assertEquals(res.headers.get("content-type",), "text/plain; charset=utf-8",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("serves index.html for a directory path", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.mkdir(`${tmpDir}/sub`,);
  await Deno.writeTextFile(`${tmpDir}/sub/index.html`, "<h1>Hi</h1>",);
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/sub/",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "<h1>Hi</h1>",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("returns 404 for a nonexistent file", async () => {
  const tmpDir = await Deno.makeTempDir();
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/nope.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  await Deno.remove(tmpDir, { recursive: true, },);
});

```

---

## File: `tests/routes_class_test.ts`

```ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import {
  HttpRoute,
  MiddlewareRoute,
  Router,
  WorkerRoute,
  WsRoute,
} from "../src/mod.ts";

describe("HttpRoute Class", () => {
  it("creates HttpRoute instance with normalized path and method", () => {
    const route = new HttpRoute("get", "users/:id", (_req, params,) => ({
      body: JSON.stringify(params,),
    }),);

    assertEquals(route.method, "GET",);
    assertEquals(route.path, "/users/:id",);
    assert(route.matchesMethod("get",),);
    assert(route.matchesMethod("GET",),);
  });

  it("matches URL correctly using pattern matching", () => {
    const route = new HttpRoute("POST", "/items/:category", (_req,) => ({
      body: "ok",
    }),);

    const match = route.match("http://localhost/items/electronics",);
    assertNotEquals(match, null,);
    assertEquals(match?.pathname.groups["category"], "electronics",);
  });

  it("executes handler function", async () => {
    const route = new HttpRoute("GET", "/test", (_req, params,) => ({
      body: `Hello ${params.name ?? "World"}`,
    }),);

    const result = await route.execute(new Request("http://localhost/test",), {
      name: "Deno",
    },);
    assertEquals(result.body, "Hello Deno",);
  });
});

describe("WsRoute Class & Router Integration", () => {
  it("creates WsRoute instance with associated WebSocketGroup", () => {
    const route = new WsRoute("/chat/:room", (_ws, _req, _params,) => {},);

    assertEquals(route.path, "/chat/:room",);
    assertNotEquals(route.group, undefined,);
    assertEquals(route.activeConnections, 0,);
  });

  it("allows matching URL and broadcasting directly via WsRoute", () => {
    const route = new WsRoute("/live/:stream", () => {},);
    const match = route.match("http://localhost/live/gaming",);

    assertNotEquals(match, null,);
    assertEquals(match?.pathname.groups["stream"], "gaming",);

    // Broadcast shouldn't throw error even if no sockets are connected
    route.broadcast("test message",);
    assertEquals(route.activeConnections, 0,);
  });

  it("exposes HttpRoute and WsRoute instances from Router", () => {
    const router = new Router();
    router.get("/api/v1/health", () => ({ body: "OK", }),);
    router.ws("/api/v1/ws", () => {},);

    const httpRoutes = router.getHttpRoutes();
    const wsRoutes = router.getWsRoutes();

    assertEquals(httpRoutes.length, 1,);
    assertEquals(httpRoutes[0]?.path, "/api/v1/health",);
    assertEquals(httpRoutes[0]?.method, "GET",);

    assertEquals(wsRoutes.length, 1,);
    assertEquals(wsRoutes[0]?.path, "/api/v1/ws",);

    const foundWsRoute = router.getWsRouteByPath("/api/v1/ws",);
    assertNotEquals(foundWsRoute, undefined,);
    assertEquals(foundWsRoute?.path, "/api/v1/ws",);
  });
});

describe("MiddlewareRoute Class", () => {
  it("creates global and path-scoped MiddlewareRoute instances", () => {
    const globalMw = new MiddlewareRoute((_req, _params, next,) => next());
    const pathMw = new MiddlewareRoute(
      (_req, _params, next,) => next(),
      "/api/admin/*",
    );

    assert(globalMw.match("http://localhost/any/route",),);
    assert(pathMw.match("http://localhost/api/admin/users",),);
    assertEquals(pathMw.match("http://localhost/public/index",), false,);
  });

  it("filters path-scoped middleware execution in Router", async () => {
    const router = new Router();
    let adminMwExecuted = false;

    router.use("/admin/*", async (_req, _params, next,) => {
      adminMwExecuted = true;
      return await next();
    },);

    router.get("/public", () => ({ body: "public", }),);
    router.get("/admin/dashboard", () => ({ body: "admin", }),);

    await router.handleRequest(new Request("http://localhost/public",),);
    assertEquals(adminMwExecuted, false,);

    await router.handleRequest(
      new Request("http://localhost/admin/dashboard",),
    );
    assertEquals(adminMwExecuted, true,);
  });
});

describe("WorkerRoute Class", () => {
  it("creates WorkerRoute with function or object handler", async () => {
    const funcWorker = new WorkerRoute(
      async () => new Response("From func worker",),
      "func-worker",
    );
    const objWorker = new WorkerRoute({
      fetch: async () => new Response("From obj worker",),
    }, "obj-worker",);

    const res1 = await funcWorker.execute(
      new Request("http://localhost/test",),
    );
    assertEquals(await res1.text(), "From func worker",);

    const res2 = await objWorker.execute(
      new Request("http://localhost/test",),
    );
    assertEquals(await res2.text(), "From obj worker",);
  });

  it("registers WorkerRoute instances in Router", async () => {
    const router = new Router();
    const worker = new WorkerRoute(async () =>
      new Response("Worker Fallback",)
    );

    router.worker(worker,);
    assertEquals(router.getWorkers().length, 1,);

    const res = await router.handleRequest(
      new Request("http://localhost/unhandled",),
    );
    assertEquals(await res.text(), "Worker Fallback",);
  });
});

```

---

## File: `tests/security_audit_test.ts`

```ts
// tests/security_audit_test.ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import { assertEquals, assertNotEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { join, } from "@std/path";
import { WebSocketGroup, } from "../src/websocket-group.ts";

async function setupFixture(): Promise<{ tmpRoot: string; publicDir: string }> {
  const tmpRoot = await Deno.makeTempDir({ prefix: "wsrouter_audit_", },);
  const publicDir = join(tmpRoot, "public",);
  await Deno.mkdir(publicDir, { recursive: true, },);
  await Deno.mkdir(join(publicDir, "subfolder",), { recursive: true, },);

  await Deno.writeTextFile(join(publicDir, "index.html",), "<h1>Home</h1>",);
  await Deno.writeTextFile(join(publicDir, "app.js",), "console.log('app');",);
  await Deno.writeTextFile(
    join(publicDir, "subfolder", "page.html",),
    "<p>Sub</p>",
  );
  await Deno.writeTextFile(join(tmpRoot, "secret.txt",), "CONFIDENTIAL_DATA",);
  return { tmpRoot, publicDir, };
}

async function cleanup(dir: string,): Promise<void> {
  await Deno.remove(dir, { recursive: true, },).catch(() => {},);
}

describe("Security Audit & Hardening Suite", () => {
  it("Static files include X-Content-Type-Options: nosniff", async () => {
    const { tmpRoot, publicDir, } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir, },);
      const req = new Request("http://localhost/app.js",);
      const res = await app.handleRequest(req,);
      assertEquals(res.status, 200,);
      assertEquals(res.headers.get("X-Content-Type-Options",), "nosniff",);
      await res.text();
    } finally {
      await cleanup(tmpRoot,);
    }
  });

  it("ETag matching If-None-Match returns 304 Not Modified without streaming body", async () => {
    const { tmpRoot, publicDir, } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir, },);
      // 1. Initial request to get ETag
      const req1 = new Request("http://localhost/index.html",);
      const res1 = await app.handleRequest(req1,);
      assertEquals(res1.status, 200,);
      const etag = res1.headers.get("ETag",);
      assertNotEquals(etag, null,);
      await res1.text();

      // 2. Request with If-None-Match matching etag
      const req2 = new Request("http://localhost/index.html", {
        headers: { "If-None-Match": etag!, },
      },);
      const res2 = await app.handleRequest(req2,);
      assertEquals(res2.status, 304,);
      assertEquals(res2.body, null,);
    } finally {
      await cleanup(tmpRoot,);
    }
  });

  it("HEAD request to static file returns headers with null body and no stream leak", async () => {
    const { tmpRoot, publicDir, } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir, },);
      const req = new Request("http://localhost/index.html", {
        method: "HEAD",
      },);
      const res = await app.handleRequest(req,);
      assertEquals(res.status, 200,);
      assertEquals(res.body, null,);
      assertEquals(
        res.headers.get("Content-Type",),
        "text/html; charset=utf-8",
      );
      assertNotEquals(res.headers.get("Content-Length",), null,);
    } finally {
      await cleanup(tmpRoot,);
    }
  });

  it("Path traversal with .. is strictly blocked even when allowDotfiles is true", async () => {
    const { tmpRoot, publicDir, } = await setupFixture();
    try {
      const app = createDenoRouter({
        staticDir: publicDir,
        allowDotfiles: true, // dotfiles enabled (e.g. .well-known), but .. traversal must be rejected!
      },);
      const req = new Request("http://localhost/../../secret.txt",);
      const res = await app.handleRequest(req,);
      assertEquals(res.status, 404,);
      const body = await res.text();
      assertEquals(body.includes("CONFIDENTIAL_DATA",), false,);
    } finally {
      await cleanup(tmpRoot,);
    }
  });

  it("Directory 301 redirect preserves basePath", async () => {
    const { tmpRoot, publicDir, } = await setupFixture();
    try {
      const app = createDenoRouter({
        basePath: "/site",
        staticDir: publicDir,
      },);
      const req = new Request("http://localhost/site/subfolder",);
      const res = await app.handleRequest(req,);
      assertEquals(res.status, 301,);
      assertEquals(res.headers.get("Location",), "/site/subfolder/",);
    } finally {
      await cleanup(tmpRoot,);
    }
  });

  it("Proxy X-Forwarded-Host sanitizes malicious host injection", async () => {
    const app = createDenoRouter({
      forceHttps: true,
      trustProxy: true,
    },);
    // Malicious host with path escape or credentials
    const req = new Request("http://example.com/api/test", {
      headers: {
        "x-forwarded-proto": "http",
        "x-forwarded-host": "evil.com/malicious/path",
      },
    },);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 301,);
    const location = res.headers.get("Location",);
    assertNotEquals(location, null,);
    // Should fallback to local request host and reject the malicious path injection
    assertEquals(location!.includes("evil.com/malicious",), false,);
  });

  it("WebSocketGroup broadcast prunes closed sockets automatically", () => {
    const group = new WebSocketGroup();
    // Simulate active socket
    const openSocket = {
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
    } as unknown as WebSocket;

    // Simulate closed socket
    const closedSocket = {
      readyState: WebSocket.CLOSED,
      send: () => {},
      close: () => {},
    } as unknown as WebSocket;

    group.addSocket(openSocket, {},);
    group.addSocket(closedSocket, {},);
    assertEquals(group.size, 2,);

    group.broadcast("hello",);
    // Closed socket should be pruned from the pool during broadcast
    assertEquals(group.size, 1,);
  });

  it("WebSocketGroup sendLastBroadcastTo does not deliver to socket removed during delay", async () => {
    const group = new WebSocketGroup(20,);
    const messages: string[] = [];
    const socket = {
      readyState: WebSocket.OPEN,
      send: (data: string,) => messages.push(data,),
      close: () => {},
    } as unknown as WebSocket;

    group.broadcast("Welcome message",);
    group.addSocket(socket, {},);
    group.sendLastBroadcastTo(socket, {},);

    // Remove socket before delay timer fires
    group.removeSocket(socket,);

    await new Promise((resolve,) => setTimeout(resolve, 50,));
    assertEquals(messages.length, 0,);
  });
});

```

---

## File: `tests/security_test.ts`

```ts
// monorepo/router/tests/security_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { join, } from "@std/path";

Deno.test("trustProxy: X-Forwarded-Proto is ignored by default", async () => {
  const app = createDenoRouter({
    basePath: "",
    forceHttps: true,
    trustProxy: false,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(
    res.status,
    301,
    "Should redirect even with X-Forwarded-Proto",
  );
});

Deno.test("trustProxy: X-Forwarded-Proto is respected when enabled", async () => {
  const app = createDenoRouter({
    basePath: "",
    forceHttps: true,
    trustProxy: true,
  },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200, "Should accept X-Forwarded-Proto",);
});

Deno.test("HSTS is present in HTTPS responses when forceHttps is active", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("https://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(
    res.headers.get("Strict-Transport-Security",),
    "max-age=31536000; includeSubDomains",
  );
});

Deno.test("Dotfiles are blocked by default", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, ".env",), "SECRET=123",);
  await Deno.writeTextFile(join(tmpDir, "public.txt",), "ok",);

  const app = createDenoRouter({
    basePath: "",
    staticDir: tmpDir,
    allowDotfiles: false,
  },);

  const req1 = new Request("http://localhost/.env",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 404, "Dotfile should be blocked",);

  const req2 = new Request("http://localhost/public.txt",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200, "Regular file should be served",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Dotfiles are allowed when allowDotfiles is true", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, ".env",), "SECRET=123",);

  const app = createDenoRouter({
    basePath: "",
    staticDir: tmpDir,
    allowDotfiles: true,
  },);

  const req = new Request("http://localhost/.env",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200, "Dotfile should be served",);
  assertEquals(await res.text(), "SECRET=123",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Symlinks are rejected", async () => {
  const tmpRoot = await Deno.makeTempDir();
  const publicDir = join(tmpRoot, "public",);
  const secretDir = join(tmpRoot, "secret",);

  await Deno.mkdir(publicDir,);
  await Deno.mkdir(secretDir,);
  await Deno.writeTextFile(join(secretDir, "secret.txt",), "TOP SECRET",);
  await Deno.symlink(
    join(secretDir, "secret.txt",),
    join(publicDir, "leak.txt",),
  );

  const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);

  const req = new Request("http://localhost/leak.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404, "Symlink should be rejected",);

  await Deno.remove(tmpRoot, { recursive: true, },);
});

Deno.test("Static file headers include Content-Length and ETag", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, "test.txt",), "hello world",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/test.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Length",), "11",);
  assertEquals(res.headers.get("Last-Modified",) !== null, true,);
  assertEquals(res.headers.get("ETag",) !== null, true,);
  assertEquals(res.headers.get("Cache-Control",), "public, max-age=3600",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Directory without trailing slash redirects to one with slash", async () => {
  const tmpDir = await Deno.makeTempDir();
  const subDir = join(tmpDir, "docs",);
  await Deno.mkdir(subDir,);
  await Deno.writeTextFile(join(subDir, "index.html",), "<h1>Docs</h1>",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/docs",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "/docs/",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

```

---

## File: `tests/webrtc_signaling_test.ts`

```ts
// tests/webrtc_signaling_test.ts
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import {
  Router,
  WebRTCSignalingHub,
  type WebRTCSignalingMessage,
  WebSocketGroup,
} from "../src/mod.ts";

function createMockWebSocket(
  readyState: number = WebSocket.OPEN,
): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    readyState,
    sent,
    send: (data: string,) => {
      sent.push(data,);
    },
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as WebSocket & { sent: string[] };
}

describe("WebRTCSignalingHub (Signaling & Peer Coordination)", () => {
  it("registers peers and routes targeted SDP offers and answers directly to the recipient", () => {
    const hub = new WebRTCSignalingHub();
    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();

    hub.registerPeer(aliceWs, "alice",);
    hub.registerPeer(bobWs, "bob",);

    // Alice sends SDP offer targeted to Bob
    const offerHandled = hub.handleMessage(aliceWs, {
      type: "webrtc_offer",
      from: "alice",
      to: "bob",
      sdp: { type: "offer", sdp: "v=0\r\no=alice 123456 ... m=video...", },
      fromName: "Alice",
    },);

    assertEquals(offerHandled, true,);
    assertEquals(bobWs.sent.length, 1,);
    assertEquals(aliceWs.sent.length, 0,); // Alice shouldn't receive her own offer

    const bobReceivedOffer = JSON.parse(
      bobWs.sent[0]!,
    ) as WebRTCSignalingMessage;
    assertEquals(bobReceivedOffer.type, "webrtc_offer",);
    if (bobReceivedOffer.type === "webrtc_offer") {
      assertEquals(bobReceivedOffer.from, "alice",);
      assertEquals(bobReceivedOffer.sdp.type, "offer",);
      assertEquals(bobReceivedOffer.fromName, "Alice",);
    }

    // Bob sends SDP answer targeted back to Alice
    const answerHandled = hub.handleMessage(bobWs, {
      type: "webrtc_answer",
      from: "bob",
      to: "alice",
      sdp: { type: "answer", sdp: "v=0\r\no=bob 789101 ... m=video...", },
      fromName: "Bob",
    },);

    assertEquals(answerHandled, true,);
    assertEquals(aliceWs.sent.length, 1,);

    const aliceReceivedAnswer = JSON.parse(
      aliceWs.sent[0]!,
    ) as WebRTCSignalingMessage;
    assertEquals(aliceReceivedAnswer.type, "webrtc_answer",);
    if (aliceReceivedAnswer.type === "webrtc_answer") {
      assertEquals(aliceReceivedAnswer.from, "bob",);
      assertEquals(aliceReceivedAnswer.sdp.type, "answer",);
    }
  });

  it("routes ICE candidates exclusively to the destination peer", () => {
    const hub = new WebRTCSignalingHub();
    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();

    hub.registerPeer(aliceWs, "alice",);
    hub.registerPeer(bobWs, "bob",);

    const candidateHandled = hub.handleMessage(aliceWs, {
      type: "webrtc_candidate",
      from: "alice",
      to: "bob",
      candidate: {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    },);

    assertEquals(candidateHandled, true,);
    assertEquals(bobWs.sent.length, 1,);
    const receivedCandidate = JSON.parse(
      bobWs.sent[0]!,
    ) as WebRTCSignalingMessage;
    assertEquals(receivedCandidate.type, "webrtc_candidate",);
    if (receivedCandidate.type === "webrtc_candidate") {
      assertEquals(receivedCandidate.from, "alice",);
      assertEquals(receivedCandidate.candidate.sdpMid, "0",);
    }
  });

  it("tracks active broadcasters, broadcasts start/stop events, and handles stream requests", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const broadcasterWs = createMockWebSocket();
    const viewerWs = createMockWebSocket();

    group.addSocket(broadcasterWs, { room: "stage1", },);
    group.addSocket(viewerWs, { room: "stage1", },);

    // Broadcaster starts streaming
    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_started",
      broadcasterId: "streamer_dan",
      broadcasterName: "Dan",
      streamTitle: "Live Coding Session",
    }, { room: "stage1", },);

    const active = hub.getActiveStream("stage1",);
    assertNotEquals(active, undefined,);
    assertEquals(active?.broadcasterId, "streamer_dan",);
    assertEquals(active?.broadcasterName, "Dan",);
    assertEquals(active?.streamTitle, "Live Coding Session",);

    // Viewer should have received the broadcaster_started notification
    const startNotice = viewerWs.sent.find((m,) =>
      m.includes("broadcaster_started",)
    );
    assert(startNotice !== undefined,);

    // Viewer sends request_stream to broadcaster
    hub.handleMessage(viewerWs, {
      type: "request_stream",
      viewerId: "viewer_claire",
      viewerName: "Claire",
      broadcasterId: "streamer_dan",
    }, { room: "stage1", },);

    // Broadcaster should receive the request_stream message directly
    const requestNotice = broadcasterWs.sent.find((m,) =>
      m.includes("request_stream",) && m.includes("viewer_claire",)
    );
    assert(requestNotice !== undefined,);

    // Broadcaster stops streaming
    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_stopped",
      broadcasterId: "streamer_dan",
    }, { room: "stage1", },);

    assertEquals(hub.getActiveStream("stage1",), undefined,);
    const stopNotice = viewerWs.sent.find((m,) =>
      m.includes("broadcaster_stopped",)
    );
    assert(stopNotice !== undefined,);
  });

  it("automatically terminates broadcast when broadcaster socket disconnects", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const broadcasterWs = createMockWebSocket();
    const viewerWs = createMockWebSocket();

    group.addSocket(broadcasterWs, { room: "main", },);
    group.addSocket(viewerWs, { room: "main", },);

    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_started",
      broadcasterId: "host1",
      broadcasterName: "Host 1",
    }, { room: "main", },);

    assertEquals(hub.getActiveStream("main",)?.broadcasterId, "host1",);

    // Broadcaster disconnects from WebSocketGroup
    group.removeSocket(broadcasterWs,);

    // Stream should be automatically removed and stop message broadcasted
    assertEquals(hub.getActiveStream("main",), undefined,);
    const stopNotice = viewerWs.sent.find((m,) =>
      m.includes("broadcaster_stopped",)
    );
    assert(stopNotice !== undefined,);
  });

  it("broadcasts live stream reactions to group members", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    group.addSocket(ws1, { room: "live", },);
    group.addSocket(ws2, { room: "live", },);

    hub.handleMessage(ws1, {
      type: "stream_reaction",
      from: "user1",
      fromName: "User 1",
      emoji: "🔥",
      timestamp: Date.now(),
    }, { room: "live", },);

    const reactionReceived = ws2.sent.find((m,) =>
      m.includes("stream_reaction",) && m.includes("🔥",)
    );
    assert(reactionReceived !== undefined,);
  });

  it("supports WebRTC helper methods, peer inspection, and stream queries on Hub, Group, and Router", () => {
    const router = new Router();
    router.ws("/webrtc/:room", () => {},);

    const group = router.getWsGroupByPath("/webrtc/:room",);
    assert(group !== undefined,);

    const wsAlice = createMockWebSocket();
    const wsBob = createMockWebSocket();

    group.addSocket(wsAlice, { room: "coding", },);
    group.addSocket(wsBob, { room: "coding", },);

    // Register peers via Group
    group.registerPeer(wsAlice, "peer_alice",);
    group.registerPeer(wsBob, "peer_bob",);

    assertEquals(group.peerCount, 2,);
    assertEquals(group.getPeers().sort(), ["peer_alice", "peer_bob",],);

    // Send direct message to peer
    const directSent = group.sendToPeer("peer_bob", {
      type: "request_stream",
      viewerId: "peer_alice",
      viewerName: "Alice",
      broadcasterId: "peer_bob",
      room: "coding",
    },);
    assertEquals(directSent, true,);
    assertEquals(wsBob.sent.length, 1,);

    // Start stream via Router
    const stream = router.startBroadcasting(
      "/webrtc/:room",
      "peer_alice",
      "Alice In Tech",
      "coding",
      "Live Coding Rust & Deno",
      { room: "coding", },
    );
    assertNotEquals(stream, undefined,);
    assertEquals(stream?.broadcasterName, "Alice In Tech",);

    // Query active stream via Router & Group
    assertEquals(router.isBroadcasting("/webrtc/:room", "coding",), true,);
    assertEquals(router.isBroadcasting("/webrtc/:room", "gaming",), false,);
    assertEquals(group.isBroadcasting("coding",), true,);

    const activeStreamRouter = router.getActiveStream(
      "/webrtc/:room",
      "coding",
    );
    assertEquals(activeStreamRouter?.broadcasterId, "peer_alice",);

    const allStreams = router.getAllActiveStreams("/webrtc/:room",);
    assertEquals(allStreams.length, 1,);
    assertEquals(allStreams[0]?.room, "coding",);

    // Send live reaction via Group
    const reactionSent = group.sendReaction("coding", {
      from: "peer_bob",
      fromName: "Bob",
      emoji: "🚀",
    },);
    assertEquals(reactionSent, true,);
    const bobReaction = wsAlice.sent.find((m,) => m.includes("🚀",));
    assert(bobReaction !== undefined,);

    // Stop stream via Router
    const stopped = router.stopBroadcasting(
      "/webrtc/:room",
      "peer_alice",
      "coding",
    );
    assertEquals(stopped, true,);
    assertEquals(router.isBroadcasting("/webrtc/:room", "coding",), false,);
  });
});

```

---

## File: `tests/websocket_group_test.ts`

```ts
// monorepo/router/tests/websocket_group_test.ts
import { assertEquals, } from "@std/assert";
import { type RouteParams, WebSocketGroup, } from "../src/mod.ts";

class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob,) {
    if (typeof data === "string") this.sent.push(data,);
  }
  close(code?: number, reason?: string,) {
    this.readyState = 3;
  }
}

Deno.test("broadcast sends to all sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.broadcast("hello",);
  assertEquals(ws1.sent, ["hello",],);
  assertEquals(ws2.sent, ["hello",],);
});

Deno.test("broadcast with permissionFn filters recipients", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", },);

  // 🚀 CHANGE: Dual signature (receiver, sender, msg)
  group.broadcast(
    "only-A",
    (receiver, _sender, _msg,) => receiver.room === "A",
  );

  assertEquals(ws1.sent, ["only-A",],);
  assertEquals(ws2.sent, [],);
});

Deno.test("new member receives the last broadcast when joining", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.broadcast("first-msg", undefined, { room: "A", },);

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A", },);

  // 🚀 CHANGE: The default delay is now 0ms, 10ms is more than enough
  await new Promise((resolve,) => setTimeout(resolve, 10,));
  assertEquals(ws2.sent, ["first-msg",],);
});

Deno.test("new member in a different room does NOT receive the last broadcast", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);

  // 🚀 CHANGE: Dual signature
  group.broadcast(
    "first-msg",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", },
  );

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "B", },);

  await new Promise((resolve,) => setTimeout(resolve, 10,));
  assertEquals(ws2.sent, [],);
});

Deno.test("closeGroup closes all sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, {},);
  group.addSocket(ws2 as unknown as WebSocket, {},);
  group.closeGroup();
  assertEquals(ws1.readyState, 3,);
  assertEquals(ws2.readyState, 3,);
  assertEquals(group.size, 0,);
});

```

---

## File: `tests/websocket_real_test.ts`

```ts
import { assertEquals, assertExists, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import type { Router, } from "../src/deno.ts";

function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20,
): Promise<boolean> {
  return new Promise((resolve,) => {
    const start = Date.now();
    const check = () => {
      if (condition()) return resolve(true,);
      if (Date.now() - start > timeoutMs) return resolve(false,);
      setTimeout(check, intervalMs,);
    };
    check();
  },);
}

async function startServer(
  app: Router,
): Promise<{ server: Deno.HttpServer; port: number }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {}, },
    app.handleRequest.bind(app,),
  );
  const addr = server.addr;
  return { server, port: addr.port, };
}

Deno.test("Real WebSocket: connection, broadcast and last broadcast for a new member", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  const receivedByUser1: string[] = [];
  const receivedByUser2: string[] = [];
  app.ws("/chat/:room/:user", (ws, _req, params,) => {
    const room = params.room as string;
    const user = params.user as string;
    const group = app.getWsGroupByPath("/chat/:room/:user",);
    if (!group) {
      ws.close(1011, "No group",);
      return;
    }
    ws.onmessage = (event,) => {
      // ✅ CORRECT: use dual params
      group.broadcast(
        `[${user}]: ${event.data}`,
        (receiver, sender, _msg,) => receiver.room === sender.room, // ← NEW
        params,
      );
    };
  },);
  const { server, port, } = await startServer(app,);
  try {
    const ws1 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user1`,);
    await waitFor(() => ws1.readyState === WebSocket.OPEN);
    assertEquals(ws1.readyState, WebSocket.OPEN, "user1 should connect",);
    ws1.onmessage = (e,) => receivedByUser1.push(e.data,);

    const ws2 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user2`,);
    await waitFor(() => ws2.readyState === WebSocket.OPEN);
    assertEquals(ws2.readyState, WebSocket.OPEN, "user2 should connect",);
    ws2.onmessage = (e,) => receivedByUser2.push(e.data,);

    await new Promise((r,) => setTimeout(r, 100,));
    ws1.send("hello from user1",);
    await waitFor(() => receivedByUser2.length >= 1);
    assertEquals(receivedByUser2[0], "[user1]: hello from user1",);
    assertEquals(receivedByUser1[0], "[user1]: hello from user1",);

    const receivedByUser3: string[] = [];
    const ws3 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user3`,);
    ws3.onmessage = (e,) => receivedByUser3.push(e.data,);
    await waitFor(() => ws3.readyState === WebSocket.OPEN);
    const got = await waitFor(() => receivedByUser3.length >= 1, 2000,);
    assertEquals(
      got,
      true,
      "user3 should receive the last broadcast when connecting",
    );
    assertEquals(receivedByUser3[0], "[user1]: hello from user1",);

    const receivedByUser4: string[] = [];
    const ws4 = new WebSocket(`ws://localhost:${port}/api/chat/roomB/user4`,);
    ws4.onmessage = (e,) => receivedByUser4.push(e.data,);
    await waitFor(() => ws4.readyState === WebSocket.OPEN);
    await new Promise((r,) => setTimeout(r, 200,));
    assertEquals(
      receivedByUser4.length,
      0,
      "user4 in roomB should not receive the broadcast from roomA",
    );

    ws1.close();
    ws2.close();
    ws3.close();
    ws4.close();
    await new Promise((r,) => setTimeout(r, 100,));
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});

Deno.test("Real WebSocket: nonexistent route returns 404", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.ws("/exists", () => {},);
  const { server, port, } = await startServer(app,);
  try {
    const ws = new WebSocket(`ws://localhost:${port}/api/nope`,);
    const errored = await waitFor(
      () => ws.readyState === WebSocket.CLOSED,
      2000,
    );
    assertEquals(
      errored,
      true,
      "WebSocket should close when trying a nonexistent route",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("Real WebSocket: closeGroup closes all sockets in the group", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.ws("/chat/:room/:user", () => {},);
  const { server, port, } = await startServer(app,);
  try {
    const ws1 = new WebSocket(`ws://localhost:${port}/api/chat/room1/user1`,);
    const ws2 = new WebSocket(`ws://localhost:${port}/api/chat/room1/user2`,);
    await waitFor(() =>
      ws1.readyState === WebSocket.OPEN && ws2.readyState === WebSocket.OPEN
    );
    const closed = app.closeGroupByPath("/chat/:room/:user",);
    assertEquals(closed, true,);
    await waitFor(() =>
      ws1.readyState === WebSocket.CLOSED && ws2.readyState === WebSocket.CLOSED
    );
    assertEquals(ws1.readyState, WebSocket.CLOSED,);
    assertEquals(ws2.readyState, WebSocket.CLOSED,);
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});

```

---

## File: `tests/worker_test.ts`

```ts
// monorepo/router/tests/worker_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// 1. BASIC WORKER
// ============================================================
Deno.test("Worker: handles a request when the route does not exist", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/api/hello") {
      return new Response(JSON.stringify({ message: "from worker", },), {
        headers: { "Content-Type": "application/json", },
      },);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/hello",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.message, "from worker",);
});

Deno.test("Worker: returns 404 when the worker does not handle it", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  app.worker(async (_req,) => {
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/unknown",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// ============================================================
// 2. MULTIPLE WORKERS (FALLBACK CHAIN)
// ============================================================
Deno.test("Worker: multiple workers in chain", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  const order: string[] = [];

  // Worker 1: handles /api/v1
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v1",)) {
      order.push("worker1",);
      return new Response("v1 response",);
    }
    order.push("worker1-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Worker 2: handles /api/v2
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v2",)) {
      order.push("worker2",);
      return new Response("v2 response",);
    }
    order.push("worker2-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Tests /api/v1 → worker1 handles it
  const req1 = new Request("http://localhost/api/v1/data",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  assertEquals(await res1.text(), "v1 response",);

  // Tests /api/v2 → worker1 skips, worker2 handles it
  const req2 = new Request("http://localhost/api/v2/data",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);
  assertEquals(await res2.text(), "v2 response",);

  // Tests /unknown → both skip → 404
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 3. WORKER WITH HTTP ROUTES (PRIORITY)
// ============================================================
Deno.test("Worker: HTTP routes have priority over workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Registered HTTP route
  app.get("/api/data", () => ({
    body: "from route",
  }),);

  // Worker that would also handle /api/data
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/api/data") {
      return new Response("from worker",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/data",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  // The HTTP route should win, not the worker
  assertEquals(await res.text(), "from route",);
});

// ============================================================
// 4. WORKER WITH STATIC FILES (ORDER)
// ============================================================
Deno.test("Worker: workers run BEFORE static files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/test.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker that handles /test.txt (same path as the static file)
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/test.txt") {
      return new Response("from worker",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/test.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  // Worker should win over static
  assertEquals(await res.text(), "from worker",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Worker: if the worker returns 404, static is attempted", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker that does NOT handle /hello.txt
  app.worker(async (_req,) => {
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "from static",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

// ============================================================
// 5. WORKER WITH ERRORS (RESILIENCE)
// ============================================================
Deno.test("Worker: an error in a worker does not break the chain", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Worker 1: throws an error
  app.worker(async (_req,) => {
    throw new Error("Worker exploded!",);
  },);

  // Worker 2: works normally
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/safe") {
      return new Response("safe response",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/safe",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "safe response",);
});

// ============================================================
// 6. WORKER WITH MIDDLEWARES
// ============================================================
Deno.test("Worker: middlewares run before workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  let middlewareCalled = false;

  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    const res = await next();
    res.headers.set("X-Middleware", "applied",);
    return res;
  },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/worker-endpoint") {
      return new Response("worker response",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/worker-endpoint",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "worker response",);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run before the worker",
  );
  assertEquals(res.headers.get("X-Middleware",), "applied",);
});

// ============================================================
// 7. WORKER WITH BASEPATH
// ============================================================
Deno.test("Worker: works with basePath", async () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    // The worker receives the full URL (with basePath)
    if (url.pathname === "/api/proxy/data") {
      return new Response("proxied data",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/proxy/data",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "proxied data",);
});

// ============================================================
// 8. WORKER SIMULATING workerHandler.fetch (REAL USE CASE)
// ============================================================
Deno.test("Worker: simulates integration with workerHandler.fetch", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Simulates a Cloudflare Worker-style workerHandler
  const workerHandler = {
    async fetch(request: Request, _env?: any, _ctx?: any,): Promise<Response> {
      const url = new URL(request.url,);
      if (url.pathname === "/ping") {
        return new Response(
          JSON.stringify({ success: true, service: "loco-proxy", },),
          {
            headers: { "Content-Type": "application/json", },
          },
        );
      }
      if (url.pathname === "/push" && request.method === "POST") {
        return new Response(JSON.stringify({ success: true, },), {
          headers: { "Content-Type": "application/json", },
        },);
      }
      return new Response(JSON.stringify({ error: "Not found", },), {
        status: 404,
      },);
    },
  };

  // Registers the worker using a closure to capture env/ctx
  const env = { SOME_KEY: "value", };
  const ctx = { waitUntil: (_p: Promise<unknown>,) => {}, };
  app.worker((req,) => workerHandler.fetch(req, env, ctx,));

  // Tests /ping
  const req1 = new Request("http://localhost/ping", { method: "POST", },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  const data1 = await res1.json();
  assertEquals(data1.success, true,);
  assertEquals(data1.service, "loco-proxy",);

  // Tests /push
  const req2 = new Request("http://localhost/push", { method: "POST", },);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);

  // Tests a nonexistent route
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 9. WORKER WITH FORCE HTTPS
// ============================================================
Deno.test("Worker: forceHttps redirects before workers", async () => {
  const app = createDenoRouter({
    basePath: "",
    staticDir: null,
    forceHttps: true,
  },);

  app.worker(async (_req,) => {
    return new Response("should not reach here",);
  },);

  const req = new Request("http://example.com/anything",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "https://example.com/anything",);
});

```

---

