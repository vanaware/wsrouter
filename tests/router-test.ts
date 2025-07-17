// tests/router_test.ts

import { assertEquals, assertInstanceOf } from "https://deno.land/std @0.224.0/assert/mod.ts";
import { Router } from "../src/mod.ts";

Deno.test("Router - GET /hello retorna resposta HTTP válida", async () => {
  const router = new Router();

  router.get("/hello", () => new Response("Olá"));

  const req = new Request("http://localhost/hello");
  const res = router.fetch(req);

  assertInstanceOf(res, Response);
  assertEquals(res?.status, 200);
  assertEquals(await res.text(), "Olá");
});

Deno.test("Router - WS /ws aceita upgrade WebSocket", async () => {
  const router = new Router();

  router.websocket("/ws", (socket) => {
    socket.onMessage((msg) => {
      socket.send(`Recebido: ${msg.data}`);
    });
  });

  const req = new Request("http://localhost/ws", {
    headers: {
      upgrade: "websocket",
      connection: "upgrade",
    },
  });

  const res = router.fetch(req);
  assertInstanceOf(res, Response);
  assertEquals(res.status, 101); // Switching Protocols
  assertEquals(res.headers.get("upgrade"), "websocket");
});


Deno.test("Router - GET /hello deve retornar handler", async () => {
  const router = new Router();

  router.get("/hello", () => new Response("Olá"));

  const handler = router.match("GET", "/hello");
  const res = handler?.(new Request("http://localhost/hello"));

  assertEquals(res?.status, 200);
  assertEquals(await res?.text(), "Olá");
});

Deno.test("Router - Rota não encontrada", async () => {
  const router = new Router();
  const handler = router.match("GET", "/nao-existe");

  const res = handler?.(new Request("http://localhost/nao-existe"));

  assertEquals(res?.status, 404);
});