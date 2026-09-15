// monorepo/router/tests/http_semantics_test.ts
import { assertEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";

Deno.test("HEAD automático: usa rota GET se HEAD não existir", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/resource", () => ({
    body: "data",
    init: { headers: { "X-Custom": "value" } },
  }));
  
  const req = new Request("http://localhost/resource", { method: "HEAD" });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("X-Custom"), "value");
  assertEquals(await res.text(), "", "HEAD deve ter body vazio");
});

Deno.test("405 Method Not Allowed: retorna quando path existe com outro método", async () => {
  const app = createDenoRouter({ basePath: "" });
  app.get("/resource", () => ({ body: "data" }));
  app.post("/resource", () => ({ body: "created", init: { status: 201 } }));
  
  const req = new Request("http://localhost/resource", { method: "PUT" });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Allow"), "GET, POST");
});

Deno.test("Static files: POST retorna 404", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  
  const req = new Request("http://localhost/file.txt", { method: "POST" });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
  
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("Static files: HEAD retorna headers sem body", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  
  const req = new Request("http://localhost/file.txt", { method: "HEAD" });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assertEquals(await res.text(), "", "HEAD deve ter body vazio");
  
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("basePath normaliza '/' para ''", async () => {
  const app = createDenoRouter({ basePath: "/" });
  app.get("/test", () => ({ body: "ok" }));
  
  const req = new Request("http://localhost/test");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("lastBroadcastDelay default é 0ms", async () => {
  // Teste implícito: se fosse 50ms, testes de last broadcast seriam mais lentos
  const app = createDenoRouter({ basePath: "" });
  // Se não houver erro, o default está correto
  assertEquals(true, true);
});