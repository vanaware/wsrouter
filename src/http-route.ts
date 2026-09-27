// src/http-route.ts
/**
 * @file http-route.ts
 * @description Encapsulates an HTTP route with method, URLPattern matching, metadata, and route-level middlewares.
 */

import { MiddlewareRoute } from "./middleware-route.ts";
import type {
  HttpHandler,
  Middleware,
  RequestContext,
  RouteParams,
} from "./types.ts";

/**
 * Options for configuring an HttpRoute.
 */
export interface HttpRouteOptions {
  /** Arbitrary static metadata associated with this route (e.g., auth requirements, permissions, roles). */
  meta?: Record<string, unknown>;
  /** Route-specific middlewares executed before this route's handler. */
  middlewares?: (Middleware | MiddlewareRoute)[];
}

/**
 * HttpRoute encapsulates a single HTTP endpoint with an HTTP method, path pattern,
 * handler, metadata, and optional route-level middleware pipeline.
 */
export class HttpRoute {
  /** HTTP method in uppercase (e.g., "GET", "POST"). */
  readonly method: string;
  /** Normalized path pattern string (e.g., "/users/:id"). */
  readonly path: string;
  /** Compiled URLPattern for matching incoming request URLs and extracting params. */
  readonly pattern: URLPattern;
  /** The core HTTP handler callback. */
  readonly handler: HttpHandler;
  /** Static metadata attached to this route. */
  readonly meta: Record<string, unknown>;
  /** Route-specific middlewares that run when this route matches. */
  readonly middlewares: MiddlewareRoute[];

  /**
   * Creates a new HttpRoute instance.
   *
   * @param method HTTP method verb (case-insensitive, e.g. "get", "POST").
   * @param path Path pattern (e.g. "/items/:id").
   * @param handler The HTTP request handler function.
   * @param options Optional route configuration including metadata and middlewares.
   */
  constructor(
    method: string,
    path: string,
    handler: HttpHandler,
    options?: HttpRouteOptions,
  ) {
    this.method = method.toUpperCase();
    this.path = path.startsWith("/") ? path : "/" + path;
    this.pattern = new URLPattern({ pathname: this.path });
    this.handler = handler;
    this.meta = options?.meta ?? {};
    this.middlewares = (options?.middlewares ?? []).map((m) =>
      m instanceof MiddlewareRoute ? m : new MiddlewareRoute(m)
    );
  }

  /**
   * Tests whether an incoming URL matches this route's URLPattern.
   *
   * @param url The target URL to test.
   * @returns URLPatternResult containing matched parameter groups, or `null` if no match.
   */
  match(url: URL | string): URLPatternResult | null {
    return this.pattern.exec(url);
  }

  /**
   * Tests if the given method string matches this route's HTTP method verb.
   */
  matchesMethod(method: string): boolean {
    return this.method === method.toUpperCase();
  }

  /**
   * Invokes the HTTP route handler.
   */
  execute(req: Request, params: RouteParams, ctx?: RequestContext) {
    return this.handler(req, params, ctx);
  }
}
