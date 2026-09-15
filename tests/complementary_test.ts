// monorepo/router/tests/complementary_test.ts
import { assertEquals, assert } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";
import { WebSocketGroup } from "../src/mod.ts";

// ============================================================
// 1. ERROR HANDLING
// ============================================================
Deno.test("Handler HTTP que lança erro retorna 500", async () => {
  const app = createDenoRouter("", null, null);
  app.get("/error", () => {
    throw new Error("Database connection failed");
  });
  const req = new Request("http://localhost/error");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 500);
  assertEquals(await res.text(), "Internal Server Error");
});

Deno.test("Handler HTTP assíncrono que rejeita retorna 500", async () => {
  const app = createDenoRouter("", null, null);
  app.get("/async-error", async () => {
    await new Promise(r => setTimeout(r, 10));
    throw new Error("Async boom");
  });
  const req = new Request("http://localhost/async-error");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 500);
});

// ============================================================
// 2. FORCE HTTPS
// ============================================================
Deno.test("Force HTTPS redireciona em produção (não localhost)", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://example.com/ping");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 301);
  assertEquals(res.headers.get("Location"), "https://example.com/ping");
  assertEquals(res.headers.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
});

Deno.test("Force HTTPS ignora localhost", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://localhost:8000/ping");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "pong");
});

// 🚀 CORREÇÃO: Adicionado trustProxy: true
Deno.test("Force HTTPS ignora se x-forwarded-proto for https", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, trustProxy: true });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https" }
  });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
});

// ============================================================
// 3. MIDDLEWARES
// ============================================================
Deno.test("Middleware HTTP: executa antes do handler e pode abortar", async () => {
  const app = createDenoRouter("", null, null);
  app.use((_req, _params, _next) => {
    return new Response("Unauthorized", { status: 401 });
  });
  app.get("/protected", () => ({ body: "secret" }));
  const req = new Request("http://localhost/protected");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "Unauthorized");
});

Deno.test("Middleware HTTP: múltiplos middlewares em cadeia", async () => {
  const app = createDenoRouter("", null, null);
  const order: number[] = [];
  app.use(async (_req, _params, next) => {
    order.push(1);
    const res = await next();
    order.push(4);
    return res;
  });
  app.use(async (_req, _params, next) => {
    order.push(2);
    const res = await next();
    order.push(3);
    return res;
  });
  app.get("/test", () => {
    return { body: "ok" };
  });
  const req = new Request("http://localhost/test");
  await app.handleRequest(req);
  assertEquals(order, [1, 2, 3, 4]);
});

Deno.test("Middleware HTTP: modifica a resposta", async () => {
  const app = createDenoRouter("", null, null);
  app.use(async (_req, _params, next) => {
    const res = await next();
    res.headers.set("X-Middleware", "applied");
    return res;
  });
  app.get("/test", () => ({ body: "ok" }));
  const req = new Request("http://localhost/test");
  const res = await app.handleRequest(req);
  assertEquals(res.headers.get("X-Middleware"), "applied");
});

Deno.test("Middleware HTTP: executa mesmo sem rota (404)", async () => {
  const app = createDenoRouter("", null, null);
  let middlewareCalled = false;
  app.use(async (_req, _params, next) => {
    middlewareCalled = true;
    return await next();
  });
  const req = new Request("http://localhost/inexistente");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
  assertEquals(middlewareCalled, true, "Middleware deve executar mesmo sem rota");
});

Deno.test("Middleware WS: aborta upgrade sem token", async () => {
  const app = createDenoRouter("", null, null);
  app.use((req, _params, next) => {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return next();
    }
    const token = req.headers.get("authorization");
    if (!token) {
      return new Response("Token required", { status: 401 });
    }
    return next();
  });
  app.ws("/chat", () => {});
  const req1 = new Request("http://localhost/chat", {
    headers: { upgrade: "websocket" },
  });
  const res1 = await app.handleRequest(req1);
  assertEquals(res1.status, 401);
});

Deno.test("Middleware WS: não é chamado para rotas WS inexistentes", async () => {
  const app = createDenoRouter("", null, null);
  let middlewareCalled = false;
  app.use(async (_req, _params, next) => {
    middlewareCalled = true;
    return await next();
  });
  const req = new Request("http://localhost/inexistente", {
    headers: { upgrade: "websocket" },
  });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
  assertEquals(middlewareCalled, true, "Middleware deve executar mesmo para 404 WS");
});

Deno.test("Middleware WS: pode passar Request modificada para next()", async () => {
  const app = createDenoRouter("", null, null);
  app.use(async (req, _params, next) => {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return next();
    }
    const newHeaders = new Headers(req.headers);
    newHeaders.set("X-User-Id", "42");
    const newReq = new Request(req.url, {
      method: req.method,
      headers: newHeaders,
    });
    return next(newReq);
  });
  let receivedUserId: string | null = null;
  app.ws("/chat", (ws, req) => {
    receivedUserId = req.headers.get("X-User-Id");
    ws.close(1000, "Test done");
  });
  const req = new Request("http://localhost/chat", {
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
  });
  await app.handleRequest(req);
  await new Promise((r) => setTimeout(r, 50));
  assertEquals(receivedUserId, "42", "Handler deve receber a request modificada");
});

// ============================================================
// 4. LAST BROADCAST COM DUAL PERMISSION
// ============================================================
class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob) {
    if (typeof data === "string") {
      this.sent.push(data);
    }
  }
  close(code?: number, reason?: string) {
    this.readyState = 3;
  }
}

Deno.test("Last Broadcast NÃO vaza para sala diferente (Dual Permission)", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1" });
  group.broadcast(
    "Segredo da Sala A",
    (receiver, sender, _msg) => receiver.room === sender.room,
    { room: "A", user: "user1" }
  );
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", user: "user2" });
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "B", user: "user2" });
  await new Promise(r => setTimeout(r, 100));
  assertEquals(ws2.sent, [], "User2 na sala B não deve receber broadcast da sala A");
});

Deno.test("Last Broadcast É entregue para novo membro na mesma sala", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", user: "user1" });
  group.broadcast(
    "Bem-vindos!",
    (receiver, sender, _msg) => receiver.room === sender.room,
    { room: "A", user: "user1" }
  );
  const ws3 = new MockWebSocket();
  group.addSocket(ws3 as unknown as WebSocket, { room: "A", user: "user3" });
  group.sendLastBroadcastTo(ws3 as unknown as WebSocket, { room: "A", user: "user3" });
  await new Promise(r => setTimeout(r, 100));
  assertEquals(ws3.sent, ["Bem-vindos!"]);
});

Deno.test("Last Broadcast com delay customizado (0ms)", async () => {
  const group = new WebSocketGroup(0);
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A" });
  group.broadcast("msg", undefined, { room: "A" });
  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A" });
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A" });
  await new Promise(r => setTimeout(r, 10));
  assertEquals(ws2.sent, ["msg"]);
});