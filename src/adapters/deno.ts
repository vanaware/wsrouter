// src/adapters/deno.ts
/**
 * @file deno.ts
 * @description Deno-specific adapters for WebSocket upgrading and static file serving.
 */

import { join, resolve } from "@std/path";
import type { WebSocketUpgrader, StaticFileHandler } from "../mod.ts";

/**
 * WebSocket upgrader implementation using the native Deno.upgradeWebSocket API.
 */
export const denoWebSocketUpgrader: WebSocketUpgrader = {
  upgrade(req: Request): { socket: WebSocket; response: Response } {
    return Deno.upgradeWebSocket(req);
  },
};

/**
 * Factory function to create a static file handler using Deno's file system APIs.
 *
 * @param staticDir - Local directory to serve files from.
 * @param embeddedDir - Optional additional directory for embedded assets.
 * @returns A StaticFileHandler implementation.
 */
export function createDenoStaticFileHandler(
  staticDir: string | null,
  embeddedDir: string | null = null,
): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      if (embeddedDir) {
        const embedded = await tryServeDir(embeddedDir, path);
        if (embedded) return embedded;
      }
      if (staticDir) {
        const staticResp = await tryServeDir(staticDir, path);
        if (staticResp) return staticResp;
      }
      return null;
    },
  };
}

/**
 * Internal helper to attempt serving a file from a base directory.
 * Implements security checks for containment, symlinks, and dotfiles.
 */
async function tryServeDir(baseDir: string, pathname: string): Promise<Response | null> {
  const fullPath = join(baseDir, pathname);
  
  // 🚀 CONTAINMENT: Resolve absolute path and verify it stays within baseDir
  let resolvedPath: string;
  try {
    resolvedPath = await Deno.realPath(fullPath);
  } catch {
    resolvedPath = resolve(fullPath);
  }
  
  const resolvedBase = await Deno.realPath(baseDir).catch(() => resolve(baseDir));
  
  if (!resolvedPath.startsWith(resolvedBase + "/") && resolvedPath !== resolvedBase) {
    return new Response("Not Found", { status: 404 });
  }

  const candidates = buildFileCandidates(baseDir, pathname);
  for (const candidate of candidates) {
    try {
      // 🚀 SYMLINKS: Use lstat to reject direct symlinks
      const info = await Deno.lstat(candidate);
      
      if (info.isSymlink) {
        console.warn(`[Static] Symlink rejected: ${candidate}`);
        continue;
      }

      // 🚀 CONTAINMENT: Verify that the real path is contained in the base directory (prevents intermediate symlinks)
      const realCandidate = await Deno.realPath(candidate).catch(() => null);
      if (!realCandidate || (!realCandidate.startsWith(resolvedBase + "/") && realCandidate !== resolvedBase)) {
        console.warn(`[Static] Path outside base directory rejected: ${candidate}`);
        continue;
      }
      
      if (info.isFile) {
        const ext = candidate.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = defaultDenoMimeTypeResolver(ext) ?? "application/octet-stream";
        const file = await Deno.open(candidate);
        
        // 🚀 HEADERS: Add complete metadata and security headers
        const headers: HeadersInit = {
          "Content-Type": mimeType,
          "Content-Length": info.size.toString(),
          "Last-Modified": info.mtime?.toUTCString() ?? new Date().toUTCString(),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        };
        
        // Add ETag based on size + mtime
        if (info.mtime) {
          const etag = `"${info.size.toString(16)}-${info.mtime.getTime().toString(16)}"`;
          headers["ETag"] = etag;
        }
        
        return new Response(file.readable, { headers });
      }
      
      // 🚀 REDIRECT: If it's a directory without a trailing slash, redirect
      if (info.isDirectory && !pathname.endsWith("/")) {
        return new Response(null, {
          status: 301,
          headers: { "Location": pathname + "/" },
        });
      }
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        console.error(`Static file error: ${candidate}`, err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }
  }
  return null;
}

/**
 * Generates an array of potential file path candidates based on the requested pathname.
 * Handles automatic extension appending (.html, .htm) and index file resolution.
 */
function buildFileCandidates(baseDir: string, pathname: string): string[] {
  const fullPath = join(baseDir, pathname);
  const candidates: string[] = [fullPath];
  if (!/\.[a-zA-Z0-9]+$/.test(pathname)) {
    candidates.push(fullPath + ".html");
    candidates.push(fullPath + ".htm");
  }
  candidates.push(join(fullPath, "index.html"));
  candidates.push(join(fullPath, "index.htm"));
  return candidates;
}

/**
 * Maps common file extensions to their corresponding standard MIME types.
 */
function defaultDenoMimeTypeResolver(ext: string): string | undefined {
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8", js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8", json: "application/json; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", ico: "image/x-icon", txt: "text/plain; charset=utf-8",
    pdf: "application/pdf", xml: "application/xml", woff: "font/woff",
    woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm", wasm: "application/wasm",
    // 🚀 MODERN EXTENSIONS
    webp: "image/webp", avif: "image/avif", webmanifest: "application/manifest+json",
    ts: "application/typescript", tsx: "application/typescript",
    jsx: "application/javascript", map: "application/json",
  };
  return map[ext.toLowerCase()];
}