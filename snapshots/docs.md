> **AI INSTRUCTION:** 
> The text below contains the project DOCUMENTATION and architectural guidelines.
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project WorkerDB - Mode: DOCS

Automatically generated at: 2026-10-24T20:20:08.322Z

---

## File: `.tool-versions`

```tool-versions
deno 2.9.7
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

## File: `LICENSE`

```license
MIT License

Copyright (c) 2025 Vanaware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

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

## File: `docs/adapter-deno-serve-dir.md`

````md
# 🦕 Alternative Adapter: `deno-serve-dir`

`@vanaware/wsrouter` offers **two static file adapters** for Deno. This document describes the alternative adapter based on `serveDir` from `@std/http/file-server`.

---

## 🎯 Motivation

The primary adapter (`adapters/deno.ts`) implements file serving manually with `Deno.open`, `Deno.lstat` and `Deno.realPath`. This gives full control over headers and behavior, but:

- **Does not support Range Requests** (required for large video/audio/PDF files)
- **Does not handle `If-None-Match` / `If-Modified-Since`** (304 Not Modified)
- **~100 lines of code** to maintain

`serveDir` from `@std/http` solves all of this natively, since it is Deno's official implementation for file serving.

---

## 📐 Architecture: Two Adapters

```
src/adapters/
├── deno.ts              ← Manual: full control, zero extra dependencies
└── deno-serve-dir.ts    ← serveDir: native Range, 304, HEAD

src/
├── deno.ts              ← Entry point: createDenoRouter()
└── deno-serve-dir.ts    ← Entry point: createDenoServeDirRouter()
```

**Both share the same WebSocket upgrader** (`denoWebSocketUpgrader`), re-exported via:

```typescript
export { denoWebSocketUpgrader } from "./deno.ts";
```

---

## 📊 Comparison

| Aspect | `deno.ts` (Manual) | `deno-serve-dir.ts` (serveDir) |
|---|:---:|:---:|
| **Lines of code** | ~100 | ~50 |
| **Range Requests** | ❌ | ✅ Native |
| **ETag / 304** | ✅ Custom (size+mtime) | ✅ Native (more robust) |
| **Automatic HEAD** | ✅ Via core | ✅ Via serveDir |
| **Cache-Control** | ✅ Customizable | ⚠️ Fixed |
| **ETag format** | Custom: `"size-mtime"` | std internal |
| **Extra dependency** | None | `@std/http` |
| **Maintenance** | Manual | Community (std) |
| **Containment** | ✅ `Deno.realPath` | ✅ `resolve` |
| **Symlinks** | ✅ Rejected | ✅ Rejected |
| **Dotfiles** | ✅ Blocked | ✅ Blocked |

### When to use each one?

| Scenario | Adapter |
|---|---|
| Serving large video/audio/PDF files | `deno-serve-dir` |
| Need 304 Not Modified | `deno-serve-dir` |
| Need per-file custom Cache-Control | `deno` (manual) |
| Don't want the `@std/http` dependency | `deno` (manual) |
| Want less code to maintain | `deno-serve-dir` |

---

## 📝 API

### Entry Point

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
```

### `createDenoServeDirRouter(options)`

```typescript
interface DenoServeDirRouterOptions {
  basePath?: string;
  staticDir?: string | null;
  embeddedDir?: string | null;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  /** serveDir-specific options */
  serveDir?: {
    showDirListing?: boolean;  // Default: false
    enableCors?: boolean;      // Default: false
  };
}
```

### `createDenoServeDirStaticFileHandler(staticDir, embeddedDir, options)`

Creates only the `StaticFileHandler` without instantiating the full Router:

```typescript
interface DenoServeDirOptions {
  allowDotfiles?: boolean;   // Default: false
  showDirListing?: boolean;  // Default: false
  enableCors?: boolean;      // Default: false
}
```

---

## 🌍 Examples

### Basic

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";

const app = createDenoServeDirRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({ body: "Hello!" }));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

### With CORS and dir listing

```typescript
const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./public",
  serveDir: {
    showDirListing: true,   // Shows directory listing
    enableCors: true,       // Adds CORS headers
  },
});
```

### Using only the handler (no entry point)

```typescript
import { Router } from "@vanaware/wsrouter";
import { denoWebSocketUpgrader } from "@vanaware/wsrouter/adapters/deno";
import { createDenoServeDirStaticFileHandler } from "@vanaware/wsrouter/adapters/deno-serve-dir";

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: denoWebSocketUpgrader,
  staticFileHandler: createDenoServeDirStaticFileHandler("./public", null, {
    allowDotfiles: false,
    showDirListing: false,
  }),
});
```

### Integration with the Loco server/main.ts

Replacing the manual `serveDir` in `main.ts`:

```typescript
// BEFORE (manual main.ts):
import { serveDir } from "@std/http/file-server";
const staticResponse = await serveDir(req, {
  fsRoot: "./build/dist",
  showDirListing: false,
  quiet: true,
});

// AFTER (with router):
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
import workerHandler from "./worker.ts";

const env = Deno.env.toObject();
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(console.error) };

const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./build/dist",
});

app.worker((req) => workerHandler.fetch(req, env, ctx));

Deno.serve({ port: Number(env.PORT || 3000) }, app.handleRequest.bind(app));
```

---

## 🔒 Security

The `deno-serve-dir` adapter keeps the **same security policies** as the manual adapter:

### Containment

Before delegating to `serveDir`, the path is resolved and verified:

```typescript
const fullPath = resolve(baseDir, "." + pathname);
const resolvedBase = resolve(baseDir);

if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
  return null; // Path attempts to escape the directory
}
```

### Symlinks

Symlinks are rejected with `Deno.lstat` before reaching `serveDir`:

```typescript
const info = await Deno.lstat(fullPath);
if (info.isSymlink) {
  console.warn(`[Static] Symlink rejected: ${fullPath}`);
  return null;
}
```

### Dotfiles

Controlled by the `allowDotfiles` option (default: `false`), which is passed as `showDotfiles` to `serveDir`.

---

## 🧪 Tests

The adapter has dedicated tests in `tests/adapters_serve_dir_test.ts`:

```bash
deno test tests/adapters_serve_dir_test.ts --allow-read --allow-write --allow-net --allow-env
```

Current tests:
- ✅ Serves existing files
- ✅ Blocks dotfiles by default

Recommended tests to add:
- ⏳ Range Request returns 206 Partial Content
- ⏳ If-None-Match returns 304
- ⏳ HEAD returns headers without body
- ⏳ Symlink is rejected
- ⏳ Path traversal is blocked

---

## 📋 Dependencies

This adapter requires `@std/http` in `deno.jsonc`:

```jsonc
{
  "imports": {
    "@std/http": "jsr:@std/http@^1"
  }
}
```

The manual adapter (`deno.ts`) **does not require** this dependency.

---

## 📋 Summary

| Item | Value |
|---|---|
| **Adapter file** | `src/adapters/deno-serve-dir.ts` |
| **Entry point** | `src/deno-serve-dir.ts` |
| **Export in deno.jsonc** | `"./adapters/deno-serve-dir"` |
| **Main function** | `createDenoServeDirRouter()` |
| **Handler factory** | `createDenoServeDirStaticFileHandler()` |
| **Dependency** | `@std/http` |
| **WS Upgrader** | Re-exported from `deno.ts` |
| **Security** | Containment + Symlinks + Dotfiles |
| **Main advantage** | Native Range Requests + 304 |

````

---

## File: `docs/middleware.md`

````md
# 🎯 Yes, Middleware Fits WebSocket Perfectly!

In fact, that is **where it shines the most**, because it lets you authenticate **before** the upgrade (avoiding the creation of unauthorized connections), instead of validating inside the handler when the socket is already open.

## 📊 How the Flow Works

```
Request → Force HTTPS? → Route found? → MIDDLEWARES → Final handler
                ↓                                    ↓
              301                          If it returns a Response → ABORTS
                                           If it calls next() → continues
```

**For HTTP:** `next()` executes the route handler.
**For WS:** `next()` performs the `Deno.upgradeWebSocket` and starts the group.

If a middleware returns a `Response` (e.g. `401`), the upgrade **never happens**.


---

## 🌍 Practical Examples

### Example 1: JWT Authentication via Subprotocol (now as middleware!)

The `jwt/main.ts` example becomes **much cleaner**. All validation moves out of the handler:

```typescript
import { Router } from "../../src/mod.ts";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = "my-super-secret-key-123";
const encoder = new TextEncoder();

const app = new Router({ basePath: "/api" });

// ✅ Authentication middleware: blocks BEFORE the upgrade
app.use(async (req, _params, next) => {
  // Only applies to WebSocket routes
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return await next();
  }

  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map((p) => p.trim());
  const bearerIndex = protocols.findIndex((p) => p === "Bearer");
  const token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;

  if (!token) {
    console.error("[Middleware] ❌ Token missing");
    return new Response("Token required", { status: 401 });
  }

  try {
    await jwtVerify(token, encoder.encode(JWT_SECRET));
    console.log("[Middleware] ✅ Token valid, allowing upgrade");
    return await next(); // Proceeds with the upgrade
  } catch {
    console.error("[Middleware] ❌ Invalid token");
    return new Response("Invalid token", { status: 403 });
  }
});

