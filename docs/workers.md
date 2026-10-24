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
