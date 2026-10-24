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