// The WS handler is now clean — only business logic
app.ws("/chat/:room", (ws, _req, params) => {
  const room = params.room as string;
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;

  ws.onmessage = (event) => {
    group.broadcast(
      `[room ${room}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params,
    );
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

### Example 2: Logging + Rate Limiting

```typescript
// Log every request (HTTP + WS)
app.use(async (req, params, next) => {
  const start = Date.now();
  const res = await next();
  const ms = Date.now() - start;
  const isWs = req.headers.get("upgrade") === "websocket";
  console.log(`📝 [${isWs ? "WS" : "HTTP"}] ${req.method} ${req.url} → ${res.status} (${ms}ms)`);
  return res;
});

// Rate limiting by IP (simple, in-memory)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return await next();
  }

  entry.count++;
  if (entry.count > 100) {
    return new Response("Too Many Requests", { status: 429 });
  }
  return await next();
});
```

### Example 3: Scheduled Maintenance

```typescript
let maintenanceMode = false;

app.use(async (_req, _params, next) => {
  if (maintenanceMode) {
    return new Response("🔧 Under maintenance", {
      status: 503,
      headers: { "Retry-After": "300" },
    });
  }
  return await next();
});
```

### Example 4: Path-Scoped Middleware and State/Meta

You can apply middlewares only to specific paths and share metadata (such as the authenticated user) through the third context parameter or headers:

```typescript
// Runs only for routes starting with /admin/*
app.use("/admin/*", async (req, params, next, ctx) => {
  const token = req.headers.get("Authorization");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Attach metadata to the shared state
  if (ctx) {
    ctx.state.authorizedUser = { id: "user-123", role: "admin" };
  }
  return await next();
});
```

---

## 🏗️ Internal Modular Architecture

The middleware engine was modularized into dedicated classes:
- **`MiddlewareRoute`** (`src/middleware-route.ts`): Encapsulates the middleware function and the optional route pattern (such as `/api/*` or a global wildcard).
- **`MiddlewareChain`** (`src/middleware-chain.ts`): Executes the Onion pattern, passing requests recursively with `RequestContext` support (`req`, `params`, `state`).

---

## 📊 Comparison: Middleware vs PermissionFn

| Aspect | `app.use()` (Middleware) | `permissionFn` (Broadcast) |
|---|---|---|
| **When it runs** | At connection/request time | For every broadcasted message |
| **What it controls** | Whether the connection/request is accepted | Who receives each message |
| **Access to the WebSocket** | ❌ No (it hasn't been created yet) | ✅ Yes (sockets already connected) |
| **Access to the Request** | ✅ Yes (headers, URL, method) | ❌ No |
| **Use case** | Auth, rate limiting, logging, CORS | Room isolation, content filters |

**They complement each other:** the middleware controls **who gets in**, the `permissionFn` controls **who hears what**.

---

## ⚠️ Important Points

1. **Order matters:** Middlewares run in the order they were registered with `app.use()`.
2. **They run on every request:** Middlewares run for every
   request, including 404s, static files, and unmatched routes.
   This enables global logging, CORS, and universal rate limiting.
3. **Aborting the upgrade:** If a middleware returns a `Response` without calling `next()` on a WS route, the upgrade never happens — the client receives a regular HTTP response (e.g. 401).
4. **Params available:** The middleware receives the `params` already extracted from the route, enabling logic such as "block access to room X".

````

---

## File: `docs/presence.md`

````md
# 👥 Online Presence Tracking Suite

`@vanaware/wsrouter` includes a built-in `PresenceTracker` engine for tracking online users, status states (e.g. *Online*, *Away*, *Busy*, *In Meeting*), custom metadata, and handling multi-tab connections without duplicate events.

---

## ✨ Features

- **Initial State Snapshots (`presence_state`)**: New WebSocket connections immediately receive a complete roster of online users.
- **Real-Time Diff Broadcasts**: Automatically emits `presence_join`, `presence_leave`, and `presence_update` events to group peers.
- **Multi-Tab Deduplication**: Sockets are grouped by `userId`. When a user opens 3 tabs, an internal `connections` counter increases to 3 without firing extra `presence_join` messages. A `presence_leave` event is only fired when their last tab closes.
- **Dead Connection Pruning**: Automatically detects and prunes disconnected/closed sockets to prevent ghost entries.
- **WebSocketGroup & Router Integration**: Direct helper methods on `WebSocketGroup` and `Router`.

---

## 🚀 Server-Side Setup

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room", (ws, req, params) => {
  const room = (params.room as string) || "lobby";
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "anonymous";
  const name = url.searchParams.get("name") || "Guest";

  // Automatically registers presence and announces presence_join/presence_state
  group.track(ws, {
    userId,
    name,
    status: "online",
    statusMessage: "Coding with WsRouter",
    room,
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "update_status") {
        // Broadcasts presence_update to everyone in the room
        group.updatePresence(ws, {
          status: data.status,
          statusMessage: data.statusMessage,
        });
      }
    } catch {
      // Handle standard chat messages
    }
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 Presence Events Protocol

Clients receive typed JSON payloads:

### 1. `presence_state` (Snapshot)
Sent exclusively to a newly connected client:
```json
{
  "type": "presence_state",
  "users": [
    {
      "userId": "user-1",
      "name": "Alice",
      "status": "online",
      "joinedAt": 1726500000000,
      "connections": 1
    }
  ]
}
```

### 2. `presence_join` (Broadcast)
Sent to peers when a new user enters:
```json
{
  "type": "presence_join",
  "user": {
    "userId": "user-2",
    "name": "Bob",
    "status": "online",
    "joinedAt": 1726500010000,
    "connections": 1
  }
}
```

### 3. `presence_leave` (Broadcast)
Sent when a user's final connection closes:
```json
{
  "type": "presence_leave",
  "userId": "user-2"
}
```

### 4. `presence_update` (Broadcast)
Sent when user metadata is updated:
```json
{
  "type": "presence_update",
  "user": {
    "userId": "user-1",
    "name": "Alice",
    "status": "busy",
    "statusMessage": "In a call"
  }
}
```

---

## 🛠️ API Reference

### `WebSocketGroup` Presence Methods
- `group.track(ws, user)`: Associates socket with identity and emits snapshot/join diffs.
- `group.untrack(ws)`: Disassociates socket and emits leave diff if no more tabs exist.
- `group.updatePresence(wsOrUserId, partialData)`: Merges new data and emits `presence_update`.
- `group.getPresenceList()`: Snapshot array of all online `PresenceUser` objects.
- `group.getPresenceUser(userId)`: Looks up a specific user record.
- `group.presenceSize`: Count of unique online users.

### `Router` Presence Methods
- `router.getPresence(pathOrPattern)`: Gets online users for a route pattern.
- `router.getPresenceUser(pathOrPattern, userId)`: Looks up a user on a route pattern.

````

---

## File: `docs/publish-jsr-rules.md`

`````md
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

`````

---

## File: `docs/return.md`

````md
# HTTP Handler Return Possibilities

HTTP handlers in `@vanaware/wsrouter` offer **two flexible return forms**:

1. **Native `Response` instance** (Web API standard)
2. **Object with `{ body, init }`** (simplified, ergonomic format)

---

## 🚀 1. Returning a Native `Response` (Web Standard)

You can directly return any native `Response` instance, including helpers like `Response.json()` or `new Response(...)`:

```typescript
// Simple text response
app.get("/ping", () => new Response("pong"));

// JSON with the native Response.json() helper
app.get("/api/users", () => {
  return Response.json({ users: ["Alice", "Bob"] }, { status: 200 });
});

// Native redirect
app.get("/legacy", () => {
  return Response.redirect("https://example.com/new-url", 301);
});

// Custom response with headers and status
app.post("/api/items", async (req) => {
  const item = await req.json();
  return new Response(JSON.stringify(item), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 📦 2. Returning a `{ body, init }` Object

The `body` can be any of these types:

| Type | Description | Example |
|------|-----------|---------|
| `string` | Plain text | `"Hello World"` |
| `ArrayBuffer` | Binary data | `new ArrayBuffer(8)` |
| `TypedArray` | Typed arrays | `new Uint8Array([1, 2, 3])` |
| `Blob` | Typed binary data | `new Blob(["data"], { type: "text/plain" })` |
| `FormData` | Form data | `new FormData()` |
| `URLSearchParams` | Query string | `new URLSearchParams({ a: "1" })` |
| `ReadableStream` | Data stream | `file.readable` |
| `null` | No body | `null` |

### Practical examples

```typescript
// String
app.get("/text", () => ({
  body: "Hello World"
}));

// JSON (string)
app.get("/json", () => ({
  body: JSON.stringify({ message: "Hello" })
}));

// ArrayBuffer
app.get("/binary", () => ({
  body: new ArrayBuffer(16)
}));

// Uint8Array
app.get("/bytes", () => ({
  body: new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
}));

// Blob
app.get("/blob", () => ({
  body: new Blob(["<h1>HTML</h1>"], { type: "text/html" })
}));

// FormData
app.post("/form", () => {
  const formData = new FormData();
  formData.append("name", "John");
  formData.append("age", "30");
  return { body: formData };
});

// URLSearchParams
app.get("/query", () => ({
  body: new URLSearchParams({ foo: "bar", baz: "qux" })
}));

// ReadableStream (file)
app.get("/file", async () => {
  const file = await Deno.open("./data.txt");
  return { body: file.readable };
});

// null (no body)
app.head("/check", () => ({
  body: null
}));
```

---

## ⚙️ `init?: ResponseInit`

The `init` is optional and may contain:

| Property | Type | Default | Description |
|-------------|------|--------|-----------|
| `status` | `number` | `200` | HTTP status code |
| `statusText` | `string` | `""` | Status text (rarely used) |
| `headers` | `HeadersInit` | `{}` | Response headers |

### `headers` can be:

1. **Plain object**
```typescript
{ "Content-Type": "application/json" }
```

2. **Array of tuples**
```typescript
[["Content-Type", "application/json"], ["X-Custom", "value"]]
```

3. **Headers instance**
```typescript
new Headers({ "Content-Type": "application/json" })
```

---

## 🎯 Common Combinations

### 1. **Simple response (200 OK)**
```typescript
app.get("/hello", () => ({
  body: "Hello World"
}));
// Status: 200, Headers: {}
```

### 2. **JSON with headers**
```typescript
app.get("/api/data", () => ({
  body: JSON.stringify({ id: 1, name: "John" }),
  init: {
    headers: { "Content-Type": "application/json" }
  }
}));
```

### 3. **Custom status (201 Created)**
```typescript
app.post("/users", async (req) => {
  const data = await req.json();
  return {
    body: JSON.stringify({ created: true, data }),
    init: {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }
  };
});
```

### 4. **No Content (204)**
```typescript
app.delete("/users/:id", () => ({
  body: "",
  init: { status: 204 }
}));
```

### 5. **Redirect (301/302)**
```typescript
app.get("/old-page", () => ({
  body: "",
  init: {
    status: 302,
    headers: { "Location": "/new-page" }
  }
}));
```

### 6. **Not Found (404)**
```typescript
app.get("/missing", () => ({
  body: "Resource not found",
  init: { status: 404 }
}));
```

### 7. **Server Error (500)**
```typescript
app.get("/error", () => ({
  body: "Internal Server Error",
  init: { status: 500 }
}));
```

### 8. **CORS preflight (204)**
```typescript
app.options("/*", () => ({
  body: "",
  init: {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      "Access-Control-Max-Age": "86400"
    }
  }
}));
```

### 9. **File download**
```typescript
app.get("/download", async () => {
  const file = await Deno.open("./document.pdf");
  return {
    body: file.readable,
    init: {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"document.pdf\""
      }
    }
  };
});
```

### 10. **Multiple headers**
```typescript
app.get("/custom", () => ({
  body: "data",
  init: {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Custom-Header": "value",
      "Cache-Control": "no-cache",
      "X-Request-Id": crypto.randomUUID()
    }
  }
}));
```

### 11. **Cookies**
```typescript
app.post("/login", async (req) => {
  const credentials = await req.json();
  const token = "jwt-token-here";
  return {
    body: JSON.stringify({ success: true }),
    init: {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
      }
    }
  };
});
```

### 12. **Caching**
```typescript
app.get("/cached", () => ({
  body: JSON.stringify({ data: "cached" }),
  init: {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "ETag": "\"abc123\""
    }
  }
}));
```

### 13. **Chunked transfer (streaming)**
```typescript
app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("chunk1"));
      setTimeout(() => {
        controller.enqueue(new TextEncoder().encode("chunk2"));
        controller.close();
      }, 1000);
    }
  });
  
  return {
    body: stream,
    init: {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked"
      }
    }
  };
});
```

### 14. **XML response**
```typescript
app.get("/xml", () => ({
  body: '<?xml version="1.0"?><root><item>data</item></root>',
  init: {
    headers: { "Content-Type": "application/xml" }
  }
}));
```

### 15. **HTML response**
```typescript
app.get("/page", () => ({
  body: "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
  init: {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  }
}));
```

---

## 📊 Common Status Codes Table

| Status | Text | Usage |
|--------|-------|-----|
| `200` | OK | Default success |
| `201` | Created | Resource created (POST) |
| `204` | No Content | Success without body (DELETE) |
| `301` | Moved Permanently | Permanent redirect |
| `302` | Found | Temporary redirect |
| `304` | Not Modified | Valid cache |
| `400` | Bad Request | Client error |
| `401` | Unauthorized | Not authenticated |
| `403` | Forbidden | Not authorized |
| `404` | Not Found | Resource not found |
| `405` | Method Not Allowed | HTTP method not allowed |
| `409` | Conflict | Conflict (e.g. duplicate) |
| `422` | Unprocessable Entity | Validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `502` | Bad Gateway | Gateway error |
| `503` | Service Unavailable | Service unavailable |

---

## 🎨 Complete Example with All Options

```typescript
import { Router } from "../src/mod.ts";

const app = new Router({ basePath: "/api" });

// 1. Simple string
app.get("/text", () => ({
  body: "Hello World"
}));

// 2. JSON
app.get("/json", () => ({
  body: JSON.stringify({ message: "Hello" }),
  init: { headers: { "Content-Type": "application/json" } }
}));

// 3. Custom status
app.post("/create", async (req) => {
  const data = await req.json();
  return {
    body: JSON.stringify({ id: 1, ...data }),
    init: { status: 201, headers: { "Content-Type": "application/json" } }
  };
});

// 4. No Content
app.delete("/remove/:id", (_req, params) => ({
  body: "",
  init: { status: 204 }
}));

// 5. Redirect
app.get("/old", () => ({
  body: "",
  init: { status: 302, headers: { "Location": "/new" } }
}));

// 6. Not Found
app.get("/missing", () => ({
  body: "Not Found",
  init: { status: 404 }
}));

// 7. CORS
app.options("/*", () => ({
  body: "",
  init: {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  }
}));

// 8. Download
app.get("/download", async () => {
  const file = await Deno.open("./file.pdf");
  return {
    body: file.readable,
    init: {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"file.pdf\""
      }
    }
  };
});

// 9. Cookies
app.post("/login", async (req) => {
  const { username } = await req.json();
  return {
    body: JSON.stringify({ success: true }),
    init: {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `user=${username}; HttpOnly; Path=/`
      }
    }
  };
});

// 10. Streaming
app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      const interval = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`chunk ${count++}\n`));
        if (count >= 5) {
          clearInterval(interval);
          controller.close();
        }
      }, 500);
    }
  });
  
  return {
    body: stream,
    init: { headers: { "Content-Type": "text/plain" } }
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## ✅ Summary

**`body`** can be:
- `string`, `ArrayBuffer`, `TypedArray`, `Blob`, `FormData`, `URLSearchParams`, `ReadableStream`, `null`

**`init`** may contain:
- `status` (number)
- `statusText` (string)
- `headers` (object, array, or Headers)

**Most common combinations:**
1. `{ body: "text" }` → 200 OK
2. `{ body: json, init: { headers } }` → JSON response
3. `{ body: "", init: { status: 204 } }` → No Content
4. `{ body: "", init: { status: 302, headers: { Location } } }` → Redirect
5. `{ body: stream, init: { headers } }` → File download / streaming

All these combinations are valid and supported by the router! 🚀
````

---

## File: `docs/roadmap-adapters.md`

````md
# 🗺️ Roadmap: Adapters for Other Runtimes

`@vanaware/wsrouter` was designed with a runtime-agnostic architecture, but currently only has official support for **Deno**. This document describes the roadmap for supporting other environments.

---

## 📊 Current Status

| Runtime | HTTP | WebSocket | Static Files | Status |
|---------|------|-----------|--------------|--------|
| **Deno** | ✅ | ✅ | ✅ | **Official Support** |
| Cloudflare Workers | ⏸️ | ❌ | ⏸️ | Roadmap (Static Assets) |
| Node.js | ❌ | ❌ | ❌ | Roadmap |
| Bun | ❌ | ❌ | ❌ | Roadmap |
| Edge Runtimes (Vercel, Netlify) | ❌ | ❌ | ❌ | Future |

---

## ☁️ Cloudflare Workers

### Current Status

The Cloudflare adapters were **removed from the core** in version 1.0 due to:

1. **State limitations**: Cloudflare Workers does not keep shared state between requests (except via Durable Objects)
2. **In-memory WebSocket**: WebSocket groups would not work correctly in production
3. **Focus on Deno**: Simplify the core and guarantee quality

### Future Path: Static Assets

Cloudflare launched **Static Assets** ([documentation](https://developers.cloudflare.com/workers/static-assets/)), which is the recommended way to serve static files:

```typescript
// Future Cloudflare adapter with Static Assets
export function createCloudflareRouter(options: {
  basePath?: string;
  assets?: { binding: string }; // New Static Assets binding
}) {
  // ...
}
```

**For WebSockets on Cloudflare**, use **Durable Objects**:

```typescript
// Conceptual example: Chat Room as a Durable Object
export class ChatRoom {
  private sessions: Map<string, WebSocket> = new Map();
  
  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    await this.handleSession(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    // Handle messages, broadcast, etc.
  }
}
```

### Priority: **Medium**

---

## 🟢 Node.js

### Challenges

1. **URLPattern**: Only available in Node 18.17+ (via `undici`)
2. **WebSocket**: Requires an external library (`ws`, `uWebSockets.js`)
3. **Static Files**: `fs` or `fs/promises` module

### Conceptual Adapter

```typescript
// src/adapters/node.ts (future)
import { WebSocketServer } from "ws";
import { createReadStream, stat } from "fs/promises";
import { join, resolve } from "path";

export function createNodeWebSocketUpgrader(wss: WebSocketServer): WebSocketUpgrader {
  return {
    upgrade(req: Request): { socket: WebSocket; response: Response } {
      // Node.js requires a different approach
      // WebSocket upgrade happens on the HTTP server, not in the handler
      throw new Error("Node WebSocket adapter requires HTTP server integration");
    },
  };
}

export function createNodeStaticFileHandler(staticDir: string): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      try {
        const filePath = join(staticDir, path);
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          const stream = createReadStream(filePath);
          return new Response(stream as any, {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": stats.size.toString(),
            },
          });
        }
      } catch {
        return null;
      }
      return null;
    },
  };
}
```

### Priority: **High**

Node.js is widely used and official support would be valuable.

---

## 🥐 Bun

### Advantages

- Compatible with Node.js APIs
- Native WebSocket support via `Bun.serve`
- Excellent performance

### Conceptual Adapter

```typescript
// src/adapters/bun.ts (future)
export function createBunWebSocketUpgrader(): WebSocketUpgrader {
  return {
    upgrade(req: Request): { socket: WebSocket; response: Response } {
      const { socket, response } = Bun.upgrade(req, {
        data: {},
      });
      return { socket, response };
    },
  };
}

export function createBunStaticFileHandler(staticDir: string): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      try {
        const file = Bun.file(join(staticDir, path));
        if (await file.exists()) {
          return new Response(file);
        }
      } catch {
        return null;
      }
      return null;
    },
  };
}
```

### Priority: **Medium-High**

Bun is gaining popularity and would be relatively easy to adapt.

---

## 🌐 Edge Runtimes (Vercel Edge, Netlify Edge)

### Challenges

- Serverless environments with cold starts
- No support for long-lived WebSockets
- Focused on HTTP request/response

### Recommended Approach

Use the agnostic core directly, without official adapters:

```typescript
// edge-function.ts
import { Router } from "@vanaware/wsrouter";

const router = new Router({ basePath: "/api" });

router.get("/hello", () => ({
  body: JSON.stringify({ message: "Hello from Edge!" }),
  init: { headers: { "Content-Type": "application/json" } },
}));

export default function handler(request: Request) {
  return router.handleRequest(request);
}
```

### Priority: **Low**

---

## 🛠️ How to Contribute an Adapter

If you want to create an adapter for another runtime:

### 1. Implement `WebSocketUpgrader`

```typescript
interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}
```

### 2. Implement `StaticFileHandler`

```typescript
interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}
```

### 3. Create the Entry Point

```typescript
// src/[runtime].ts
export function create[Runtime]Router(options: {
  basePath?: string;
  staticDir?: string;
  forceHttps?: boolean;
  // ... other runtime-specific options
}): Router {
  const router = new Router({
    basePath,
    forceHttps,
    webSocketUpgrader: create[Runtime]WebSocketUpgrader(),
    staticFileHandler: staticDir ? create[Runtime]StaticFileHandler(staticDir) : undefined,
  });
  return router;
}

export * from "./mod.ts";
```

### 4. Add Tests

Create `tests/adapters_[runtime]_test.ts` with:
- HTTP routing tests
- WebSocket tests (if supported)
- Static file tests (if supported)
- Runtime edge case tests

### 5. Document

- Add a section in `docs/runtime-agnostic.md`
- Create an example in `example/[runtime]/`
- Update `README.md`

---

## 📅 Estimated Timeline

| Adapter | Estimate | Dependencies |
|-----------|------------|--------------|
| Node.js | 2-3 weeks | `ws`, `undici` |
| Bun | 1-2 weeks | None (built-in) |
| Cloudflare (Static Assets) | 1-2 weeks | Wrangler |
| Edge Runtimes | 1 week | None |

---

## 💡 Alternative: Community Adapters

If you create an adapter, consider publishing it as a separate package:

```bash
@vanaware/wsrouter-adapter-node
@vanaware/wsrouter-adapter-bun
@vanaware/wsrouter-adapter-cloudflare
```

This keeps the core lightweight and lets the community contribute without overloading the main repository.

---

## 🤝 Contributing

Interested in contributing an adapter? Open an issue discussing:

1. Which runtime you want to support
2. How you plan to implement `WebSocketUpgrader`
3. How you plan to implement `StaticFileHandler`
4. Whether you will maintain the adapter long term

We are open to collaborations! 🚀

````

---

## File: `docs/roadmap-rate-limiting.md`

````md
# 🚦 Roadmap: Rate Limiting and Abuse Protection

`@vanaware/wsrouter` currently **does not include native rate limiting**. This document describes recommended strategies and the roadmap for possible future implementations.

---

## 📊 Current Status

| Feature | Status | Recommended Implementation |
|---------|--------|---------------------------|
| Rate Limiting by IP | ❌ | Custom middleware |
| Rate Limiting by User | ❌ | Custom middleware |
| Rate Limiting by WebSocket | ❌ | Custom middleware |
| Maximum Message Size | ❌ | Handler validation |
| Broadcast Backpressure | ❌ | Handler logic |

---

## 🛡️ Why Is Rate Limiting Important?

### Common Attacks

1. **Brute Force**: Massive login attempts
2. **DDoS**: Overloading the server with requests
3. **Credential Stuffing**: Testing leaked credentials
4. **Scraping**: Automated data extraction
5. **WebSocket Flood**: Massive message sending

### Impacts Without Rate Limiting

- **Degraded performance**: CPU/memory overloaded
- **High costs**: Excessive resource usage (especially in serverless)
- **Compromised data**: Accounts breached via brute force
- **Availability**: Service unavailable for legitimate users

---

## 💡 Recommended Implementations

### 1. Simple Rate Limiting (In Memory)

Suitable for single-instance applications:

```typescript
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;
  
  const record = requestCounts.get(ip) ?? { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }
  
  record.count++;
  requestCounts.set(ip, record);
  
  if (record.count > maxRequests) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString(),
        "X-RateLimit-Limit": maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": record.resetTime.toString(),
      },
    });
  }
  
  const res = await next();
  res.headers.set("X-RateLimit-Limit", maxRequests.toString());
  res.headers.set("X-RateLimit-Remaining", (maxRequests - record.count).toString());
  res.headers.set("X-RateLimit-Reset", record.resetTime.toString());
  
  return res;
});
```

**Limitations:**
- Does not work across multiple instances
- Loses state on restart
- No persistence

---

### 2. Rate Limiting with Redis (Distributed)

For multi-instance applications:

```typescript
import { connect } from "redis";

const redis = await connect({ hostname: "localhost", port: 6379 });

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const key = `ratelimit:${ip}`;
  const windowMs = 60000;
  const maxRequests = 100;
  
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  
  if (current > maxRequests) {
    const ttl = await redis.ttl(key);
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": ttl.toString(),
        "X-RateLimit-Limit": maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  
  const res = await next();
  res.headers.set("X-RateLimit-Limit", maxRequests.toString());
  res.headers.set("X-RateLimit-Remaining", (maxRequests - current).toString());
  
  return res;
});
```

**Advantages:**
- Works across multiple instances
- Persistent
- Atomicity guaranteed

---

### 3. Rate Limiting by Authenticated User

```typescript
app.use(async (req, _params, next) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return await next();
  
  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  
  try {
    const { payload } = await jwtVerify(token, secret);
    userId = payload.userId as string;
  } catch {
    return await next(); // Let the auth handler deal with it
  }
  
  const key = `ratelimit:user:${userId}`;
  // ... same rate limiting logic
  
  return await next();
});
```

---

### 4. WebSocket Rate Limiting

#### Message Limit per Second

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const messageCount = { count: 0, resetTime: Date.now() + 1000 };
  const maxMessagesPerSecond = 10;
  
  ws.onmessage = (event) => {
    const now = Date.now();
    
    if (now > messageCount.resetTime) {
      messageCount.count = 0;
      messageCount.resetTime = now + 1000;
    }
    
    messageCount.count++;
    
    if (messageCount.count > maxMessagesPerSecond) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Rate limit exceeded. Max 10 messages/second.",
      }));
      return;
    }
    
    // Process the message normally
    const group = app.getWsGroupByPath("/chat/:room/:user");
    group.broadcast(event.data, /* ... */);
  };
});
```

#### Maximum Message Size

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const maxMessageSize = 1024; // 1 KB
  
  ws.onmessage = (event) => {
    if (typeof event.data === "string" && event.data.length > maxMessageSize) {
      ws.send(JSON.stringify({
        type: "error",
        message: `Message too large. Max ${maxMessageSize} characters.`,
      }));
      return;
    }
    
    // Process the message
  };
});
```

