// src/middleware-chain.ts
/**
 * @file middleware-chain.ts
 * @description Composable pipeline for executing middleware layers with onion architecture.
 */

import { MiddlewareRoute } from "./middleware-route.ts";
import type { Middleware, RequestContext } from "./types.ts";

/**
 * MiddlewareChain maintains an ordered list of MiddlewareRoute instances and manages
 * nested execution with cascading `next()` calls, error catching, and Request mutations.
 */
export class MiddlewareChain {
  private middlewares: MiddlewareRoute[] = [];

  /**
   * Initializes a new MiddlewareChain with optional initial middlewares.
   */
  constructor(middlewares: (Middleware | MiddlewareRoute)[] = []) {
    for (const mw of middlewares) {
      if (mw instanceof MiddlewareRoute) {
        this.middlewares.push(mw);
      } else {
        this.middlewares.push(new MiddlewareRoute(mw));
      }
    }
  }

  /**
   * Registers a middleware, sub-chain, or path-scoped middleware to the pipeline.
   *
   * @param middlewareOrPathOrChain Middleware function, MiddlewareRoute, nested chain, or route prefix string.
   * @param handler Optional handler or chain when the first parameter is a path prefix string.
   */
  use(
    middlewareOrPathOrChain:
      | Middleware
      | MiddlewareRoute
      | MiddlewareChain
      | string,
    handler?: Middleware | MiddlewareChain,
  ): this {
    if (middlewareOrPathOrChain instanceof MiddlewareChain) {
      this.middlewares.push(...middlewareOrPathOrChain.routes);
    } else if (middlewareOrPathOrChain instanceof MiddlewareRoute) {
      this.middlewares.push(middlewareOrPathOrChain);
    } else if (typeof middlewareOrPathOrChain === "string" && handler) {
      const patternPath = middlewareOrPathOrChain.startsWith("/")
        ? middlewareOrPathOrChain
        : "/" + middlewareOrPathOrChain;
      if (handler instanceof MiddlewareChain) {
        for (const mw of handler.routes) {
          const subPath = mw.path ? mw.path : patternPath;
          this.middlewares.push(new MiddlewareRoute(mw.handler, subPath));
        }
      } else {
        this.middlewares.push(new MiddlewareRoute(handler, patternPath));
      }
    } else if (typeof middlewareOrPathOrChain === "function") {
      this.middlewares.push(new MiddlewareRoute(middlewareOrPathOrChain));
    }
    return this;
  }

  /**
   * Returns a readonly array of all registered MiddlewareRoute instances in the chain.
   */
  get routes(): readonly MiddlewareRoute[] {
    return this.middlewares;
  }

  /**
   * Executes the middleware chain for a given request context, ultimately invoking `finalHandler`.
   *
   * @param ctx The current RequestContext containing request, params, and state.
   * @param finalHandler The terminal handler called after all middlewares yield via `next()`.
   */
  async execute(
    ctx: RequestContext,
    finalHandler: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const adjustedUrl = new URL(ctx.req.url);
    const applicable = this.middlewares.filter((mw) => mw.match(adjustedUrl));
    let index = 0;

    const next = async (newReq?: Request): Promise<Response> => {
      if (newReq) {
        ctx.req = newReq;
      }
      if (index < applicable.length) {
        const mw = applicable[index++];
        if (!mw) return await finalHandler(ctx.req);
        let nextCalled = false;
        try {
          return await mw.execute(
            ctx.req,
            ctx.params,
            async (nReq?: Request) => {
              if (nextCalled) throw new Error("next() called multiple times");
              nextCalled = true;
              return await next(nReq);
            },
            ctx,
          );
        } catch (err) {
          console.error("[MiddlewareChain] Middleware error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
      return await finalHandler(ctx.req);
    };

    return await next();
  }
}
