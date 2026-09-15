// monorepo/router/tests/security_test.ts
import { assertEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";
import { join } from "@std/path";

Deno.test("trustProxy: X-Forwarded-Proto é ignorado por padrão", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, trustProxy: false });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https" },
  });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 301, "Deve redirecionar mesmo com X-Forwarded-Proto");
});

Deno.test("trustProxy: X-Forwarded-Proto é respeitado quando ativo", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true, trustProxy: true });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("http://example.com/ping", {
    headers: { "x-forwarded-proto": "https" },
  });
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200, "Deve aceitar X-Forwarded-Proto");
});

Deno.test("HSTS está presente em respostas HTTPS quando forceHttps ativo", async () => {
  const app = createDenoRouter({ basePath: "", forceHttps: true });
  app.get("/ping", () => ({ body: "pong" }));
  const req = new Request("https://example.com/ping");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains"
  );
});

Deno.test("Dotfiles são bloqueados por padrão", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, ".env"), "SECRET=123");
  await Deno.writeTextFile(join(tmpDir, "public.txt"), "ok");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, allowDotfiles: false });
  
  const req1 = new Request("http://localhost/.env");
  const res1 = await app.handleRequest(req1);
  assertEquals(res1.status, 404, "Dotfile deve ser bloqueado");
  
  const req2 = new Request("http://localhost/public.txt");
  const res2 = await app.handleRequest(req2);
  assertEquals(res2.status, 200, "Arquivo normal deve ser servido");
  
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("Dotfiles são permitidos quando allowDotfiles é true", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, ".env"), "SECRET=123");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, allowDotfiles: true });
  
  const req = new Request("http://localhost/.env");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200, "Dotfile deve ser servido");
  assertEquals(await res.text(), "SECRET=123");
  
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("Symlinks são recusados", async () => {
  const tmpRoot = await Deno.makeTempDir();
  const publicDir = join(tmpRoot, "public");
  const secretDir = join(tmpRoot, "secret");
  
  await Deno.mkdir(publicDir);
  await Deno.mkdir(secretDir);
  await Deno.writeTextFile(join(secretDir, "secret.txt"), "TOP SECRET");
  await Deno.symlink(join(secretDir, "secret.txt"), join(publicDir, "leak.txt"));
  
  const app = createDenoRouter({ basePath: "", staticDir: publicDir });
  
  const req = new Request("http://localhost/leak.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404, "Symlink deve ser recusado");
  
  await Deno.remove(tmpRoot, { recursive: true });
});

Deno.test("Headers de arquivo estático incluem Content-Length e ETag", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(join(tmpDir, "test.txt"), "hello world");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  
  const req = new Request("http://localhost/test.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Length"), "11");
  assertEquals(res.headers.get("Last-Modified") !== null, true);
  assertEquals(res.headers.get("ETag") !== null, true);
  assertEquals(res.headers.get("Cache-Control"), "public, max-age=3600");
  
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("Diretório sem barra final redireciona para com barra", async () => {
  const tmpDir = await Deno.makeTempDir();
  const subDir = join(tmpDir, "docs");
  await Deno.mkdir(subDir);
  await Deno.writeTextFile(join(subDir, "index.html"), "<h1>Docs</h1>");
  
  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });
  
  const req = new Request("http://localhost/docs");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 301);
  assertEquals(res.headers.get("Location"), "/docs/");
  
  await Deno.remove(tmpDir, { recursive: true });
});