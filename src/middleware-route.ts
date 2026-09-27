// src/middleware-route.ts
/**
 * @file middleware-route.ts
 * @description Encapsulates middleware functions with optional URLPattern path scoping.
 */

import type { Middleware, RequestContext, RouteParams } from "./types.ts";

/**
 * MiddlewareRoute wraps a Middleware handler with optional path filtering.
 * If a path pattern is specified, the middleware only executes on matching incoming URLs.
 */
export class MiddlewareRoute {
  /** The normalized path pattern string, if path-scoped. */
  readonly path?: string;
  /** The compiled URLPattern instance used for testing matches. */
  readonly pattern?: URLPattern;
  /** The actual middleware handler function. */
  readonly handler: Middleware;

  /**
   * Creates a new MiddlewareRoute.
   * @param handler The middleware function to execute.
   * @param path Optional URL path or pattern (e.g. "/admin/*" or "*").
   */
  constructor(handler: Middleware, path?: string) {
    this.handler = handler;
    if (path && path !== "*") {
      const patternPath = path.startsWith("/") ? path : "/" + path;
      this.pattern = new URLPattern({ pathname: patternPath });
      this.path = patternPath;
    }
  }

  /**
   * Checks whether the incoming URL matches this middleware route.
   * Global middlewares (without pattern) always return `true`.
   */
  match(url: URL | string): boolean {
    if (!this.pattern) return true;
    return this.pattern.test(url);
  }

  /**
   * Executes the wrapped middleware function.
   *
   * @param req The incoming HTTP Request.
   * @param params Extracted path parameters.
   * @param next Continuation callback to invoke the next middleware or final handler.
   * @param ctx Execution context containing shared state.
   */
  execute(
    req: Request,
    params: RouteParams,
    next: (newReq?: Request) => Promise<Response>,
    ctx?: RequestContext,
  ): Promise<Response> | Response {
    return this.handler(req, params, next, ctx);
  }
}
