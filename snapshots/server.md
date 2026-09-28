> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém os arquivos de configuração e execução do WSROUTER @vanaware/wsrouter e CI/CD.
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB [v0.4.0] - Modo: SERVER

Gerado automaticamente em: 2026-09-28T17:11:49.557Z

---

## Arquivo: `.env.example`

```properties
PORT=3000
```

---

## Arquivo: `.github/workflows/ci.yml`

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

## Arquivo: `.github/workflows/jsr-publish.yml`

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
        run: deno task check-all

      - name: Sanitize Version
        run: |
          deno run -A ./sanitize-version.ts ./deno.jsonc

      - name: Publish WsRouter to JSR
        run: |
          deno publish --allow-slow-types --allow-dirty
```

---

## Arquivo: `.github/workflows/pages.yml`

```yaml
name: Deploy Example to GitHub Pages

on:
  push:
    branches:
      - main
    paths:
      - 'example/**'
      - 'src/**'
      - '.github/workflows/pages.yml'
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
          deno-version: "v2.x"

      - name: Verify code integrity
        run: deno task check

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

## Arquivo: `README.md`

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

````

---

## Arquivo: `deno.jsonc`

```json
{
  "tasks": {
    "test": "deno test -P",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "fmt-check": "deno fmt --check",
    "lint-fix": "deno lint --fix",
    "check-all": "deno task check && deno task lint && deno task fmt --check && deno task test",
    "tests": "deno task check && deno task test",
    "check": "deno check src/**/*.ts tests/**/*.ts example/**/*.ts",
    "start": "deno run --allow-read --allow-net --allow-env --env-file example/main.ts",
    "dev": "deno run --allow-read --allow-net --allow-env --env-file --watch example/main.ts",
    "export": "deno run --allow-read --allow-write ./export.ts",
    "sanitize-version": "deno run -A ./sanitize-version.ts",
    "tag-version": "deno run -A ./tag-version.ts",
    "bump": "deno install --frozen=false && deno run -A ./tag-version.ts"
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
  "version": "0.4.0",
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
    "@std/assert": "jsr:@std/assert@^1",
    "@std/cli": "jsr:@std/cli@^1",
    "@std/testing/bdd": "jsr:@std/testing@^1/bdd",
    "@std/testing/": "jsr:@std/testing@^1/",
    "@std/http": "jsr:@std/http@^1",
    "@std/media-types": "jsr:@std/media-types@^1", //uso futuro
    "@std/path": "jsr:@std/path@^1",
    "@vanaware/buildit": "jsr:@vanaware/buildit@^0.4.1"
  },
     // 📦 Gerenciamento de Dependências
  "minimumDependencyAge": 10,
  "nodeModulesDir": "auto",
  "vendor": true,
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["ban-untagged-todo"],
      "exclude": ["no-unused-vars", "require-await", "no-explicit-any"]
    },
    "include": [
      "export.ts",
      "src/**/*.{ts,tsx}",
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
      "export.ts",
      "example/**/*.{ts,tsx}"
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
      "export.ts",
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "unstable": ["bundle"],
  "exclude": [
      ".qwen/",
      ".vscode/",
      "vendor",
      "node_modules",
      "snapshots",
      "docs"
    ]
}

```

---

## Arquivo: `src/adapters/deno-serve-dir.ts`

```ts
// monorepo/router/src/adapters/deno-serve-dir.ts
// 🦕 Adaptador Deno ALTERNATIVO — usa serveDir do @std/http/file-server
// Mantém containment + recusa de symlinks, mas delega o serving para o std.
// Ganhos: Range Requests, ETag/If-None-Match (304), HEAD nativo, menos código.

import { serveDir } from "@std/http/file-server";
import { resolve } from "@std/path";
import type { StaticFileHandler } from "../mod.ts";

// Re-exporta o mesmo upgrader WebSocket do adaptador principal
export { denoWebSocketUpgrader } from "./deno.ts";

export interface DenoServeDirOptions {
  /** Permitir arquivos que começam com '.' (default: false) */
  allowDotfiles?: boolean;
  /** Mostrar listagem de diretórios (default: false) */
  showDirListing?: boolean;
  /** Habilitar CORS nos arquivos estáticos (default: false) */
  enableCors?: boolean;
}

/**
 * Cria um handler de arquivos estáticos usando serveDir do @std/http.
 *
 * Vantagens sobre o adaptador manual (deno.ts):
 * - Range Requests (vídeo, áudio, PDFs grandes)
 * - ETag + If-None-Match → 304 Not Modified
 * - Last-Modified + If-Modified-Since → 304
 * - HEAD automático
 * - Menos código para manter
 *
 * Desvantagens:
 * - Cache-Control fixo (não customizável por arquivo)
 * - Formato do ETag é interno do std
 * - Dependência extra: @std/http
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
      // Tenta embedded primeiro, depois static (mesma lógica do adaptador manual)
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
  // 🛡️ CONTAINMENT: resolver caminho e verificar que está dentro de baseDir
  const fullPath = resolve(baseDir, "." + pathname);
  const resolvedBase = resolve(baseDir);

  if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
    return null; // Path tenta escapar do diretório
  }

  // 🛡️ SYMLINKS: recusar symlinks (mesma política do adaptador manual)
  try {
    const info = await Deno.lstat(fullPath);
    if (info.isSymlink) {
      console.warn(`[Static] Symlink recusado: ${fullPath}`);
      return null;
    }
  } catch {
    // Arquivo não existe — serveDir retornará 404, retornamos null
    return null;
  }

  // 🚀 Delega para serveDir (Range, ETag, 304, HEAD, etc.)
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

  // serveDir retorna 404 quando não encontra
  if (res.status === 404) return null;

  return res;
}
```