---

### 5. Broadcast Backpressure

When a client is slow, broadcasting can pile up messages:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  const maxQueueSize = 100;
  let messageQueue: string[] = [];
  
  ws.onmessage = (event) => {
    // Normal broadcast
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  // Monitor bufferedAmount (WebSocket API)
  setInterval(() => {
    if (ws.bufferedAmount > 1024 * 1024) { // > 1 MB
      console.warn(`[WS] Client ${params.user} has a high buffer: ${ws.bufferedAmount}`);
      // Optional: close the connection or send an alert
      ws.send(JSON.stringify({
        type: "warning",
        message: "You're receiving messages faster than you can process them.",
      }));
    }
  }, 5000);
});
```

---

## 🔮 Possible Future Implementation in the Core

If rate limiting were added to the core, it could look like this:

```typescript
const app = createDenoRouter({
  basePath: "/api",
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    maxRequests: 100,
    keyGenerator: (req) => req.headers.get("x-forwarded-for") ?? "unknown",
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req, res, next, options) => {
      res.status(429).json({
        error: "Too many requests, please try again later.",
      });
    },
  },
});
```

### Challenges

1. **Storage**: In memory vs Redis vs database
2. **Distribution**: How to synchronize between instances
3. **Flexibility**: Different limits for different routes
4. **Performance**: Overhead of checking rate limits on every request

### Priority: **Medium**

Rate limiting is important, but mature solutions (middlewares, proxies) already exist and can be used. Implementing it in the core may be over-engineering.

---

## 📚 Recommended Libraries

### For Node.js

- **rate-limiter-flexible**: Supports Redis, MongoDB, memory
- **express-rate-limit**: Simple and popular
- **slow-down**: Adds delay instead of blocking

### For Deno

There are currently no mature libraries. Implement your own or use Redis directly.

### For Cloudflare

- **Cloudflare Rate Limiting Rules**: Configured in the dashboard
- **Workers KV**: For distributed rate limiting

---

## ✅ Rate Limiting Checklist

- [ ] Rate limit by IP on public endpoints
- [ ] More aggressive rate limit on `/login`, `/register`
- [ ] Rate limit by authenticated user
- [ ] WebSocket rate limiting (messages/second)
- [ ] Maximum WebSocket message size
- [ ] `X-RateLimit-*` headers on responses
- [ ] Logs of abuse attempts
- [ ] Alerts for anomalous traffic spikes

---

## 🎯 Recommendations by Application Size

### Small (Single Instance, < 1000 req/min)

- In-memory rate limiting
- No Redis
- Simple middleware

### Medium (Multi-Instance, < 10000 req/min)

- Redis for distributed rate limiting
- Different limits per route
- Basic monitoring

### Large (> 10000 req/min)

- Edge solution (Cloudflare, AWS WAF)
- Redis cluster
- Traffic pattern analysis
- Machine learning for anomaly detection

---

## 🤝 Contributing

If you have implemented a robust rate limiting solution, consider:

1. Sharing it as an example in `example/rate-limiting/`
2. Creating a separate package: `@vanaware/wsrouter-rate-limit`
3. Opening an issue discussing the approach

We are open to contributions! 🚀

````

---

## File: `docs/runtime-agnostic.md`

````md
# 🌐 Runtime-Agnostic Architecture

`@vanaware/wsrouter` is designed to run on **any JavaScript runtime** that supports standard Web APIs (Fetch API, WebSocket, URLPattern). The router core **has no direct dependency** on any specific runtime.

Currently, we provide official, tested adapters only for **Deno**. Adapters for other runtimes (Node.js, Bun, Cloudflare Workers) are on our [Roadmap](./roadmap-adapters.md).

---

## 🏗️ Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│             YOUR CODE (main.ts / worker.ts)             │
│  - Defines routes, middlewares and handlers             │
│  - Chooses the entry point matching the runtime         │
└──────────────────────────┬──────────────────────────────┘
                           │ imports
┌──────────────────────────▼──────────────────────────────┐
 │           ENTRY POINTS (src/deno.ts)                    │
 │  - createDenoRouter()                                   │
 └──────────────────────────┬──────────────────────────────┘
                           │ injects adapters
┌──────────────────────────▼──────────────────────────────┐
 │            AGNOSTIC CORE (src/mod.ts)                   │
 │  - Router (src/router.ts)                               │
 │  - HttpRoute (src/http-route.ts)                        │
 │  - WsRoute (src/ws-route.ts)                            │
 │  - WebSocketGroup (src/websocket-group.ts)              │
 │  - MiddlewareChain (src/middleware-chain.ts)            │
 │  - MiddlewareRoute (src/middleware-route.ts)            │
 │  - WorkerRoute (src/worker-route.ts)                    │
 │  - Types (src/types.ts)                                 │
 │  - ZERO dependency on any specific runtime              │
 │  - Uses interfaces: WebSocketUpgrader, StaticFileHandler│
 └──────────────────────────┬──────────────────────────────┘
                           │ implemented by
┌──────────────────────────▼──────────────────────────────┐
 │              ADAPTERS (src/adapters/)                    │
 │  - adapters/deno.ts       → Deno.upgradeWebSocket,      │
 │                              Deno.stat, Deno.open       │
 └─────────────────────────────────────────────────────────┘
```

