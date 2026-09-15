// monorepo/router/tests/middleware_test.ts
 import { assertEquals, assert } from "@std/assert";
 import { createDenoRouter } from "../src/deno.ts";
 // ============================================================
 // 1. MIDDLEWARE HTTP - BÁSICO
 // ============================================================
 Deno.test("Middleware HTTP: executa antes do handler", async () => {
   const app = createDenoRouter("", null, null);
   const calls: string[] = [];
   app.use(async (_req, _params, next) => {
     calls.push("middleware");
     return await next();
   });
   app.get("/test", () => {
     calls.push("handler");
     return { body: "ok" };
   });
   const req = new Request("http://localhost/test");
   const res = await app.handleRequest(req);
   assertEquals(res.status, 200);
   assertEquals(await res.text(), "ok");
   assertEquals(calls, ["middleware", "handler"]);
 });
 Deno.test("Middleware HTTP: pode abortar o fluxo (401)", async () => {
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
     order.push(5);
     return res;
   });
   app.use(async (_req, _params, next) => {
     order.push(2);
     const res = await next();
     order.push(4);
     return res;
   });
   app.get("/test", () => {
     order.push(3);
     return { body: "ok" };
   });
   const req = new Request("http://localhost/test");
   await app.handleRequest(req);
   assertEquals(order, [1, 2, 3, 4, 5]);
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
 Deno.test("Middleware HTTP: middleware de log mede tempo", async () => {
   const app = createDenoRouter("", null, null);
   let measuredMs = -1;
   app.use(async (_req, _params, next) => {
     const start = Date.now();
     const res = await next();
     measuredMs = Date.now() - start;
     return res;
   });
   app.get("/slow", async () => {
     await new Promise((r) => setTimeout(r, 50));
     return { body: "ok" };
   });
   const req = new Request("http://localhost/slow");
   await app.handleRequest(req);
   assert(measuredMs >= 45, `Tempo medido (${measuredMs}ms) deve ser >= 45ms`);
 });
 // ============================================================
 // 2. MIDDLEWARE HTTP - EDGE CASES
 // ============================================================
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
 Deno.test("Middleware HTTP: CORS em arquivo estático", async () => {
   const tmpDir = await Deno.makeTempDir();
   await Deno.writeTextFile(`${tmpDir}/hello.txt`, "world");
   const app = createDenoRouter("", tmpDir, null);
   app.use(async (_req, _params, next) => {
     const res = await next();
     res.headers.set("Access-Control-Allow-Origin", "*");
     return res;
   });
   const req = new Request("http://localhost/hello.txt");
   const res = await app.handleRequest(req);
   assertEquals(res.status, 200);
   assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
   await Deno.remove(tmpDir, { recursive: true });
 });
 Deno.test("Middleware HTTP: múltiplas chamadas de next() são protegidas", async () => {
   const app = createDenoRouter("", null, null);
   const handlerCalls: number[] = [];
   app.use(async (_req, _params, next) => {
     const r1 = await next(); // 1ª chamada OK
     // Tenta chamar de novo - deve falhar
     try {
       await next();
     } catch {
       // Ignora
     }
     return r1;
   });
   app.get("/test", () => {
     handlerCalls.push(1);
     return { body: "ok" };
   });
   const req = new Request("http://localhost/test");
   const res = await app.handleRequest(req);
   // Handler deve ser chamado APENAS UMA VEZ
   assertEquals(handlerCalls, [1]);
   assertEquals(res.status, 200);
 });
 // ============================================================
 // 3. MIDDLEWARE WEBSOCKET
 // ============================================================
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
   // Sem token - deve retornar 401
   const req1 = new Request("http://localhost/chat", {
     headers: { upgrade: "websocket" },
   });
   const res1 = await app.handleRequest(req1);
   assertEquals(res1.status, 401);
   // Com token - deve permitir upgrade (101)
   // ✅ CORREÇÃO: Deno.upgradeWebSocket exige o header 'connection: Upgrade'
   const req2 = new Request("http://localhost/chat", {
     headers: {
       upgrade: "websocket",
       connection: "Upgrade",
       authorization: "Bearer valid-token",
       "sec-websocket-version": "13",
       "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
     },
   });
   const res2 = await app.handleRequest(req2);
   assertEquals(res2.status, 101);
 });
 Deno.test("Middleware WS: não é chamado para rotas WS inexistentes", async () => {
   const app = createDenoRouter("", null, null);
   let middlewareCalled = false;
   app.use(async (_req, _params, next) => {
     middlewareCalled = true;
     return await next();
   });
   // ✅ CORREÇÃO: Com o novo fluxo, middlewares EXECUTAM mesmo para 404 WS
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
     // Cria nova request com header injetado
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
   // ✅ CORREÇÃO: Adicionado connection: Upgrade para satisfazer o Deno
   const req = new Request("http://localhost/chat", {
     headers: {
       upgrade: "websocket",
       connection: "Upgrade",
       "sec-websocket-version": "13",
       "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
     },
   });
   await app.handleRequest(req);
   // Aguarda um tick para o handler executar
   await new Promise((r) => setTimeout(r, 50));
   assertEquals(receivedUserId, "42", "Handler deve receber a request modificada");
 });
 // ============================================================
 // 4. MIDDLEWARE + ROUTES COMBINADAS
 // ============================================================
 Deno.test("Middleware HTTP: autenticação com rotas públicas e privadas", async () => {
   const app = createDenoRouter("", null, null);
   // Middleware global de autenticação
   app.use(async (req, _params, next) => {
     const path = new URL(req.url).pathname;
     if (path === "/public") {
       return await next(); // Rota pública
     }
     const auth = req.headers.get("authorization");
     if (!auth || auth !== "Bearer valid") {
       return new Response("Unauthorized", { status: 401 });
     }
     return await next();
   });
   app.get("/public", () => ({ body: "public data" }));
   app.get("/private", () => ({ body: "private data" }));
   // Rota pública - sem auth
   const req1 = new Request("http://localhost/public");
   const res1 = await app.handleRequest(req1);
   assertEquals(res1.status, 200);
   assertEquals(await res1.text(), "public data");
   // Rota privada - sem auth (deve falhar)
   const req2 = new Request("http://localhost/private");
   const res2 = await app.handleRequest(req2);
   assertEquals(res2.status, 401);
   // Rota privada - com auth
   const req3 = new Request("http://localhost/private", {
     headers: { authorization: "Bearer valid" },
   });
   const res3 = await app.handleRequest(req3);
   assertEquals(res3.status, 200);
   assertEquals(await res3.text(), "private data");
 });
 Deno.test("Middleware: CORS preflight (OPTIONS) é tratado corretamente", async () => {
   const app = createDenoRouter("", null, null);
   app.use(async (req, _params, next) => {
     if (req.method === "OPTIONS") {
       return new Response(null, {
         status: 204,
         headers: {
           "Access-Control-Allow-Origin": "*",
           "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type",
         },
       });
     }
     const res = await next();
     res.headers.set("Access-Control-Allow-Origin", "*");
     return res;
   });
   app.get("/data", () => ({ body: "ok" }));
   // Preflight OPTIONS
   const req1 = new Request("http://localhost/data", { method: "OPTIONS" });
   const res1 = await app.handleRequest(req1);
   assertEquals(res1.status, 204);
   assertEquals(res1.headers.get("Access-Control-Allow-Origin"), "*");
   // Request normal GET
   const req2 = new Request("http://localhost/data");
   const res2 = await app.handleRequest(req2);
   assertEquals(res2.status, 200);
   assertEquals(res2.headers.get("Access-Control-Allow-Origin"), "*");
 });
