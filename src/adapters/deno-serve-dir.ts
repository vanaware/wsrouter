// src/adapters/deno-serve-dir.ts
/**
 * @file deno-serve-dir.ts
 * @description Alternative Deno static file adapter using @std/http/file-server serveDir.
 */

import { serveDir } from "@std/http/file-server";
import { resolve } from "@std/path";
import type { StaticFileHandler } from "../mod.ts";

// Re-export standard WebSocket upgrader from primary adapter
export { denoWebSocketUpgrader } from "./deno.ts";

/**
 * Options for configuring the Deno serveDir static file adapter.
 */
export interface DenoServeDirOptions {
  /** Whether to allow serving dotfiles (files starting with '.') (default: false). */
  allowDotfiles?: boolean;
  /** Whether to display directory listings (default: false). */
  showDirListing?: boolean;
  /** Whether to enable CORS headers on served static files (default: false). */
  enableCors?: boolean;
}

/**
 * Creates a static file handler leveraging @std/http/file-server serveDir.
 *
 * @param staticDir - Primary directory to serve static files from.
 * @param embeddedDir - Optional embedded fallback directory.
 * @param options - Additional serveDir options.
 * @returns Configured StaticFileHandler instance.
 */
export function createDenoServeDirStaticFileHandler(
  staticDir: string | null,
  embeddedDir: string | null = null,
  options: DenoServeDirOptions = {},
): StaticFileHandler {
  const {
    allowDotfiles = false,
    showDirListing = false,
    enableCors = false,
  } = options;

  return {
    async handle(path: string): Promise<Response | null> {
      // Try embedded directory first, then static dir (same logic as the manual adapter)
      if (embeddedDir) {
        const res = await tryServeWithStd(
          embeddedDir, path, allowDotfiles, showDirListing, enableCors,
        );
        if (res) return res;
      }
      if (staticDir) {
        const res = await tryServeWithStd(
          staticDir, path, allowDotfiles, showDirListing, enableCors,
        );
        if (res) return res;
      }
      return null;
    },
  };
}

async function tryServeWithStd(
  baseDir: string,
  pathname: string,
  allowDotfiles: boolean,
  showDirListing: boolean,
  enableCors: boolean,
): Promise<Response | null> {
  // 🛡️ CONTAINMENT: resolve the path and verify it stays inside baseDir
  const fullPath = resolve(baseDir, "." + pathname);
  const resolvedBase = resolve(baseDir);

  if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
    return null; // Path attempts to escape the directory
  }

  // 🛡️ SYMLINKS: reject symlinks (same policy as the manual adapter)
  try {
    const info = await Deno.lstat(fullPath);
    if (info.isSymlink) {
      console.warn(`[Static] Symlink rejected: ${fullPath}`);
      return null;
    }
  } catch {
    // File does not exist — serveDir would return 404, so return null
    return null;
  }

  // 🚀 Delegate to serveDir (Range, ETag, 304, HEAD, etc.)
  const fakeReq = new Request(`http://localhost${pathname}`);
  const res = await serveDir(fakeReq, {
    fsRoot: baseDir,
    urlRoot: "",
    showDirListing,
    showDotfiles: allowDotfiles,
    showIndex: true,
    quiet: true,
    enableCors,
  });

  // serveDir returns 404 when nothing is found
  if (res.status === 404) return null;

  return res;
}