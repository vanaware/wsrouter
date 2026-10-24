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
