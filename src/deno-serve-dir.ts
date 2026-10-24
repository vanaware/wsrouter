// src/deno-serve-dir.ts
/**
 * @file deno-serve-dir.ts
 * @description Alternative Deno entry point leveraging @std/http/file-server serveDir.
 */

import { Router } from "./mod.ts";
import { resolveFactoryOptions } from "./factory-options.ts";
import {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";

/**
 * Configuration options for creating a Deno router with serveDir static file serving.
 */
export interface DenoServeDirRouterOptions {
  /** Base URL path prefix for all registered routes. */
  basePath?: string;
  /** Directory path to serve static files from disk. */
  staticDir?: string | null;
  /** Directory path for embedded fallback static files. */
  embeddedDir?: string | null;
  /** Whether to enforce HTTPS redirects in production. */
  forceHttps?: boolean;
  /** Whether to trust reverse proxy headers like X-Forwarded-Proto. */
  trustProxy?: boolean;
  /** Whether to allow serving dotfiles (files starting with '.'). */
  allowDotfiles?: boolean;
  /** Debounce delay in milliseconds for presence broadcast throttling. */
  lastBroadcastDelay?: number;
  /** Specific options forwarded to the @std/http serveDir file server. */
  serveDir?: {
    /** Whether to display directory listings. */
    showDirListing?: boolean;
    /** Whether to enable CORS headers on served static files. */
    enableCors?: boolean;
  };
}

/**
 * Creates a pre-configured Router for Deno utilizing @std/http serveDir.
 *
 * Provides native HTTP Range requests, ETag/If-None-Match (304), and HEAD requests.
 *
 * @param basePathOrOptions - Base path prefix string or full router options object.
 * @param staticDir - Directory to serve static files from (default: "public").
 * @param embeddedDir - Optional embedded directory for fallbacks.
 * @param forceHttps - Whether to redirect HTTP requests to HTTPS.
 * @param lastBroadcastDelay - Delay in ms for broadcast debouncing.
 * @returns Configured Router instance.
 */
export function createDenoServeDirRouter(
  basePathOrOptions: string | DenoServeDirRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  const options = resolveFactoryOptions(basePathOrOptions, (basePath) => ({
    basePath,
    staticDir,
    embeddedDir,
    forceHttps,
    lastBroadcastDelay,
  }));

  const staticOptions: DenoServeDirOptions = {
    allowDotfiles: options.allowDotfiles,
    showDirListing: options.serveDir?.showDirListing ?? false,
    enableCors: options.serveDir?.enableCors ?? false,
  };

  return new Router({
    basePath: options.basePath,
    forceHttps: options.forceHttps,
    trustProxy: options.trustProxy,
    allowDotfiles: options.allowDotfiles,
    lastBroadcastDelay: options.lastBroadcastDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: options.staticDir || options.embeddedDir
      ? createDenoServeDirStaticFileHandler(
        options.staticDir ?? null,
        options.embeddedDir ?? null,
        staticOptions,
      )
      : undefined,
  });
}

// Re-export everything from the core module.
export * from "./mod.ts";
export {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";