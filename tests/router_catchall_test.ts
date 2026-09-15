// monorepo/router/tests/router_catchall_test.ts
import { assertEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";

Deno.test("Catch-all com * captura path completo", async () => {
  const app = createDenoRouter("", null, null);
  app.get("/files/*", (_req, params) => ({
    body: JSON.stringify(params.catch),
  }));

  const req = new Request("http://localhost/files/docs/readme.md");
  const res = await app.handleRequest(req);
  assertEquals(await res.json(), ["docs/readme.md"]);
});

Deno.test("Catch-all com múltiplos * gera array", async () => {
  const app = createDenoRouter("", null, null);
  app.get("/a/*/b/*", (_req, params) => ({
    body: JSON.stringify(params.catch),
  }));

  const req = new Request("http://localhost/a/x/b/y/z");
  const res = await app.handleRequest(req);
  assertEquals(await res.json(), ["x", "y/z"]);
});

Deno.test("Catch-all combinado com parâmetro nomeado", async () => {
  const app = createDenoRouter("", null, null);
  app.get("/api/:version/*", (_req, params) => ({
    body: JSON.stringify({ version: params.version, catch: params.catch }),
  }));

  const req = new Request("http://localhost/api/v1/foo/bar");
  const res = await app.handleRequest(req);
  assertEquals(await res.json(), { version: "v1", catch: ["foo/bar"] });
});