---

## 🔌 Adaptation Interfaces

### `WebSocketUpgrader`
Abstracts the HTTP-to-WebSocket upgrade mechanism:
```typescript
interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}
```

### `StaticFileHandler`
Abstracts the file system used to serve static files:
```typescript
interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}
```

---

## 🦕 Using with Deno (Official Support)

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
  forceHttps: true,
  trustProxy: true,
});

app.get("/hello", () => ({ body: "Hello!" }));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

## 🟢 Using with Node.js or Bun (Via Pure Core)

Since the core is agnostic, you can use it on Node.js or Bun by implementing your own adaptation interfaces:

```typescript
import { Router } from "@vanaware/wsrouter";

// You would need to implement these interfaces for your runtime
const myNodeUpgrader = { /* ... */ };
const myNodeStaticHandler = { /* ... */ };

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: myNodeUpgrader,
  staticFileHandler: myNodeStaticHandler,
});
```

---

## 🔒 Security

- **Path Traversal Protection**: The core sanitizes paths and the Deno adapter enforces real *containment* and rejects symlinks.
- **Dotfiles**: Blocked by default (`allowDotfiles: false`).
- **Force HTTPS**: Redirects HTTP→HTTPS in production (ignores localhost).
- **HSTS**: The `Strict-Transport-Security` header is added automatically on HTTPS responses.
- **Trust Proxy**: Explicit trust in headers such as `X-Forwarded-Proto` via `trustProxy: true`.