---

## Arquivo: `src/adapters/deno.ts`

```ts
// src/adapters/deno.ts
/**
 * @file deno.ts
 * @description Deno-specific adapters for WebSocket upgrading and static file serving.
 */

import { join, resolve } from "@std/path";
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
        const mimeType = defaultDenoMimeTypeResolver(ext) ?? "application/octet-stream";
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
 * Maps common file extensions to their corresponding standard MIME types.
 */
function defaultDenoMimeTypeResolver(ext: string): string | undefined {
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8", js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8", json: "application/json; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", ico: "image/x-icon", txt: "text/plain; charset=utf-8",
    pdf: "application/pdf", xml: "application/xml", woff: "font/woff",
    woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm", wasm: "application/wasm",
    // 🚀 MODERN EXTENSIONS
    webp: "image/webp", avif: "image/avif", webmanifest: "application/manifest+json",
    ts: "application/typescript", tsx: "application/typescript",
    jsx: "application/javascript", map: "application/json",
  };
  return map[ext.toLowerCase()];
}
```

---

## Arquivo: `src/deno-serve-dir.ts`

```ts
// monorepo/router/src/deno-serve-dir.ts
// 🦕 Entry point ALTERNATIVO para Deno — usa serveDir do @std/http
// Importe assim: import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";

import { Router } from "./mod.ts";
import {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";

export interface DenoServeDirRouterOptions {
  basePath?: string;
  staticDir?: string | null;
  embeddedDir?: string | null;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  /** Opções específicas do serveDir */
  serveDir?: {
    showDirListing?: boolean;
    enableCors?: boolean;
  };
}

/**
 * Cria um Router pré-configurado para Deno usando serveDir do @std/http.
 *
 * Diferença para createDenoRouter():
 * - Usa serveDir (Range, ETag/304, HEAD nativos)
 * - Cache-Control é fixo (não customizável)
 * - Requer dependência @std/http
 *
 * Use createDenoRouter() se precisar de controle total sobre headers.
 */
export function createDenoServeDirRouter(
  basePathOrOptions: string | DenoServeDirRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  let options: DenoServeDirRouterOptions;
  if (typeof basePathOrOptions === "string") {
    options = {
      basePath: basePathOrOptions,
      staticDir,
      embeddedDir,
      forceHttps,
      lastBroadcastDelay,
    };
  } else {
    options = basePathOrOptions;
  }

  const {
    basePath = "",
    staticDir: sDir = null,
    embeddedDir: eDir = null,
    forceHttps: fHttps = false,
    trustProxy = false,
    allowDotfiles = false,
    lastBroadcastDelay: lDelay,
    serveDir: serveDirOpts = {},
  } = options;

  const staticOptions: DenoServeDirOptions = {
    allowDotfiles,
    showDirListing: serveDirOpts.showDirListing ?? false,
    enableCors: serveDirOpts.enableCors ?? false,
  };

  const router = new Router({
    basePath,
    forceHttps: fHttps,
    trustProxy,
    allowDotfiles,
    lastBroadcastDelay: lDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: sDir || eDir
      ? createDenoServeDirStaticFileHandler(sDir, eDir, staticOptions)
      : undefined,
  });
  return router;
}

// Re-exporta tudo do core
export * from "./mod.ts";
export {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";
```

---

## Arquivo: `src/deno.ts`

````ts
// src/deno.ts
/**
 * @file deno.ts
 * @description Entry point for the Deno-specific router factory.
 */
import { Router } from "./mod.ts";
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
  let options: DenoRouterOptions;
  if (typeof basePathOrOptions === "string") {
    options = { basePath: basePathOrOptions, staticDir, embeddedDir, forceHttps, lastBroadcastDelay };
  } else {
    options = basePathOrOptions;
  }

  const {
    basePath = "",
    staticDir: sDir = null, // 🚀 MUDANÇA: Default null no options object
    embeddedDir: eDir = null,
    forceHttps: fHttps = false,
    trustProxy = false,
    allowDotfiles = false,
    lastBroadcastDelay: lDelay,
  } = options;

  const router = new Router({
    basePath,
    forceHttps: fHttps,
    trustProxy,
    allowDotfiles,
    lastBroadcastDelay: lDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: sDir || eDir ? createDenoStaticFileHandler(sDir, eDir) : undefined,
  });
  return router;
}

export * from "./mod.ts";
export { denoWebSocketUpgrader, createDenoStaticFileHandler } from "./adapters/deno.ts";
````

---

## Arquivo: `src/http-route.ts`

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
   */
  execute(req: Request, params: RouteParams, ctx?: RequestContext) {
    return this.handler(req, params, ctx);
  }
}

```

---

## Arquivo: `src/middleware-chain.ts`

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

## Arquivo: `src/middleware-route.ts`

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

## Arquivo: `src/mod.ts`

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

```

---

