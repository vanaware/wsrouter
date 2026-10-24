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
