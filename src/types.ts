// src/types.ts
/**
 * @file types.ts
 * @description Fundamental type declarations, interfaces, and options for WsRouter.
 */

import type { HttpRoute } from "./http-route.ts";
import type { WsRoute } from "./ws-route.ts";

/**
 * Route parameter map extracted from URL pattern matching.
 * Dynamic segments like `:id` produce strings, while catch-alls produce string arrays.
 */
export type RouteParams = Record<string, string | string[]>;

/**
 * Request execution context passed to handlers and middlewares.
 * Contains the original/modified Request, extracted parameters, mutable shared state,
 * and optional reference to the matched route instance.
 */
export interface RequestContext {
  /** The incoming HTTP Request object. Can be substituted or enriched by middlewares. */
  req: Request;
  /** Route path parameters parsed from the URL pattern. */
  params: RouteParams;
  /** Mutable application state shared across middlewares and the final route handler. */
  state: Record<string, unknown>;
  /** The matched HttpRoute or WsRoute instance, if a route pattern was identified. */
  route?: HttpRoute | WsRoute;
}

/**
 * HTTP handler function signature.
 * Can return a raw standard Response object or a lightweight `{ body, init }` structure,
 * synchronously or wrapped in a Promise.
 */
export type HttpHandler = (
  req: Request,
  params: RouteParams,
  ctx?: RequestContext,
) =>
  | { body: BodyInit; init?: ResponseInit }
  | Response
  | Promise<{ body: BodyInit; init?: ResponseInit } | Response>;

/**
 * WebSocket handler callback invoked when an incoming connection is upgraded successfully.
 */
export type WsHandler = (
  ws: WebSocket,
  req: Request,
  params: RouteParams,
) => void | Promise<void>;

/**
 * Granular broadcast filtering function.
 * Determines if a particular message should be delivered to a recipient socket.
 *
 * @param receiverParams Parameters associated with the receiving socket.
 * @param senderParams Parameters associated with the message sender.
 * @param message The serialized broadcast payload.
 * @returns boolean `true` if the message should be delivered, `false` to discard.
 */
export type PermissionFn = (
  receiverParams: RouteParams,
  senderParams: RouteParams,
  message: string,
) => boolean;

/**
 * Middleware function with standard onion architecture (`next()` pipeline).
 */
export type Middleware = (
  req: Request,
  params: RouteParams,
  next: (newReq?: Request) => Promise<Response>,
  ctx?: RequestContext,
) => Promise<Response> | Response;

/**
 * Worker handler function that handles Requests and produces Responses.
 * Useful for integrating Cloudflare Workers, edge worker scripts, or fallback fetchers.
 */
export type WorkerHandler = (req: Request) => Promise<Response>;

/**
 * WebSocket upgrader abstraction interface to decouple environment-specific upgrade logic.
 */
export interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}

/**
 * Static file handler abstraction interface for serving local or embedded static assets.
 */
export interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}

/** Default delay (in milliseconds) before sending the last broadcast to newly connected clients. */
export const DEFAULT_LAST_BROADCAST_DELAY = 0;

/**
 * Configuration options for initializing a Router instance.
 */
export interface RouterOptions {
  /** Optional base prefix path for all routes registered on this router (e.g., "/api"). */
  basePath?: string;
  /** When enabled, redirects unencrypted HTTP traffic to HTTPS (ignoring localhost). */
  forceHttps?: boolean;
  /** When enabled, inspects `X-Forwarded-Proto` header from reverse proxies when determining HTTPS. */
  trustProxy?: boolean;
  /** When enabled, allows serving hidden dotfiles (e.g. `.well-known`). Defaults to `false`. */
  allowDotfiles?: boolean;
  /** Default debounce delay (in ms) for replaying last broadcast to joining sockets. */
  lastBroadcastDelay?: number;
  /** Custom WebSocket upgrader instance. */
  webSocketUpgrader?: WebSocketUpgrader;
  /** Custom static file handler instance. */
  staticFileHandler?: StaticFileHandler;
}
