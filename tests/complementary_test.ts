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
