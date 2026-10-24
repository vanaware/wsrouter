import { assertEquals, assertStringIncludes, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import { join, } from "@std/path";

async function setupFixture(): Promise<{ tmpRoot: string; publicDir: string }> {
  const tmpRoot = await Deno.makeTempDir({ prefix: "router_traversal_", },);
  const publicDir = join(tmpRoot, "public",);
  await Deno.mkdir(publicDir,);
  await Deno.writeTextFile(join(tmpRoot, "secret.txt",), "TOP-SECRET-DATA",);
  await Deno.writeTextFile(join(publicDir, "hello.txt",), "hello world",);
  await Deno.writeTextFile(join(publicDir, "index.html",), "<h1>home</h1>",);
  return { tmpRoot, publicDir, };
}

async function cleanup(path: string,) {
  try {
    await Deno.remove(path, { recursive: true, },);
  } catch { /* ignore */ }
}

Deno.test("Path traversal: ../ must not escape staticDir", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(
      res.status,
      404,
      "Should return 404 when attempting path traversal with ..",
    );
    const body = await res.text();
    assertEquals(
      body.includes("TOP-SECRET-DATA",),
      false,
      "MUST NEVER leak the secret file content",
    );
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: multiple ../ do not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/../../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: /subdir/../../secret.txt does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/subdir/../../secret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: URL-encoded ..%2F does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/..%2Fsecret.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 404,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: backslash (Windows-style) does not escape", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/..\\secret.txt",);
    const res = await app.handleRequest(req,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Path traversal: basePath is not bypassed", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "/api", staticDir: publicDir, },);
    const req = new Request("http://localhost/api/../secret.txt",);
    const res = await app.handleRequest(req,);
    const body = await res.text();
    assertEquals(body.includes("TOP-SECRET-DATA",), false,);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Legitimate file inside staticDir is served normally", async () => {
  const { tmpRoot, publicDir, } = await setupFixture();
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/hello.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 200,);
    assertEquals(await res.text(), "hello world",);
  } finally {
    await cleanup(tmpRoot,);
  }
});

Deno.test("Legitimate file in subfolder is served", async () => {
  const tmpRoot = await Deno.makeTempDir({ prefix: "router_sub_", },);
  const publicDir = join(tmpRoot, "public",);
  const subDir = join(publicDir, "docs",);
  await Deno.mkdir(subDir, { recursive: true, },);
  await Deno.writeTextFile(join(subDir, "readme.txt",), "readme content",);
  try {
    const app = createDenoRouter({ basePath: "", staticDir: publicDir, },);
    const req = new Request("http://localhost/docs/readme.txt",);
    const res = await app.handleRequest(req,);
    assertEquals(res.status, 200,);
    assertEquals(await res.text(), "readme content",);
  } finally {
    await cleanup(tmpRoot,);
  }
});
