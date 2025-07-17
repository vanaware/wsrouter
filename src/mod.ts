// src/mod.ts

export class Router {
  private routes: Map<string, (req: Request) => Response> = new Map();
  private wsRoutes: Map<string, (conn: WebSocketConn) => void> = new Map();

  get(path: string, handler: (req: Request) => Response): void {
    this.routes.set(`GET:${path}`, handler);
  }

  websocket(path: string, handler: (conn: WebSocketConn) => void): void {
    this.wsRoutes.set(`WS:${path}`, handler);
  }

  match(method: string, path: string):
    | { type: "http"; handler: (req: Request) => Response }
    | { type: "websocket"; handler: (conn: WebSocketConn) => void }
    | undefined {

    const httpKey = `${method}:${path}`;
    const wsKey = `WS:${path}`;

    if (this.routes.has(httpKey)) {
      return { type: "http", handler: this.routes.get(httpKey)! };
    } else if (this.wsRoutes.has(wsKey)) {
      return { type: "websocket", handler: this.wsRoutes.get(wsKey)! };
    }

    return undefined;
  }

  fetch(req: Request): Response | undefined {
    const url = new URL(req.url);
    const route = this.match(req.method, url.pathname);

    if (!route) {
      return new Response("Not Found", { status: 404 });
    }

    if (route.type === "http") {
      return route.handler(req);
    }

    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const { response, socket } = Deno.upgradeWebSocket(req);
      route.handler(socket as WebSocketConn);
      return response;
    }

    return new Response("Upgrade required", { status: 400 });
  }
}

// Tipos adicionais
type WebSocketConn = {
  send(data: string | ArrayBufferLike): void;
  receive(): Promise<{  string | ArrayBufferLike }>;
  close(code?: number): void;
  onOpen(): void;
  onClose(): void;
  onError(): void;
  onMessage(fn: (msg: {  string | ArrayBuffer }) => void): void;
};