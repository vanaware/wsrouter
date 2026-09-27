import { describe, it, } from "jsr:@std/testing@^1/bdd";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import {
  HttpRoute,
  MiddlewareRoute,
  Router,
  WorkerRoute,
  WsRoute,
} from "../src/mod.ts";

describe("HttpRoute Class", () => {
  it("creates HttpRoute instance with normalized path and method", () => {
    const route = new HttpRoute("get", "users/:id", (_req, params,) => ({
      body: JSON.stringify(params,),
    }),);

    assertEquals(route.method, "GET",);
    assertEquals(route.path, "/users/:id",);
    assert(route.matchesMethod("get",),);
    assert(route.matchesMethod("GET",),);
  });

  it("matches URL correctly using pattern matching", () => {
    const route = new HttpRoute("POST", "/items/:category", (_req,) => ({
      body: "ok",
    }),);

    const match = route.match("http://localhost/items/electronics",);
    assertNotEquals(match, null,);
    assertEquals(match?.pathname.groups["category"], "electronics",);
  });

  it("executes handler function", async () => {
    const route = new HttpRoute("GET", "/test", (_req, params,) => ({
      body: `Hello ${params.name ?? "World"}`,
    }),);

    const result = await route.execute(new Request("http://localhost/test",), {
      name: "Deno",
    },);
    assertEquals(result.body, "Hello Deno",);
  });
});

describe("WsRoute Class & Router Integration", () => {
  it("creates WsRoute instance with associated WebSocketGroup", () => {
    const route = new WsRoute("/chat/:room", (_ws, _req, _params,) => {},);

    assertEquals(route.path, "/chat/:room",);
    assertNotEquals(route.group, undefined,);
    assertEquals(route.activeConnections, 0,);
  });

  it("allows matching URL and broadcasting directly via WsRoute", () => {
    const route = new WsRoute("/live/:stream", () => {},);
    const match = route.match("http://localhost/live/gaming",);

    assertNotEquals(match, null,);
    assertEquals(match?.pathname.groups["stream"], "gaming",);

    // Broadcast shouldn't throw error even if no sockets are connected
    route.broadcast("test message",);
    assertEquals(route.activeConnections, 0,);
  });

  it("exposes HttpRoute and WsRoute instances from Router", () => {
    const router = new Router();
    router.get("/api/v1/health", () => ({ body: "OK", }),);
    router.ws("/api/v1/ws", () => {},);

    const httpRoutes = router.getHttpRoutes();
    const wsRoutes = router.getWsRoutes();

    assertEquals(httpRoutes.length, 1,);
    assertEquals(httpRoutes[0]?.path, "/api/v1/health",);
    assertEquals(httpRoutes[0]?.method, "GET",);

    assertEquals(wsRoutes.length, 1,);
    assertEquals(wsRoutes[0]?.path, "/api/v1/ws",);

    const foundWsRoute = router.getWsRouteByPath("/api/v1/ws",);
    assertNotEquals(foundWsRoute, undefined,);
    assertEquals(foundWsRoute?.path, "/api/v1/ws",);
  });
});

describe("MiddlewareRoute Class", () => {
  it("creates global and path-scoped MiddlewareRoute instances", () => {
    const globalMw = new MiddlewareRoute((_req, _params, next,) => next());
    const pathMw = new MiddlewareRoute(
      (_req, _params, next,) => next(),
      "/api/admin/*",
    );

    assert(globalMw.match("http://localhost/any/route",),);
    assert(pathMw.match("http://localhost/api/admin/users",),);
    assertEquals(pathMw.match("http://localhost/public/index",), false,);
  });

  it("filters path-scoped middleware execution in Router", async () => {
    const router = new Router();
    let adminMwExecuted = false;

    router.use("/admin/*", async (_req, _params, next,) => {
      adminMwExecuted = true;
      return await next();
    },);

    router.get("/public", () => ({ body: "public", }),);
    router.get("/admin/dashboard", () => ({ body: "admin", }),);

    await router.handleRequest(new Request("http://localhost/public",),);
    assertEquals(adminMwExecuted, false,);

    await router.handleRequest(
      new Request("http://localhost/admin/dashboard",),
    );
    assertEquals(adminMwExecuted, true,);
  });
});

describe("WorkerRoute Class", () => {
  it("creates WorkerRoute with function or object handler", async () => {
    const funcWorker = new WorkerRoute(
      async () => new Response("From func worker",),
      "func-worker",
    );
    const objWorker = new WorkerRoute({
      fetch: async () => new Response("From obj worker",),
    }, "obj-worker",);

    const res1 = await funcWorker.execute(
      new Request("http://localhost/test",),
    );
    assertEquals(await res1.text(), "From func worker",);

    const res2 = await objWorker.execute(
      new Request("http://localhost/test",),
    );
    assertEquals(await res2.text(), "From obj worker",);
  });

  it("registers WorkerRoute instances in Router", async () => {
    const router = new Router();
    const worker = new WorkerRoute(async () =>
      new Response("Worker Fallback",)
    );

    router.worker(worker,);
    assertEquals(router.getWorkers().length, 1,);

    const res = await router.handleRequest(
      new Request("http://localhost/unhandled",),
    );
    assertEquals(await res.text(), "Worker Fallback",);
  });
});
