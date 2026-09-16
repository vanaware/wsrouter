// src/router.ts
/**
 * @file router.ts
 * @description Core Router class managing route registration, sub-router mounting, middleware execution, and request dispatching.
 */

import { normalize } from "@std/path";
import { HttpRoute, type HttpRouteOptions } from "./http-route.ts";
import { WsRoute, type WsRouteOptions } from "./ws-route.ts";
import { MiddlewareRoute } from "./middleware-route.ts";
import { MiddlewareChain } from "./middleware-chain.ts";
import { WorkerRoute } from "./worker-route.ts";
import { WebSocketGroup } from "./websocket-group.ts";
import {
  DEFAULT_LAST_BROADCAST_DELAY,
  type HttpHandler,
  type Middleware,
  type RequestContext,
  type RouteParams,
  type RouterOptions,
  type StaticFileHandler,
  type WebSocketUpgrader,
  type WorkerHandler,
  type WsHandler,
} from "./types.ts";

/**
 * High-performance, environment-agnostic HTTP and WebSocket router.
 * Features:
 * - URLPattern pattern-based route matching.
 * - HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD).
 * - Middleware pipeline with bidirectional onion model (`next()`).
 * - WebSocket connection management, channel grouping, and selective broadcasting.
 * - Sub-router composition and prefix mounting (`mount()`).
 * - Worker fallback chain before static files.
 * - Automatic HTTPS redirection and HSTS headers.
 */
export class Router {
  /** The base URL prefix for this router (e.g. "/api"). */
  public basePath: string;
  private httpRoutes: HttpRoute[] = [];
  private wsRoutes: WsRoute[] = [];
  private middlewareChain = new MiddlewareChain();
  private workers: WorkerRoute[] = [];
  private webSockets = new Map<WebSocket, { group: WebSocketGroup }>();
  private webSocketUpgrader?: WebSocketUpgrader;
  private staticFileHandler?: StaticFileHandler;
  /** Whether unencrypted HTTP traffic should be redirected to HTTPS. */
  public forceHttps: boolean;
  /** Whether to trust `X-Forwarded-Proto` proxy header. */
  public trustProxy: boolean;
  /** Whether to permit serving hidden dotfiles from static directories. */
  public allowDotfiles: boolean;
  private lastBroadcastDelay: number;

  /**
   * Initializes a new Router instance with the specified options.
   */
  constructor(options: RouterOptions = {}) {
    this.basePath = this.normalizeBasePath(options.basePath ?? "");
    this.forceHttps = options.forceHttps ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.allowDotfiles = options.allowDotfiles ?? false;
    this.lastBroadcastDelay = options.lastBroadcastDelay ??
      DEFAULT_LAST_BROADCAST_DELAY;
    this.webSocketUpgrader = options.webSocketUpgrader;
    this.staticFileHandler = options.staticFileHandler;
  }

  /**
   * Configures the WebSocket upgrader implementation.
   */
  setWebSocketUpgrader(upgrader: WebSocketUpgrader): this {
    this.webSocketUpgrader = upgrader;
    return this;
  }

  /**
   * Configures the static file handler implementation.
   */
  setStaticFileHandler(handler: StaticFileHandler): this {
    this.staticFileHandler = handler;
    return this;
  }

  private normalizeBasePath(p: string): string {
    if (!p || p === "/") return "";
    return "/" + p.replace(/^\/+|\/+$/g, "");
  }

  private normalizePath(p: string): string {
    return p.startsWith("/") ? p : "/" + p;
  }

  private combinePaths(prefix: string, path?: string): string {
    const normPrefix = prefix
      ? (prefix.startsWith("/") ? prefix : "/" + prefix).replace(/\/+$/, "")
      : "";
    if (!path) return normPrefix || "/";
    if (path === "*") return normPrefix ? `${normPrefix}{/*}?` : "/*";
    const normPath = path.startsWith("/") ? path : "/" + path;
    if (!normPrefix) return normPath;
    if (normPath === "/") return normPrefix;
    return normPrefix + normPath;
  }

  private stripBase(pathname: string): string {
    if (!this.basePath) return pathname;
    if (pathname === this.basePath) return "/";
    if (pathname.startsWith(this.basePath + "/")) {
      return pathname.slice(this.basePath.length);
    }
    return pathname;
  }