## Arquivo: `src/presence.ts`

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
        const joinPayload = this.options.serialize({
          type: "presence_join",
          user: presenceUser,
        });
        this.group.broadcast(
          joinPayload,
          (recvParams, sendParams, _msg) => {
            return this.options.filter(recvParams, sendParams, {
              type: "presence_join",
              user: presenceUser!,
            });
          },
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
        const leavePayload = this.options.serialize({
          type: "presence_leave",
          userId,
          lastSeenAt: presenceUser.lastSeenAt,
        });
        this.group.broadcast(
          leavePayload,
          (recvParams, sendParams, _msg) => {
            return this.options.filter(recvParams, sendParams, {
              type: "presence_leave",
              userId,
              lastSeenAt: presenceUser.lastSeenAt,
            });
          },
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
      const updatePayload = this.options.serialize({
        type: "presence_update",
        user: presenceUser,
      });
      this.group.broadcast(
        updatePayload,
        (recvParams, sendParams, _msg) => {
          return this.options.filter(recvParams, sendParams, {
            type: "presence_update",
            user: presenceUser,
          });
        },
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
   * Attaches an event listener for presence events.
   */
  on(
    event: "join",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(
    event: "leave",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(
    event: "update",
    listener: (user: PresenceUser<T>, oldData: T) => void,
  ): this;
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

## Arquivo: `src/router.ts`

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

  private normalizeBasePath(p: string): string {
    if (!p || p === "/") return "";
    return "/" + p.replace(/^\/+|\/+$/g, "");
  }

  private normalizePath(p: string): string {
    return p.startsWith("/") ? p : "/" + p;
  }

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

  private stripBase(pathname: string): string {
    if (!this.basePath) return pathname;
    if (pathname === this.basePath) return "/";
    if (pathname.startsWith(this.basePath + "/")) {
      return pathname.slice(this.basePath.length);
    }
    return pathname;
  }

  private isLocalhost(req: Request): boolean {
    const url = new URL(req.url);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return hostname === "localhost" || hostname === "127.0.0.1" ||
      hostname === "::1";
  }

  private shouldForceHttps(req: Request): boolean {
    if (!this.forceHttps) return false;
    if (this.isLocalhost(req)) return false;
    if (this.trustProxy) {
      const protoHeader = req.headers.get("x-forwarded-proto");
      const forwardedProto = protoHeader
        ? protoHeader.split(",")[0]?.trim().toLowerCase()
        : undefined;
      if (forwardedProto === "https") return false;
      if (forwardedProto === "http") return true;
    }
    const url = new URL(req.url);
    if (url.protocol === "https:") return false;
    return true;
  }

  private buildHttpsUrl(req: Request): string {
    const url = new URL(req.url);
    url.protocol = "https:";
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      url.protocol = "wss:";
    }
    if (this.trustProxy) {
      const hostHeader = req.headers.get("x-forwarded-host");
      if (hostHeader) {
        const forwardedHost = hostHeader.split(",")[0]?.trim();
        if (forwardedHost && /^[\w.:-]+$/.test(forwardedHost)) {
          url.host = forwardedHost;
        }
      }
    }
    return url.toString();
  }

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
   * Registers a GET route.
   *
   * @param path - The URL pattern for the route.
   * @param handler - The HTTP handler function.
   * @param options - Optional route configuration.
   * @returns The router instance for chaining.
   */
  get(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  /**
   * Registers a GET route with route-specific middlewares.
   *
   * @param path - The URL pattern for the route.
   * @param middlewares - Array of middlewares to execute for this route.
   * @param handler - The HTTP handler function.
   * @param options - Optional route configuration.
   * @returns The router instance for chaining.
   */
  get(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  get(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "GET",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a POST route. */
  post(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  post(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  post(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "POST",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a PUT route. */
  put(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  put(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  put(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "PUT",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a DELETE route. */
  delete(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  delete(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  delete(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "DELETE",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a PATCH route. */
  patch(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  patch(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  patch(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "PATCH",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers an OPTIONS route. */
  options(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  options(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  options(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "OPTIONS",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a HEAD route. */
  head(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  head(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  head(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "HEAD",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
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

  private findHttpRoute(
    req: Request,
  ): { route: HttpRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.httpRoutes) {
      if (!route.matchesMethod(req.method)) continue;
      const match = route.match(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

  private findWsRoute(
    req: Request,
  ): { route: WsRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.wsRoutes) {
      const match = route.match(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

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
        try {
          await (result.body as ReadableStream).cancel();
        } catch {
          // ignore stream cancel failure
        }
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
    if (this.shouldForceHttps(req)) {
      const httpsUrl = this.buildHttpsUrl(req);
      return new Response(null, {
        status: 301,
        headers: {
          "Location": httpsUrl,
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        },
      });
    }
    const isHttps = new URL(req.url).protocol === "https:";
    const hstsHeader: Record<string, string> = {};
    if (this.forceHttps && isHttps) {
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
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
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
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
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
      for (const [k, v] of Object.entries(extraHeaders)) {
        workerRes.headers.set(k, v);
      }
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
          if (staticRes.body) {
            try {
              await staticRes.body.cancel();
            } catch {
              // ignore stream cancel failure
            }
          }
          return new Response(null, {
            status: 304,
            statusText: "Not Modified",
            headers: staticRes.headers,
          });
        }

        // Head request: cancel stream body to prevent file descriptor leaks
        if (req.method === "HEAD") {
          if (staticRes.body) {
            try {
              await staticRes.body.cancel();
            } catch {
              // ignore stream cancel failure
            }
          }
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

        for (const [k, v] of Object.entries(extraHeaders)) {
          staticRes.headers.set(k, v);
        }
        return staticRes;
      }
    }

    // 7. 404 Not Found
    return new Response("Not Found", { status: 404, headers: extraHeaders });
  }

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

## Arquivo: `src/types.ts`

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

## Arquivo: `src/webrtc.ts`

```ts
// src/webrtc.ts
/**
 * @file webrtc.ts
 * @description WebRTC Signaling Engine and Peer Connection Coordination for WsRouter.
 * Facilitates peer-to-peer video/audio streaming, broadcaster announcements,
 * targeted SDP offer/answer exchanges, ICE candidate forwarding, and room management.
 */

import type { RouteParams } from "./types.ts";
import type { WebSocketGroup } from "./websocket-group.ts";

/**
 * Standard ICE candidate format compatible with browser RTCIceCandidateInit.
 */
export interface SerializedIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/**
 * Standard SDP format compatible with browser RTCSessionDescriptionInit.
 */
export interface SerializedSessionDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
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
  broadcasterId: string;
  broadcasterName: string;
  streamTitle?: string;
  room: string;
  startedAt: number;
}

/**
 * Event map for WebRTC signaling hub lifecycle events.
 */
export interface WebRTCSignalingEvents {
  "stream_start": (stream: ActiveStreamInfo) => void;
  "stream_stop": (broadcasterId: string, room: string) => void;
  "peer_register": (peerId: string, ws: WebSocket) => void;
  "peer_unregister": (peerId: string, ws: WebSocket) => void;
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

    if (this.group) {
      this.group.broadcast(
        this.serialize(msg),
        (recvParams, sendParams) => {
          return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
        },
        params,
      );
    }

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

      if (this.group) {
        this.group.broadcast(
          this.serialize(msg),
          (recvParams, sendParams) => {
            return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
          },
          params,
        );
      }
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

    if (this.group) {
      this.group.broadcast(
        this.serialize(payload),
        (recvParams, sendParams) => {
          return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
        },
        params,
      );
      return true;
    }
    return false;
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
        if (this.group) {
          this.group.broadcast(
            this.serialize({ ...msg, room }),
            (recvParams, sendParams) => {
              return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
            },
            params,
          );
          return true;
        }
        return false;
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

## Arquivo: `src/websocket-group.ts`

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
   * Attaches an event listener for group events ('connect', 'disconnect', 'message', 'broadcast').
   */
  on(
    event: "connect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  on(
    event: "disconnect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  on(
    event: "message",
    listener: (ws: WebSocket, data: unknown, params: RouteParams) => void,
  ): this;
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

## Arquivo: `src/worker-route.ts`

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

## Arquivo: `src/ws-route.ts`

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

## Arquivo: `tests/adapters_serve_dir_test.ts`

```ts
// monorepo/router/tests/adapters_serve_dir_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoServeDirRouter, } from "../src/deno-serve-dir.ts";

Deno.test("createDenoServeDirRouter serve arquivos", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world",);
  const app = createDenoServeDirRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "hello world",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("createDenoServeDirRouter bloqueia dotfiles", async () => {
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

## Arquivo: `tests/adapters_test.ts`

```ts
// monorepo/router/tests/adapters_test.ts
import { assert, assertEquals, } from "@std/assert";
import { Router, } from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// 1. TESTES DO ADAPTADOR DENO
// ============================================================
Deno.test("createDenoRouter cria router com adaptadores configurados", () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);
  assert(app instanceof Router, "Deve retornar instância de Router",);
});

Deno.test("createDenoRouter com staticDir serve arquivos", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world",);
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "hello world",);
  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("createDenoRouter sem staticDir retorna 404 para estáticos", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  const req = new Request("http://localhost/anything.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// ============================================================
// 2. TESTE DE WEBSOCKET SEM UPGRADER (Erro esperado)
// ============================================================
Deno.test("WebSocket sem upgrader retorna 501", async () => {
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
// 3. TESTE DE INTEGRAÇÃO COM createDenoRouter + WebSocket
// ============================================================
Deno.test("createDenoRouter com WebSocket funciona", async () => {
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
    assert(wsHandlerCalled, "Handler WebSocket deve ser chamado",);
    ws.close();
    await new Promise((r,) => setTimeout(r, 100,));
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});

// ============================================================
// 4. TESTE DE FORCE HTTPS COM createDenoRouter
// ============================================================
Deno.test("createDenoRouter com forceHttps redireciona", async () => {
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

Deno.test("createDenoRouter com forceHttps ignora localhost", async () => {
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

## Arquivo: `tests/api_coverage_test.ts`

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

## Arquivo: `tests/architectural_improvements_test.ts`

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

## Arquivo: `tests/complementary_test.ts`

```ts
// monorepo/router/tests/complementary_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { WebSocketGroup, } from "../src/mod.ts";

// ============================================================
// 1. ERROR HANDLING
// ============================================================
Deno.test("Handler HTTP que lança erro retorna 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/error", () => {
    throw new Error("Database connection failed",);
  },);
  const req = new Request("http://localhost/error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
  assertEquals(await res.text(), "Internal Server Error",);
});

Deno.test("Handler HTTP assíncrono que rejeita retorna 500", async () => {
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
Deno.test("Force HTTPS redireciona em produção (não localhost)", async () => {
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

Deno.test("Force HTTPS ignora localhost", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost:8000/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "pong",);
});

// 🚀 CORREÇÃO: Adicionado trustProxy: true
Deno.test("Force HTTPS ignora se x-forwarded-proto for https", async () => {
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
Deno.test("Middleware HTTP: executa antes do handler e pode abortar", async () => {
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

Deno.test("Middleware HTTP: múltiplos middlewares em cadeia", async () => {
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

Deno.test("Middleware HTTP: modifica a resposta", async () => {
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

Deno.test("Middleware HTTP: executa mesmo sem rota (404)", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/inexistente",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware deve executar mesmo sem rota",
  );
});

Deno.test("Middleware WS: aborta upgrade sem token", async () => {
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

Deno.test("Middleware WS: não é chamado para rotas WS inexistentes", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/inexistente", {
    headers: { upgrade: "websocket", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware deve executar mesmo para 404 WS",
  );
});

Deno.test("Middleware WS: pode passar Request modificada para next()", async () => {
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
    "Handler deve receber a request modificada",
  );
});

// ============================================================
// 4. LAST BROADCAST COM DUAL PERMISSION
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

Deno.test("Last Broadcast NÃO vaza para sala diferente (Dual Permission)", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Segredo da Sala A",
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
    "User2 na sala B não deve receber broadcast da sala A",
  );
});

Deno.test("Last Broadcast É entregue para novo membro na mesma sala", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Bem-vindos!",
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
  assertEquals(ws3.sent, ["Bem-vindos!",],);
});

Deno.test("Last Broadcast com delay customizado (0ms)", async () => {
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

## Arquivo: `tests/http_semantics_test.ts`

```ts
// monorepo/router/tests/http_semantics_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("HEAD automático: usa rota GET se HEAD não existir", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({
    body: "data",
    init: { headers: { "X-Custom": "value", }, },
  }),);

  const req = new Request("http://localhost/resource", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("X-Custom",), "value",);
  assertEquals(await res.text(), "", "HEAD deve ter body vazio",);
});

Deno.test("405 Method Not Allowed: retorna quando path existe com outro método", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({ body: "data", }),);
  app.post("/resource", () => ({ body: "created", init: { status: 201, }, }),);

  const req = new Request("http://localhost/resource", { method: "PUT", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET, POST",);
});

Deno.test("Static files: POST retorna 404", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "POST", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Static files: HEAD retorna headers sem body", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Type",), "text/plain; charset=utf-8",);
  assertEquals(await res.text(), "", "HEAD deve ter body vazio",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("basePath normaliza '/' para ''", async () => {
  const app = createDenoRouter({ basePath: "/", },);
  app.get("/test", () => ({ body: "ok", }),);

  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "ok",);
});

Deno.test("lastBroadcastDelay default é 0ms", async () => {
  // Teste implícito: se fosse 50ms, testes de last broadcast seriam mais lentos
  const app = createDenoRouter({ basePath: "", },);
  // Se não houver erro, o default está correto
  assertEquals(true, true,);
});

```

---

## Arquivo: `tests/middleware_test.ts`

```ts
// monorepo/router/tests/middleware_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
// ============================================================
// 1. MIDDLEWARE HTTP - BÁSICO
// ============================================================
Deno.test("Middleware HTTP: executa antes do handler", async () => {
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
Deno.test("Middleware HTTP: pode abortar o fluxo (401)", async () => {
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
Deno.test("Middleware HTTP: múltiplos middlewares em cadeia", async () => {
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
Deno.test("Middleware HTTP: modifica a resposta", async () => {
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
Deno.test("Middleware HTTP: middleware de log mede tempo", async () => {
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
  assert(measuredMs >= 45, `Tempo medido (${measuredMs}ms) deve ser >= 45ms`,);
});
// ============================================================
// 2. MIDDLEWARE HTTP - EDGE CASES
// ============================================================
Deno.test("Middleware HTTP: executa mesmo sem rota (404)", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  const req = new Request("http://localhost/inexistente",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware deve executar mesmo sem rota",
  );
});
Deno.test("Middleware HTTP: CORS em arquivo estático", async () => {
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
Deno.test("Middleware HTTP: múltiplas chamadas de next() são protegidas", async () => {
  const app = createDenoRouter("", null, null,);
  const handlerCalls: number[] = [];
  app.use(async (_req, _params, next,) => {
    const r1 = await next(); // 1ª chamada OK
    // Tenta chamar de novo - deve falhar
    try {
      await next();
    } catch {
      // Ignora
    }
    return r1;
  },);
  app.get("/test", () => {
    handlerCalls.push(1,);
    return { body: "ok", };
  },);
  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  // Handler deve ser chamado APENAS UMA VEZ
  assertEquals(handlerCalls, [1,],);
  assertEquals(res.status, 200,);
});
// ============================================================
// 3. MIDDLEWARE WEBSOCKET
// ============================================================
Deno.test("Middleware WS: aborta upgrade sem token", async () => {
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
  // Sem token - deve retornar 401
  const req1 = new Request("http://localhost/chat", {
    headers: { upgrade: "websocket", },
  },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 401,);
  // Com token - deve permitir upgrade (101)
  // ✅ CORREÇÃO: Deno.upgradeWebSocket exige o header 'connection: Upgrade'
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
Deno.test("Middleware WS: não é chamado para rotas WS inexistentes", async () => {
  const app = createDenoRouter("", null, null,);
  let middlewareCalled = false;
  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    return await next();
  },);
  // ✅ CORREÇÃO: Com o novo fluxo, middlewares EXECUTAM mesmo para 404 WS
  const req = new Request("http://localhost/inexistente", {
    headers: { upgrade: "websocket", },
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware deve executar mesmo para 404 WS",
  );
});
Deno.test("Middleware WS: pode passar Request modificada para next()", async () => {
  const app = createDenoRouter("", null, null,);
  app.use(async (req, _params, next,) => {
    if (req.headers.get("upgrade",)?.toLowerCase() !== "websocket") {
      return next();
    }
    // Cria nova request com header injetado
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
  // ✅ CORREÇÃO: Adicionado connection: Upgrade para satisfazer o Deno
  const req = new Request("http://localhost/chat", {
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
  },);
  await app.handleRequest(req,);
  // Aguarda um tick para o handler executar
  await new Promise((r,) => setTimeout(r, 50,));
  assertEquals(
    receivedUserId,
    "42",
    "Handler deve receber a request modificada",
  );
});
// ============================================================
// 4. MIDDLEWARE + ROUTES COMBINADAS
// ============================================================
Deno.test("Middleware HTTP: autenticação com rotas públicas e privadas", async () => {
  const app = createDenoRouter("", null, null,);
  // Middleware global de autenticação
  app.use(async (req, _params, next,) => {
    const path = new URL(req.url,).pathname;
    if (path === "/public") {
      return await next(); // Rota pública
    }
    const auth = req.headers.get("authorization",);
    if (!auth || auth !== "Bearer valid") {
      return new Response("Unauthorized", { status: 401, },);
    }
    return await next();
  },);
  app.get("/public", () => ({ body: "public data", }),);
  app.get("/private", () => ({ body: "private data", }),);
  // Rota pública - sem auth
  const req1 = new Request("http://localhost/public",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  assertEquals(await res1.text(), "public data",);
  // Rota privada - sem auth (deve falhar)
  const req2 = new Request("http://localhost/private",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 401,);
  // Rota privada - com auth
  const req3 = new Request("http://localhost/private", {
    headers: { authorization: "Bearer valid", },
  },);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 200,);
  assertEquals(await res3.text(), "private data",);
});
Deno.test("Middleware: CORS preflight (OPTIONS) é tratado corretamente", async () => {
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
  // Request normal GET
  const req2 = new Request("http://localhost/data",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);
  assertEquals(res2.headers.get("Access-Control-Allow-Origin",), "*",);
});

```

---

## Arquivo: `tests/path_traversal_test.ts`

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
  } catch { /* ignora */ }
}

Deno.test("Path traversal: ../ não deve escapar do staticDir", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(
      res.status,
      404,
      "Deve retornar 404 ao tentar path traversal com ..",
    );
    const body = await res.text();
    assertEquals(
      body.includes("TOP-SECRET-DATA",),
      false,
      "NUNCA deve vazar conteúdo do arquivo secreto",
    );
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: múltiplos ../ não escapam", async () => {
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

Deno.test("Path traversal: /subdir/../../secret.txt não escapa", async () => {
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

Deno.test("Path traversal: URL-encoded ..%2F não escapa", async () => {
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

Deno.test("Path traversal: backslash (Windows-style) não escapa", async () => {
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

Deno.test("Path traversal: basePath não é bypassado", async () => {
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

Deno.test("Arquivo legítimo dentro do staticDir é servido normalmente", async () => {
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

Deno.test("Arquivo legítimo em subpasta é servido", async () => {
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

## Arquivo: `tests/presence_test.ts`

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

## Arquivo: `tests/router-test.ts`

```ts
// tests/router_test.ts

import { assertEquals, assertInstanceOf, } from "jsr:@std/assert@^1";
import { Router, } from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Router - GET /hello retorna resposta HTTP válida", async () => {
  const router = createDenoRouter();

  router.get("/hello", () => ({ body: "Olá", init: { status: 200, }, }),);

  const req = new Request("http://localhost/hello",);
  const res = await router.handleRequest(req,);

  assertInstanceOf(res, Response,);
  assertEquals(res?.status, 200,);
  assertEquals(await res.text(), "Olá",);
});

Deno.test("Router - Rota não encontrada", async () => {
  const router = createDenoRouter();

  const req = new Request("http://localhost/nao-existe",);
  const res = await router.handleRequest(req,);

  assertEquals(res?.status, 404,);
});

```

---

## Arquivo: `tests/router_advanced_test.ts`

```ts
// monorepo/router/tests/router_advanced_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { WebSocketGroup, } from "../src/mod.ts";

// ============================================================
// 1. Error Handling
// ============================================================
Deno.test("Handler HTTP que lança erro retorna 500", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/error", () => {
    throw new Error("Database connection failed",);
  },);
  const req = new Request("http://localhost/error",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 500,);
  assertEquals(await res.text(), "Internal Server Error",);
});

Deno.test("Handler HTTP assíncrono que rejeita retorna 500", async () => {
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
Deno.test("Force HTTPS redireciona em produção (não localhost)", async () => {
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

Deno.test("Force HTTPS ignora localhost", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost:8000/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "pong",);
});

Deno.test("Force HTTPS ignora se já for HTTPS", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("https://example.com/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
});

// 🚀 CORREÇÃO: Adicionado trustProxy: true
Deno.test("Force HTTPS ignora se x-forwarded-proto for https", async () => {
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
// 3. Last Broadcast com Dual Permission
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

Deno.test("Last Broadcast NÃO vaza para sala diferente (Dual Permission)", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Segredo da Sala A",
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
    "User2 na sala B não deve receber broadcast da sala A",
  );
});

Deno.test("Last Broadcast É entregue para novo membro na mesma sala", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1", },);
  group.broadcast(
    "Bem-vindos!",
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
  assertEquals(ws3.sent, ["Bem-vindos!",],);
});

Deno.test("Last Broadcast com delay customizado (0ms)", async () => {
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

## Arquivo: `tests/router_catchall_test.ts`

```ts
// monorepo/router/tests/router_catchall_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Catch-all com * captura path completo", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/files/*", (_req, params,) => ({
    body: JSON.stringify(params.catch,),
  }),);

  const req = new Request("http://localhost/files/docs/readme.md",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), ["docs/readme.md",],);
});

Deno.test("Catch-all com múltiplos * gera array", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/a/*/b/*", (_req, params,) => ({
    body: JSON.stringify(params.catch,),
  }),);

  const req = new Request("http://localhost/a/x/b/y/z",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), ["x", "y/z",],);
});

Deno.test("Catch-all combinado com parâmetro nomeado", async () => {
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

## Arquivo: `tests/router_http_methods_test.ts`

```ts
// monorepo/router/tests/router_http_methods_test.ts
import { assertEquals, assertExists, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// Testes para método OPTIONS (CORS preflight)
// ============================================================

Deno.test("OPTIONS retorna headers CORS corretos", async () => {
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

Deno.test("OPTIONS com rota específica", async () => {
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
// Testes para método PUT
// ============================================================

Deno.test("PUT atualiza recurso completo", async () => {
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
    body: JSON.stringify({ name: "João", email: "joao@example.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.updated, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.data.name, "João",);
});

Deno.test("PUT sem body funciona", async () => {
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
// Testes para método DELETE
// ============================================================

Deno.test("DELETE remove recurso", async () => {
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

Deno.test("DELETE retorna 204 No Content", async () => {
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
// Testes para método PATCH
// ============================================================

Deno.test("PATCH atualiza recurso parcialmente", async () => {
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
    body: JSON.stringify({ email: "novo@email.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.patched, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.updates.email, "novo@email.com",);
});

Deno.test("PATCH com múltiplos campos", async () => {
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
// Testes para método HEAD
// ============================================================

Deno.test("HEAD retorna headers sem body", async () => {
  const app = createDenoRouter("", null, null,);

  app.head("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ id: params.id, name: "João", },),
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

  // HEAD não deve ter body (ou body vazio)
  const text = await res.text();
  assertEquals(text, "",);
});

Deno.test("HEAD para verificar existência de recurso", async () => {
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
// Testes de métodos não permitidos
// ============================================================

// 🚀 CORREÇÃO: Agora retorna 405 Method Not Allowed
Deno.test("Método não registrado retorna 405", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/only-get", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/only-get", {
    method: "POST",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

// 🚀 CORREÇÃO: Agora retorna 405 Method Not Allowed
Deno.test("PUT em rota GET retorna 405", async () => {
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
// Testes com basePath
// ============================================================

Deno.test("OPTIONS com basePath funciona", async () => {
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

Deno.test("PUT com basePath e parâmetros", async () => {
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
// Testes de combinação de métodos
// ============================================================

Deno.test("Mesma rota com métodos diferentes", async () => {
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

  // Testa cada método
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

## Arquivo: `tests/router_http_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("GET rota simples retorna body correto", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/hello", () => ({ body: "world", }),);
  const req = new Request("http://localhost/hello",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "world",);
});

Deno.test("GET com parâmetros nomeados", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ id: params.id, },),
  }),);
  const req = new Request("http://localhost/users/42",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), { id: "42", },);
});

Deno.test("GET com múltiplos parâmetros", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/a/:x/b/:y", (_req, params,) => ({
    body: JSON.stringify(params,),
  }),);
  const req = new Request("http://localhost/a/1/b/2",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.json(), { x: "1", y: "2", },);
});

Deno.test("POST retorna 201", async () => {
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

Deno.test("basePath é aplicado corretamente", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.get("/ping", () => ({ body: "pong", }),);
  const req = new Request("http://localhost/api/ping",);
  const res = await app.handleRequest(req,);
  assertEquals(await res.text(), "pong",);
});

Deno.test("Rota inexistente retorna 404 (sem static)", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/exists", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/nope",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// 🚀 CORREÇÃO: Agora retorna 405 Method Not Allowed
Deno.test("Método HTTP errado retorna 405", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/only-get", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/only-get", { method: "POST", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

```

---

## Arquivo: `tests/router_static_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("serve arquivo estático existente", async () => {
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

Deno.test("serve index.html para path de diretório", async () => {
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

Deno.test("retorna 404 para arquivo inexistente", async () => {
  const tmpDir = await Deno.makeTempDir();
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);
  const req = new Request("http://localhost/nope.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
  await Deno.remove(tmpDir, { recursive: true, },);
});

```

---

## Arquivo: `tests/routes_class_test.ts`

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

## Arquivo: `tests/security_audit_test.ts`

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

## Arquivo: `tests/security_test.ts`

```ts
// monorepo/router/tests/security_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { join, } from "@std/path";

Deno.test("trustProxy: X-Forwarded-Proto é ignorado por padrão", async () => {
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
    "Deve redirecionar mesmo com X-Forwarded-Proto",
  );
});

Deno.test("trustProxy: X-Forwarded-Proto é respeitado quando ativo", async () => {
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
  assertEquals(res.status, 200, "Deve aceitar X-Forwarded-Proto",);
});

Deno.test("HSTS está presente em respostas HTTPS quando forceHttps ativo", async () => {
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

Deno.test("Dotfiles são bloqueados por padrão", async () => {
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
  assertEquals(res1.status, 404, "Dotfile deve ser bloqueado",);

  const req2 = new Request("http://localhost/public.txt",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200, "Arquivo normal deve ser servido",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Dotfiles são permitidos quando allowDotfiles é true", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, ".env",), "SECRET=123",);

  const app = createDenoRouter({
    basePath: "",
    staticDir: tmpDir,
    allowDotfiles: true,
  },);

  const req = new Request("http://localhost/.env",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200, "Dotfile deve ser servido",);
  assertEquals(await res.text(), "SECRET=123",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Symlinks são recusados", async () => {
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
  assertEquals(res.status, 404, "Symlink deve ser recusado",);

  await Deno.remove(tmpRoot, { recursive: true, },);
});

Deno.test("Headers de arquivo estático incluem Content-Length e ETag", async () => {
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

Deno.test("Diretório sem barra final redireciona para com barra", async () => {
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

## Arquivo: `tests/webrtc_signaling_test.ts`

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

## Arquivo: `tests/websocket_group_test.ts`

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

Deno.test("broadcast envia para todos os sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.broadcast("hello",);
  assertEquals(ws1.sent, ["hello",],);
  assertEquals(ws2.sent, ["hello",],);
});

Deno.test("broadcast com permissionFn filtra destinatários", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", },);

  // 🚀 MUDANÇA: Assinatura Dual (receiver, sender, msg)
  group.broadcast(
    "only-A",
    (receiver, _sender, _msg,) => receiver.room === "A",
  );

  assertEquals(ws1.sent, ["only-A",],);
  assertEquals(ws2.sent, [],);
});

Deno.test("novo membro recebe último broadcast ao entrar", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.broadcast("first-msg", undefined, { room: "A", },);

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A", },);

  // 🚀 MUDANÇA: Delay default agora é 0ms, 10ms é mais que suficiente
  await new Promise((resolve,) => setTimeout(resolve, 10,));
  assertEquals(ws2.sent, ["first-msg",],);
});

Deno.test("novo membro em sala diferente NÃO recebe último broadcast", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);

  // 🚀 MUDANÇA: Assinatura Dual
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

Deno.test("closeGroup fecha todos os sockets", () => {
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

## Arquivo: `tests/websocket_real_test.ts`

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

Deno.test("WebSocket real: conexão, broadcast e last broadcast para novo membro", async () => {
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
      // ✅ CORRETO: usar dual params
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
    assertEquals(ws1.readyState, WebSocket.OPEN, "user1 deve conectar",);
    ws1.onmessage = (e,) => receivedByUser1.push(e.data,);

    const ws2 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user2`,);
    await waitFor(() => ws2.readyState === WebSocket.OPEN);
    assertEquals(ws2.readyState, WebSocket.OPEN, "user2 deve conectar",);
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
      "user3 deve receber o último broadcast ao conectar",
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
      "user4 em roomB não deve receber broadcast de roomA",
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

Deno.test("WebSocket real: rota inexistente retorna 404", async () => {
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
      "WebSocket deve fechar ao tentar rota inexistente",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("WebSocket real: closeGroup fecha todos os sockets do grupo", async () => {
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

## Arquivo: `tests/worker_test.ts`

```ts
// monorepo/router/tests/worker_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// 1. WORKER BÁSICO
// ============================================================
Deno.test("Worker: trata request quando rota não existe", async () => {
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

Deno.test("Worker: retorna 404 quando worker não trata", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  app.worker(async (_req,) => {
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/unknown",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// ============================================================
// 2. MÚLTIPLOS WORKERS (CADEIA DE FALLBACK)
// ============================================================
Deno.test("Worker: múltiplos workers em cadeia", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  const order: string[] = [];

  // Worker 1: trata /api/v1
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v1",)) {
      order.push("worker1",);
      return new Response("v1 response",);
    }
    order.push("worker1-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Worker 2: trata /api/v2
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v2",)) {
      order.push("worker2",);
      return new Response("v2 response",);
    }
    order.push("worker2-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Testa /api/v1 → worker1 trata
  const req1 = new Request("http://localhost/api/v1/data",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  assertEquals(await res1.text(), "v1 response",);

  // Testa /api/v2 → worker1 pula, worker2 trata
  const req2 = new Request("http://localhost/api/v2/data",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);
  assertEquals(await res2.text(), "v2 response",);

  // Testa /unknown → ambos pulam → 404
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 3. WORKER COM ROTAS HTTP (PRIORIDADE)
// ============================================================
Deno.test("Worker: rotas HTTP têm prioridade sobre workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Rota HTTP registrada
  app.get("/api/data", () => ({
    body: "from route",
  }),);

  // Worker que também trataria /api/data
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
  // A rota HTTP deve ganhar, não o worker
  assertEquals(await res.text(), "from route",);
});

// ============================================================
// 4. WORKER COM STATIC FILES (ORDEM)
// ============================================================
Deno.test("Worker: workers executam ANTES de static files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/test.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker que trata /test.txt (mesmo path do arquivo estático)
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
  // Worker deve ganhar sobre static
  assertEquals(await res.text(), "from worker",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Worker: se worker retorna 404, static é tentado", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker que NÃO trata /hello.txt
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
// 5. WORKER COM ERRO (RESILIÊNCIA)
// ============================================================
Deno.test("Worker: erro em worker não quebra a cadeia", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Worker 1: lança erro
  app.worker(async (_req,) => {
    throw new Error("Worker exploded!",);
  },);

  // Worker 2: funciona normalmente
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
// 6. WORKER COM MIDDLEWARES
// ============================================================
Deno.test("Worker: middlewares executam antes de workers", async () => {
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
    "Middleware deve executar antes do worker",
  );
  assertEquals(res.headers.get("X-Middleware",), "applied",);
});

// ============================================================
// 7. WORKER COM BASEPATH
// ============================================================
Deno.test("Worker: funciona com basePath", async () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    // O worker recebe a URL completa (com basePath)
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
// 8. WORKER SIMULANDO workerHandler.fetch (CASO DE USO REAL)
// ============================================================
Deno.test("Worker: simula integração com workerHandler.fetch", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Simula um workerHandler no estilo Cloudflare Worker
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

  // Registra o worker usando closure para capturar env/ctx
  const env = { SOME_KEY: "value", };
  const ctx = { waitUntil: (_p: Promise<unknown>,) => {}, };
  app.worker((req,) => workerHandler.fetch(req, env, ctx,));

  // Testa /ping
  const req1 = new Request("http://localhost/ping", { method: "POST", },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  const data1 = await res1.json();
  assertEquals(data1.success, true,);
  assertEquals(data1.service, "loco-proxy",);

  // Testa /push
  const req2 = new Request("http://localhost/push", { method: "POST", },);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);

  // Testa rota inexistente
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 9. WORKER COM FORCE HTTPS
// ============================================================
Deno.test("Worker: forceHttps redireciona antes de workers", async () => {
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

