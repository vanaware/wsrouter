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
