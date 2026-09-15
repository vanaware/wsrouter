// monorepo/router/src/adapters/deno-serve-dir.ts
// 🦕 Adaptador Deno ALTERNATIVO — usa serveDir do @std/http/file-server
// Mantém containment + recusa de symlinks, mas delega o serving para o std.
// Ganhos: Range Requests, ETag/If-None-Match (304), HEAD nativo, menos código.

import { serveDir } from "@std/http/file-server";
import { resolve } from "@std/path";
import type { StaticFileHandler } from "../mod.ts";

// Re-exporta o mesmo upgrader WebSocket do adaptador principal
export { denoWebSocketUpgrader } from "./deno.ts";

export interface DenoServeDirOptions {
  /** Permitir arquivos que começam com '.' (default: false) */
  allowDotfiles?: boolean;
  /** Mostrar listagem de diretórios (default: false) */
  showDirListing?: boolean;
  /** Habilitar CORS nos arquivos estáticos (default: false) */
  enableCors?: boolean;
}

/**
 * Cria um handler de arquivos estáticos usando serveDir do @std/http.
 *
 * Vantagens sobre o adaptador manual (deno.ts):
 * - Range Requests (vídeo, áudio, PDFs grandes)
 * - ETag + If-None-Match → 304 Not Modified
 * - Last-Modified + If-Modified-Since → 304
 * - HEAD automático
 * - Menos código para manter
 *
 * Desvantagens:
 * - Cache-Control fixo (não customizável por arquivo)
 * - Formato do ETag é interno do std
 * - Dependência extra: @std/http
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
      // Tenta embedded primeiro, depois static (mesma lógica do adaptador manual)
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
  // 🛡️ CONTAINMENT: resolver caminho e verificar que está dentro de baseDir
  const fullPath = resolve(baseDir, "." + pathname);
  const resolvedBase = resolve(baseDir);

  if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
    return null; // Path tenta escapar do diretório
  }

  // 🛡️ SYMLINKS: recusar symlinks (mesma política do adaptador manual)
  try {
    const info = await Deno.lstat(fullPath);
    if (info.isSymlink) {
      console.warn(`[Static] Symlink recusado: ${fullPath}`);
      return null;
    }
  } catch {
    // Arquivo não existe — serveDir retornará 404, retornamos null
    return null;
  }

  // 🚀 Delega para serveDir (Range, ETag, 304, HEAD, etc.)
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

  // serveDir retorna 404 quando não encontra
  if (res.status === 404) return null;

  return res;
}