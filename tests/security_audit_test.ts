// tests/security_audit_test.ts
import { describe, it } from "jsr:@std/testing@^1/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";
import { join } from "@std/path";
import { WebSocketGroup } from "../src/websocket-group.ts";

async function setupFixture(): Promise<{ tmpRoot: string; publicDir: string }> {
  const tmpRoot = await Deno.makeTempDir({ prefix: "wsrouter_audit_" });
  const publicDir = join(tmpRoot, "public");
  await Deno.mkdir(publicDir, { recursive: true });
  await Deno.mkdir(join(publicDir, "subfolder"), { recursive: true });

  await Deno.writeTextFile(join(publicDir, "index.html"), "<h1>Home</h1>");
  await Deno.writeTextFile(join(publicDir, "app.js"), "console.log('app');");
  await Deno.writeTextFile(join(publicDir, "subfolder", "page.html"), "<p>Sub</p>");
  await Deno.writeTextFile(join(tmpRoot, "secret.txt"), "CONFIDENTIAL_DATA");
  return { tmpRoot, publicDir };
}

async function cleanup(dir: string): Promise<void> {
  await Deno.remove(dir, { recursive: true }).catch(() => {});
}

describe("Security Audit & Hardening Suite", () => {
  it("Static files include X-Content-Type-Options: nosniff", async () => {
    const { tmpRoot, publicDir } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir });
      const req = new Request("http://localhost/app.js");
      const res = await app.handleRequest(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
      await res.text();
    } finally {
      await cleanup(tmpRoot);
    }
  });

  it("ETag matching If-None-Match returns 304 Not Modified without streaming body", async () => {
    const { tmpRoot, publicDir } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir });
      // 1. Initial request to get ETag
      const req1 = new Request("http://localhost/index.html");
      const res1 = await app.handleRequest(req1);
      assertEquals(res1.status, 200);
      const etag = res1.headers.get("ETag");
      assertNotEquals(etag, null);
      await res1.text();

      // 2. Request with If-None-Match matching etag
      const req2 = new Request("http://localhost/index.html", {
        headers: { "If-None-Match": etag! },
      });
      const res2 = await app.handleRequest(req2);
      assertEquals(res2.status, 304);
      assertEquals(res2.body, null);
    } finally {
      await cleanup(tmpRoot);
    }
  });

  it("HEAD request to static file returns headers with null body and no stream leak", async () => {
    const { tmpRoot, publicDir } = await setupFixture();
    try {
      const app = createDenoRouter({ staticDir: publicDir });
      const req = new Request("http://localhost/index.html", { method: "HEAD" });
      const res = await app.handleRequest(req);
      assertEquals(res.status, 200);
      assertEquals(res.body, null);
      assertEquals(res.headers.get("Content-Type"), "text/html; charset=utf-8");
      assertNotEquals(res.headers.get("Content-Length"), null);
    } finally {
      await cleanup(tmpRoot);
    }
  });

  it("Path traversal with .. is strictly blocked even when allowDotfiles is true", async () => {
    const { tmpRoot, publicDir } = await setupFixture();
    try {
      const app = createDenoRouter({
        staticDir: publicDir,
        allowDotfiles: true, // dotfiles enabled (e.g. .well-known), but .. traversal must be rejected!
      });
      const req = new Request("http://localhost/../../secret.txt");
      const res = await app.handleRequest(req);
      assertEquals(res.status, 404);
      const body = await res.text();
      assertEquals(body.includes("CONFIDENTIAL_DATA"), false);
    } finally {
      await cleanup(tmpRoot);
    }
  });

  it("Directory 301 redirect preserves basePath", async () => {
    const { tmpRoot, publicDir } = await setupFixture();
    try {
      const app = createDenoRouter({
        basePath: "/site",
        staticDir: publicDir,
      });
      const req = new Request("http://localhost/site/subfolder");
      const res = await app.handleRequest(req);
      assertEquals(res.status, 301);
      assertEquals(res.headers.get("Location"), "/site/subfolder/");
    } finally {
      await cleanup(tmpRoot);
    }
  });

  it("Proxy X-Forwarded-Host sanitizes malicious host injection", async () => {
    const app = createDenoRouter({
      forceHttps: true,
      trustProxy: true,
    });
    // Malicious host with path escape or credentials
    const req = new Request("http://example.com/api/test", {
      headers: {
        "x-forwarded-proto": "http",
        "x-forwarded-host": "evil.com/malicious/path",
      },
    });
    const res = await app.handleRequest(req);
    assertEquals(res.status, 301);
    const location = res.headers.get("Location");
    assertNotEquals(location, null);
    // Should fallback to local request host and reject the malicious path injection
    assertEquals(location!.includes("evil.com/malicious"), false);
  });

  it("WebSocketGroup broadcast prunes closed sockets automatically", () => {
    const group = new WebSocketGroup();
    // Simulate active socket
    const openSocket = {
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
    } as unknown as WebSocket;

    // Simulate closed socket
    const closedSocket = {
      readyState: WebSocket.CLOSED,
      send: () => {},
      close: () => {},
    } as unknown as WebSocket;

    group.addSocket(openSocket, {});
    group.addSocket(closedSocket, {});
    assertEquals(group.size, 2);

    group.broadcast("hello");
    // Closed socket should be pruned from the pool during broadcast
    assertEquals(group.size, 1);
  });

  it("WebSocketGroup sendLastBroadcastTo does not deliver to socket removed during delay", async () => {
    const group = new WebSocketGroup(20);
    const messages: string[] = [];
    const socket = {
      readyState: WebSocket.OPEN,
      send: (data: string) => messages.push(data),
      close: () => {},
    } as unknown as WebSocket;

    group.broadcast("Welcome message");
    group.addSocket(socket, {});
    group.sendLastBroadcastTo(socket, {});

    // Remove socket before delay timer fires
    group.removeSocket(socket);

    await new Promise((resolve) => setTimeout(resolve, 50));
    assertEquals(messages.length, 0);
  });
});
