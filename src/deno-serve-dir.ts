// monorepo/router/src/deno-serve-dir.ts
// 🦕 Entry point ALTERNATIVO para Deno — usa serveDir do @std/http
// Importe assim: import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";

import { Router } from "./mod.ts";
import {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";

export interface DenoServeDirRouterOptions {
  basePath?: string;
  staticDir?: string | null;
  embeddedDir?: string | null;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  /** Opções específicas do serveDir */
  serveDir?: {
    showDirListing?: boolean;
    enableCors?: boolean;
  };
}

/**
 * Cria um Router pré-configurado para Deno usando serveDir do @std/http.
 *
 * Diferença para createDenoRouter():
 * - Usa serveDir (Range, ETag/304, HEAD nativos)
 * - Cache-Control é fixo (não customizável)
 * - Requer dependência @std/http
 *
 * Use createDenoRouter() se precisar de controle total sobre headers.
 */
export function createDenoServeDirRouter(
  basePathOrOptions: string | DenoServeDirRouterOptions = "",
  staticDir: string | null = "public",
  embeddedDir: string | null = null,
  forceHttps: boolean = false,
  lastBroadcastDelay?: number,
): Router {
  let options: DenoServeDirRouterOptions;
  if (typeof basePathOrOptions === "string") {
    options = {
      basePath: basePathOrOptions,
      staticDir,
      embeddedDir,
      forceHttps,
      lastBroadcastDelay,
    };
  } else {
    options = basePathOrOptions;
  }

  const {
    basePath = "",
    staticDir: sDir = null,
    embeddedDir: eDir = null,
    forceHttps: fHttps = false,
    trustProxy = false,
    allowDotfiles = false,
    lastBroadcastDelay: lDelay,
    serveDir: serveDirOpts = {},
  } = options;

  const staticOptions: DenoServeDirOptions = {
    allowDotfiles,
    showDirListing: serveDirOpts.showDirListing ?? false,
    enableCors: serveDirOpts.enableCors ?? false,
  };

  const router = new Router({
    basePath,
    forceHttps: fHttps,
    trustProxy,
    allowDotfiles,
    lastBroadcastDelay: lDelay,
    webSocketUpgrader: denoWebSocketUpgrader,
    staticFileHandler: sDir || eDir
      ? createDenoServeDirStaticFileHandler(sDir, eDir, staticOptions)
      : undefined,
  });
  return router;
}

// Re-exporta tudo do core
export * from "./mod.ts";
export {
  denoWebSocketUpgrader,
  createDenoServeDirStaticFileHandler,
  type DenoServeDirOptions,
} from "./adapters/deno-serve-dir.ts";