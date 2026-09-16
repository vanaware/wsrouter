// src/worker-route.ts
/**
 * @file worker-route.ts
 * @description Encapsulates fallback worker routes (such as Cloudflare Workers or fetch handlers).
 */

import type { WorkerHandler } from "./types.ts";

/**
 * WorkerRoute wraps a background or edge worker handler.
 * Workers execute as a programmable fallback tier between explicit routes and static file handlers.
 */
export class WorkerRoute {
  /** Optional identifier or label for this worker. */
  readonly name?: string;
  /** The underlying handler function or object with a `fetch(req)` method. */
  readonly handler:
    | WorkerHandler
    | { fetch: (req: Request) => Promise<Response> };

  /**
   * Creates a new WorkerRoute instance.
   *
   * @param handler A worker function `(req: Request) => Promise<Response>` or object with a `fetch()` method.
   * @param name Optional descriptor name.
   */
  constructor(
    handler: WorkerHandler | { fetch: (req: Request) => Promise<Response> },
    name?: string,
  ) {
    this.handler = handler;
    this.name = name;
  }

  /**
   * Dispatches the incoming Request to the worker's handler.
   */
  execute(req: Request): Promise<Response> {
    if (typeof this.handler === "function") {
      return this.handler(req);
    }
    return this.handler.fetch(req);
  }
}