  private isLocalhost(req: Request): boolean {
    const url = new URL(req.url);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return hostname === "localhost" || hostname === "127.0.0.1" ||
      hostname === "::1";
  }

  private shouldForceHttps(req: Request): boolean {
    if (!this.forceHttps) return false;
    if (this.isLocalhost(req)) return false;
    if (this.trustProxy) {
      const protoHeader = req.headers.get("x-forwarded-proto");
      const forwardedProto = protoHeader
        ? protoHeader.split(",")[0]?.trim().toLowerCase()
        : undefined;
      if (forwardedProto === "https") return false;
      if (forwardedProto === "http") return true;
    }
    const url = new URL(req.url);
    if (url.protocol === "https:") return false;
    return true;
  }

  private buildHttpsUrl(req: Request): string {
    const url = new URL(req.url);
    url.protocol = "https:";
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      url.protocol = "wss:";
    }
    if (this.trustProxy) {
      const hostHeader = req.headers.get("x-forwarded-host");
      if (hostHeader) {
        const forwardedHost = hostHeader.split(",")[0]?.trim();
        if (forwardedHost && /^[\w.:-]+$/.test(forwardedHost)) {
          url.host = forwardedHost;
        }
      }
    }
    return url.toString();
  }

  private addHttpRoute(
    method: string,
    path: string,
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): HttpRoute {
    const patternPath = this.normalizePath(path);
    const route = new HttpRoute(method, patternPath, handler, options);
    this.httpRoutes.push(route);
    return route;
  }

  private addWsRoute(
    path: string,
    handler: WsHandler,
    optionsOrDelay?: number | WsRouteOptions,
  ): WsRoute {
    const patternPath = this.normalizePath(path);
    if (this.wsRoutes.some((r) => r.pattern.pathname === patternPath)) {
      throw new Error(`Duplicate WebSocket route pattern: ${patternPath}`);
    }
    const opts: WsRouteOptions = typeof optionsOrDelay === "number"
      ? { lastBroadcastDelay: optionsOrDelay }
      : (optionsOrDelay ?? {});
    const route = new WsRoute(patternPath, handler, {
      lastBroadcastDelay: opts.lastBroadcastDelay ?? this.lastBroadcastDelay,
      meta: opts.meta,
      group: opts.group,
    });
    this.wsRoutes.push(route);
    return route;
  }

  /**
   * Registers a pre-instantiated HttpRoute or WsRoute directly onto this router.
   *
   * @param route The HttpRoute or WsRoute to register.
   */
  addRoute(route: HttpRoute | WsRoute): this {
    if (route instanceof HttpRoute) {
      this.httpRoutes.push(route);
    } else if (route instanceof WsRoute) {
      if (
        this.wsRoutes.some((r) =>
          r.pattern.pathname === route.pattern.pathname
        )
      ) {
        throw new Error(
          `Duplicate WebSocket route pattern: ${route.pattern.pathname}`,
        );
      }
      this.wsRoutes.push(route);
    }
    return this;
  }

  /**
   * Registers global or path-scoped middleware functions or nested MiddlewareChain instances.
   */
  use(
    middlewareOrPathOrChain:
      | Middleware
      | MiddlewareRoute
      | MiddlewareChain
      | string,
    handler?: Middleware | MiddlewareChain,
  ): this {
    this.middlewareChain.use(middlewareOrPathOrChain, handler);
    return this;
  }

  private registerMethod(
    method: string,
    path: string,
    handlerOrMiddlewares: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOptions?: HttpHandler | HttpRouteOptions,
    maybeOptions?: HttpRouteOptions,
  ): this {
    let middlewares: (Middleware | MiddlewareRoute)[] = [];
    let handler: HttpHandler;
    let options: HttpRouteOptions | undefined;

    if (Array.isArray(handlerOrMiddlewares)) {
      middlewares = handlerOrMiddlewares;
      handler = maybeHandlerOrOptions as HttpHandler;
      options = maybeOptions;
    } else {
      handler = handlerOrMiddlewares;
      options = maybeHandlerOrOptions as HttpRouteOptions;
    }

    const routeOptions: HttpRouteOptions = {
      ...options,
      middlewares: [...(options?.middlewares ?? []), ...middlewares],
    };
    this.addHttpRoute(method, path, handler, routeOptions);
    return this;
  }

  /** Registers a GET route. */
  get(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  get(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  get(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "GET",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a POST route. */
  post(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  post(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  post(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "POST",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a PUT route. */
  put(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  put(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  put(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "PUT",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a DELETE route. */
  delete(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  delete(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  delete(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "DELETE",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a PATCH route. */
  patch(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  patch(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  patch(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "PATCH",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers an OPTIONS route. */
  options(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  options(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  options(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "OPTIONS",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /** Registers a HEAD route. */
  head(path: string, handler: HttpHandler, options?: HttpRouteOptions): this;
  head(
    path: string,
    middlewares: (Middleware | MiddlewareRoute)[],
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ): this;
  head(
    path: string,
    handlerOrMw: HttpHandler | (Middleware | MiddlewareRoute)[],
    maybeHandlerOrOpts?: HttpHandler | HttpRouteOptions,
    maybeOpts?: HttpRouteOptions,
  ): this {
    return this.registerMethod(
      "HEAD",
      path,
      handlerOrMw,
      maybeHandlerOrOpts,
      maybeOpts,
    );
  }

  /**
   * Registers a WebSocket route and returns the instantiated WsRoute.
   *
   * @param path Path pattern (e.g. "/ws/:room").
   * @param handler Connection handler callback.
   * @param optionsOrDelay Debounce delay or WsRouteOptions object.
   */
  ws(
    path: string,
    handler: WsHandler,
    optionsOrDelay?: number | WsRouteOptions,
  ): WsRoute {
    return this.addWsRoute(path, handler, optionsOrDelay);
  }

  /**
   * Mounts a child sub-router under an optional path prefix.
   * Merges all child HTTP routes, WebSocket routes, scoped middlewares, and worker fallbacks.
   *
   * @param prefixOrRouter Prefix string (e.g. "/api/v1") or Router instance.
   * @param maybeRouter Sub-router instance when a prefix string is passed as the first argument.
   */
  mount(prefixOrRouter: string | Router, maybeRouter?: Router): this {
    let prefix = "";
    let subRouter: Router;
    if (typeof prefixOrRouter === "string") {
      subRouter = maybeRouter!;
      if (!subRouter) {
        throw new Error(
          "Sub-router instance must be provided when prefix is specified",
        );
      }
      const base = this.normalizeBasePath(prefixOrRouter);
      prefix = this.combinePaths(base, subRouter.basePath);
    } else {
      subRouter = prefixOrRouter;
      prefix = subRouter.basePath || "";
    }

    for (const r of subRouter.getHttpRoutes()) {
      const mountedPath = this.combinePaths(prefix, r.path);
      this.httpRoutes.push(
        new HttpRoute(r.method, mountedPath, r.handler, {
          meta: r.meta,
          middlewares: r.middlewares,
        }),
      );
    }

    for (const r of subRouter.getWsRoutes()) {
      const mountedPath = this.combinePaths(prefix, r.path);
      if (
        this.wsRoutes.some((existing) =>
          existing.pattern.pathname === mountedPath
        )
      ) {
        throw new Error(`Duplicate WebSocket route pattern: ${mountedPath}`);
      }
      this.wsRoutes.push(
        new WsRoute(mountedPath, r.handler, {
          group: r.group,
          meta: r.meta,
        }),
      );
    }

    for (const mw of subRouter.getMiddlewares()) {
      const mountedPath = mw.path
        ? this.combinePaths(prefix, mw.path)
        : (prefix ? `${prefix}{/*}?` : undefined);
      this.middlewareChain.use(mountedPath ?? "*", mw.handler);
    }

    for (const w of subRouter.getWorkers()) {
      this.workers.push(w);
    }

    return this;
  }

  /**
   * Registers a worker handler to act as a fallback tier before static files.
   *
   * @param workerOrHandler WorkerRoute, worker function, or object with a `fetch(req)` method.
   * @param name Optional descriptor name.
   */
  worker(
    workerOrHandler:
      | WorkerHandler
      | WorkerRoute
      | { fetch: (req: Request) => Promise<Response> },
    name?: string,
  ): this {
    if (workerOrHandler instanceof WorkerRoute) {
      this.workers.push(workerOrHandler);
    } else {
      this.workers.push(new WorkerRoute(workerOrHandler, name));
    }
    return this;
  }

  private findHttpRoute(
    req: Request,
  ): { route: HttpRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.httpRoutes) {
      if (!route.matchesMethod(req.method)) continue;
      const match = route.match(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

  private findWsRoute(
    req: Request,
  ): { route: WsRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.wsRoutes) {
      const match = route.match(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

  private async tryWorkers(req: Request): Promise<Response | null> {
    for (const worker of this.workers) {
      try {
        const res = await worker.execute(req);
        if (res.status !== 404) return res;
      } catch (err) {
        console.error("[Router] Worker error:", err);
      }
    }
    return null;
  }

  private async executeHttpHandler(
    req: Request,
    route: HttpRoute,
    params: RouteParams,
    isHeadFromGet: boolean = false,
    ctx?: RequestContext,
  ): Promise<Response> {
    try {
      const result = await route.handler(req, params, ctx);
      const isHead = req.method.toUpperCase() === "HEAD" || isHeadFromGet;
      if (result instanceof Response) {
        if (isHead) {
          return new Response(null, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
          });
        }
        return result;
      }
      const isNullBodyStatus = result.init?.status &&
        [101, 204, 205, 304].includes(result.init.status);
      const finalBody = (isHead || isNullBodyStatus) ? null : result.body;
      if (finalBody === null && result.body instanceof ReadableStream) {
        try {
          await (result.body as ReadableStream).cancel();
        } catch {
          // ignore stream cancel failure
        }
      }
      return new Response(finalBody, result.init);
    } catch (error) {
      console.error(
        `[Router] Error in ${req.method} ${route.pattern.pathname}:`,
        error,
      );
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  private async executeWsHandler(
    req: Request,
    route: WsRoute,
    params: RouteParams,
  ): Promise<Response> {
    if (!this.webSocketUpgrader) {
      return new Response("WebSocket not supported", { status: 501 });
    }
    let socket: WebSocket;
    let response: Response;
    try {
      const upgraded = this.webSocketUpgrader.upgrade(req);
      socket = upgraded.socket;
      response = upgraded.response;
    } catch (err) {
      console.error("[Router] WebSocket upgrade failed:", err);
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    route.group.addSocket(socket, params);
    this.webSockets.set(socket, { group: route.group });
    route.group.sendLastBroadcastTo(socket, params);

    const cleanup = () => {
      this.webSockets.delete(socket);
      route.group.removeSocket(socket);
    };
    const messageListener = (ev: MessageEvent) => {
      route.group.emit("message", socket, ev.data, params);
    };

    if (typeof socket.addEventListener === "function") {
      socket.addEventListener("message", messageListener);
      socket.addEventListener("close", cleanup);
      socket.addEventListener("error", (ev) => {
        console.error(`WebSocket error:`, ev);
        cleanup();
      });
    } else {
      socket.onmessage = messageListener;
      socket.onclose = cleanup;
      socket.onerror = (ev) => {
        console.error(`WebSocket error:`, ev);
        cleanup();
      };
    }
    try {
      await route.handler(socket, req, params);
    } catch (error) {
      console.error(
        `[Router] Error in WS handler ${route.pattern.pathname}:`,
        error,
      );
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1011, "Internal Server Error");
      }
    }
    return response;
  }

  /**
   * Main request entrypoint. Executes HTTPS checks, global middlewares, route matching,
   * route-specific middlewares, handler execution, worker fallbacks, and static files.
   *
   * @param req The incoming Request object.
   * @returns Response object.
   */
  async handleRequest(req: Request): Promise<Response> {
    if (this.shouldForceHttps(req)) {
      const httpsUrl = this.buildHttpsUrl(req);
      return new Response(null, {
        status: 301,
        headers: {
          "Location": httpsUrl,
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        },
      });
    }
    const isHttps = new URL(req.url).protocol === "https:";
    const hstsHeader: Record<string, string> = {};
    if (this.forceHttps && isHttps) {
      hstsHeader["Strict-Transport-Security"] =
        "max-age=31536000; includeSubDomains";
    }

    const initialIsWs =
      req.headers.get("upgrade")?.toLowerCase() === "websocket";
    const initialFound = initialIsWs
      ? this.findWsRoute(req)
      : this.findHttpRoute(req);

    const ctx: RequestContext = {
      req,
      params: initialFound?.params ?? {},
      state: {},
      route: initialFound?.route,
    };

    return await this.middlewareChain.execute(ctx, async (finalReq) => {
      const currentIsWs =
        finalReq.headers.get("upgrade")?.toLowerCase() === "websocket";
      const currentFound = (finalReq !== req || !initialFound)
        ? (currentIsWs
          ? this.findWsRoute(finalReq)
          : this.findHttpRoute(finalReq))
        : initialFound;

      if (currentFound) {
        ctx.params = currentFound.params;
        ctx.route = currentFound.route;
      }

      if (
        !currentIsWs && currentFound &&
        currentFound.route instanceof HttpRoute &&
        currentFound.route.middlewares.length > 0
      ) {
        const routeChain = new MiddlewareChain(currentFound.route.middlewares);
        return await routeChain.execute(ctx, async (routeReq) => {
          return await this.executeFinalHandler(
            routeReq,
            currentIsWs,
            currentFound,
            hstsHeader,
            ctx,
          );
        });
      }

      return await this.executeFinalHandler(
        finalReq,
        currentIsWs,
        currentFound,
        hstsHeader,
        ctx,
      );
    });
  }

  private async executeFinalHandler(
    req: Request,
    isWs: boolean,
    found: { route: HttpRoute | WsRoute; params: RouteParams } | null,
    extraHeaders: Record<string, string> = {},
    ctx?: RequestContext,
  ): Promise<Response> {
    // 1. WebSocket
    if (isWs) {
      if (!found) return new Response("WebSocket Not Found", { status: 404 });
      const res = await this.executeWsHandler(
        req,
        found.route as WsRoute,
        found.params,
      );
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
      return res;
    }

    // 2. Automatic HEAD handler based on GET
    let httpFound = found as { route: HttpRoute; params: RouteParams } | null;
    let isHeadFromGet = false;
    if (!httpFound && req.method === "HEAD") {
      const fakeGetReq = new Request(req.url, {
        method: "GET",
        headers: req.headers,
      });
      const getFound = this.findHttpRoute(fakeGetReq);
      if (getFound) {
        httpFound = getFound;
        isHeadFromGet = true;
      }
    }

    // 3. Matched HTTP route
    if (httpFound) {
      const res = await this.executeHttpHandler(
        req,
        httpFound.route,
        httpFound.params,
        isHeadFromGet,
        ctx,
      );
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
      return res;
    }

    // 4. Check for 405 Method Not Allowed
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    const rawAllowed = this.httpRoutes
      .filter((r) => r.pattern.exec(adjustedUrl))
      .map((r) => r.method);
    const allowedMethods = Array.from(new Set(rawAllowed));
    if (allowedMethods.length > 0 && !allowedMethods.includes(req.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Allow": allowedMethods.join(", "), ...extraHeaders },
      });
    }

    // 5. Workers fallback
    const workerRes = await this.tryWorkers(req);
    if (workerRes) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        workerRes.headers.set(k, v);
      }
      return workerRes;
    }

    // 6. Static files (only GET/HEAD)
    if (req.method === "GET" || req.method === "HEAD") {
      const staticRes = await this.handleStaticFile(req);
      if (staticRes.status !== 404) {
        // ETag 304 Not Modified validation
        const ifNoneMatch = req.headers.get("if-none-match");
        const etag = staticRes.headers.get("etag");
        if (ifNoneMatch && etag && ifNoneMatch === etag) {
          if (staticRes.body) {
            try {
              await staticRes.body.cancel();
            } catch {
              // ignore stream cancel failure
            }
          }
          return new Response(null, {
            status: 304,
            statusText: "Not Modified",
            headers: staticRes.headers,
          });
        }

        // Head request: cancel stream body to prevent file descriptor leaks
        if (req.method === "HEAD") {
          if (staticRes.body) {
            try {
              await staticRes.body.cancel();
            } catch {
              // ignore stream cancel failure
            }
          }
          return new Response(null, {
            status: staticRes.status,
            statusText: staticRes.statusText,
            headers: staticRes.headers,
          });
        }

        // Handle directory 301/302 redirects with basePath preservation
        if (staticRes.status === 301 || staticRes.status === 302) {
          const loc = staticRes.headers.get("Location");
          if (
            loc && loc.startsWith("/") && !loc.startsWith("//") && this.basePath
          ) {
            staticRes.headers.set("Location", this.basePath + loc);
          }
        }

        for (const [k, v] of Object.entries(extraHeaders)) {
          staticRes.headers.set(k, v);
        }
        return staticRes;
      }
    }

    // 7. 404 Not Found
    return new Response("Not Found", { status: 404, headers: extraHeaders });
  }

  private async handleStaticFile(req: Request): Promise<Response> {
    if (!this.staticFileHandler) {
      return new Response("Not Found", { status: 404 });
    }
    const { pathname } = new URL(req.url);
    const adjustedPathname = this.stripBase(pathname);
    const normalized = normalize("/" + adjustedPathname);
    // Strict defense-in-depth: reject traversal escapes
    if (normalized.startsWith("/..") || normalized === "/..") {
      return new Response("Not Found", { status: 404 });
    }
    const safePath = normalize(adjustedPathname).replace(/^(\.\.[/\\])+/, "");
    const segments = safePath.split("/").filter(Boolean);
    // Strict defense: never allow '.' or '..' segments regardless of allowDotfiles
    if (segments.some((seg) => seg === ".." || seg === ".")) {
      return new Response("Not Found", { status: 404 });
    }
    if (
      !this.allowDotfiles &&
      segments.some((segment) => segment.startsWith("."))
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const response = await this.staticFileHandler.handle(safePath);
    return response ?? new Response("Not Found", { status: 404 });
  }

  /**
   * Retrieves a registered HttpRoute instance by method and pattern path.
   */
  getHttpRouteByPath(
    method: string,
    pathOrPattern: string,
  ): HttpRoute | undefined {
    const targetPath = this.normalizePath(pathOrPattern);
    const upperMethod = method.toUpperCase();
    return this.httpRoutes.find(
      (r) => r.method === upperMethod && r.pattern.pathname === targetPath,
    );
  }

  /**
   * Retrieves a registered WsRoute instance by pattern path.
   */
  getWsRouteByPath(pathOrPattern: string): WsRoute | undefined {
    const targetPath = this.normalizePath(pathOrPattern);
    return this.wsRoutes.find((r) => r.pattern.pathname === targetPath);
  }

  /**
   * Returns a readonly list of all registered HttpRoute instances.
   */
  getHttpRoutes(): readonly HttpRoute[] {
    return this.httpRoutes;
  }

  /**
   * Returns a readonly list of all registered WsRoute instances.
   */
  getWsRoutes(): readonly WsRoute[] {
    return this.wsRoutes;
  }

  /**
   * Returns a readonly list of all registered MiddlewareRoute instances.
   */
  getMiddlewares(): readonly MiddlewareRoute[] {
    return this.middlewareChain.routes;
  }

  /**
   * Returns the underlying MiddlewareChain instance.
   */
  getMiddlewareChain(): MiddlewareChain {
    return this.middlewareChain;
  }

  /**
   * Returns a readonly list of all registered WorkerRoute instances.
   */
  getWorkers(): readonly WorkerRoute[] {
    return this.workers;
  }

  /**
   * Closes all active WebSocket connections across all registered groups.
   */
  closeAllWebSockets(): void {
    for (const [socket, { group }] of this.webSockets.entries()) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1001, "Server is shutting down");
      }
      group.removeSocket(socket);
    }
    this.webSockets.clear();
  }

  /**
   * Finds the WebSocketGroup associated with a specific path pattern.
   */
  getWsGroupByPath(pathOrPattern: string): WebSocketGroup | undefined {
    return this.getWsRouteByPath(pathOrPattern)?.group;
  }

  /**
   * Closes all connections in the WebSocketGroup of a specific path pattern.
   */
  closeGroupByPath(path: string): boolean {
    const group = this.getWsGroupByPath(path);
    if (!group) return false;
    group.closeGroup();
    return true;
  }

  private extractParams(
    groups: Record<string, string | undefined>,
  ): RouteParams {
    const params: RouteParams = {};
    const catches: string[] = [];
    for (const [key, value] of Object.entries(groups)) {
      if (value === undefined) continue;
      if (key === "0" || /^\d+$/.test(key)) catches.push(value);
      else params[key] = value;
    }
    if (catches.length > 0) params.catch = catches;
    return params;
  }
}