---

## 📋 Current Compatibility Table

| Feature | Deno (Official) | Node.js / Bun (Via Core) |
|---------|----------------|--------------------------|
| HTTP Routing | ✅ | ✅ |
| WebSocket | ✅ | ⚠️ (Adapter Required) |
| Static Files (disk) | ✅ | ⚠️ (Adapter Required) |
| Force HTTPS / HSTS | ✅ | ✅ |
| Middlewares | ✅ | ✅ |
| Dual Params Broadcast | ✅ | ✅ |
| Last Broadcast | ✅ | ✅ |
| Path Traversal / Symlinks | ✅ | ⚠️ (Adapter Dependent) |

````

---

## File: `docs/security.md`

````md
# 🔒 @vanaware/wsrouter Security Guide

This document describes the recommended security practices when using `@vanaware/wsrouter` in production.

## 📋 Index

1. [HTTPS and HSTS](#https-and-hsts)
2. [Static File Protection](#static-file-protection)
3. [WebSocket Security](#websocket-security)
4. [Authentication and Authorization](#authentication-and-authorization)
5. [Rate Limiting](#rate-limiting)
6. [Security Headers](#security-headers)

---

## 🌐 HTTPS and HSTS

### Force HTTPS

The router supports automatic HTTP-to-HTTPS redirection:

```typescript
const app = createDenoRouter({
  basePath: "/api",
  forceHttps: true, // Redirects HTTP → HTTPS
});
```

**Behavior:**
- Redirects with status `301 Moved Permanently`
- Automatically ignores `localhost` and `127.0.0.1` to ease development
- Supports IPv6 `[::1]`

### Proxy Trust (`trustProxy`)

When running behind a reverse proxy (nginx, Cloudflare, etc.), the router can trust the `X-Forwarded-Proto` header:

```typescript
const app = createDenoRouter({
  forceHttps: true,
  trustProxy: true, // ⚠️ Only if behind a trusted proxy
});
```

**⚠️ WARNING:** Never enable `trustProxy` if the server is exposed directly to the internet. An attacker could send `X-Forwarded-Proto: https` and bypass the redirect.

### HSTS (HTTP Strict Transport Security)

When `forceHttps` is active and the request is already HTTPS, the router automatically adds:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This instructs browsers to always use HTTPS for your domain.

---

## 📂 Static File Protection

### Dotfiles and Traversal Defense-in-Depth

By default, files that begin with `.` are blocked:

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: false, // Default: false
});
```

**Blocked by default:**
- `.env`, `.env.local`
- `.git/config`, `.git/HEAD`
- `.DS_Store`
- `.htaccess`

Even when `allowDotfiles: true` is enabled (for example, to serve `.well-known`), relative directory segments such as `..` and `.` remain **strictly forbidden and blocked with 404**, guaranteeing that enabling dotfiles never opens path traversal gaps.

### Symlinks and Symlinked Directories

The Deno adapter **rejects symlinks** directly and validates the physical resolution with `Deno.realPath`:
- Direct symlinks are detected via `Deno.lstat` and rejected.
- Intermediate symlinked directories are validated against `resolvedBase`, preventing symlinked directories pointing outside the `staticDir` from being accessed.

### Static File Headers & MIME Protection

The Deno adapter automatically injects:
- `X-Content-Type-Options: nosniff` (preventing MIME sniffing attacks)
- `ETag` and transparent `If-None-Match` support (returning `304 Not Modified` and cancelling the stream to save I/O)
- `Cache-Control` and `Last-Modified`
- Safe handling of `HEAD` requests, cancelling the opened stream to avoid file descriptor leaks.

### Path Traversal

The router sanitizes paths to prevent path traversal attacks:

```typescript
// Malicious request
GET /../../etc/passwd
GET /..%2F..%2Fetc%2Fpasswd

// Result: 404 (path sanitized before access)
```

### Containment

The Deno adapter verifies that the resolved path is strictly inside the `staticDir`:

```typescript
const app = createDenoRouter({
  staticDir: "/var/www/public",
});

// Request: GET /../../etc/passwd
// Even after sanitization, the resolved path is verified
// Result: 404 if it attempts to escape the directory
```

---

## 🔌 WebSocket Security

### Origin Validation

WebSockets are vulnerable to Cross-Site WebSocket Hijacking (CSWSH) attacks. Validate the `Origin` header:

```typescript
const allowedOrigins = ["https://mysite.com", "https://app.mysite.com"];

app.use(async (req, _params, next) => {
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response("Forbidden: Invalid origin", { status: 403 });
    }
  }
  return await next();
});
```

### Authentication via Subprotocol

The JWT example demonstrates how to pass tokens through the WebSocket subprotocol:

```javascript
// Client
const ws = new WebSocket("wss://api.site.com/chat", ["Bearer", token]);

// Server (middleware)
app.use(async (req, _params, next) => {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return await next();
  }

  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map(p => p.trim());
  const bearerIndex = protocols.findIndex(p => p === "Bearer");
  const token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;

  if (!token) {
    return new Response("Token required", { status: 401 });
  }

  try {
    await jwtVerify(token, secret);
    return await next();
  } catch {
    return new Response("Invalid token", { status: 403 });
  }
});
```

### Room Isolation

Use `permissionFn` to ensure messages do not leak between rooms:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");

  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
});
```

**Without `permissionFn`, the broadcast sends to ALL sockets on the route**, not only to the same room.

---

## 🔐 Authentication and Authorization

### JWT with Expiration

Always set expiration on JWT tokens:

```typescript
import { SignJWT } from "jose";

const token = await new SignJWT({ userId: "123", role: "user" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h") // ⚠️ Always set
  .setIssuedAt()
  .sign(secret);
```

### Algorithm Validation

When verifying JWTs, specify the allowed algorithms:

```typescript
import { jwtVerify } from "jose";

await jwtVerify(token, secret, {
  algorithms: ["HS256"], // ⚠️ Avoid "none" and weak algorithms
});
```

### Secrets in Environment Variables

Never hardcode secrets in production:

```typescript
// ❌ BAD
const JWT_SECRET = "my-secret-123";

// ✅ GOOD
const JWT_SECRET = Deno.env.get("JWT_SECRET");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not configured");
}
```

---

## 🚦 Rate Limiting

The router **does not include native rate limiting**. Use middlewares to protect against abuse:

```typescript
// Simple example of rate limiting by IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  const record = requestCounts.get(ip) ?? { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  record.count++;
  requestCounts.set(ip, record);

  if (record.count > maxRequests) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString(),
      },
    });
  }

  return await next();
});
```

For production, consider:
- Redis for distributed rate limiting
- Specialized libraries such as `rate-limiter-flexible`
- Edge solutions (Cloudflare, AWS WAF)

---

## 🛡️ Security Headers

Add security headers via middleware:

```typescript
app.use(async (req, _params, next) => {
  const res = await next();

  // Prevent clickjacking
  res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer Policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (adjust as needed)
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  return res;
});
```

---

## ✅ Production Security Checklist

- [ ] `forceHttps: true` enabled
- [ ] `trustProxy: true` only if behind a trusted proxy
- [ ] `allowDotfiles: false` (default)
- [ ] `Origin` validation on WebSockets
- [ ] JWT tokens with expiration and restricted algorithms
- [ ] Secrets in environment variables
- [ ] Rate limiting implemented
- [ ] Security headers added
- [ ] Audit logs for authentication
- [ ] HTTPS/WSS in production (never HTTP/WS)

---

## 📚 Additional Resources

- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [MDN: HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

````

---

## File: `docs/simple-permission.md`

````md
# Simple Example: The `/room` Route Without Parameters

When a route has no dynamic parameters, the `params` object received by the `permissionFn` will be an empty object `{}`. In that case, filtering must be based on the **message content** or on **external state** (such as a banned-user list).

## 📄 File: `monorepo/router/example/room/main.ts`

```typescript
// monorepo/router/example/room/main.ts
import { Router } from "../../src/mod.ts";

const app = new Router({ basePath: "/api" });

// External list of banned users (simulating a database)
const bannedUsers = new Set(["spammer1", "baduser2"]);

// ============================================================
// Simple WebSocket route: /room (no parameters)
// ============================================================
app.ws("/room", (ws, req, _params) => {
  // Extract the user name from a header (since we have no URL params)
  const user = req.headers.get("x-user-name") ?? "anonymous";

  console.log(`[WS] ${user} joined the room`);

  const group = app.getWsGroupByPath("/room");
  if (!group) return;

  ws.onmessage = (event) => {
    const message = event.data;

    // Example 1: Filter by message content
    // Example 2: Filter by banned user (external state)
    group.broadcast(
      `[${user}]: ${message}`,
      (_receiver, _sender, msg) => {
        // clientParams is {} (empty, because the route has no params)
        // msg is the message being sent

        // Rule 1: Block messages containing a forbidden word
        if (msg.toLowerCase().includes("spam")) {
          return false;
        }

        // Rule 2: Block messages from banned users
        // (we extract the user name from the "[user]:" prefix)
        const senderMatch = msg.match(/^\[([^\]]+)\]:/);
        if (senderMatch && bannedUsers.has(senderMatch[1])) {
          return false;
        }

        return true; // Allow all other messages
      },
      {}, // empty senderParams, since we have no params on the route
    );
  };

  ws.onclose = () => console.log(`[WS] ${user} left the room`);
});

// ============================================================
// Server
// ============================================================
const server = Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Server running on http://localhost:3000");
console.log("🔌 WS: ws://localhost:3000/api/room (optional X-User-Name header)");
```

---

## 🔍 How the `permissionFn` Works Without Parameters

Because the `/room` route has no `:param`, the `params` object is always `{}`. So filtering must rely on other information:

| Data Source | How to Access | Example Use |
|-------------|---------------|-------------|
| **Message content** | The `msg` parameter of the `permissionFn` | Block forbidden words |
| **External state** | Variables outside the handler (e.g. `bannedUsers`) | Ban list, roles |
| **Request headers** | Captured in `onopen` and stored | Roles, access levels |

---

## 🧪 Testing

### Simple client (Node.js or browser)

```javascript
// Connect passing the name in a header (via fetch + manual WebSocket)
// In the browser, custom headers are not possible with WebSocket.
// Alternative: pass the name in the query string or first message.

const ws = new WebSocket("ws://localhost:3000/api/room");

ws.onopen = () => {
  // The first message identifies the user
  ws.send("__IDENTIFY__:joao");
};

ws.onmessage = (e) => console.log("Received:", e.data);
```

### Test cases

```bash
# ✅ Normal message → everyone receives it
ws.send("Hello everyone!")
# → [joao]: Hello everyone!

# ❌ Message containing "spam" → nobody receives it
ws.send("This is spam!")
# → (silence)

# ❌ Message from a banned user → nobody receives it
# (if the sender is "spammer1")
# → (silence)
```

---

## 💡 Alternative: Keep State in the Handler

If you need more complex filtering, you can keep information in the handler's closure:

```typescript
app.ws("/room", (ws, req, _params) => {
  // Local per-connection state
  const userRole = req.headers.get("x-role") ?? "visitor";
  const userName = req.headers.get("x-user-name") ?? "anonymous";

  const group = app.getWsGroupByPath("/room");
  if (!group) return;

  ws.onmessage = (event) => {
    group.broadcast(
      `[${userName}]: ${event.data}`,
      (_receiver, _sender, msg) => {
        // Here you can use the `userRole` from the closure
        // to decide whether the message should pass through
        if (userRole === "admin") return true; // Admin always passes
        if (msg.includes("@admin")) return false; // Visitors don't see mentions
        return true;
      },
      {},
    );
  };
});
```

---

## ✅ Summary

For routes **without parameters**:
- `params` will always be `{}`
- Use the `message` parameter of the `permissionFn` to filter by content
- Use external variables (closures, Maps, Sets) for shared state
- The permission logic remains `(receiverParams, senderParams, message) => boolean`

````

---

## File: `docs/webrtc.md`

````md
# 🎥 WebRTC Live Streaming & Signaling Guide

`@vanaware/wsrouter` includes native, high-performance WebRTC signaling and stream coordination utilities via `WebRTCSignalingHub` and `WebSocketGroup`. This enables zero-dependency peer-to-peer webcam, audio, and screen sharing with real-time viewer tracking and interactive reactions.

---

## 🏗️ Architecture & Signaling Flow

WebRTC establishes direct peer-to-peer media streaming between browsers. The server acts as a low-latency signaling mediator exchanging SDP offers, SDP answers, and ICE candidates.

```text
[ Broadcaster ]                    [ WsRouter Hub ]                    [ Viewer(s) ]
       │                                  │                                  │
       ├─── broadcaster_started ─────────►│─── broadcaster_started ─────────►│
       │                                  │◄── request_stream ───────────────┤
       │◄── request_stream ───────────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_offer (SDP) ──────────►│─── webrtc_offer (SDP) ──────────►│
       │                                  │◄── webrtc_answer (SDP) ──────────┤
       │◄── webrtc_answer (SDP) ──────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_candidate (ICE) ──────►│─── webrtc_candidate (ICE) ──────►│
       │◄── webrtc_candidate (ICE) ───────│◄── webrtc_candidate (ICE) ───────┤
       │                                  │                                  │
       ══════════════════════ Direct P2P Media Stream ════════════════════════►
```

---

## 🚀 Server-Side Setup

### 1. Minimal WebRTC Signaling Endpoint

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/webrtc/:room", (ws, _req, params) => {
  const room = (params.room as string) || "general";
  const group = app.getWsGroupByPath("/webrtc/:room");
  if (!group) return;

  ws.onmessage = (event) => {
    // Automatically routes SDP offers, answers, candidates, and stream events
    group.handleSignaling(ws, event.data, params);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 WebRTC Signaling Protocol Messages

The `WebRTCSignalingHub` handles standard JSON message formats:

### 1. Broadcaster Announcements
- **Start Broadcast**:
  ```json
  {
    "type": "broadcaster_started",
    "broadcasterId": "user-123",
    "broadcasterName": "Alice",
    "streamTitle": "Live Demo"
  }
  ```
- **Stop Broadcast**:
  ```json
  {
    "type": "broadcaster_stopped",
    "broadcasterId": "user-123"
  }
  ```

### 2. Stream Request (Viewer -> Broadcaster)
```json
{
  "type": "request_stream",
  "viewerId": "viewer-456",
  "viewerName": "Bob",
  "broadcasterId": "user-123"
}
```

### 3. SDP Offer & Answer
- **Offer**:
  ```json
  {
    "type": "webrtc_offer",
    "from": "user-123",
    "to": "viewer-456",
    "sdp": { "type": "offer", "sdp": "..." },
    "fromName": "Alice"
  }
  ```
- **Answer**:
  ```json
  {
    "type": "webrtc_answer",
    "from": "viewer-456",
    "to": "user-123",
    "sdp": { "type": "answer", "sdp": "..." },
    "fromName": "Bob"
  }
  ```

### 4. ICE Candidates
```json
{
  "type": "webrtc_candidate",
  "from": "user-123",
  "to": "viewer-456",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### 5. Floating Reactions
```json
{
  "type": "stream_reaction",
  "from": "viewer-456",
  "fromName": "Bob",
  "emoji": "🔥",
  "timestamp": 1726500000000
}
```

---

## 🛠️ Server-Side API Reference

### `WebRTCSignalingHub`
- `hub.registerPeer(ws: WebSocket, peerId: string): void`: Binds a socket to a unique peer ID.
- `hub.unregisterPeer(ws: WebSocket): void`: Removes socket and closes any active broadcast by this peer.
- `hub.handleMessage(ws: WebSocket, rawData: string | object, params?: RouteParams): boolean`: Dispatches signaling messages.
- `hub.startBroadcasting(broadcasterId, name, room, title?, params?): ActiveStreamInfo`: Marks stream active and notifies group.
- `hub.stopBroadcasting(broadcasterId, room, params?): boolean`: Ends stream and notifies group.
- `hub.getActiveStream(room: string): ActiveStreamInfo | undefined`: Gets current broadcaster info.
- `hub.isBroadcasting(room: string): boolean`: Checks if a stream is live in a room.
- `hub.getAllActiveStreams(): ActiveStreamInfo[]`: Returns all active streams across rooms.
- `hub.sendToPeer(peerId: string, message: WebRTCSignalingMessage | string): boolean`: Delivers a message directly to a peer.
- `hub.sendReaction(room, reaction, params?): boolean`: Broadcasts a live reaction emoji.
- `hub.getPeers(): string[]` & `hub.peerCount: number`: Peer roster and total count.
- `hub.on(event, listener)` & `hub.off(event, listener)`: Lifecycle events (`stream_start`, `stream_stop`, `peer_register`, `peer_unregister`, `reaction`).

### `WebSocketGroup` WebRTC Methods
- `group.signaling`: The `WebRTCSignalingHub` bound to this group.
- `group.handleSignaling(ws, rawData, params)`
- `group.registerPeer(ws, peerId)`
- `group.unregisterPeer(ws)`
- `group.startBroadcasting(broadcasterId, name, room, title?, params?)`
- `group.stopBroadcasting(broadcasterId, room, params?)`
- `group.getActiveStream(room)`
- `group.isBroadcasting(room)`
- `group.getAllActiveStreams()`
- `group.sendReaction(room, reaction, params?)`
- `group.sendToPeer(peerId, message)`
- `group.peerCount` & `group.getPeers()`

### `Router` WebRTC Methods
- `router.getSignaling(pathOrPattern)`
- `router.getActiveStream(pathOrPattern, room)`
- `router.getAllActiveStreams(pathOrPattern)`
- `router.isBroadcasting(pathOrPattern, room)`
- `router.startBroadcasting(pathOrPattern, broadcasterId, name, room, title?, params?)`
- `router.stopBroadcasting(pathOrPattern, broadcasterId, room, params?)`

---

## 💻 Client-Side Implementation Example

### Broadcaster Setup (Webcam / Microphone)

```javascript
const peerConnections = new Map(); // viewerId -> RTCPeerConnection
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
document.getElementById("local-video").srcObject = localStream;

// Connect to WebSocket signaling route
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onopen = () => {
  // Announce live broadcast
  ws.send(JSON.stringify({
    type: "broadcaster_started",
    broadcasterId: myPeerId,
    broadcasterName: "Alice",
    streamTitle: "Deno WebRTC Live Stream",
    room: currentRoom
  }));
};

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "request_stream") {
    // Create new RTCPeerConnection for incoming viewer
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.set(msg.viewerId, pc);

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Send ICE candidates to viewer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.viewerId,
          candidate: e.candidate
        }));
      }
    };

    // Create & send SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({
      type: "webrtc_offer",
      from: myPeerId,
      to: msg.viewerId,
      sdp: offer,
      fromName: "Alice"
    }));
  }

  if (msg.type === "webrtc_answer") {
    const pc = peerConnections.get(msg.from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
  }

  if (msg.type === "webrtc_candidate") {
    const pc = peerConnections.get(msg.from);
    if (pc && msg.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  }
};
```

### Viewer Setup

```javascript
let pc = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "broadcaster_started") {
    // Request stream from active broadcaster
    ws.send(JSON.stringify({
      type: "request_stream",
      viewerId: myPeerId,
      viewerName: "Bob",
      broadcasterId: msg.broadcasterId,
      room: currentRoom
    }));
  }

  if (msg.type === "webrtc_offer") {
    pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (e) => {
      document.getElementById("remote-video").srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.from,
          candidate: e.candidate
        }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({
      type: "webrtc_answer",
      from: myPeerId,
      to: msg.from,
      sdp: answer,
      fromName: "Bob"
    }));
  }

  if (msg.type === "webrtc_candidate" && pc) {
    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
  }
};
```

````

---

## File: `docs/websocket-permissions.md`

````md
# 📡 Documentation: Smart Permissioning in WebSockets (Dual Params)

`@vanaware/wsrouter` has a native and robust permissioning system for WebSockets, allowing broadcast messages to be filtered dynamically based on the **receiver parameters**, the **sender parameters**, and the **message content**.

---

## 🔑 Fundamental Concepts

### 1. `PermissionFn` (Dual Permission Function)
It is an optional callback passed to the `group.broadcast()` method. Its signature receives three arguments:

```typescript
type PermissionFn = (
  receiverParams: RouteParams, // Parameters of who WILL RECEIVE the message
  senderParams: RouteParams,   // Parameters of who SENT the message
  message: string              // The message content
) => boolean;
```

---

## 🌍 Practical Real-World Examples

### Scenario 1: Chat Room Isolation (The Classic)
**Goal:** Ensure a message sent in the "general" room does not leak into the "vip" room.

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");

  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      // Filter: the receiver must be in the same room as the sender
      (receiver, sender, _msg) => receiver.room === sender.room,
      params // We pass the sender's params
    );
  };
});
```

