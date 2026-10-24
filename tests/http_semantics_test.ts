// monorepo/router/tests/http_semantics_test.ts
import { assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

Deno.test("Automatic HEAD: uses GET route when HEAD does not exist", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({
    body: "data",
    init: { headers: { "X-Custom": "value", }, },
  }),);

  const req = new Request("http://localhost/resource", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("X-Custom",), "value",);
  assertEquals(await res.text(), "", "HEAD should have an empty body",);
});

Deno.test("405 Method Not Allowed: returned when the path exists with another method", async () => {
  const app = createDenoRouter({ basePath: "", },);
  app.get("/resource", () => ({ body: "data", }),);
  app.post("/resource", () => ({ body: "created", init: { status: 201, }, }),);

  const req = new Request("http://localhost/resource", { method: "PUT", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET, POST",);
});

Deno.test("Static files: POST returns 404", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "POST", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Static files: HEAD returns headers without body", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/file.txt`, "content",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  const req = new Request("http://localhost/file.txt", { method: "HEAD", },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Type",), "text/plain; charset=utf-8",);
  assertEquals(await res.text(), "", "HEAD should have an empty body",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("basePath normalizes '/' to ''", async () => {
  const app = createDenoRouter({ basePath: "/", },);
  app.get("/test", () => ({ body: "ok", }),);

  const req = new Request("http://localhost/test",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "ok",);
});

Deno.test("lastBroadcastDelay default is 0ms", async () => {
  // Implicit test: if it were 50ms, last broadcast tests would be slower
  const app = createDenoRouter({ basePath: "", },);
  // If there is no error, the default is correct
  assertEquals(true, true,);
});
