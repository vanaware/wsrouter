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
