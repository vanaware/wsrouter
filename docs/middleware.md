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
