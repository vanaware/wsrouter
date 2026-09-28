// src/deno.ts
/**
 * @file deno.ts
 * @description Entry point for the Deno-specific router factory.
 */
import { Router } from "./mod.ts";
import { denoWebSocketUpgrader, createDenoStaticFileHandler } from "./adapters/deno.ts";

/**
 * Options for configuring a Deno-specific Router.
 */
export interface DenoRouterOptions {
  /** Optional base prefix path for all routes. */
  basePath?: string;
  /** Optional local directory path for serving static files. */
  staticDir?: string | null;
  /** Optional directory path for serving embedded assets. */
  embeddedDir?: string | null;
  /** When enabled, redirects unencrypted HTTP traffic to HTTPS. */
  forceHttps?: boolean;
  /** When enabled, inspects `X-Forwarded-Proto` header from reverse proxies. */
  trustProxy?: boolean;
  /** When enabled, allows serving hidden dotfiles. */
  allowDotfiles?: boolean;
  /** Default debounce delay (in ms) for replaying last broadcast to joining sockets. */
  lastBroadcastDelay?: number;
}

/**
 * Factory function to create a Router pre-configured for the Deno runtime.
 *
 * @param basePathOrOptions - Base path string or full options object.
 * @param staticDir - Directory to serve static files from (default: "public").
 * @param embeddedDir - Optional directory for embedded assets.
 * @param forceHttps - Whether to enforce HTTPS redirects.
 * @param lastBroadcastDelay - Optional delay for last broadcast replay.
 * @returns A Router instance configured with Deno-native adapters.
 *
 * @example
 * ```ts
 * const app = createDenoRouter({
 *   basePath: "/api",
 *   staticDir: "./public"
 * });
 * ```
 */
export function createDenoRouter(
  basePathOrOptions: string | DenoRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  let options: DenoRouterOptions;
  if (typeof basePathOrOptions === "string") {
    options = { basePath: basePathOrOptions, staticDir, embeddedDir, forceHttps, lastBroadcastDelay };
  } else {
    options = basePathOrOptions;
  }

  const {
    basePath = "",
    staticDir: sDir = null, // 🚀 MUDANÇA: Default null no options object
    embeddedDir: eDir = null,
    forceHttps: fHttps = false,
    trustProxy = false,
    allowDotfiles = false,
    lastBroadcastDelay: lDelay,
  } = options;

  const router = new Router({
    basePath,
    forceHttps: fHttps,
    trustProxy,
    allowDotfiles,
    lastBroadcastDelay: lDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: sDir || eDir ? createDenoStaticFileHandler(sDir, eDir) : undefined,
  });
  return router;
}

export * from "./mod.ts";
export { denoWebSocketUpgrader, createDenoStaticFileHandler } from "./adapters/deno.ts";