// monorepo/router/src/mod.ts
// ⚡ CORE AGNÓSTICO — Fase 3: Segurança reforçada + Workers

import { normalize } from "@std/path";

// ============================================================
// TIPOS FUNDAMENTAIS
// ============================================================
export type RouteParams = Record<string, string | string[]>;
export type HttpHandler = (
  req: Request,
  params: RouteParams,
) =>
  | { body: BodyInit; init?: ResponseInit }
  | Promise<{ body: BodyInit; init?: ResponseInit }>;
export type WsHandler = (
  ws: WebSocket,
  req: Request,
  params: RouteParams,
) => void | Promise<void>;
export type PermissionFn = (
  receiverParams: RouteParams,
  senderParams: RouteParams,
  message: string,
) => boolean;
export type Middleware = (
  req: Request,
  params: RouteParams,
  next: (newReq?: Request) => Promise<Response>,
) => Promise<Response> | Response;

// 🆕 WORKER HANDLER: função simples que recebe Request e retorna Response
// O env/ctx ficam capturados no closure pelo usuário
export type WorkerHandler = (req: Request) => Promise<Response>;

// ============================================================
// 🌐 INTERFACES DE ABSTRAÇÃO
// ============================================================
export interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}
export interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}

// ============================================================
// OPÇÕES DO ROUTER
// ============================================================
export const DEFAULT_LAST_BROADCAST_DELAY = 0;
export interface RouterOptions {
  basePath?: string;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  webSocketUpgrader?: WebSocketUpgrader;
  staticFileHandler?: StaticFileHandler;
}

// ============================================================
// INTERFACES INTERNAS
// ============================================================
interface HttpRoute {
  method: string;
  pattern: URLPattern;
  handler: HttpHandler;
}
interface WsRoute {
  pattern: URLPattern;
  handler: WsHandler;
  group: WebSocketGroup;
}
interface LastBroadcast {
  message: string;
  permissionFn?: PermissionFn;
  senderParams: RouteParams;
}

// ============================================================
// CLASSE ROUTER
// ============================================================
export class Router {
  public basePath: string;
  private httpRoutes: HttpRoute[] = [];
  private wsRoutes: WsRoute[] = [];
  private middlewares: Middleware[] = [];
  private workers: WorkerHandler[] = []; // 🆕 Workers
  private webSockets = new Map<WebSocket, { group: WebSocketGroup }>();
  private webSocketUpgrader?: WebSocketUpgrader;
  private staticFileHandler?: StaticFileHandler;
  public forceHttps: boolean;
  public trustProxy: boolean;
  public allowDotfiles: boolean;
  private lastBroadcastDelay: number;

  constructor(options: RouterOptions = {}) {
    this.basePath = this.normalizeBasePath(options.basePath ?? "");
    this.forceHttps = options.forceHttps ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.allowDotfiles = options.allowDotfiles ?? false;
    this.lastBroadcastDelay = options.lastBroadcastDelay ?? DEFAULT_LAST_BROADCAST_DELAY;
    this.webSocketUpgrader = options.webSocketUpgrader;
    this.staticFileHandler = options.staticFileHandler;
  }

