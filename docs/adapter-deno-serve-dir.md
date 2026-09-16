# 🦕 Adaptador Alternativo: `deno-serve-dir`

O `@vanaware/wsrouter` oferece **dois adaptadores de arquivos estáticos** para Deno. Este documento descreve o adaptador alternativo baseado em `serveDir` do `@std/http/file-server`.

---

## 🎯 Motivação

O adaptador principal (`adapters/deno.ts`) implementa serving de arquivos manualmente com `Deno.open`, `Deno.lstat` e `Deno.realPath`. Isso dá controle total sobre headers e comportamento, mas:

- **Não suporta Range Requests** (necessário para vídeo/áudio/PDFs grandes)
- **Não processa `If-None-Match` / `If-Modified-Since`** (304 Not Modified)
- **~100 linhas de código** para manter

O `serveDir` do `@std/http` resolve tudo isso nativamente, pois é a implementação oficial do Deno para file serving.

---

## 📐 Arquitetura: Dois Adaptadores

```
src/adapters/
├── deno.ts              ← Manual: controle total, zero dependências extras
└── deno-serve-dir.ts    ← serveDir: Range, 304, HEAD nativos

src/
├── deno.ts              ← Entry point: createDenoRouter()
└── deno-serve-dir.ts    ← Entry point: createDenoServeDirRouter()
```

**Ambos compartilham o mesmo upgrader WebSocket** (`denoWebSocketUpgrader`), re-exportado via:

```typescript
export { denoWebSocketUpgrader } from "./deno.ts";
```

---

## 📊 Comparação

| Aspecto | `deno.ts` (Manual) | `deno-serve-dir.ts` (serveDir) |
|---|:---:|:---:|
| **Linhas de código** | ~100 | ~50 |
| **Range Requests** | ❌ | ✅ Nativo |
| **ETag / 304** | ✅ Custom (size+mtime) | ✅ Nativo (mais robusto) |
| **HEAD automático** | ✅ Via core | ✅ Via serveDir |
| **Cache-Control** | ✅ Customizável | ⚠️ Fixo |
| **Formato do ETag** | Custom: `"size-mtime"` | Interno do std |
| **Dependência extra** | Nenhuma | `@std/http` |
| **Manutenção** | Manual | Comunitária (std) |
| **Containment** | ✅ `Deno.realPath` | ✅ `resolve` |
| **Symlinks** | ✅ Recusados | ✅ Recusados |
| **Dotfiles** | ✅ Bloqueados | ✅ Bloqueados |

### Quando usar cada um?

| Cenário | Adaptador |
|---|---|
| Serve vídeo/áudio/PDFs grandes | `deno-serve-dir` |
| Precisa de 304 Not Modified | `deno-serve-dir` |
| Precisa de Cache-Control custom por arquivo | `deno` (manual) |
| Não quer dependência `@std/http` | `deno` (manual) |
| Quer menos código para manter | `deno-serve-dir` |

---

## 📝 API

### Entry Point

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
```

### `createDenoServeDirRouter(options)`

```typescript
interface DenoServeDirRouterOptions {
  basePath?: string;
  staticDir?: string | null;
  embeddedDir?: string | null;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  /** Opções específicas do serveDir */
  serveDir?: {
    showDirListing?: boolean;  // Default: false
    enableCors?: boolean;      // Default: false
  };
}
```

### `createDenoServeDirStaticFileHandler(staticDir, embeddedDir, options)`

Cria apenas o `StaticFileHandler` sem instanciar o Router completo:

```typescript
interface DenoServeDirOptions {
  allowDotfiles?: boolean;   // Default: false
  showDirListing?: boolean;  // Default: false
  enableCors?: boolean;      // Default: false
}
```

---

## 🌍 Exemplos

### Básico

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";

const app = createDenoServeDirRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({ body: "Hello!" }));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

### Com CORS e dir listing

```typescript
const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./public",
  serveDir: {
    showDirListing: true,   // Mostra listagem de diretórios
    enableCors: true,       // Adiciona headers CORS
  },
});
```

### Usando apenas o handler (sem entry point)

```typescript
import { Router } from "@vanaware/wsrouter";
import { denoWebSocketUpgrader } from "@vanaware/wsrouter/adapters/deno";
import { createDenoServeDirStaticFileHandler } from "@vanaware/wsrouter/adapters/deno-serve-dir";

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: denoWebSocketUpgrader,
  staticFileHandler: createDenoServeDirStaticFileHandler("./public", null, {
    allowDotfiles: false,
    showDirListing: false,
  }),
});
```

### Integração com server/main.ts do Loco

Substituindo o `serveDir` manual do `main.ts`:

```typescript
// ANTES (main.ts manual):
import { serveDir } from "@std/http/file-server";
const staticResponse = await serveDir(req, {
  fsRoot: "./build/dist",
  showDirListing: false,
  quiet: true,
});

// DEPOIS (com router):
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
import workerHandler from "./worker.ts";

const env = Deno.env.toObject();
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(console.error) };

const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./build/dist",
});

app.worker((req) => workerHandler.fetch(req, env, ctx));

Deno.serve({ port: Number(env.PORT || 3000) }, app.handleRequest.bind(app));
```

---

## 🔒 Segurança

O adaptador `deno-serve-dir` mantém as **mesmas políticas de segurança** do adaptador manual:

### Containment

Antes de delegar para o `serveDir`, o caminho é resolvido e verificado:

```typescript
const fullPath = resolve(baseDir, "." + pathname);
const resolvedBase = resolve(baseDir);

if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
  return null; // Path tenta escapar do diretório
}
```

### Symlinks

Symlinks são recusados com `Deno.lstat` antes de chegar ao `serveDir`:

```typescript
const info = await Deno.lstat(fullPath);
if (info.isSymlink) {
  console.warn(`[Static] Symlink recusado: ${fullPath}`);
  return null;
}
```

### Dotfiles

Controlados pela opção `allowDotfiles` (default: `false`), que é passada como `showDotfiles` para o `serveDir`.

---

## 🧪 Testes

O adaptador possui testes dedicados em `tests/adapters_serve_dir_test.ts`:

```bash
deno test tests/adapters_serve_dir_test.ts --allow-read --allow-write --allow-net --allow-env
```

Testes atuais:
- ✅ Serve arquivos existentes
- ✅ Bloqueia dotfiles por padrão

Testes recomendados para adicionar:
- ⏳ Range Request retorna 206 Partial Content
- ⏳ If-None-Match retorna 304
- ⏳ HEAD retorna headers sem body
- ⏳ Symlink é recusado
- ⏳ Path traversal é bloqueado

---

## 📋 Dependências

Este adaptador requer `@std/http` no `deno.jsonc`:

```jsonc
{
  "imports": {
    "@std/http": "jsr:@std/http@^1"
  }
}
```

O adaptador manual (`deno.ts`) **não requer** essa dependência.

---

## 📋 Resumo

| Item | Valor |
|---|---|
| **Arquivo do adaptador** | `src/adapters/deno-serve-dir.ts` |
| **Entry point** | `src/deno-serve-dir.ts` |
| **Export no deno.jsonc** | `"./adapters/deno-serve-dir"` |
| **Função principal** | `createDenoServeDirRouter()` |
| **Handler factory** | `createDenoServeDirStaticFileHandler()` |
| **Dependência** | `@std/http` |
| **Upgrader WS** | Re-exportado de `deno.ts` |
| **Segurança** | Containment + Symlinks + Dotfiles |
| **Vantagem principal** | Range Requests + 304 nativos |