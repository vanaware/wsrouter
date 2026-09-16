// tests/api_coverage_test.ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "@std/assert";
import {
  createDenoRouter,
  HttpRoute,
  MiddlewareChain,
  MiddlewareRoute,
  Router,
  WebSocketGroup,
  WorkerRoute,
  WsRoute,
} from "../src/deno.ts";

describe("Complete API & Router Coverage", () => {
  describe("Router inspection and collection accessors", () => {
    it("getHttpRoutes, getWsRoutes, getWorkers, getMiddlewares, getMiddlewareChain", () => {
      const router = new Router();
      router.get("/users", () => ({ body: "users", }),);
      router.post("/users", () => ({ body: "created", }),);
      router.ws("/live", () => {},);
      router.worker(async () => new Response("worker",));
      router.use((_req, _p, next,) => next());

      assertEquals(router.getHttpRoutes().length, 2,);
      assertEquals(router.getWsRoutes().length, 1,);
      assertEquals(router.getWorkers().length, 1,);
      assertEquals(router.getMiddlewares().length, 1,);
      assert(router.getMiddlewareChain() instanceof MiddlewareChain,);
    });

    it("closeGroupByPath closes matching WebSocketGroup and returns true, returns false if not found", () => {
      const router = new Router();
      router.ws("/chat/:room", () => {},);

      const closed = router.closeGroupByPath("/chat/:room",);
      assertEquals(closed, true,);

      const notFound = router.closeGroupByPath("/nonexistent",);
      assertEquals(notFound, false,);
    });

    it("setWebSocketUpgrader and setStaticFileHandler fluent setters", () => {
      const router = new Router();
      const upgrader = {
        upgrade: (_req: Request,) => ({
          socket: {} as WebSocket,
          response: new Response(),
        }),
      };
      const staticHandler = {
        handle: async (_path: string,) => new Response("static file",),
      };

      const res1 = router.setWebSocketUpgrader(upgrader,);
      const res2 = router.setStaticFileHandler(staticHandler,);

      assertEquals(res1, router,);
      assertEquals(res2, router,);
    });

    it("addRoute throws error on duplicate WebSocket path pattern", () => {
      const router = new Router();
      const ws1 = new WsRoute("/events", () => {},);
      const ws2 = new WsRoute("/events", () => {},);

      router.addRoute(ws1,);
      let errorThrown = false;
      try {
        router.addRoute(ws2,);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes("Duplicate WebSocket route pattern",),
        );
      }
      assertEquals(errorThrown, true,);
    });

    it("mount throws error when subRouter is missing for prefix string", () => {
      const router = new Router();
      let errorThrown = false;
      try {
        // @ts-ignore testing defensive runtime error
        router.mount("/api/v1",);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes(
            "Sub-router instance must be provided",
          ),
        );
      }
      assertEquals(errorThrown, true,);
    });

    it("mount throws error on duplicate WebSocket route pattern during mount", () => {
      const app = new Router();
      app.ws("/api/stream", () => {},);

      const subRouter = new Router();
      subRouter.ws("/stream", () => {},);

      let errorThrown = false;
      try {
        app.mount("/api", subRouter,);
      } catch (err: unknown) {
        errorThrown = true;
        assert(
          (err as Error).message.includes(
            "Duplicate WebSocket route pattern: /api/stream",
          ),
        );
      }
      assertEquals(errorThrown, true,);
    });
  });

  describe("WebSocketGroup advanced features", () => {
    it("group.emit logs error safely if a listener throws without breaking others", () => {
      const group = new WebSocketGroup();
      let secondListenerCalled = false;

      group.on("connect", () => {
        throw new Error("Simulated listener explosion!",);
      },);
      group.on("connect", () => {
        secondListenerCalled = true;
      },);

      const mockWs = {} as WebSocket;
      group.addSocket(mockWs, { user: "bob", },);
      assertEquals(secondListenerCalled, true,);
    });

    it("group.size accurately reflects sockets add/remove and closeGroup", () => {
      const group = new WebSocketGroup();
      const ws1 = { readyState: 1, close: () => {}, } as unknown as WebSocket;
      const ws2 = { readyState: 1, close: () => {}, } as unknown as WebSocket;

      assertEquals(group.size, 0,);
      group.addSocket(ws1, { id: "1", },);
      group.addSocket(ws2, { id: "2", },);
      assertEquals(group.size, 2,);

      group.removeSocket(ws1,);
      assertEquals(group.size, 1,);

      group.closeGroup();
      assertEquals(group.size, 0,);
    });
  });

  describe("MiddlewareRoute and MiddlewareChain edge cases", () => {
    it("handles wildcard '*' in MiddlewareRoute correctly", () => {
      const mw = new MiddlewareRoute((_req, _p, next,) => next(), "*",);
      assert(mw.match("http://localhost/any/route",),);
      assert(mw.match("http://localhost/api/v1/users",),);
    });

    it("handles middleware returning a Response without calling next() in sub-chain", async () => {
      const chain = new MiddlewareChain();
      chain.use((_req, _p, _next,) => {
        return new Response("Blocked by early return", { status: 403, },);
      },);

      const ctx = {
        req: new Request("http://localhost/test",),
        params: {},
        state: {},
      };
      const res = await chain.execute(
        ctx,
        async () => new Response("unreachable",),
      );
      assertEquals(res.status, 403,);
      assertEquals(await res.text(), "Blocked by early return",);
    });
  });
});