### Scenario 2: Access Control by User Level (RBAC)
**Goal:** Only users with the `admin` role may send critical system alerts.

```typescript
app.ws("/dashboard/:role/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/dashboard/:role/:userId");

  ws.onmessage = (event) => {
    group.broadcast(
      `🚨 ALERT: ${event.data}`,
      (_receiver, sender, _msg) => {
        // Only allow the broadcast if the SENDER is admin
        return sender.role === "admin";
      },
      params
    );
  };
});
```

### Scenario 3: Filtering Based on Message Content
**Goal:** Prevent messages containing the word "spam" from being propagated.

```typescript
app.ws("/community/:serverId/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/community/:serverId/:userId");

  ws.onmessage = (event) => {
    group.broadcast(
      event.data,
      (_receiver, _sender, msgContent) => {
        // Block if the message contains "spam"
        return !msgContent.toLowerCase().includes("spam");
      },
      params
    );
  };
});
```

---

## 💡 The "Magic" of Last Broadcast with Dual Params

When a new member joins the room, the router re-evaluates the `lastBroadcast` using the **Dual Params**.

```typescript
// 10:00:00 -> User A (room: "lobby") sends: "Hello everyone!"
// The router stores: { message: "Hello...", permissionFn: (r, s) => r.room === s.room, senderParams: { room: "lobby" } }

// 10:00:05 -> User B connects on route /chat/lobby/userB
// The router re-evaluates: permissionFn({ room: "lobby" }, { room: "lobby" }, "Hello...") -> TRUE
// User B automatically receives the historical message!

// 10:00:10 -> User C connects on route /chat/vip/userC
// The router re-evaluates: permissionFn({ room: "vip" }, { room: "lobby" }, "Hello...") -> FALSE
// User C does NOT receive the message (Security guaranteed!).
```