  setWebSocketUpgrader(upgrader: WebSocketUpgrader): this {
    this.webSocketUpgrader = upgrader;
    return this;
  }
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
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  }
  private shouldForceHttps(req: Request): boolean {
    if (!this.forceHttps) return false;
    if (this.isLocalhost(req)) return false;
    if (this.trustProxy) {
      const protoHeader = req.headers.get("x-forwarded-proto");
      const forwardedProto = protoHeader ? protoHeader.split(",")[0]?.trim() : undefined;
      if (forwardedProto === "https") return false;
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
    return url.toString();
  }

  private addHttpRoute(method: string, path: string, handler: HttpHandler) {
    const patternPath = this.normalizePath(path);
    const pattern = new URLPattern({ pathname: patternPath });
    this.httpRoutes.push({ method: method.toUpperCase(), pattern, handler });
  }
  private addWsRoute(path: string, handler: WsHandler) {
    const patternPath = this.normalizePath(path);
    const pattern = new URLPattern({ pathname: patternPath });
    if (this.wsRoutes.some(r => r.pattern.pathname === patternPath)) {
      throw new Error(`Duplicate WebSocket route pattern: ${patternPath}`);
    }
    const group = new WebSocketGroup(this.lastBroadcastDelay);
    this.wsRoutes.push({ pattern, handler, group });
  }

  // ============================================================
  // REGISTRO DE ROTAS
  // ============================================================
  use(middleware: Middleware): this { this.middlewares.push(middleware); return this; }
  get(path: string, handler: HttpHandler): this { this.addHttpRoute("GET", path, handler); return this; }
  post(path: string, handler: HttpHandler): this { this.addHttpRoute("POST", path, handler); return this; }
  put(path: string, handler: HttpHandler): this { this.addHttpRoute("PUT", path, handler); return this; }
  delete(path: string, handler: HttpHandler): this { this.addHttpRoute("DELETE", path, handler); return this; }
  patch(path: string, handler: HttpHandler): this { this.addHttpRoute("PATCH", path, handler); return this; }
  options(path: string, handler: HttpHandler): this { this.addHttpRoute("OPTIONS", path, handler); return this; }
  head(path: string, handler: HttpHandler): this { this.addHttpRoute("HEAD", path, handler); return this; }
  ws(path: string, handler: WsHandler): this { this.addWsRoute(path, handler); return this; }

  // 🆕 REGISTRO DE WORKERS
  // Workers são fallbacks programáveis executados ANTES de static files
  // mas DEPOIS de rotas HTTP/WS e verificação 405.
  // Múltiplos workers formam uma cadeia: se um retorna 404, o próximo é tentado.
  worker(handler: WorkerHandler): this {
    this.workers.push(handler);
    return this;
  }

  // ============================================================
  // BUSCA DE ROTAS
  // ============================================================
  private findHttpRoute(req: Request): { route: HttpRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.httpRoutes) {
      if (route.method !== req.method.toUpperCase()) continue;
      const match = route.pattern.exec(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }
  private findWsRoute(req: Request): { route: WsRoute; params: RouteParams } | null {
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    for (const route of this.wsRoutes) {
      const match = route.pattern.exec(adjustedUrl);
      if (match) {
        return { route, params: this.extractParams(match.pathname.groups) };
      }
    }
    return null;
  }

  // ============================================================
  // 🆕 EXECUÇÃO DOS WORKERS (CADEIA DE FALLBACK)
  // ============================================================
  private async tryWorkers(req: Request): Promise<Response | null> {
    for (const worker of this.workers) {
      try {
        const res = await worker(req);
        // Se o worker retornar 404, tentamos o próximo worker
        if (res.status !== 404) return res;
      } catch (err) {
        console.error("[Router] Worker error:", err);
        // Continua para o próximo worker em caso de erro
      }
    }
    return null; // Nenhum worker tratou a request
  }

  // ============================================================
  // EXECUÇÃO DOS HANDLERS
  // ============================================================
  private async executeHttpHandler(
    req: Request,
    route: HttpRoute,
    params: RouteParams,
    isHeadFromGet: boolean = false,
  ): Promise<Response> {
    try {
      const result = await route.handler(req, params);
      const isHead = req.method.toUpperCase() === "HEAD" || isHeadFromGet;
      const isNullBodyStatus = result.init?.status &&
        [101, 204, 205, 304].includes(result.init.status);
      const finalBody = (isHead || isNullBodyStatus) ? null : result.body;
      if (finalBody === null && result.body instanceof ReadableStream) {
        try { await (result.body as ReadableStream).cancel(); } catch {}
      }
      return new Response(finalBody, result.init);
    } catch (error) {
      console.error(`[Router] Error in ${req.method} ${route.pattern.pathname}:`, error);
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
    if (typeof socket.addEventListener === "function") {
      socket.addEventListener("close", cleanup);
      socket.addEventListener("error", (ev) => {
        console.error(`WebSocket error:`, ev);
        cleanup();
      });
    } else {
      socket.onclose = cleanup;
      socket.onerror = (ev) => { console.error(`WebSocket error:`, ev); cleanup(); };
    }
    try {
      await route.handler(socket, req, params);
    } catch (error) {
      console.error(`[Router] Error in WS handler ${route.pattern.pathname}:`, error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1011, "Internal Server Error");
      }
    }
    return response;
  }

  // ============================================================
  // HANDLER PRINCIPAL COM MIDDLEWARES
  // ============================================================
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
    let isWs = req.headers.get("upgrade")?.toLowerCase() === "websocket";
    let found = isWs ? this.findWsRoute(req) : this.findHttpRoute(req);
    const isHttps = new URL(req.url).protocol === "https:";
    const hstsHeader: Record<string, string> = {};
    if (this.forceHttps && isHttps) {
      hstsHeader["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }
    let index = 0;
    let currentReq = req;
    const executeChain = async (): Promise<Response> => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        if (!mw) return this.executeFinalHandler(currentReq, isWs, found, hstsHeader);
        try {
          let nextHasBeenCalled = false;
          const result = await mw(currentReq, found?.params ?? {}, async (newReq?: Request) => {
            if (nextHasBeenCalled) throw new Error("next() called multiple times");
            nextHasBeenCalled = true;
            if (newReq) {
              currentReq = newReq;
              isWs = currentReq.headers.get("upgrade")?.toLowerCase() === "websocket";
              found = isWs ? this.findWsRoute(currentReq) : this.findHttpRoute(currentReq);
            }
            return await executeChain();
          });
          return result;
        } catch (error) {
          console.error(`[Router] Middleware error:`, error);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
      return this.executeFinalHandler(currentReq, isWs, found, hstsHeader);
    };
    return await executeChain();
  }

  private async executeFinalHandler(
    req: Request,
    isWs: boolean,
    found: { route: HttpRoute | WsRoute; params: RouteParams } | null,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    // 1. WebSocket
    if (isWs) {
      if (!found) return new Response("WebSocket Not Found", { status: 404 });
      const res = await this.executeWsHandler(req, found.route as WsRoute, found.params);
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
      return res;
    }

    // 2. HEAD automático baseado em GET
    let httpFound = found as { route: HttpRoute; params: RouteParams } | null;
    let isHeadFromGet = false;
    if (!httpFound && req.method === "HEAD") {
      const fakeGetReq = new Request(req.url, { method: "GET", headers: req.headers });
      const getFound = this.findHttpRoute(fakeGetReq);
      if (getFound) {
        httpFound = getFound;
        isHeadFromGet = true;
      }
    }

    // 3. Rota HTTP encontrada
    if (httpFound) {
      const res = await this.executeHttpHandler(req, httpFound.route, httpFound.params, isHeadFromGet);
      for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
      return res;
    }

    // 4. Verificação 405 Method Not Allowed
    const adjustedUrl = new URL(req.url);
    adjustedUrl.pathname = this.stripBase(adjustedUrl.pathname);
    const allowedMethods = this.httpRoutes
      .filter(r => r.pattern.exec(adjustedUrl))
      .map(r => r.method);
    if (allowedMethods.length > 0 && !allowedMethods.includes(req.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Allow": allowedMethods.join(", "), ...extraHeaders },
      });
    }

    // 🆕 5. TRY WORKERS (fallback programável antes de static)
    const workerRes = await this.tryWorkers(req);
    if (workerRes) {
      for (const [k, v] of Object.entries(extraHeaders)) workerRes.headers.set(k, v);
      return workerRes;
    }

    // 6. Static files (apenas GET/HEAD)
    if (req.method === "GET" || req.method === "HEAD") {
      const staticRes = await this.handleStaticFile(req);
      if (staticRes.status !== 404) {
        if (req.method === "HEAD") {
          return new Response(null, {
            status: staticRes.status,
            statusText: staticRes.statusText,
            headers: staticRes.headers,
          });
        }
        for (const [k, v] of Object.entries(extraHeaders)) staticRes.headers.set(k, v);
        return staticRes;
      }
    }

    // 7. 404 Not Found
    return new Response("Not Found", { status: 404, headers: extraHeaders });
  }

  private async handleStaticFile(req: Request): Promise<Response> {
    if (!this.staticFileHandler) return new Response("Not Found", { status: 404 });
    const { pathname } = new URL(req.url);
    const adjustedPathname = this.stripBase(pathname);
    const safePath = normalize(adjustedPathname).replace(/^(\.\.[/\\])+/, "");
    if (!this.allowDotfiles && safePath.split("/").some(segment => segment.startsWith("."))) {
      return new Response("Not Found", { status: 404 });
    }
    const response = await this.staticFileHandler.handle(safePath);
    return response ?? new Response("Not Found", { status: 404 });
  }

  closeAllWebSockets() {
    for (const [socket, { group }] of this.webSockets.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1001, "Server is shutting down");
      }
      group.removeSocket(socket);
    }
    this.webSockets.clear();
  }
  getWsGroupByPath(pathOrPattern: string): WebSocketGroup | undefined {
    const targetPath = this.normalizePath(pathOrPattern);
    for (const route of this.wsRoutes) {
      if (route.pattern.pathname === targetPath) {
        return route.group;
      }
    }
    return undefined;
  }
  closeGroupByPath(path: string): boolean {
    const group = this.getWsGroupByPath(path);
    if (!group) return false;
    group.closeGroup();
    return true;
  }
  private extractParams(groups: Record<string, string | undefined>): RouteParams {
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

// ============================================================
// WEBSOCKET GROUP
// ============================================================
export class WebSocketGroup {
  private sockets = new Map<WebSocket, RouteParams>();
  private lastBroadcast: LastBroadcast | null = null;
  private lastBroadcastDelay: number;
  constructor(lastBroadcastDelay: number = DEFAULT_LAST_BROADCAST_DELAY) {
    this.lastBroadcastDelay = lastBroadcastDelay;
  }
  addSocket(ws: WebSocket, params: RouteParams) { this.sockets.set(ws, params); }
  removeSocket(ws: WebSocket) { this.sockets.delete(ws); }
  get size(): number { return this.sockets.size; }
  sendLastBroadcastTo(ws: WebSocket, receiverParams: RouteParams) {
    const broadcast = this.lastBroadcast;
    if (!broadcast) return;
    setTimeout(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          const { message, permissionFn, senderParams } = broadcast;
          if (!permissionFn || permissionFn(receiverParams, senderParams, message)) {
            ws.send(message);
          }
        }
      } catch (err) { console.error("Last broadcast error:", err); }
    }, this.lastBroadcastDelay);
  }
  broadcast(message: string, permissionFn?: PermissionFn, senderParams?: RouteParams) {
    this.lastBroadcast = { message, permissionFn, senderParams: senderParams ?? {} };
    for (const [socket, receiverParams] of this.sockets.entries()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        if (!permissionFn || permissionFn(receiverParams, senderParams ?? {}, message)) {
          socket.send(message);
        }
      } catch (err) { console.error("Broadcast error:", err); }
    }
  }
  closeGroup() {
    for (const [socket] of this.sockets.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Group is being closed");
    }
    this.sockets.clear();
    this.lastBroadcast = null;
  }
}