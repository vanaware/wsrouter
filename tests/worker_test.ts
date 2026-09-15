// monorepo/router/tests/worker_test.ts
import { assertEquals, assert } from "@std/assert";
import { createDenoRouter } from "../src/deno.ts";

// ============================================================
// 1. WORKER BÁSICO
// ============================================================
Deno.test("Worker: trata request quando rota não existe", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });

  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/api/hello") {
      return new Response(JSON.stringify({ message: "from worker" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/api/hello");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.message, "from worker");
});

Deno.test("Worker: retorna 404 quando worker não trata", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });

  app.worker(async (_req) => {
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/unknown");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 404);
});

// ============================================================
// 2. MÚLTIPLOS WORKERS (CADEIA DE FALLBACK)
// ============================================================
Deno.test("Worker: múltiplos workers em cadeia", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });
  const order: string[] = [];

  // Worker 1: trata /api/v1
  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/v1")) {
      order.push("worker1");
      return new Response("v1 response");
    }
    order.push("worker1-skip");
    return new Response("Not Found", { status: 404 });
  });

  // Worker 2: trata /api/v2
  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/v2")) {
      order.push("worker2");
      return new Response("v2 response");
    }
    order.push("worker2-skip");
    return new Response("Not Found", { status: 404 });
  });

  // Testa /api/v1 → worker1 trata
  const req1 = new Request("http://localhost/api/v1/data");
  const res1 = await app.handleRequest(req1);
  assertEquals(res1.status, 200);
  assertEquals(await res1.text(), "v1 response");

  // Testa /api/v2 → worker1 pula, worker2 trata
  const req2 = new Request("http://localhost/api/v2/data");
  const res2 = await app.handleRequest(req2);
  assertEquals(res2.status, 200);
  assertEquals(await res2.text(), "v2 response");

  // Testa /unknown → ambos pulam → 404
  const req3 = new Request("http://localhost/unknown");
  const res3 = await app.handleRequest(req3);
  assertEquals(res3.status, 404);
});

// ============================================================
// 3. WORKER COM ROTAS HTTP (PRIORIDADE)
// ============================================================
Deno.test("Worker: rotas HTTP têm prioridade sobre workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });

  // Rota HTTP registrada
  app.get("/api/data", () => ({
    body: "from route",
  }));

  // Worker que também trataria /api/data
  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/api/data") {
      return new Response("from worker");
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/api/data");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  // A rota HTTP deve ganhar, não o worker
  assertEquals(await res.text(), "from route");
});

// ============================================================
// 4. WORKER COM STATIC FILES (ORDEM)
// ============================================================
Deno.test("Worker: workers executam ANTES de static files", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/test.txt`, "from static");

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });

  // Worker que trata /test.txt (mesmo path do arquivo estático)
  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/test.txt") {
      return new Response("from worker");
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/test.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  // Worker deve ganhar sobre static
  assertEquals(await res.text(), "from worker");

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("Worker: se worker retorna 404, static é tentado", async () => {
  const tmpDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tmpDir}/hello.txt`, "from static");

  const app = createDenoRouter({ basePath: "", staticDir: tmpDir });

  // Worker que NÃO trata /hello.txt
  app.worker(async (_req) => {
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/hello.txt");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "from static");

  await Deno.remove(tmpDir, { recursive: true });
});

// ============================================================
// 5. WORKER COM ERRO (RESILIÊNCIA)
// ============================================================
Deno.test("Worker: erro em worker não quebra a cadeia", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });

  // Worker 1: lança erro
  app.worker(async (_req) => {
    throw new Error("Worker exploded!");
  });

  // Worker 2: funciona normalmente
  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/safe") {
      return new Response("safe response");
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/safe");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "safe response");
});

// ============================================================
// 6. WORKER COM MIDDLEWARES
// ============================================================
Deno.test("Worker: middlewares executam antes de workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });
  let middlewareCalled = false;

  app.use(async (_req, _params, next) => {
    middlewareCalled = true;
    const res = await next();
    res.headers.set("X-Middleware", "applied");
    return res;
  });

  app.worker(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/worker-endpoint") {
      return new Response("worker response");
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/worker-endpoint");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "worker response");
  assertEquals(middlewareCalled, true, "Middleware deve executar antes do worker");
  assertEquals(res.headers.get("X-Middleware"), "applied");
});

// ============================================================
// 7. WORKER COM BASEPATH
// ============================================================
Deno.test("Worker: funciona com basePath", async () => {
  const app = createDenoRouter({ basePath: "/api", staticDir: null });

  app.worker(async (req) => {
    const url = new URL(req.url);
    // O worker recebe a URL completa (com basePath)
    if (url.pathname === "/api/proxy/data") {
      return new Response("proxied data");
    }
    return new Response("Not Found", { status: 404 });
  });

  const req = new Request("http://localhost/api/proxy/data");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "proxied data");
});

// ============================================================
// 8. WORKER SIMULANDO workerHandler.fetch (CASO DE USO REAL)
// ============================================================
Deno.test("Worker: simula integração com workerHandler.fetch", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null });

  // Simula um workerHandler no estilo Cloudflare Worker
  const workerHandler = {
    async fetch(request: Request, _env?: any, _ctx?: any): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/ping") {
        return new Response(JSON.stringify({ success: true, service: "loco-proxy" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname === "/push" && request.method === "POST") {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    },
  };

  // Registra o worker usando closure para capturar env/ctx
  const env = { SOME_KEY: "value" };
  const ctx = { waitUntil: (_p: Promise<unknown>) => {} };
  app.worker((req) => workerHandler.fetch(req, env, ctx));

  // Testa /ping
  const req1 = new Request("http://localhost/ping", { method: "POST" });
  const res1 = await app.handleRequest(req1);
  assertEquals(res1.status, 200);
  const data1 = await res1.json();
  assertEquals(data1.success, true);
  assertEquals(data1.service, "loco-proxy");

  // Testa /push
  const req2 = new Request("http://localhost/push", { method: "POST" });
  const res2 = await app.handleRequest(req2);
  assertEquals(res2.status, 200);

  // Testa rota inexistente
  const req3 = new Request("http://localhost/unknown");
  const res3 = await app.handleRequest(req3);
  assertEquals(res3.status, 404);
});

// ============================================================
// 9. WORKER COM FORCE HTTPS
// ============================================================
Deno.test("Worker: forceHttps redireciona antes de workers", async () => {
  const app = createDenoRouter({ basePath: "", staticDir: null, forceHttps: true });

  app.worker(async (_req) => {
    return new Response("should not reach here");
  });

  const req = new Request("http://example.com/anything");
  const res = await app.handleRequest(req);
  assertEquals(res.status, 301);
  assertEquals(res.headers.get("Location"), "https://example.com/anything");
});