## ⚠️ Best Practices

1. **Keep the `PermissionFn` Lightweight:** Avoid asynchronous operations (such as database queries) inside the `PermissionFn`.
2. **Use `senderParams` Correctly:** Always pass the third argument `params` in `group.broadcast(msg, fn, params)`. Without it, `senderParams` will be an empty object `{}` and the "Last Broadcast" feature will not work correctly.

````

---

## File: `docs/workers.md`

````md
# 🔧 Workers: Programmable Fallback in the Router

The `app.worker()` function lets you register **generic fallback handlers** that run when no HTTP/WS route matches the request, but **before** attempting to serve static files.

---

## 🎯 Motivation

In the **Loco** project, the `@loco/server` package has a `workerHandler` in the Cloudflare Worker format (`fetch(request, env, ctx)`) that processes endpoints such as `/ping`, `/push`, and `/publickey`. When integrating the server with the router, we needed a native way to delegate unrouted requests to that worker without duplicating routes.

The server's `main.ts` pattern was:

```typescript
// 1. Try the worker
const workerResponse = await workerHandler.fetch(req, env, ctx);

// 2. If the worker returned 404, try static files
if (workerResponse.status !== 404) {
  return workerResponse;
}

// 3. Otherwise, serveDir
return await serveDir(req, { fsRoot: "./build/dist" });
```

