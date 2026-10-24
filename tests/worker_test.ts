// monorepo/router/tests/worker_test.ts
import { assert, assertEquals, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// 1. BASIC WORKER
// ============================================================
Deno.test("Worker: handles a request when the route does not exist", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/api/hello") {
      return new Response(JSON.stringify({ message: "from worker", },), {
        headers: { "Content-Type": "application/json", },
      },);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/hello",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.message, "from worker",);
});

Deno.test("Worker: returns 404 when the worker does not handle it", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  app.worker(async (_req,) => {
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/unknown",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 404,);
});

// ============================================================
// 2. MULTIPLE WORKERS (FALLBACK CHAIN)
// ============================================================
Deno.test("Worker: multiple workers in chain", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  const order: string[] = [];

  // Worker 1: handles /api/v1
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v1",)) {
      order.push("worker1",);
      return new Response("v1 response",);
    }
    order.push("worker1-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Worker 2: handles /api/v2
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname.startsWith("/api/v2",)) {
      order.push("worker2",);
      return new Response("v2 response",);
    }
    order.push("worker2-skip",);
    return new Response("Not Found", { status: 404, },);
  },);

  // Tests /api/v1 → worker1 handles it
  const req1 = new Request("http://localhost/api/v1/data",);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  assertEquals(await res1.text(), "v1 response",);

  // Tests /api/v2 → worker1 skips, worker2 handles it
  const req2 = new Request("http://localhost/api/v2/data",);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);
  assertEquals(await res2.text(), "v2 response",);

  // Tests /unknown → both skip → 404
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 3. WORKER WITH HTTP ROUTES (PRIORITY)
// ============================================================
Deno.test("Worker: HTTP routes have priority over workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Registered HTTP route
  app.get("/api/data", () => ({
    body: "from route",
  }),);

  // Worker that would also handle /api/data
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/api/data") {
      return new Response("from worker",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/data",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  // The HTTP route should win, not the worker
  assertEquals(await res.text(), "from route",);
});

// ============================================================
// 4. WORKER WITH STATIC FILES (ORDER)
// ============================================================
Deno.test("Worker: workers run BEFORE static files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/test.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker that handles /test.txt (same path as the static file)
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/test.txt") {
      return new Response("from worker",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/test.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  // Worker should win over static
  assertEquals(await res.text(), "from worker",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

Deno.test("Worker: if the worker returns 404, static is attempted", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "from static",);

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir, },);

  // Worker that does NOT handle /hello.txt
  app.worker(async (_req,) => {
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/hello.txt",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "from static",);

  await Deno.remove(tmpDir, { recursive: true, },);
});

// ============================================================
// 5. WORKER WITH ERRORS (RESILIENCE)
// ============================================================
Deno.test("Worker: an error in a worker does not break the chain", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Worker 1: throws an error
  app.worker(async (_req,) => {
    throw new Error("Worker exploded!",);
  },);

  // Worker 2: works normally
  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/safe") {
      return new Response("safe response",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/safe",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "safe response",);
});

// ============================================================
// 6. WORKER WITH MIDDLEWARES
// ============================================================
Deno.test("Worker: middlewares run before workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);
  let middlewareCalled = false;

  app.use(async (_req, _params, next,) => {
    middlewareCalled = true;
    const res = await next();
    res.headers.set("X-Middleware", "applied",);
    return res;
  },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    if (url.pathname === "/worker-endpoint") {
      return new Response("worker response",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/worker-endpoint",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "worker response",);
  assertEquals(
    middlewareCalled,
    true,
    "Middleware should run before the worker",
  );
  assertEquals(res.headers.get("X-Middleware",), "applied",);
});

// ============================================================
// 7. WORKER WITH BASEPATH
// ============================================================
Deno.test("Worker: works with basePath", async () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null, },);

  app.worker(async (req,) => {
    const url = new URL(req.url,);
    // The worker receives the full URL (with basePath)
    if (url.pathname === "/api/proxy/data") {
      return new Response("proxied data",);
    }
    return new Response("Not Found", { status: 404, },);
  },);

  const req = new Request("http://localhost/api/proxy/data",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "proxied data",);
});

// ============================================================
// 8. WORKER SIMULATING workerHandler.fetch (REAL USE CASE)
// ============================================================
Deno.test("Worker: simulates integration with workerHandler.fetch", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, },);

  // Simulates a Cloudflare Worker-style workerHandler
  const workerHandler = {
    async fetch(request: Request, _env?: any, _ctx?: any,): Promise<Response> {
      const url = new URL(request.url,);
      if (url.pathname === "/ping") {
        return new Response(
          JSON.stringify({ success: true, service: "loco-proxy", },),
          {
            headers: { "Content-Type": "application/json", },
          },
        );
      }
      if (url.pathname === "/push" && request.method === "POST") {
        return new Response(JSON.stringify({ success: true, },), {
          headers: { "Content-Type": "application/json", },
        },);
      }
      return new Response(JSON.stringify({ error: "Not found", },), {
        status: 404,
      },);
    },
  };

  // Registers the worker using a closure to capture env/ctx
  const env = { SOME_KEY: "value", };
  const ctx = { waitUntil: (_p: Promise<unknown>,) => {}, };
  app.worker((req,) => workerHandler.fetch(req, env, ctx,));

  // Tests /ping
  const req1 = new Request("http://localhost/ping", { method: "POST", },);
  const res1 = await app.handleRequest(req1,);
  assertEquals(res1.status, 200,);
  const data1 = await res1.json();
  assertEquals(data1.success, true,);
  assertEquals(data1.service, "loco-proxy",);

  // Tests /push
  const req2 = new Request("http://localhost/push", { method: "POST", },);
  const res2 = await app.handleRequest(req2,);
  assertEquals(res2.status, 200,);

  // Tests a nonexistent route
  const req3 = new Request("http://localhost/unknown",);
  const res3 = await app.handleRequest(req3,);
  assertEquals(res3.status, 404,);
});

// ============================================================
// 9. WORKER WITH FORCE HTTPS
// ============================================================
Deno.test("Worker: forceHttps redirects before workers", async () => {
  const app = createDenoRouter({
    basePath: "",
    staticDir: null,
    forceHttps: true,
  },);

  app.worker(async (_req,) => {
    return new Response("should not reach here",);
  },);

  const req = new Request("http://example.com/anything",);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 301,);
  assertEquals(res.headers.get("Location",), "https://example.com/anything",);
});
