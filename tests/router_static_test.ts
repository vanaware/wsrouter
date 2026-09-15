import { assertEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";

Deno.test("serve arquivo estático existente", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "hello world");
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  const req = new Request("http://localhost/hello.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "hello world");
  assertEquals(res.headers.get("content-type"), "text/plain; charset=utf-8");
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("serve index.html para path de diretório", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.mkdir(`${tmpDir}/sub`);
  await Deno.writeTextFile(`${tmpDir}/sub/index.html`, "<h1>Hi</h1>");
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  const req = new Request("http://localhost/sub/");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "<h1>Hi</h1>");
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("retorna 404 para arquivo inexistente", async () => {
  const tmpDir = await Deno.makeTempDir();
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  const req = new Request("http://localhost/nope.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
  await Deno.remove(tmpDir, { recursive: true });
});