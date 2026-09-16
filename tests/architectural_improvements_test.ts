// monorepo/router/tests/architectural_improvements_test.ts
import { describe, it, } from "jsr:@std/testing@^1/bdd";
import { assert, assertEquals, assertExists, } from "@std/assert";
import {
  createDenoRouter,
  HttpRoute,
  MiddlewareChain,
  Router,
  WebSocketGroup,
  WsRoute,
} from "../src/deno.ts";

describe("Architectural Improvements (1-5)", () => {
  // ============================================================
  // 1. DUAL REGISTRATION & UNIFIED ROUTER METHODS
  // ============================================================
  describe("1. Unified Router Method Chaining & Dual Registration", () => {
    it("allows registering pre-created HttpRoute and WsRoute via addRoute()", () => {
      const app = createDenoRouter("", null, null,);
      const httpRoute = new HttpRoute(
        "GET",
        "/custom-http",
        () => ({ body: "custom-ok", }),
        {
          meta: { tag: "manual", },
        },
      );
      const wsRoute = new WsRoute("/custom-ws", () => {}, {
        meta: { tag: "ws-manual", },
      },);

      app.addRoute(httpRoute,);
      app.addRoute(wsRoute,);

      const registeredHttp = app.getHttpRoutes();
      const registeredWs = app.getWsRoutes();

      assertEquals(registeredHttp.length, 1,);
      assertEquals(registeredWs.length, 1,);
      assertEquals(registeredHttp[0]?.meta.tag, "manual",);
      assertEquals(registeredWs[0]?.meta.tag, "ws-manual",);
    });

    it("app.ws() returns the WsRoute instance for granular control", () => {
      const app = createDenoRouter("", null, null,);
      const wsRoute = app.ws("/chat/:room", () => {}, {
        meta: { authRequired: true, },
      },);

      assertExists(wsRoute,);
      assert(wsRoute instanceof WsRoute,);
      assertEquals(wsRoute.path, "/chat/:room",);
      assertEquals(wsRoute.meta.authRequired, true,);
      assertExists(wsRoute.group,);
      assertEquals(typeof wsRoute.broadcast, "function",);
    });

    it("supports route-level middlewares array in method registration", async () => {
      const app = createDenoRouter("", null, null,);
      const logs: string[] = [];

      const mw1 = async (
        _req: Request,
        _p: Record<string, string | string[]>,
        next: () => Promise<Response>,
      ) => {
        logs.push("mw1",);
        return await next();
      };
      const mw2 = async (
        _req: Request,
        _p: Record<string, string | string[]>,
        next: () => Promise<Response>,
      ) => {
        logs.push("mw2",);
        return await next();
      };

      app.get("/with-middlewares", [mw1, mw2,], () => {
        logs.push("handler",);
        return { body: "ok", };
      },);

      const res = await app.handleRequest(
        new Request("http://localhost/with-middlewares",),
      );
      assertEquals(res.status, 200,);
      assertEquals(await res.text(), "ok",);
      assertEquals(logs, ["mw1", "mw2", "handler",],);
    });

    it("retrieves HttpRoute and WsRoute by path using inspection helpers", () => {
      const app = createDenoRouter("", null, null,);
      app.get("/items/:id", () => ({ body: "item", }),);
      app.ws("/stream/:topic", () => {},);

      const httpRoute = app.getHttpRouteByPath("GET", "/items/:id",);
      assertExists(httpRoute,);
      assertEquals(httpRoute.method, "GET",);

      const wsRoute = app.getWsRouteByPath("/stream/:topic",);
      assertExists(wsRoute,);
      assertEquals(wsRoute.path, "/stream/:topic",);
    });
  });

  // ============================================================
  // 2. ROUTE GROUPS & SUB-ROUTERS (MOUNT)
  // ============================================================
  describe("2. Route Groups & Sub-routers (app.mount)", () => {
    it("mounts child router HTTP routes under a prefix", async () => {
      const api = new Router();
      api.get("/users", () => ({ body: "user list", }),);
      api.get(
        "/users/:id",
        (_req, params,) => ({ body: `user ${params.id}`, }),
      );

      const app = createDenoRouter("", null, null,);
      app.mount("/api/v1", api,);

      const res1 = await app.handleRequest(
        new Request("http://localhost/api/v1/users",),
      );
      assertEquals(res1.status, 200,);
      assertEquals(await res1.text(), "user list",);

      const res2 = await app.handleRequest(
        new Request("http://localhost/api/v1/users/42",),
      );
      assertEquals(res2.status, 200,);
      assertEquals(await res2.text(), "user 42",);
    });

    it("mounts child router middlewares scoped to mount prefix", async () => {
      const admin = new Router();
      admin.use(async (req, _p, next, ctx,) => {
        if (!req.headers.has("x-admin-secret",)) {
          return new Response("Forbidden Admin", { status: 403, },);
        }
        if (ctx) ctx.state.admin = true;
        return await next();
      },);
      admin.get("/dashboard", (_req, _p, ctx,) => {
        return { body: `Admin Dashboard: ${ctx?.state?.admin}`, };
      },);

      const app = createDenoRouter("", null, null,);
      app.get("/public", () => ({ body: "Public View", }),);
      app.mount("/admin", admin,);

      // Public view is untouched
      const resPublic = await app.handleRequest(
        new Request("http://localhost/public",),
      );
      assertEquals(resPublic.status, 200,);

      // Admin view without header -> 403
      const resForbidden = await app.handleRequest(
        new Request("http://localhost/admin/dashboard",),
      );
      assertEquals(resForbidden.status, 403,);
      assertEquals(await resForbidden.text(), "Forbidden Admin",);

      // Admin view with header -> 200
      const resAuthorized = await app.handleRequest(
        new Request("http://localhost/admin/dashboard", {
          headers: { "x-admin-secret": "12345", },
        },),
      );
      assertEquals(resAuthorized.status, 200,);
      assertEquals(await resAuthorized.text(), "Admin Dashboard: true",);
    });

    it("mounts child router WebSocket routes preserving the original WebSocketGroup", () => {
      const chatRouter = new Router();
      const wsRoute = chatRouter.ws("/live", () => {},);

      const app = createDenoRouter("", null, null,);
      app.mount("/chat", chatRouter,);

      const mountedWsRoute = app.getWsRouteByPath("/chat/live",);
      assertExists(mountedWsRoute,);
      // The group instance should be preserved
      assertEquals(mountedWsRoute.group, wsRoute.group,);
    });
  });

  // ============================================================
  // 3. MIDDLEWARE CHAIN
  // ============================================================
  describe("3. MiddlewareChain class & pipeline composition", () => {
    it("executes a standalone pre-composed MiddlewareChain", async () => {
      const chain = new MiddlewareChain();
      const steps: number[] = [];

      chain.use(async (_req, _p, next,) => {
        steps.push(1,);
        const res = await next();
        steps.push(4,);
        return res;
      },);
      chain.use(async (_req, _p, next,) => {
        steps.push(2,);
        const res = await next();
        steps.push(3,);
        return res;
      },);

      const ctx = {
        req: new Request("http://localhost/test",),
        params: {},
        state: {},
      };

      const res = await chain.execute(ctx, async () => {
        return new Response("chain-done",);
      },);

      assertEquals(res.status, 200,);
      assertEquals(await res.text(), "chain-done",);
      assertEquals(steps, [1, 2, 3, 4,],);
    });

    it("can mount a MiddlewareChain directly into app.use()", async () => {
      const securityChain = new MiddlewareChain();
      securityChain.use(async (_req, _p, next,) => {
        const res = await next();
        res.headers.set("X-Security-Audit", "passed",);
        return res;
      },);

      const app = createDenoRouter("", null, null,);
      app.use(securityChain,);
      app.get("/secure", () => ({ body: "ok", }),);

      const res = await app.handleRequest(
        new Request("http://localhost/secure",),
      );
      assertEquals(res.status, 200,);
      assertEquals(res.headers.get("X-Security-Audit",), "passed",);
    });
  });

  // ============================================================
  // 4. ROUTE META & REQUEST STATE
  // ============================================================
  describe("4. Route meta & Request state (ctx.state)", () => {
    it("middleware reads route.meta and sets ctx.state.authorizedUser", async () => {
      const app = createDenoRouter("", null, null,);

      // Global auth middleware that checks route.meta
      app.use(async (req, _params, next, ctx,) => {
        const routeMeta = (ctx?.route as HttpRoute)?.meta;
        if (routeMeta?.requireAuth) {
          const authHeader = req.headers.get("Authorization",);
          if (!authHeader || !authHeader.startsWith("Bearer user-",)) {
            return new Response("Unauthorized", { status: 401, },);
          }
          if (ctx) {
            ctx.state.authorizedUser = {
              id: authHeader.replace("Bearer user-", "",),
              role: "member",
            };
          }
        }
        return await next();
      },);

      // Public route without meta.requireAuth
      app.get("/public", () => ({ body: "public", }),);

      // Protected route with meta.requireAuth
      app.get(
        "/private",
        (_req, _params, ctx,) => {
          const user = ctx?.state?.authorizedUser as {
            id: string;
            role: string;
          };
          return { body: `Hello user ${user.id} with role ${user.role}`, };
        },
        { meta: { requireAuth: true, }, },
      );

      // 1. Access public route
      const resPublic = await app.handleRequest(
        new Request("http://localhost/public",),
      );
      assertEquals(resPublic.status, 200,);

      // 2. Access private route without token -> 401
      const resNoToken = await app.handleRequest(
        new Request("http://localhost/private",),
      );
      assertEquals(resNoToken.status, 401,);

      // 3. Access private route with valid token -> 200 with ctx.state populated
      const resWithToken = await app.handleRequest(
        new Request("http://localhost/private", {
          headers: { Authorization: "Bearer user-777", },
        },),
      );
      assertEquals(resWithToken.status, 200,);
      assertEquals(
        await resWithToken.text(),
        "Hello user 777 with role member",
      );
    });

    it("HttpHandler can return a raw Response instance directly", async () => {
      const app = createDenoRouter("", null, null,);
      app.get("/raw-response", () => {
        return new Response(JSON.stringify({ status: "healthy", },), {
          status: 202,
          headers: { "Content-Type": "application/json", },
        },);
      },);

      const res = await app.handleRequest(
        new Request("http://localhost/raw-response",),
      );
      assertEquals(res.status, 202,);
      assertEquals(res.headers.get("Content-Type",), "application/json",);
      assertEquals(await res.json(), { status: "healthy", },);
    });
  });

  // ============================================================
  // 5. WEBSOCKET GROUP HOOKS
  // ============================================================
  describe("5. WebSocketGroup Hooks (onConnect, onDisconnect, onBroadcast, onMessage)", () => {
    it("triggers connect, disconnect, and broadcast event hooks", () => {
      const group = new WebSocketGroup();
      const events: string[] = [];

      group.onConnect((_ws, params,) => {
        events.push(`connect:${params.user}`,);
      },);

      group.onDisconnect((_ws, params,) => {
        events.push(`disconnect:${params.user}`,);
      },);

      group.on("broadcast", (msg, senderParams,) => {
        events.push(`broadcast:${msg}:${senderParams?.room}`,);
      },);

      // Mock WebSocket
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: () => {},
        close: () => {},
      } as unknown as WebSocket;

      // 1. Connect
      group.addSocket(mockWs, { user: "alice", },);
      assertEquals(events, ["connect:alice",],);

      // 2. Broadcast
      group.broadcast("welcome", undefined, { room: "lounge", },);
      assertEquals(events, ["connect:alice", "broadcast:welcome:lounge",],);

      // 3. Disconnect
      group.removeSocket(mockWs,);
      assertEquals(events, [
        "connect:alice",
        "broadcast:welcome:lounge",
        "disconnect:alice",
      ],);
    });

    it("allows unsubscribing listeners with off()", () => {
      const group = new WebSocketGroup();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      group.on("connect", listener,);

      const mockWs1 = {} as WebSocket;
      group.addSocket(mockWs1, {},);
      assertEquals(callCount, 1,);

      group.off("connect", listener,);

      const mockWs2 = {} as WebSocket;
      group.addSocket(mockWs2, {},);
      assertEquals(callCount, 1,); // Not called again
    });
  });
});
