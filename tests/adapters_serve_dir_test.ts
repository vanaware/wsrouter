// monorepo/router/tests/adapters_serve_dir_test.ts
import { assertEquals, assert } from "@std/assert";
import { createDenoServeDirRouter } from "../src/deno-serve-dir.ts";

Deno.test("createDenoServeDirRouter serve arquivos", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world");
  const app = createDenoServeDirRouter({ basePath: "", staticDir: tmpDir });
  const req = new Request("http://localhost/hello.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "hello world");
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("createDenoServeDirRouter bloqueia dotfiles", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/.env`, "SECRET=123");
  const app = createDenoServeDirRouter({ basePath: "", staticDir: tmpDir });
  const req = new Request("http://localhost/.env");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
  await Deno.remove(tmpDir, { recursive: true });
});