import { assertEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";

Deno.test("GET rota simples retorna body correto", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/hello", () => ({ body: "world" }));
  const req = new Request("http://localhost/hello");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "world");
});

Deno.test("GET com parâmetros nomeados", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/users/:id", (_req, params) => ({
    body: JSON.stringify({ id: params.id }),
  }));
  const req = new Request("http://localhost/users/42");
  const res = await app.handleRequest(req);
  assertEquals(await res.json(), { id: "42" });
});

Deno.test("GET com múltiplos parâmetros", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/a/:x/b/:y", (_req, params) => ({
    body: JSON.stringify(params),
  }));
  const req = new Request("http://localhost/a/1/b/2");
  const res = await app.handleRequest(req);
  assertEquals(await res.json(), { x: "1", y: "2" });
});

Deno.test("POST retorna 201", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.post("/items", async (req) => {
    const body = await req.text();
    return { body, init: { status: 201 } };
  });
  const req = new Request("http://localhost/items", {
    method: "POST",
    body: "test",
  });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 201);
  assertEquals(await res.text(), "test");
});

Deno.test("basePath é aplicado corretamente", async () => {
  const app = createDenoRouter({ basePath: "/api" });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://localhost/api/ping");
  const res = await app.handleRequest(req);
  assertEquals(await res.text(), "pong");
});

Deno.test("Rota inexistente retorna 404 (sem static)", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/exists", () => ({ body: "ok" }));
  const req = new Request("http://localhost/nope");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
});

// 🚀 CORREÇÃO: Agora retorna 405 Method Not Allowed
Deno.test("Método HTTP errado retorna 405", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/only-get", () => ({ body: "ok" }));
  const req = new Request("http://localhost/only-get", { method: "POST" });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Allow"), "GET");
});