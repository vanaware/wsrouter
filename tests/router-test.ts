// tests/router_test.ts

import { assertEquals, assertInstanceOf, } from "jsr:@std/assert@^1";
import { Router, } from "../src/mod.ts";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Router - GET /hello retorna resposta HTTP válida", async () => {
  const router = createDenoRouter();

  router.get("/hello", () => ({ body: "Olá", init: { status: 200, }, }),);

  const req = new Request("http://localhost/hello",);
  const res = await router.handleRequest(req,);

  assertInstanceOf(res, Response,);
  assertEquals(res?.status, 200,);
  assertEquals(await res.text(), "Olá",);
});

Deno.test("Router - Rota não encontrada", async () => {
  const router = createDenoRouter();

  const req = new Request("http://localhost/nao-existe",);
  const res = await router.handleRequest(req,);

  assertEquals(res?.status, 404,);
});