With `app.worker()`, this flow becomes native to the router.

---

## 📐 Architecture

### The `WorkerHandler` Type

```typescript
type WorkerHandler = (req: Request) => Promise<Response>;
```

The worker is a **simple function** that receives a `Request` and returns a `Promise<Response>`. It does not receive `env` or `ctx` — those values are captured in the **closure** by the user. This keeps the router 100% agnostic.

### Position in the Execution Flow

```
Request
  │
  ├── forceHttps? → 301 redirect
  │
  ├── Middlewares (app.use)
  │
  ├── HTTP route found? → executeHttpHandler
  │
  ├── HEAD without route? → try automatic GET
  │
  ├── 405? → Method Not Allowed
  │
  ├── 🆕 Workers (app.worker) ← HERE
  │     ├── worker1 → 200 → return
  │     ├── worker1 → 404 → worker2 → 200 → return
  │     └── all → 404 → null
  │
  ├── Static files (GET/HEAD only)
  │
  └── 404 Not Found
```

### Why after the 405 check and before static files?

1. **After the 405:** If a route exists with another method, the correct HTTP behavior is 405, not delegating to a worker.
2. **Before static:** Workers can implement dynamic APIs. Static files are the last resort.

---

## 📝 API

### Registration

```typescript
app.worker(handler: WorkerHandler): this;
```

Returns `this` for chaining. Multiple workers form a **fallback chain**: if one returns 404, the next one is tried.

### Chain Behavior

```typescript
app.worker(worker1);  // Tried first
app.worker(worker2);  // Tried if worker1 returns 404
app.worker(worker3);  // Tried if worker2 returns 404
```

- If any worker returns a status **≠ 404**, the response is returned immediately.
- If **all** of them return 404, the router proceeds to static files.
- If a worker **throws an exception**, the error is logged and the next worker is tried (resilience).

### Middlewares

**Yes, middlewares work for workers.** Because workers run inside `executeFinalHandler`, which is invoked by the middleware chain, any middleware registered with `app.use()` intercepts the request before the worker.

This means logging, CORS, authentication, and rate limiting work automatically.

---

## 🌍 Practical Examples

### 1. Integration with the `@loco/server` workerHandler

The main use case of the Loco project:

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";
import workerHandler from "@loco/server/worker";

const env = Deno.env.toObject();
const ctx = {
  waitUntil: (p: Promise<unknown>) => { p.catch(console.error); },
  passThroughOnException: () => {},
};

const app = createDenoRouter({
  basePath: "",
  staticDir: "./build/dist",
});

// Router routes (they take priority over the worker)
app.get("/health", () => ({ body: "OK" }));

// Worker as fallback (before static files)
app.worker((req) => workerHandler.fetch(req, env, ctx));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

**Resulting flow:**

| Request | Result |
|---|---|
| `GET /health` | Router route → `OK` |
| `POST /ping` | Worker → `{ success: true, service: "loco-proxy" }` |
| `POST /push` | Worker → processes the push notification |
| `GET /index.html` | Worker returns 404 → Static file |
| `GET /does-not-exist` | Worker 404 → Static 404 → `404 Not Found` |

### 2. Simple reverse proxy

```typescript
app.worker(async (req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/legacy/")) {
    return new Response("Not Found", { status: 404 });
  }
  // Forward to the legacy service
  const target = url.pathname.replace("/api/legacy/", "http://legacy-service:3000/");
  return await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
});
```

### 3. Multiple workers (API + Proxy)

```typescript
// Worker 1: server APIs
app.worker((req) => workerHandler.fetch(req, env, ctx));

// Worker 2: proxy to an external service
app.worker(async (req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/external/")) {
    return new Response("Not Found", { status: 404 });
  }
  return await fetch(url.pathname.replace("/external/", "https://api.external.com/"));
});
```

---

## ⚠️ Considerations

### Routes take priority over workers

If `app.get("/ping")` exists **and** a worker also handles `/ping`, the router route **always wins**. The worker is never called for paths that already have a registered route.

### Performance

Every request that matches no route passes through **all workers** before reaching static files. Workers should be fast to return 404 (e.g. check the URL prefix before processing).

```typescript
// ✅ GOOD: fast return
app.worker(async (req) => {
  if (!new URL(req.url).pathname.startsWith("/api/")) {
    return new Response("Not Found", { status: 404 });
  }
  // ... processing
});

// ❌ BAD: unnecessary processing
app.worker(async (req) => {
  const data = await heavyComputation(); // Runs even for /index.html
  // ...
});
```

### `env` and `ctx` via closure

The router knows neither `env` nor `ctx`. Those values are captured in the worker's closure:

```typescript
// env and ctx live outside the router
const env = Deno.env.toObject();
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(console.error) };

// The closure captures env and ctx
app.worker((req) => workerHandler.fetch(req, env, ctx));
```

This is intentional: it keeps the router agnostic and lets any runtime provide its own context.

### Errors in workers

If a worker throws an exception, the error is logged to the console and the **next worker is tried**. This ensures a buggy worker does not take down the whole application.

---

## 📋 Summary

| Aspect | Detail |
|---|---|
| **Type** | `(req: Request) => Promise<Response>` |
| **Registration** | `app.worker(handler)` |
| **Multiple** | Yes, fallback chain (404 → next) |
| **Middlewares** | Yes, they run before workers |
| **Priority** | Routes > Workers > Static files > 404 |
| **Errors** | Logged, next worker tried |
| **env/ctx** | Via closure, the router is unaware |

````

---

