> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém a DOCUMENTAÇÃO e diretrizes arquiteturais do projeto.
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: DOCS

Gerado automaticamente em: 2026-10-01T22:35:55.033Z

---

## Arquivo: `.tool-versions`

```tool-versions
deno 2.9.7
```

---

## Arquivo: `CHANGELOG.md`

```md
## v0.4 (2026-09-29)

- Sem alterações relevantes

## v0.4 (2026-09-29)

- b711734 versão derivada pelo deno.jsonc
- e6a69c0 chore: update default remote backend URL
- ee1f71d build: remove unused dependencies and optimize CORS
- 8d5722b static dir on example to deno deploy test
- 5335eb0 chore: prune unused dependencies and update CORS
- 62ea5c9 index title version

## v0.1.0 (2025-07-17)

Initial release
```

---

## Arquivo: `LICENSE`

```license
MIT License

Copyright (c) 2025 Vanaware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

---

## Arquivo: `README.md`

````md
# wsrouter

A high-performance, runtime-agnostic WebSocket and HTTP router for Deno. Fast, secure, and extensible.

## Installation

```bash
deno add jsr:@vanaware/wsrouter
```

## Usage

### Simple HTTP Server

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({
  body: JSON.stringify({ message: "Hello, World!" }),
  init: { headers: { "Content-Type": "application/json" } },
}));

app.get("/users/:id", (_req, params) => ({
  body: JSON.stringify({ userId: params.id }),
}));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Server running on http://localhost:3000");
```

### WebSocket Chat with Rooms

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room/:user", (ws, _req, params) => {
  const room = params.room as string;
  const user = params.user as string;
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  if (!group) {
    ws.close(1011, "Internal error");
    return;
  }
  
  console.log(`✅ ${user} joined room ${room}`);
  
  ws.onmessage = (event) => {
    // Broadcast only to users in the same room
    group.broadcast(
      `[${user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  ws.onclose = () => {
    console.log(`❌ ${user} left room ${room}`);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

## Features

- ✅ **HTTP Routing**: Named parameters, catch-all routes, automatic HEAD support, and 405 Method Not Allowed handling.
- ✅ **WebSockets**: Automatic upgrades, smart broadcasting with `PermissionFn`, and multi-room support.
- ✅ **WebRTC Signaling**: High-performance hub for P2P signaling (SDP, ICE candidates) and live stream management.
- ✅ **Online Presence**: Real-time tracking of users with multi-tab/multi-device deduplication and status updates.
- ✅ **Middlewares**: Onion-model execution chain with `next()` and route rewriting capabilities.
- ✅ **Security**: Force HTTPS, HSTS, trust proxy support, dotfile blocking, and path traversal protection.
- ✅ **Static Files**: Fast serving of local directories with directory indexing and MIME type detection.

## Documentation

For full API reference and advanced guides, visit the
[JSR package page](https://jsr.io/@vanaware/wsrouter).

## Guides

- [WebRTC Live Streaming Guide](./docs/webrtc.md)
- [Online Presence Tracking Guide](./docs/presence.md)
- [Security Guide](./docs/security.md)
- [Middleware Guide](./docs/middleware.md)

## License

MIT - see [LICENSE](./LICENSE) for details.


## 📦 Últimas Atualizações

<!-- START:changelog -->
### 📦 Últimas atualizações

- Sem alterações relevantes

<!-- END:changelog -->

````

---

## Arquivo: `docs/adapter-deno-serve-dir.md`

````md
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
````

---

## Arquivo: `docs/middleware.md`

````md
# 🎯 Sim, Middleware cabe perfeitamente no WebSocket!

Na verdade, é **onde ele brilha mais**, pois permite autenticar **antes** do upgrade (evitando criar conexões não autorizadas), em vez de validar dentro do handler quando o socket já está aberto.

## 📊 Como Funciona o Fluxo

```
Request → Force HTTPS? → Rota encontrada? → MIDDLEWARES → Handler final
                ↓                                    ↓
              301                          Se retornar Response → ABORTA
                                           Se chamar next() → continua
```

**Para HTTP:** `next()` executa o handler da rota.
**Para WS:** `next()` faz o `Deno.upgradeWebSocket` e inicia o grupo.

Se um middleware retornar uma `Response` (ex: `401`), o upgrade **nunca acontece**.


---

## 🌍 Exemplos Práticos

### Exemplo 1: Autenticação JWT via Subprotocol (agora como middleware!)

O exemplo do `jwt/main.ts` fica **muito mais limpo**. Toda a validação sai do handler:

```typescript
import { Router } from "../../src/mod.ts";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = "meu-segredo-super-secreto-123";
const encoder = new TextEncoder();

const app = new Router({ basePath: "/api" });

// ✅ Middleware de autenticação: bloqueia ANTES do upgrade
app.use(async (req, _params, next) => {
  // Só aplica em rotas WebSocket
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return await next();
  }

  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map((p) => p.trim());
  const bearerIndex = protocols.findIndex((p) => p === "Bearer");
  const token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;

  if (!token) {
    console.error("[Middleware] ❌ Token ausente");
    return new Response("Token required", { status: 401 });
  }

  try {
    await jwtVerify(token, encoder.encode(JWT_SECRET));
    console.log("[Middleware] ✅ Token válido, permitindo upgrade");
    return await next(); // Prossegue com o upgrade
  } catch {
    console.error("[Middleware] ❌ Token inválido");
    return new Response("Invalid token", { status: 403 });
  }
});

// Handler WS agora fica limpo — só lógica de negócio
app.ws("/chat/:room", (ws, _req, params) => {
  const room = params.room as string;
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;

  ws.onmessage = (event) => {
    group.broadcast(
      `[room ${room}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params,
    );
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

### Exemplo 2: Logging + Rate Limiting

```typescript
// Logging de todas as requisições (HTTP + WS)
app.use(async (req, params, next) => {
  const start = Date.now();
  const res = await next();
  const ms = Date.now() - start;
  const isWs = req.headers.get("upgrade") === "websocket";
  console.log(`📝 [${isWs ? "WS" : "HTTP"}] ${req.method} ${req.url} → ${res.status} (${ms}ms)`);
  return res;
});

// Rate limiting por IP (simples, em memória)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return await next();
  }

  entry.count++;
  if (entry.count > 100) {
    return new Response("Too Many Requests", { status: 429 });
  }
  return await next();
});
```

### Exemplo 3: Manutenção Programada

```typescript
let maintenanceMode = false;

app.use(async (_req, _params, next) => {
  if (maintenanceMode) {
    return new Response("🔧 Em manutenção", {
      status: 503,
      headers: { "Retry-After": "300" },
    });
  }
  return await next();
});
```

### Exemplo 4: Middleware Escopado por Path e State/Meta

Você pode aplicar middlewares apenas a caminhos específicos e compartilhar metadados (como usuário autenticado) através do terceiro parâmetro de contexto ou headers:

```typescript
// Executa apenas para rotas que iniciam com /admin/*
app.use("/admin/*", async (req, params, next, ctx) => {
  const token = req.headers.get("Authorization");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Anexa metadados ao state compartilhado
  if (ctx) {
    ctx.state.authorizedUser = { id: "user-123", role: "admin" };
  }
  return await next();
});
```

---

## 🏗️ Arquitetura Modular Interna

A engine de middlewares foi modularizada em classes dedicadas:
- **`MiddlewareRoute`** (`src/middleware-route.ts`): Encapsula a função de middleware e o padrão opcional de rota (como `/api/*` ou wildcard global).
- **`MiddlewareChain`** (`src/middleware-chain.ts`): Executa o padrão Onion (cebola), passando requisições recursivamente com suporte a `RequestContext` (`req`, `params`, `state`).

---

## 📊 Comparação: Middleware vs PermissionFn

| Aspecto | `app.use()` (Middleware) | `permissionFn` (Broadcast) |
|---|---|---|
| **Quando roda** | No momento da conexão/requisição | A cada mensagem broadcastada |
| **O que controla** | Se a conexão/requisição é aceita | Quem recebe cada mensagem |
| **Acesso ao WebSocket** | ❌ Não (ainda não foi criado) | ✅ Sim (sockets já conectados) |
| **Acesso à Request** | ✅ Sim (headers, URL, method) | ❌ Não |
| **Caso de uso** | Auth, rate limit, logging, CORS | Isolamento de salas, filtros de conteúdo |

**Eles se complementam:** Middleware controla **quem entra**, `permissionFn` controla **quem ouve o quê**.

---

## ⚠️ Pontos Importantes

1. **Ordem importa:** Middlewares são executados na ordem em que foram registrados com `app.use()`.
2. **Executam em todas as requisições:** Middlewares rodam para todas as 
   requisições, incluindo 404, arquivos estáticos e rotas não encontradas.
   Isso permite logging global, CORS e rate limiting universais.
3. **Abortar o upgrade:** Se um middleware retornar `Response` sem chamar `next()` em uma rota WS, o upgrade nunca acontece — o cliente recebe uma resposta HTTP normal (ex: 401).
4. **Params disponíveis:** O middleware recebe os `params` já extraídos da rota, permitindo lógica como "bloquear acesso à sala X".

````

---

## Arquivo: `docs/presence.md`

````md
# 👥 Online Presence Tracking Suite

`@vanaware/wsrouter` includes a built-in `PresenceTracker` engine for tracking online users, status states (e.g. *Online*, *Away*, *Busy*, *In Meeting*), custom metadata, and handling multi-tab connections without duplicate events.

---

## ✨ Features

- **Initial State Snapshots (`presence_state`)**: New WebSocket connections immediately receive a complete roster of online users.
- **Real-Time Diff Broadcasts**: Automatically emits `presence_join`, `presence_leave`, and `presence_update` events to group peers.
- **Multi-Tab Deduplication**: Sockets are grouped by `userId`. When a user opens 3 tabs, an internal `connections` counter increases to 3 without firing extra `presence_join` messages. A `presence_leave` event is only fired when their last tab closes.
- **Dead Connection Pruning**: Automatically detects and prunes disconnected/closed sockets to prevent ghost entries.
- **WebSocketGroup & Router Integration**: Direct helper methods on `WebSocketGroup` and `Router`.

---

## 🚀 Server-Side Setup

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room", (ws, req, params) => {
  const room = (params.room as string) || "lobby";
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "anonymous";
  const name = url.searchParams.get("name") || "Guest";

  // Automatically registers presence and announces presence_join/presence_state
  group.track(ws, {
    userId,
    name,
    status: "online",
    statusMessage: "Coding with WsRouter",
    room,
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "update_status") {
        // Broadcasts presence_update to everyone in the room
        group.updatePresence(ws, {
          status: data.status,
          statusMessage: data.statusMessage,
        });
      }
    } catch {
      // Handle standard chat messages
    }
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 Presence Events Protocol

Clients receive typed JSON payloads:

### 1. `presence_state` (Snapshot)
Sent exclusively to a newly connected client:
```json
{
  "type": "presence_state",
  "users": [
    {
      "userId": "user-1",
      "name": "Alice",
      "status": "online",
      "joinedAt": 1726500000000,
      "connections": 1
    }
  ]
}
```

### 2. `presence_join` (Broadcast)
Sent to peers when a new user enters:
```json
{
  "type": "presence_join",
  "user": {
    "userId": "user-2",
    "name": "Bob",
    "status": "online",
    "joinedAt": 1726500010000,
    "connections": 1
  }
}
```

### 3. `presence_leave` (Broadcast)
Sent when a user's final connection closes:
```json
{
  "type": "presence_leave",
  "userId": "user-2"
}
```

### 4. `presence_update` (Broadcast)
Sent when user metadata is updated:
```json
{
  "type": "presence_update",
  "user": {
    "userId": "user-1",
    "name": "Alice",
    "status": "busy",
    "statusMessage": "In a call"
  }
}
```

---

## 🛠️ API Reference

### `WebSocketGroup` Presence Methods
- `group.track(ws, user)`: Associates socket with identity and emits snapshot/join diffs.
- `group.untrack(ws)`: Disassociates socket and emits leave diff if no more tabs exist.
- `group.updatePresence(wsOrUserId, partialData)`: Merges new data and emits `presence_update`.
- `group.getPresenceList()`: Snapshot array of all online `PresenceUser` objects.
- `group.getPresenceUser(userId)`: Looks up a specific user record.
- `group.presenceSize`: Count of unique online users.

### `Router` Presence Methods
- `router.getPresence(pathOrPattern)`: Gets online users for a route pattern.
- `router.getPresenceUser(pathOrPattern, userId)`: Looks up a user on a route pattern.

````

---

## Arquivo: `docs/publish-jsr-rules.md`

`````md
# Diretrizes de Documentação e Publicação no JSR

> **Nota para Agentes de IA:** Este documento define os padrões obrigatórios para documentação (README.md e JSDoc) e as regras de configuração do `deno.json` para publicação no JSR. Siga estas diretrizes rigorosamente ao gerar ou refatorar código neste repositório.

---

## 📌 Sumário

1. [Visão Geral](#-visão-geral)
2. [Padrões para o README.md](#-padrões-para-o-readmemd)
3. [Padrões para Comentários JSDoc](#-padrões-para-comentários-jsdoc)
4. [Recomendações de Uso e Qualidade](#-recomendações-de-uso-e-qualidade)
5. [Configuração de `publish: false` em Workspaces](#-configuração-de-publish-false-em-workspaces)
6. [Configuração de `publish.include` e `publish.exclude`](#-configuração-de-publishinclude-e-publishexclude)
7. [Checklist Antes de Publicar](#-checklist-antes-de-publicar)

---

## 🎯 Visão Geral

Todo pacote publicado no JSR deve ter **duas camadas de documentação**:

| Camada | Arquivo/Local | Propósito | Público-Alvo |
| :--- | :--- | :--- | :--- |
| **Guia Rápido** | `README.md` na raiz | Explicar *por que* usar o pacote e como começar. | Desenvolvedores avaliando adotar o pacote. |
| **Referência da API** | Comentários JSDoc no código | Documentar *como* usar cada símbolo exportado. | Desenvolvedores que já usam o pacote. |

Ambas as camadas impactam diretamente a **pontuação de qualidade do JSR** e a experiência do usuário final (incluindo autocompletar no editor).

---

## 📝 Padrões para o README.md

### Localização e Formato
- **Arquivo:** `README.md` 
- **Localização:** Obrigatório, na raiz do pacote, não é o mesmo README da raiz do worspace, cada pacote a ser publicado precisa de seu próprio README.
- **Sintaxe:** Markdown padrão (GFM - GitHub Flavored Markdown).
- **Idioma:** Inglês (mantenha consistência e use o mesmo idioma em toda a documentação a ser publicada).

### Estrutura Obrigatória

O README **deve** conter, no mínimo, as seguintes seções nesta ordem:

1. **Título** (`# Nome do Pacote`) — usar o nome real do pacote, sem o escopo.
2. **Descrição curta** — uma ou duas frases explicando o que o pacote faz.
3. **Instalação** — bloco de código com o comando `deno add`.
4. **Uso Básico** — **obrigatório** um bloco de código funcional mostrando import + uso real.
5. **Documentação** — link para a página do pacote no JSR (referência da API).

### Estrutura Recomendada (Adicional)

- **Features** — lista de bullets com os principais recursos.
- **API Overview** — tabela ou lista dos principais exports.
- **Exemplos Avançados** — casos de uso além do "hello world".

### Exemplo de Template

````markdown
# nome-do-pacote

Uma breve descrição de uma ou duas frases sobre o que este pacote faz.

## Instalação

```bash
deno add jsr:@seu-escopo/nome-do-pacote
```

## Uso

```ts
import { funcaoPrincipal } from "jsr:@seu-escopo/nome-do-pacote";

const resultado = funcaoPrincipal({ opcao: "valor" });
console.log(resultado);
```

## Features

- ✅ Recurso A
- ✅ Recurso B
- ✅ Recurso C

## Documentação

Para a referência completa da API, visite a
[página do pacote no JSR](https://jsr.io/@vanaware/nome-do-pacote).

````

### ⚠️ Regras Críticas
- **NUNCA** deixe o README vazio ou com apenas o título.
- **SEMPRE** inclua um bloco de código no README — o JSR usa isso para pontuar o pacote.
- **NÃO** duplique toda a documentação JSDoc aqui; o README é visão geral, não referência.

---

## 📚 Padrões para Comentários JSDoc

### Regras Gerais
- **Local:** Imediatamente acima de **cada símbolo exportado** (função, classe, interface, tipo, constante).
- **Sintaxe:** Bloco `/** ... */` com cada linha interna iniciando por `*`.
- **Idioma:** Manter o mesmo do README.
- **Obrigatoriedade:** Todo `export` **deve** ter JSDoc. Sem exceção.

### Estrutura do Bloco

1. **Resumo** (primeira linha) — frase curta e imperativa. Aparece em tooltips do editor.
2. **Descrição detalhada** (opcional) — parágrafo(s) adicional(is) com contexto.
3. **Tags** — na ordem: `@param`, `@returns`, `@throws`, `@example`, `@see`.
4. **Exemplo** — sempre que a função não for trivial.

### Exemplo Completo — Função

````ts
/**
 * Busca registros no banco de dados usando a consulta fornecida.
 *
 * Realiza normalização de entrada e aplica limite padrão quando não
 * especificado, evitando sobrecarga em consultas muito amplas.
 *
 * @param query - Consulta textual. Deve ter entre 1 e 50 caracteres.
 * @param limit - Número máximo de itens a retornar. Padrão: `20`.
 * @returns Array com os registros encontrados. Vazio se nada corresponder.
 * @throws {Error} Se `query` estiver vazia ou exceder 50 caracteres.
 *
 * @example
 * ```ts
 * const resultados = search("Deno");
 * console.log(resultados); // ["Deno", "Deno Deploy"]
 * ```
 *
 * @see {@link normalizeQuery} para detalhes da normalização.
 */
export function search(query: string, limit: number = 20): string[] {
  // ...
}
````

### Exemplo Completo — Interface / Tipo

````ts
/**
 * Opções aceitas pelo cliente HTTP.
 */
export interface ClientOptions {
  /** URL base para todas as requisições. */
  baseUrl: string;

  /** Tempo limite em milissegundos. Padrão: `5000`. */
  timeout?: number;

  /** Cabeçalhos adicionais enviados em cada requisição. */
  headers?: Record<string, string>;
}
````

### Exemplo Completo — Classe

````ts
/**
 * Cliente HTTP leve com suporte a retry automático.
 *
 * @example
 * ```ts
 * const client = new Client({ baseUrl: "https://api.example.com" });
 * const data = await client.get("/users");
 * ```
 */
export class Client {
  /**
   * Cria uma nova instância do cliente.
   *
   * @param options - Configurações do cliente.
   */
  constructor(options: ClientOptions) {
    // ...
  }

  /**
   * Executa uma requisição GET.
   *
   * @param path - Caminho relativo à `baseUrl`.
   * @returns Resposta parseada como JSON.
   */
  async get<T>(path: string): Promise<T> {
    // ...
  }
}
````

### Tags Suportadas e Quando Usar

| Tag | Uso |
| :--- | :--- |
| `@param` | Descrever **cada** parâmetro. Use `-` após o nome. |
| `@returns` | Descrever o valor de retorno (omita apenas se `void`). |
| `@throws` | Tipos e condições de erro lançados. |
| `@example` | Bloco de código executável. Sempre em cercas ` ```ts `. |
| `@see` | Referência cruzada. Combine com `{@link Symbol}`. |
| `@deprecated` | Marcar símbolos obsoletos e indicar substituto. |
| `@since` | Versão em que o símbolo foi introduzido. |

### Links Internos
Use `{@link <Símbolo>}` para criar links clicáveis entre símbolos na documentação gerada:

```ts
/**
 * Atalho para {@link Client.get} com timeout customizado.
 */
export function quickGet(path: string) { /* ... */ }
```

### ⚠️ Regras Críticas
- **NÃO** use JSDoc para comentários internos de linha — use `//`.
- **NÃO** documente símbolos não exportados (a menos que sejam úteis para contexto).
- **SEMPRE** coloque o `@example` **após** `@returns`/`@throws`.
- **NUNCA** escreva "TODO" dentro de JSDoc; use comentários normais.

---

## ✅ Recomendações de Uso e Qualidade

1. **README e JSDoc são complementares** — nunca um substitui o outro.
2. **Escreva exemplos reais** — evite `foo`/`bar`; use nomes que reflitam o domínio.
3. **Mantenha o README curto** — se passar de ~150 linhas, crie uma pasta `docs/` dentro do diretório do pacote.
4. **Valide antes de commitar:**
   ```bash
   deno doc --lint mod.ts
   ```
   Isso aponta exports sem JSDoc e tags malformadas.
5. **Valide antes de publicar:**
   ```bash
   deno publish --dry-run
   ```
   Inspecione o output para confirmar que apenas os arquivos desejados serão enviados.
6. **Atualize o JSDoc ao refatorar** — nunca deixe documentação divergente do código.
7. **Use `@deprecated`** ao invés de remover símbolos abruptamente — quebre consumidores com aviso.

---

## 🏢 Configuração de `publish: false` em Workspaces

Em um **workspace Deno** (definido por `workspace` no `deno.json` raiz), o comando `deno publish` tenta publicar **todos os membros** que possuem `name` e `exports`.

Para **excluir um membro interno** (pacotes utilitários compartilhados, ferramentas de build, etc.), defina `"publish": false` no `deno.json` desse membro.

### Estrutura Real no WorkerDB

No monorepo do WorkerDB, temos múltiplos pacotes publicados e pacotes de aplicação/infraestrutura interna:

```
/
├── deno.jsonc                 # workspace raiz
├── packages/
│   ├── worker-db/             # publicado no JSR como @vanaware/workerdb
│   │   └── deno.jsonc
│   ├── service-worker/        # publicado no JSR como @vanaware/opfs-explorer
│   │   └── deno.jsonc
│   ├── ui/                    # app frontend (publish: false)
│   │   └── deno.jsonc
│   ├── server/                # dev/prod server Deno (publish: false)
│   │   └── deno.jsonc
│   └── utils/                 # scripts de bundling/build (publish: false)
│       └── deno.jsonc
```

O workflow de CI/CD em `.github/workflows/jsr-publish.yml` executa a matriz de publicação automatizada para `packages/worker-db` e `packages/service-worker`.

### Estrutura de Exemplo Genérica

```
/
├── deno.json              # workspace raiz
├── packages/
│   ├── core/
│   │   └── deno.json      # publicado no JSR
│   ├── utils-internal/
│   │   └── deno.json      # NÃO publicado
│   └── cli/
│       └── deno.json      # publicado no JSR
```

### `deno.json` raiz (workspace)

```json
{
  "workspace": [
    "./packages/core",
    "./packages/utils-internal",
    "./packages/cli"
  ]
}
```

### `packages/core/deno.json` (publicado)

```json
{
  "name": "@seu-escopo/core",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT"
}
```
> **Importante:** Caso os campos license e version não estejam configurados no deno.jsonc (ou deno.json) do pacote, configure com o mesmo valor encontrado no deno.jsonc raiz do workspace.

### `packages/utils-internal/deno.json` (NÃO publicado)

```json
{
  "name": "@seu-escopo/utils-internal",
  "version": "0.0.0",
  "exports": "./mod.ts",
  "publish": false
}
```

> **Importante:** Mesmo com `publish: false`, o pacote ainda pode ser importado por outros membros do workspace via `jsr:@seu-escopo/utils-internal` durante o desenvolvimento. Ele apenas não será enviado ao registro.

> **Regra fundamental:** Caso alguma função do pacote que não será publicado esteja em uso por um pacote que será publicado, o desenvolvedor deverá ser alertado e uma documentação de BUG deve ser criada com todas as referidas funções que deverão ser analisadas e devidamente tratadas antes da publicação do pacote.

---

## 🗂️ Configuração de `publish.include` e `publish.exclude`

### Regras Básicas
- Os padrões são avaliados **relativos à raiz do pacote** (onde está o `deno.json` do pacote a ser publicado).
- Use **globs POSIX** com `/` como separador (funciona em Windows também).
- **`publish.include`** — lista branca. Se definido, **somente** o que casar será publicado.
- **`publish.exclude`** — lista negra. Aplicada **após** o `include`.
- Se apenas `exclude` for definido, tudo é incluído por padrão e depois filtrado.
- **NUNCA** inclua `deno.json` no `exclude` — ele é sempre publicado automaticamente.

### Globs Recomendados

#### Incluir apenas o código-fonte publicável

```json
{
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ]
  }
}
```

#### Excluir arquivos de desenvolvimento

```json
{
  "publish": {
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "tests/",
      "test/",
      "bench/",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "TODO.md",
      "CHANGELOG.md",
      ".github/",
      "*.config.ts",
      "build.ts",
      "bundle.ts",
      "deploy.ts",
      "deno.lock",
      ".gitignore"
    ]
  }
}
```

### Combinação Recomendada (Include + Exclude)

A abordagem mais segura é **combinar ambos**: um `include` restritivo que define o que é código, e um `exclude` para varrer resíduos.

```json
{
  "name": "@seu-escopo/seu-pacote",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT",
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ],
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "src/**/__mocks__/**",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "CHANGELOG.md",
      ".github/"
    ]
  }
}
```

### Mapa de Decisão: Incluir ou Excluir?

| Arquivo/Pasta | Ação | Justificativa |
| :--- | :--- | :--- |
| `src/**/*.ts` | ✅ Incluir | Código-fonte principal. |
| `mod.ts` | ✅ Incluir | Ponto de entrada principal. |
| `README.md` | ✅ Incluir | Exibido no JSR. |
| `**/*_test.ts` | ❌ Excluir | Testes não vão para o registro. |
| `tests/`, `test/` | ❌ Excluir | Idem. |
| `examples/` | ❌ Excluir | Exemplos grandes ou não-API. |
| `scripts/` | ❌ Excluir | Scripts de build/deploy. |
| `build.ts`, `bundle.ts`, `deploy.ts` | ❌ Excluir | Ferramentas de dev. |
| `docs/` | ❌ Excluir o docs da raiz pode incluir o subset do pacote | Documentação estendida da raiz do workspace fica no repo, documentação essencial reduzida do pacote pode incluir. |
| `planning/` | ❌ Excluir | Planejamento interno. |
| `AGENTS.md`, `CURRENT.md` | ❌ Excluir | Metadados para agentes de IA. |
| `CHANGELOG.md` | ⚠️ Excluir | Útil para consumidores, mas aumenta o pacote. |
| `deno.lock` | ❌ Excluir | Reconstruído pelo consumidor. |
| `.github/` | ❌ Excluir | CI/CD. |
| `deno.json` | 🚫 Nunca listar | Sempre publicado automaticamente. |

### Padrões Glob de Referência

| Padrão | Casa com |
| :--- | :--- |
| `src/**/*.ts` | Todos os `.ts` em `src/` recursivamente. |
| `**/*_test.ts` | Qualquer arquivo terminando em `_test.ts`. |
| `**/*.test.ts` | Qualquer arquivo terminando em `.test.ts`. |
| `test/` | Todo o diretório `test/`. |
| `**/__mocks__/**` | Qualquer diretório `__mocks__` em qualquer nível. |
| `scripts/**` | Tudo dentro de `scripts/`. |
| `*.config.ts` | Arquivos `.config.ts` na raiz. |

### ⚠️ Erros Comuns a Evitar
- **Não** use `./` no início dos padrões (`"./src/**"` ❌ → `"src/**"` ✅).
- **Não** use `\` como separador — sempre `/`.
- **Não** inclua `deno.json` no `exclude` — quebra a publicação.
- **Não** use `include` e `exclude` contraditórios (ex: incluir `src/**` e excluir `src/`).
- **Sempre** valide com `deno publish --dry-run` antes de publicar de verdade.

---

## ✅ Checklist Antes de Publicar

Execute na ordem:

- [ ] `deno fmt --check` — formatação consistente.
- [ ] `deno lint` — sem avisos.
- [ ] `deno check mod.ts` — sem erros de tipo.
- [ ] `deno test` — todos os testes passando.
- [ ] `deno doc --lint mod.ts` — sem exports sem JSDoc.
- [ ] `README.md` revisado e com bloco de código de exemplo.
- [ ] `deno.jsonc` com `name`, `version`, `exports`, `license` corretos.
- [ ] `publish.include` e `publish.exclude` revisados.
- [ ] `deno publish --dry-run` — inspecionar arquivos listados.
- [ ] Versão incrementada conforme SemVer, temos um script de sanitização a ser executado antes da publicação.
- [ ] `deno publish` — publicar de fato.

---

## 📎 Referências

- [Documentação oficial do JSR](https://jsr.io/docs)
- [Escrevendo documentação para JSR](https://jsr.io/docs/writing-docs)
- [Configuração `deno.jsonc`](https://docs.deno.com/runtime/fundamentals/configuration/)
- [Globs no Deno](https://docs.deno.com/runtime/fundamentals/configuration/#glob-patterns)
`````

---

## Arquivo: `docs/return.md`

````md
# Possibilidades de Retorno dos Handlers HTTP

Os handlers HTTP no `@vanaware/wsrouter` oferecem **duas formas flexíveis de retorno**:

1. **Instância nativa de `Response`** (padrão Web API)
2. **Objeto com `{ body, init }`** (formato ergonômico simplificado)

---

## 🚀 1. Retorno de `Response` Nativo (Web Standard)

Você pode retornar diretamente qualquer instância de `Response` nativa, incluindo helpers como `Response.json()` ou `new Response(...)`:

```typescript
// Resposta simples com texto
app.get("/ping", () => new Response("pong"));

// JSON com helper nativo Response.json()
app.get("/api/users", () => {
  return Response.json({ users: ["Alice", "Bob"] }, { status: 200 });
});

// Redirecionamento nativo
app.get("/legacy", () => {
  return Response.redirect("https://example.com/new-url", 301);
});

// Resposta customizada com headers e status
app.post("/api/items", async (req) => {
  const item = await req.json();
  return new Response(JSON.stringify(item), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 📦 2. Retorno com Objeto `{ body, init }`

O `body` pode ser qualquer um destes tipos:

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `string` | Texto simples | `"Hello World"` |
| `ArrayBuffer` | Dados binários | `new ArrayBuffer(8)` |
| `TypedArray` | Arrays tipados | `new Uint8Array([1, 2, 3])` |
| `Blob` | Dados binários com tipo | `new Blob(["data"], { type: "text/plain" })` |
| `FormData` | Dados de formulário | `new FormData()` |
| `URLSearchParams` | Query string | `new URLSearchParams({ a: "1" })` |
| `ReadableStream` | Stream de dados | `file.readable` |
| `null` | Sem body | `null` |

### Exemplos práticos

```typescript
// String
app.get("/text", () => ({
  body: "Hello World"
}));

// JSON (string)
app.get("/json", () => ({
  body: JSON.stringify({ message: "Hello" })
}));

// ArrayBuffer
app.get("/binary", () => ({
  body: new ArrayBuffer(16)
}));

// Uint8Array
app.get("/bytes", () => ({
  body: new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
}));

// Blob
app.get("/blob", () => ({
  body: new Blob(["<h1>HTML</h1>"], { type: "text/html" })
}));

// FormData
app.post("/form", () => {
  const formData = new FormData();
  formData.append("name", "João");
  formData.append("age", "30");
  return { body: formData };
});

// URLSearchParams
app.get("/query", () => ({
  body: new URLSearchParams({ foo: "bar", baz: "qux" })
}));

// ReadableStream (arquivo)
app.get("/file", async () => {
  const file = await Deno.open("./data.txt");
  return { body: file.readable };
});

// null (sem body)
app.head("/check", () => ({
  body: null
}));
```

---

## ⚙️ `init?: ResponseInit`

O `init` é opcional e pode conter:

| Propriedade | Tipo | Padrão | Descrição |
|-------------|------|--------|-----------|
| `status` | `number` | `200` | Código HTTP de status |
| `statusText` | `string` | `""` | Texto do status (raramente usado) |
| `headers` | `HeadersInit` | `{}` | Headers da resposta |

### `headers` pode ser:

1. **Objeto simples**
```typescript
{ "Content-Type": "application/json" }
```

2. **Array de tuplas**
```typescript
[["Content-Type", "application/json"], ["X-Custom", "value"]]
```

3. **Instância de Headers**
```typescript
new Headers({ "Content-Type": "application/json" })
```

---

## 🎯 Combinações Comuns

### 1. **Resposta simples (200 OK)**
```typescript
app.get("/hello", () => ({
  body: "Hello World"
}));
// Status: 200, Headers: {}
```

### 2. **JSON com headers**
```typescript
app.get("/api/data", () => ({
  body: JSON.stringify({ id: 1, name: "João" }),
  init: {
    headers: { "Content-Type": "application/json" }
  }
}));
```

### 3. **Status customizado (201 Created)**
```typescript
app.post("/users", async (req) => {
  const data = await req.json();
  return {
    body: JSON.stringify({ created: true, data }),
    init: {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }
  };
});
```

### 4. **No Content (204)**
```typescript
app.delete("/users/:id", () => ({
  body: "",
  init: { status: 204 }
}));
```

### 5. **Redirect (301/302)**
```typescript
app.get("/old-page", () => ({
  body: "",
  init: {
    status: 302,
    headers: { "Location": "/new-page" }
  }
}));
```

### 6. **Not Found (404)**
```typescript
app.get("/missing", () => ({
  body: "Resource not found",
  init: { status: 404 }
}));
```

### 7. **Server Error (500)**
```typescript
app.get("/error", () => ({
  body: "Internal Server Error",
  init: { status: 500 }
}));
```

### 8. **CORS preflight (204)**
```typescript
app.options("/*", () => ({
  body: "",
  init: {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      "Access-Control-Max-Age": "86400"
    }
  }
}));
```

### 9. **Download de arquivo**
```typescript
app.get("/download", async () => {
  const file = await Deno.open("./document.pdf");
  return {
    body: file.readable,
    init: {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"document.pdf\""
      }
    }
  };
});
```

### 10. **Múltiplos headers**
```typescript
app.get("/custom", () => ({
  body: "data",
  init: {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Custom-Header": "value",
      "Cache-Control": "no-cache",
      "X-Request-Id": crypto.randomUUID()
    }
  }
}));
```

### 11. **Cookies**
```typescript
app.post("/login", async (req) => {
  const credentials = await req.json();
  const token = "jwt-token-here";
  return {
    body: JSON.stringify({ success: true }),
    init: {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
      }
    }
  };
});
```

### 12. **Caching**
```typescript
app.get("/cached", () => ({
  body: JSON.stringify({ data: "cached" }),
  init: {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "ETag": "\"abc123\""
    }
  }
}));
```

### 13. **Chunked transfer (streaming)**
```typescript
app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("chunk1"));
      setTimeout(() => {
        controller.enqueue(new TextEncoder().encode("chunk2"));
        controller.close();
      }, 1000);
    }
  });
  
  return {
    body: stream,
    init: {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked"
      }
    }
  };
});
```

### 14. **XML response**
```typescript
app.get("/xml", () => ({
  body: '<?xml version="1.0"?><root><item>data</item></root>',
  init: {
    headers: { "Content-Type": "application/xml" }
  }
}));
```

### 15. **HTML response**
```typescript
app.get("/page", () => ({
  body: "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
  init: {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  }
}));
```

---

## 📊 Tabela de Status Codes Comuns

| Status | Texto | Uso |
|--------|-------|-----|
| `200` | OK | Sucesso padrão |
| `201` | Created | Recurso criado (POST) |
| `204` | No Content | Sucesso sem body (DELETE) |
| `301` | Moved Permanently | Redirect permanente |
| `302` | Found | Redirect temporário |
| `304` | Not Modified | Cache válido |
| `400` | Bad Request | Erro do cliente |
| `401` | Unauthorized | Não autenticado |
| `403` | Forbidden | Não autorizado |
| `404` | Not Found | Recurso não encontrado |
| `405` | Method Not Allowed | Método HTTP não permitido |
| `409` | Conflict | Conflito (ex: duplicata) |
| `422` | Unprocessable Entity | Erro de validação |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Erro do servidor |
| `502` | Bad Gateway | Erro de gateway |
| `503` | Service Unavailable | Serviço indisponível |

---

## 🎨 Exemplo Completo com Todas as Opções

```typescript
import { Router } from "../src/mod.ts";

const app = new Router({ basePath: "/api" });

// 1. String simples
app.get("/text", () => ({
  body: "Hello World"
}));

// 2. JSON
app.get("/json", () => ({
  body: JSON.stringify({ message: "Hello" }),
  init: { headers: { "Content-Type": "application/json" } }
}));

// 3. Status customizado
app.post("/create", async (req) => {
  const data = await req.json();
  return {
    body: JSON.stringify({ id: 1, ...data }),
    init: { status: 201, headers: { "Content-Type": "application/json" } }
  };
});

// 4. No Content
app.delete("/remove/:id", (_req, params) => ({
  body: "",
  init: { status: 204 }
}));

// 5. Redirect
app.get("/old", () => ({
  body: "",
  init: { status: 302, headers: { "Location": "/new" } }
}));

// 6. Not Found
app.get("/missing", () => ({
  body: "Not Found",
  init: { status: 404 }
}));

// 7. CORS
app.options("/*", () => ({
  body: "",
  init: {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  }
}));

// 8. Download
app.get("/download", async () => {
  const file = await Deno.open("./file.pdf");
  return {
    body: file.readable,
    init: {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"file.pdf\""
      }
    }
  };
});

// 9. Cookies
app.post("/login", async (req) => {
  const { username } = await req.json();
  return {
    body: JSON.stringify({ success: true }),
    init: {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `user=${username}; HttpOnly; Path=/`
      }
    }
  };
});

// 10. Streaming
app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      const interval = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`chunk ${count++}\n`));
        if (count >= 5) {
          clearInterval(interval);
          controller.close();
        }
      }, 500);
    }
  });
  
  return {
    body: stream,
    init: { headers: { "Content-Type": "text/plain" } }
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## ✅ Resumo

**`body`** pode ser:
- `string`, `ArrayBuffer`, `TypedArray`, `Blob`, `FormData`, `URLSearchParams`, `ReadableStream`, `null`

**`init`** pode conter:
- `status` (number)
- `statusText` (string)
- `headers` (object, array, ou Headers)

**Combinações mais comuns:**
1. `{ body: "text" }` → 200 OK
2. `{ body: json, init: { headers } }` → JSON response
3. `{ body: "", init: { status: 204 } }` → No Content
4. `{ body: "", init: { status: 302, headers: { Location } } }` → Redirect
5. `{ body: stream, init: { headers } }` → File download / streaming

Todas essas combinações são válidas e suportadas pelo router! 🚀
````

---

## Arquivo: `docs/roadmap-adapters.md`

````md
# 🗺️ Roadmap: Adaptadores para Outros Runtimes

O `@vanaware/wsrouter` foi projetado com arquitetura runtime-agnostic, mas atualmente possui suporte oficial apenas para **Deno**. Este documento descreve o roadmap para suportar outros ambientes.

---

## 📊 Status Atual

| Runtime | HTTP | WebSocket | Static Files | Status |
|---------|------|-----------|--------------|--------|
| **Deno** | ✅ | ✅ | ✅ | **Suporte Oficial** |
| Cloudflare Workers | ⏸️ | ❌ | ⏸️ | Roadmap (Static Assets) |
| Node.js | ❌ | ❌ | ❌ | Roadmap |
| Bun | ❌ | ❌ | ❌ | Roadmap |
| Edge Runtimes (Vercel, Netlify) | ❌ | ❌ | ❌ | Futuro |

---

## ☁️ Cloudflare Workers

### Status Atual

Os adaptadores Cloudflare foram **removidos do core** na versão 1.0 devido a:

1. **Limitações de estado**: Cloudflare Workers não mantém estado compartilhado entre requests (exceto via Durable Objects)
2. **WebSocket em memória**: Grupos WebSocket não funcionariam corretamente em produção
3. **Foco no Deno**: Simplificar o core e garantir qualidade

### Caminho Futuro: Static Assets

Cloudflare lançou **Static Assets** ([documentação](https://developers.cloudflare.com/workers/static-assets/)), que é a forma recomendada de servir arquivos estáticos:

```typescript
// Futuro adaptador Cloudflare com Static Assets
export function createCloudflareRouter(options: {
  basePath?: string;
  assets?: { binding: string }; // Novo binding de Static Assets
}) {
  // ...
}
```

**Para WebSockets em Cloudflare**, use **Durable Objects**:

```typescript
// Exemplo conceitual: Chat Room como Durable Object
export class ChatRoom {
  private sessions: Map<string, WebSocket> = new Map();
  
  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    await this.handleSession(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    // Gerenciar mensagens, broadcast, etc.
  }
}
```

### Prioridade: **Média**

---

## 🟢 Node.js

### Desafios

1. **URLPattern**: Disponível apenas em Node 18.17+ (via `undici`)
2. **WebSocket**: Requer biblioteca externa (`ws`, `uWebSockets.js`)
3. **Static Files**: Módulo `fs` ou `fs/promises`

### Adaptador Conceitual

```typescript
// src/adapters/node.ts (futuro)
import { WebSocketServer } from "ws";
import { createReadStream, stat } from "fs/promises";
import { join, resolve } from "path";

export function createNodeWebSocketUpgrader(wss: WebSocketServer): WebSocketUpgrader {
  return {
    upgrade(req: Request): { socket: WebSocket; response: Response } {
      // Node.js requer abordagem diferente
      // WebSocket upgrade acontece no servidor HTTP, não no handler
      throw new Error("Node WebSocket adapter requer integração com servidor HTTP");
    },
  };
}

export function createNodeStaticFileHandler(staticDir: string): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      try {
        const filePath = join(staticDir, path);
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          const stream = createReadStream(filePath);
          return new Response(stream as any, {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": stats.size.toString(),
            },
          });
        }
      } catch {
        return null;
      }
      return null;
    },
  };
}
```

### Prioridade: **Alta**

Node.js é amplamente usado e seria valioso ter suporte oficial.

---

## 🥐 Bun

### Vantagens

- Compatível com APIs Node.js
- Suporte nativo a WebSocket via `Bun.serve`
- Performance excelente

### Adaptador Conceitual

```typescript
// src/adapters/bun.ts (futuro)
export function createBunWebSocketUpgrader(): WebSocketUpgrader {
  return {
    upgrade(req: Request): { socket: WebSocket; response: Response } {
      const { socket, response } = Bun.upgrade(req, {
        data: {},
      });
      return { socket, response };
    },
  };
}

export function createBunStaticFileHandler(staticDir: string): StaticFileHandler {
  return {
    async handle(path: string): Promise<Response | null> {
      try {
        const file = Bun.file(join(staticDir, path));
        if (await file.exists()) {
          return new Response(file);
        }
      } catch {
        return null;
      }
      return null;
    },
  };
}
```

### Prioridade: **Média-Alta**

Bun está ganhando popularidade e seria relativamente fácil adaptar.

---

## 🌐 Edge Runtimes (Vercel Edge, Netlify Edge)

### Desafios

- Ambientes serverless com cold starts
- Sem suporte a WebSocket de longa duração
- Foco em HTTP request/response

### Abordagem Recomendada

Usar o core agnóstico diretamente, sem adaptadores oficiais:

```typescript
// edge-function.ts
import { Router } from "@vanaware/wsrouter";

const router = new Router({ basePath: "/api" });

router.get("/hello", () => ({
  body: JSON.stringify({ message: "Hello from Edge!" }),
  init: { headers: { "Content-Type": "application/json" } },
}));

export default function handler(request: Request) {
  return router.handleRequest(request);
}
```

### Prioridade: **Baixa**

---

## 🛠️ Como Contribuir com um Adaptador

Se você quer criar um adaptador para outro runtime:

### 1. Implementar `WebSocketUpgrader`

```typescript
interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}
```

### 2. Implementar `StaticFileHandler`

```typescript
interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}
```

### 3. Criar Entry Point

```typescript
// src/[runtime].ts
export function create[Runtime]Router(options: {
  basePath?: string;
  staticDir?: string;
  forceHttps?: boolean;
  // ... outras opções específicas do runtime
}): Router {
  const router = new Router({
    basePath,
    forceHttps,
    webSocketUpgrader: create[Runtime]WebSocketUpgrader(),
    staticFileHandler: staticDir ? create[Runtime]StaticFileHandler(staticDir) : undefined,
  });
  return router;
}

export * from "./mod.ts";
```

### 4. Adicionar Testes

Criar `tests/adapters_[runtime]_test.ts` com:
- Testes de HTTP routing
- Testes de WebSocket (se suportado)
- Testes de static files (se suportado)
- Testes de edge cases do runtime

### 5. Documentar

- Adicionar seção em `docs/runtime-agnostic.md`
- Criar exemplo em `example/[runtime]/`
- Atualizar `README.md`

---

## 📅 Timeline Estimado

| Adaptador | Estimativa | Dependências |
|-----------|------------|--------------|
| Node.js | 2-3 semanas | `ws`, `undici` |
| Bun | 1-2 semanas | Nenhuma (built-in) |
| Cloudflare (Static Assets) | 1-2 semanas | Wrangler |
| Edge Runtimes | 1 semana | Nenhuma |

---

## 💡 Alternativa: Adapters da Comunidade

Se você criar um adaptador, considere publicá-lo como pacote separado:

```bash
@vanaware/wsrouter-adapter-node
@vanaware/wsrouter-adapter-bun
@vanaware/wsrouter-adapter-cloudflare
```

Isso mantém o core leve e permite que a comunidade contribua sem sobrecarregar o repositório principal.

---

## 🤝 Contribuindo

Interessado em contribuir com um adaptador? Abra uma issue discutindo:

1. Qual runtime você quer suportar
2. Como você planeja implementar `WebSocketUpgrader`
3. Como você planeja implementar `StaticFileHandler`
4. Se você vai manter o adaptador a longo prazo

Estamos abertos a colaborações! 🚀


````

---

## Arquivo: `docs/roadmap-rate-limiting.md`

````md
# 🚦 Roadmap: Rate Limiting e Proteção contra Abuso

O `@vanaware/wsrouter` atualmente **não inclui rate limiting nativo**. Este documento descreve estratégias recomendadas e o roadmap para possíveis implementações futuras.

---

## 📊 Status Atual

| Feature | Status | Implementação Recomendada |
|---------|--------|---------------------------|
| Rate Limiting por IP | ❌ | Middleware customizado |
| Rate Limiting por Usuário | ❌ | Middleware customizado |
| Rate Limiting por WebSocket | ❌ | Middleware customizado |
| Tamanho Máximo de Mensagem | ❌ | Validação no handler |
| Backpressure de Broadcast | ❌ | Lógica no handler |

---

## 🛡️ Por Que Rate Limiting é Importante?

### Ataques Comuns

1. **Brute Force**: Tentativas massivas de login
2. **DDoS**: Sobrecarga do servidor com requests
3. **Credential Stuffing**: Teste de credenciais vazadas
4. **Scraping**: Extração automatizada de dados
5. **WebSocket Flood**: Envio massivo de mensagens

### Impactos sem Rate Limiting

- **Performance degradada**: CPU/memory sobrecarregados
- **Custos elevados**: Uso excessivo de recursos (especialmente em serverless)
- **Dados comprometidos**: Contas invadidas via brute force
- **Disponibilidade**: Serviço indisponível para usuários legítimos

---

## 💡 Implementações Recomendadas

### 1. Rate Limiting Simples (Em Memória)

Adequado para aplicações single-instance:

```typescript
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  const maxRequests = 100;
  
  const record = requestCounts.get(ip) ?? { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }
  
  record.count++;
  requestCounts.set(ip, record);
  
  if (record.count > maxRequests) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString(),
        "X-RateLimit-Limit": maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": record.resetTime.toString(),
      },
    });
  }
  
  const res = await next();
  res.headers.set("X-RateLimit-Limit", maxRequests.toString());
  res.headers.set("X-RateLimit-Remaining", (maxRequests - record.count).toString());
  res.headers.set("X-RateLimit-Reset", record.resetTime.toString());
  
  return res;
});
```

**Limitações:**
- Não funciona em múltiplas instâncias
- Perde estado ao reiniciar
- Sem persistência

---

### 2. Rate Limiting com Redis (Distribuído)

Para aplicações multi-instância:

```typescript
import { connect } from "redis";

const redis = await connect({ hostname: "localhost", port: 6379 });

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const key = `ratelimit:${ip}`;
  const windowMs = 60000;
  const maxRequests = 100;
  
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  
  if (current > maxRequests) {
    const ttl = await redis.ttl(key);
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": ttl.toString(),
        "X-RateLimit-Limit": maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  
  const res = await next();
  res.headers.set("X-RateLimit-Limit", maxRequests.toString());
  res.headers.set("X-RateLimit-Remaining", (maxRequests - current).toString());
  
  return res;
});
```

**Vantagens:**
- Funciona em múltiplas instâncias
- Persistente
- Atomicidade garantida

---

### 3. Rate Limiting por Usuário Autenticado

```typescript
app.use(async (req, _params, next) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return await next();
  
  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  
  try {
    const { payload } = await jwtVerify(token, secret);
    userId = payload.userId as string;
  } catch {
    return await next(); // Deixa o handler de auth lidar
  }
  
  const key = `ratelimit:user:${userId}`;
  // ... mesma lógica de rate limiting
  
  return await next();
});
```

---

### 4. Rate Limiting de WebSocket

#### Limite de Mensagens por Segundo

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const messageCount = { count: 0, resetTime: Date.now() + 1000 };
  const maxMessagesPerSecond = 10;
  
  ws.onmessage = (event) => {
    const now = Date.now();
    
    if (now > messageCount.resetTime) {
      messageCount.count = 0;
      messageCount.resetTime = now + 1000;
    }
    
    messageCount.count++;
    
    if (messageCount.count > maxMessagesPerSecond) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Rate limit exceeded. Max 10 messages/second.",
      }));
      return;
    }
    
    // Processar mensagem normalmente
    const group = app.getWsGroupByPath("/chat/:room/:user");
    group.broadcast(event.data, /* ... */);
  };
});
```

#### Tamanho Máximo de Mensagem

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const maxMessageSize = 1024; // 1 KB
  
  ws.onmessage = (event) => {
    if (typeof event.data === "string" && event.data.length > maxMessageSize) {
      ws.send(JSON.stringify({
        type: "error",
        message: `Message too large. Max ${maxMessageSize} characters.`,
      }));
      return;
    }
    
    // Processar mensagem
  };
});
```

---

### 5. Backpressure de Broadcast

Quando um cliente está lento, o broadcast pode acumular mensagens:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  const maxQueueSize = 100;
  let messageQueue: string[] = [];
  
  ws.onmessage = (event) => {
    // Broadcast normal
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  // Monitorar bufferedAmount (WebSocket API)
  setInterval(() => {
    if (ws.bufferedAmount > 1024 * 1024) { // > 1 MB
      console.warn(`[WS] Cliente ${params.user} com buffer alto: ${ws.bufferedAmount}`);
      // Opcional: fechar conexão ou enviar alerta
      ws.send(JSON.stringify({
        type: "warning",
        message: "You're receiving messages faster than you can process them.",
      }));
    }
  }, 5000);
});
```

---

## 🔮 Possível Implementação Futura no Core

Se rate limiting for adicionado ao core, poderia ser assim:

```typescript
const app = createDenoRouter({
  basePath: "/api",
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    maxRequests: 100,
    keyGenerator: (req) => req.headers.get("x-forwarded-for") ?? "unknown",
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req, res, next, options) => {
      res.status(429).json({
        error: "Too many requests, please try again later.",
      });
    },
  },
});
```

### Desafios

1. **Storage**: Em memória vs Redis vs banco de dados
2. **Distribuição**: Como sincronizar entre instâncias
3. **Flexibilidade**: Diferentes limites para diferentes rotas
4. **Performance**: Overhead de verificar rate limit em cada request

### Prioridade: **Média**

Rate limiting é importante, mas existem soluções maduras (middlewares, proxies) que podem ser usadas. Implementar no core pode ser over-engineering.

---

## 📚 Bibliotecas Recomendadas

### Para Node.js

- **rate-limiter-flexible**: Suporta Redis, MongoDB, memória
- **express-rate-limit**: Simples e popular
- **slow-down**: Adiciona delay em vez de bloquear

### Para Deno

Atualmente não há bibliotecas maduras. Implemente custom ou use Redis diretamente.

### Para Cloudflare

- **Cloudflare Rate Limiting Rules**: Configurado no dashboard
- **Workers KV**: Para rate limiting distribuído

---

## ✅ Checklist de Rate Limiting

- [ ] Rate limit por IP em endpoints públicos
- [ ] Rate limit mais agressivo em `/login`, `/register`
- [ ] Rate limit por usuário autenticado
- [ ] Rate limit de WebSocket (mensagens/segundo)
- [ ] Tamanho máximo de mensagem WebSocket
- [ ] Headers `X-RateLimit-*` nas respostas
- [ ] Logs de tentativas de abuso
- [ ] Alertas para picos anômalos de tráfego

---

## 🎯 Recomendações por Tamanho de Aplicação

### Pequena (Single Instance, < 1000 req/min)

- Rate limiting em memória
- Sem Redis
- Middleware simples

### Média (Multi-Instance, < 10000 req/min)

- Redis para rate limiting distribuído
- Diferentes limites por rota
- Monitoramento básico

### Grande (> 10000 req/min)

- Solução de edge (Cloudflare, AWS WAF)
- Redis cluster
- Análise de padrões de tráfego
- Machine learning para detecção de anomalias

---

## 🤝 Contribuindo

Se você implementou uma solução de rate limiting robusta, considere:

1. Compartilhar como exemplo em `example/rate-limiting/`
2. Criar um pacote separado: `@vanaware/wsrouter-rate-limit`
3. Abrir uma issue discutindo a abordagem

Estamos abertos a contribuições! 🚀

````

---

## Arquivo: `docs/runtime-agnostic.md`

````md
# 🌐 Arquitetura Runtime-Agnostic

O `@vanaware/wsrouter` foi projetado para funcionar em **qualquer runtime JavaScript** que suporte as Web APIs padrão (Fetch API, WebSocket, URLPattern). O core do router **não possui nenhuma dependência direta** de runtime específico.

Atualmente, fornecemos adaptadores oficiais e testados apenas para **Deno**. Adaptadores para outros runtimes (Node.js, Bun, Cloudflare Workers) estão em nosso [Roadmap](./roadmap-adapters.md).

---

## 🏗️ Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────┐
│              SEU CÓDIGO (main.ts / worker.ts)           │
│  - Define rotas, middlewares e handlers                 │
│  - Escolhe o entry point adequado ao runtime            │
└──────────────────────────┬──────────────────────────────┘
                           │ importa
┌──────────────────────────▼──────────────────────────────┐
 │           ENTRY POINTS (src/deno.ts)                    │
 │  - createDenoRouter()                                   │
 └──────────────────────────┬──────────────────────────────┘
                           │ injeta adaptadores
┌──────────────────────────▼──────────────────────────────┐
 │              CORE AGNÓSTICO (src/mod.ts)                │
 │  - Router (src/router.ts)                               │
 │  - HttpRoute (src/http-route.ts)                        │
 │  - WsRoute (src/ws-route.ts)                            │
 │  - WebSocketGroup (src/websocket-group.ts)              │
 │  - MiddlewareChain (src/middleware-chain.ts)            │
 │  - MiddlewareRoute (src/middleware-route.ts)            │
 │  - WorkerRoute (src/worker-route.ts)                    │
 │  - Types (src/types.ts)                                 │
 │  - ZERO dependência de runtime específico               │
 │  - Usa interfaces: WebSocketUpgrader, StaticFileHandler │
 └──────────────────────────┬──────────────────────────────┘
                           │ implementado por
┌──────────────────────────▼──────────────────────────────┐
 │              ADAPTADORES (src/adapters/)                 │
 │  - adapters/deno.ts       → Deno.upgradeWebSocket,      │
 │                              Deno.stat, Deno.open       │
 └─────────────────────────────────────────────────────────┘
```

---

## 🔌 Interfaces de Adaptação

### `WebSocketUpgrader`
Abstrai o mecanismo de upgrade de HTTP para WebSocket:
```typescript
interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}
```

### `StaticFileHandler`
Abstrai o sistema de arquivos para servir arquivos estáticos:
```typescript
interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}
```

---

## 🦕 Usando com Deno (Suporte Oficial)

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
  forceHttps: true,
  trustProxy: true,
});

app.get("/hello", () => ({ body: "Hello!" }));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

## 🟢 Usando com Node.js ou Bun (Via Core Puro)

Como o core é agnóstico, você pode usá-lo em Node.js ou Bun implementando suas próprias interfaces de adaptação:

```typescript
import { Router } from "@vanaware/wsrouter";

// Você precisaria implementar estas interfaces para o seu runtime
const myNodeUpgrader = { /* ... */ };
const myNodeStaticHandler = { /* ... */ };

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: myNodeUpgrader,
  staticFileHandler: myNodeStaticHandler,
});
```

---

## 🔒 Segurança

- **Path Traversal Protection**: O core sanitiza paths e o adaptador Deno garante *containment* real e recusa symlinks.
- **Dotfiles**: Bloqueados por padrão (`allowDotfiles: false`).
- **Force HTTPS**: Redireciona HTTP→HTTPS em produção (ignora localhost).
- **HSTS**: Header `Strict-Transport-Security` adicionado automaticamente em respostas HTTPS.
- **Trust Proxy**: Confiança explícita em headers como `X-Forwarded-Proto` via `trustProxy: true`.

---

## 📋 Tabela de Compatibilidade Atual

| Feature | Deno (Oficial) | Node.js / Bun (Via Core) |
|---------|----------------|--------------------------|
| HTTP Routing | ✅ | ✅ |
| WebSocket | ✅ | ⚠️ (Requer Adaptador) |
| Static Files (disco) | ✅ | ⚠️ (Requer Adaptador) |
| Force HTTPS / HSTS | ✅ | ✅ |
| Middlewares | ✅ | ✅ |
| Dual Params Broadcast | ✅ | ✅ |
| Last Broadcast | ✅ | ✅ |
| Path Traversal / Symlinks | ✅ | ⚠️ (Depende do Adaptador) |

````

---

## Arquivo: `docs/security.md`

````md
# 🔒 Guia de Segurança do @vanaware/wsrouter

Este documento descreve as práticas de segurança recomendadas ao usar o `@vanaware/wsrouter` em produção.

## 📋 Índice

1. [HTTPS e HSTS](#https-e-hsts)
2. [Proteção de Arquivos Estáticos](#proteção-de-arquivos-estáticos)
3. [WebSocket Security](#websocket-security)
4. [Autenticação e Autorização](#autenticação-e-autorização)
5. [Rate Limiting](#rate-limiting)
6. [Headers de Segurança](#headers-de-segurança)

---

## 🌐 HTTPS e HSTS

### Force HTTPS

O router suporta redirecionamento automático de HTTP para HTTPS:

```typescript
const app = createDenoRouter({
  basePath: "/api",
  forceHttps: true, // Redireciona HTTP → HTTPS
});
```

**Comportamento:**
- Redireciona com status `301 Moved Permanently`
- Ignora automaticamente `localhost` e `127.0.0.1` para facilitar desenvolvimento
- Suporta IPv6 `[::1]`

### Confiança em Proxy (`trustProxy`)

Quando atrás de um proxy reverso (nginx, Cloudflare, etc.), o router pode confiar no header `X-Forwarded-Proto`:

```typescript
const app = createDenoRouter({
  forceHttps: true,
  trustProxy: true, // ⚠️ Apenas se estiver atrás de proxy confiável
});
```

**⚠️ AVISO:** Nunca ative `trustProxy` se o servidor estiver exposto diretamente à internet. Um atacante poderia enviar `X-Forwarded-Proto: https` e bypassar o redirect.

### HSTS (HTTP Strict Transport Security)

Quando `forceHttps` está ativo e a requisição já é HTTPS, o router automaticamente adiciona:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Isso instrui navegadores a sempre usar HTTPS para seu domínio.

---

## 📂 Proteção de Arquivos Estáticos

### Dotfiles e Traversal Defense-in-Depth

Por padrão, arquivos que começam com `.` são bloqueados:

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: false, // Default: false
});
```

**Bloqueados por padrão:**
- `.env`, `.env.local`
- `.git/config`, `.git/HEAD`
- `.DS_Store`
- `.htaccess`

Mesmo quando `allowDotfiles: true` é habilitado (por exemplo, para servir `.well-known`), segmentos de diretório relativo como `..` e `.` continuam **estritamente proibidos e bloqueados com 404**, garantindo que a ativação de dotfiles nunca abra brechas de path traversal.

### Symlinks e Diretórios Symlink

O adaptador Deno **recusa symlinks** diretamente e valida a resolução física com `Deno.realPath`:
- Symlinks diretos são detectados via `Deno.lstat` e recusados.
- Diretórios intermediários symlink são validados contra `resolvedBase`, impedindo que symlinks de diretório apontando para fora do `staticDir` sejam acessados.

### Headers de Arquivos Estáticos & Proteção MIME

O adaptador Deno injeta automaticamente:
- `X-Content-Type-Options: nosniff` (prevenindo ataques de sniffing MIME)
- `ETag` e suporte transparente a `If-None-Match` (retornando `304 Not Modified` e cancelando o stream para economia de I/O)
- `Cache-Control` e `Last-Modified`
- Tratamento seguro de requisições `HEAD`, cancelando o stream aberto para evitar vazamento de file descriptors.

### Path Traversal

O router sanitiza caminhos para evitar ataques de path traversal:

```typescript
// Requisição maliciosa
GET /../../etc/passwd
GET /..%2F..%2Fetc%2Fpasswd

// Resultado: 404 (caminho sanitizado antes de acessar)
```

### Containment

O adaptador Deno verifica que o caminho resolvido está estritamente dentro do `staticDir`:

```typescript
const app = createDenoRouter({
  staticDir: "/var/www/public",
});

// Requisição: GET /../../etc/passwd
// Mesmo após sanitização, o path resolvido é verificado
// Resultado: 404 se tentar escapar do diretório
```

---

## 🔌 WebSocket Security

### Validação de Origin

WebSockets são vulneráveis a ataques Cross-Site WebSocket Hijacking (CSWSH). Valide o header `Origin`:

```typescript
const allowedOrigins = ["https://meusite.com", "https://app.meusite.com"];

app.use(async (req, _params, next) => {
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response("Forbidden: Invalid origin", { status: 403 });
    }
  }
  return await next();
});
```

### Autenticação via Subprotocol

O exemplo JWT demonstra como passar tokens via subprotocolo WebSocket:

```javascript
// Cliente
const ws = new WebSocket("wss://api.site.com/chat", ["Bearer", token]);

// Servidor (middleware)
app.use(async (req, _params, next) => {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return await next();
  }
  
  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map(p => p.trim());
  const bearerIndex = protocols.findIndex(p => p === "Bearer");
  const token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;
  
  if (!token) {
    return new Response("Token required", { status: 401 });
  }
  
  try {
    await jwtVerify(token, secret);
    return await next();
  } catch {
    return new Response("Invalid token", { status: 403 });
  }
});
```

### Isolamento de Salas

Use `permissionFn` para garantir que mensagens não vazem entre salas:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
});
```

**Sem `permissionFn`, o broadcast envia para TODOS os sockets da rota**, não apenas para a mesma sala.

---

## 🔐 Autenticação e Autorização

### JWT com Expiração

Sempre defina expiração em tokens JWT:

```typescript
import { SignJWT } from "jose";

const token = await new SignJWT({ userId: "123", role: "user" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h") // ⚠️ Sempre definir
  .setIssuedAt()
  .sign(secret);
```

### Validação de Algoritmo

Ao verificar JWTs, especifique algoritmos permitidos:

```typescript
import { jwtVerify } from "jose";

await jwtVerify(token, secret, {
  algorithms: ["HS256"], // ⚠️ Evite "none" e algoritmos fracos
});
```

### Segredos em Variáveis de Ambiente

Nunca hardcode segredos em produção:

```typescript
// ❌ RUIM
const JWT_SECRET = "meu-segredo-123";

// ✅ BOM
const JWT_SECRET = Deno.env.get("JWT_SECRET");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado");
}
```

---

## 🚦 Rate Limiting

O router **não inclui rate limiting nativo**. Use middlewares para proteger contra abuso:

```typescript
// Exemplo simples de rate limiting por IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  const maxRequests = 100;
  
  const record = requestCounts.get(ip) ?? { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }
  
  record.count++;
  requestCounts.set(ip, record);
  
  if (record.count > maxRequests) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString(),
      },
    });
  }
  
  return await next();
});
```

Para produção, considere:
- Redis para rate limiting distribuído
- Bibliotecas especializadas como `rate-limiter-flexible`
- Soluções de edge (Cloudflare, AWS WAF)

---

## 🛡️ Headers de Segurança

Adicione headers de segurança via middleware:

```typescript
app.use(async (req, _params, next) => {
  const res = await next();
  
  // Prevenir clickjacking
  res.headers.set("X-Frame-Options", "DENY");
  
  // Prevenir MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");
  
  // Referrer Policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy (ajuste conforme necessário)
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  
  return res;
});
```

---

## ✅ Checklist de Segurança para Produção

- [ ] `forceHttps: true` ativado
- [ ] `trustProxy: true` apenas se atrás de proxy confiável
- [ ] `allowDotfiles: false` (default)
- [ ] Validação de `Origin` em WebSockets
- [ ] Tokens JWT com expiração e algoritmos restritos
- [ ] Segredos em variáveis de ambiente
- [ ] Rate limiting implementado
- [ ] Headers de segurança adicionados
- [ ] Logs de auditoria para autenticação
- [ ] HTTPS/WSS em produção (nunca HTTP/WS)

---

## 📚 Recursos Adicionais

- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [MDN: HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

````

---

## Arquivo: `docs/simple-permission.md`

````md
# Exemplo Simples: Rota `/sala` sem Parâmetros

Quando a rota não tem parâmetros dinâmicos, o `params` recebido pela `permissionFn` será um objeto vazio `{}`. Nesse caso, a filtragem deve ser feita com base no **conteúdo da mensagem** ou em **estado externo** (como uma lista de banidos).

## 📄 Arquivo: `monorepo/router/example/sala/main.ts`

```typescript
// monorepo/router/example/sala/main.ts
import { Router } from "../../src/mod.ts";

const app = new Router({ basePath: "/api" });

// Lista externa de usuários banidos (simulando um banco de dados)
const bannedUsers = new Set(["spammer1", "baduser2"]);

// ============================================================
// Rota WebSocket simples: /sala (sem parâmetros)
// ============================================================
app.ws("/sala", (ws, req, _params) => {
  // Extrai o nome do usuário de um header (já que não temos params na URL)
  const user = req.headers.get("x-user-name") ?? "anonimo";
  
  console.log(`[WS] ${user} entrou na sala`);

  const group = app.getWsGroupByPath("/sala");
  if (!group) return;

  ws.onmessage = (event) => {
    const message = event.data;

    // Exemplo 1: Filtrar por conteúdo da mensagem
    // Exemplo 2: Filtrar por usuário banido (estado externo)
    group.broadcast(
      `[${user}]: ${message}`,
      (_receiver, _sender, msg) => { 
        // clientParams é {} (vazio, pois a rota não tem params)
        // msg é a mensagem sendo enviada
        
        // Regra 1: Bloquear mensagens com palavra proibida
        if (msg.toLowerCase().includes("spam")) {
          return false;
        }
        
        // Regra 2: Bloquear mensagens de usuários banidos
        // (extraímos o nome do usuário do prefixo "[user]:")
        const senderMatch = msg.match(/^\[([^\]]+)\]:/);
        if (senderMatch && bannedUsers.has(senderMatch[1])) {
          return false;
        }
        
        return true; // Permite todas as outras mensagens
      },
      {}, // senderParams vazio, já que não temos params na rota
    );
  };

  ws.onclose = () => console.log(`[WS] ${user} saiu da sala`);
});

// ============================================================
// Servidor
// ============================================================
const server = Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Servidor rodando em http://localhost:3000");
console.log("🔌 WS: ws://localhost:3000/api/sala (header X-User-Name opcional)");
```

---

## 🔍 Como Funciona a `permissionFn` sem Parâmetros

Como a rota `/sala` não tem `:param`, o objeto `params` é sempre `{}`. Então a filtragem precisa usar outras informações:

| Fonte de Dados | Como Acessar | Exemplo de Uso |
|----------------|--------------|----------------|
| **Conteúdo da mensagem** | Parâmetro `msg` da `permissionFn` | Bloquear palavras proibidas |
| **Estado externo** | Variáveis fora do handler (ex: `bannedUsers`) | Lista de banidos, roles |
| **Headers da requisição** | Capturados no `onopen` e guardados | Roles, níveis de acesso |

---

## 🧪 Testando

### Cliente simples (Node.js ou navegador)

```javascript
// Conectar passando o nome no header (via fetch + WebSocket manual)
// No navegador, headers customizados não são possíveis no WebSocket.
// Alternativa: passar o nome na query string ou primeira mensagem.

const ws = new WebSocket("ws://localhost:3000/api/sala");

ws.onopen = () => {
  // Primeira mensagem identifica o usuário
  ws.send("__IDENTIFY__:joao");
};

ws.onmessage = (e) => console.log("Recebido:", e.data);
```

### Casos de teste

```bash
# ✅ Mensagem normal → todos recebem
ws.send("Olá pessoal!")
# → [joao]: Olá pessoal!

# ❌ Mensagem com "spam" → ninguém recebe
ws.send("Isso é spam!")
# → (silêncio)

# ❌ Mensagem de usuário banido → ninguém recebe
# (se o sender for "spammer1")
# → (silêncio)
```

---

## 💡 Alternativa: Guardar Estado no Handler

Se precisar de filtragem mais complexa, você pode guardar informações no fechamento (closure) do handler:

```typescript
app.ws("/sala", (ws, req, _params) => {
  // Estado local por conexão
  const userRole = req.headers.get("x-role") ?? "visitor";
  const userName = req.headers.get("x-user-name") ?? "anonimo";
  
  const group = app.getWsGroupByPath("/sala");
  if (!group) return;

  ws.onmessage = (event) => {
    group.broadcast(
      `[${userName}]: ${event.data}`,
      (_receiver, _sender, msg) => { 
        // Aqui você pode usar `userRole` do closure
        // para decidir se a mensagem deve passar
        if (userRole === "admin") return true; // Admin sempre passa
        if (msg.includes("@admin")) return false; // Visitante não vê menções
        return true;
      },
      {},
    );
  };
});
```

---

## ✅ Resumo

Para rotas **sem parâmetros**:
- `params` será sempre `{}`
- Use o parâmetro `message` da `permissionFn` para filtrar por conteúdo
- Use variáveis externas (closures, Maps, Sets) para estado compartilhado
- A lógica de permissão continua sendo `(receiverParams, senderParams, message) => boolean`
````

---

## Arquivo: `docs/webrtc.md`

````md
# 🎥 WebRTC Live Streaming & Signaling Guide

`@vanaware/wsrouter` includes native, high-performance WebRTC signaling and stream coordination utilities via `WebRTCSignalingHub` and `WebSocketGroup`. This enables zero-dependency peer-to-peer webcam, audio, and screen sharing with real-time viewer tracking and interactive reactions.

---

## 🏗️ Architecture & Signaling Flow

WebRTC establishes direct peer-to-peer media streaming between browsers. The server acts as a low-latency signaling mediator exchanging SDP offers, SDP answers, and ICE candidates.

```text
[ Broadcaster ]                    [ WsRouter Hub ]                    [ Viewer(s) ]
       │                                  │                                  │
       ├─── broadcaster_started ─────────►│─── broadcaster_started ─────────►│
       │                                  │◄── request_stream ───────────────┤
       │◄── request_stream ───────────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_offer (SDP) ──────────►│─── webrtc_offer (SDP) ──────────►│
       │                                  │◄── webrtc_answer (SDP) ──────────┤
       │◄── webrtc_answer (SDP) ──────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_candidate (ICE) ──────►│─── webrtc_candidate (ICE) ──────►│
       │◄── webrtc_candidate (ICE) ───────│◄── webrtc_candidate (ICE) ───────┤
       │                                  │                                  │
       ══════════════════════ Direct P2P Media Stream ════════════════════════►
```

---

## 🚀 Server-Side Setup

### 1. Minimal WebRTC Signaling Endpoint

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/webrtc/:room", (ws, _req, params) => {
  const room = (params.room as string) || "general";
  const group = app.getWsGroupByPath("/webrtc/:room");
  if (!group) return;

  ws.onmessage = (event) => {
    // Automatically routes SDP offers, answers, candidates, and stream events
    group.handleSignaling(ws, event.data, params);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 WebRTC Signaling Protocol Messages

The `WebRTCSignalingHub` handles standard JSON message formats:

### 1. Broadcaster Announcements
- **Start Broadcast**:
  ```json
  {
    "type": "broadcaster_started",
    "broadcasterId": "user-123",
    "broadcasterName": "Alice",
    "streamTitle": "Live Demo"
  }
  ```
- **Stop Broadcast**:
  ```json
  {
    "type": "broadcaster_stopped",
    "broadcasterId": "user-123"
  }
  ```

### 2. Stream Request (Viewer -> Broadcaster)
```json
{
  "type": "request_stream",
  "viewerId": "viewer-456",
  "viewerName": "Bob",
  "broadcasterId": "user-123"
}
```

### 3. SDP Offer & Answer
- **Offer**:
  ```json
  {
    "type": "webrtc_offer",
    "from": "user-123",
    "to": "viewer-456",
    "sdp": { "type": "offer", "sdp": "..." },
    "fromName": "Alice"
  }
  ```
- **Answer**:
  ```json
  {
    "type": "webrtc_answer",
    "from": "viewer-456",
    "to": "user-123",
    "sdp": { "type": "answer", "sdp": "..." },
    "fromName": "Bob"
  }
  ```

### 4. ICE Candidates
```json
{
  "type": "webrtc_candidate",
  "from": "user-123",
  "to": "viewer-456",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### 5. Floating Reactions
```json
{
  "type": "stream_reaction",
  "from": "viewer-456",
  "fromName": "Bob",
  "emoji": "🔥",
  "timestamp": 1726500000000
}
```

---

## 🛠️ Server-Side API Reference

### `WebRTCSignalingHub`
- `hub.registerPeer(ws: WebSocket, peerId: string): void`: Binds a socket to a unique peer ID.
- `hub.unregisterPeer(ws: WebSocket): void`: Removes socket and closes any active broadcast by this peer.
- `hub.handleMessage(ws: WebSocket, rawData: string | object, params?: RouteParams): boolean`: Dispatches signaling messages.
- `hub.startBroadcasting(broadcasterId, name, room, title?, params?): ActiveStreamInfo`: Marks stream active and notifies group.
- `hub.stopBroadcasting(broadcasterId, room, params?): boolean`: Ends stream and notifies group.
- `hub.getActiveStream(room: string): ActiveStreamInfo | undefined`: Gets current broadcaster info.
- `hub.isBroadcasting(room: string): boolean`: Checks if a stream is live in a room.
- `hub.getAllActiveStreams(): ActiveStreamInfo[]`: Returns all active streams across rooms.
- `hub.sendToPeer(peerId: string, message: WebRTCSignalingMessage | string): boolean`: Delivers a message directly to a peer.
- `hub.sendReaction(room, reaction, params?): boolean`: Broadcasts a live reaction emoji.
- `hub.getPeers(): string[]` & `hub.peerCount: number`: Peer roster and total count.
- `hub.on(event, listener)` & `hub.off(event, listener)`: Lifecycle events (`stream_start`, `stream_stop`, `peer_register`, `peer_unregister`, `reaction`).

### `WebSocketGroup` WebRTC Methods
- `group.signaling`: The `WebRTCSignalingHub` bound to this group.
- `group.handleSignaling(ws, rawData, params)`
- `group.registerPeer(ws, peerId)`
- `group.unregisterPeer(ws)`
- `group.startBroadcasting(broadcasterId, name, room, title?, params?)`
- `group.stopBroadcasting(broadcasterId, room, params?)`
- `group.getActiveStream(room)`
- `group.isBroadcasting(room)`
- `group.getAllActiveStreams()`
- `group.sendReaction(room, reaction, params?)`
- `group.sendToPeer(peerId, message)`
- `group.peerCount` & `group.getPeers()`

### `Router` WebRTC Methods
- `router.getSignaling(pathOrPattern)`
- `router.getActiveStream(pathOrPattern, room)`
- `router.getAllActiveStreams(pathOrPattern)`
- `router.isBroadcasting(pathOrPattern, room)`
- `router.startBroadcasting(pathOrPattern, broadcasterId, name, room, title?, params?)`
- `router.stopBroadcasting(pathOrPattern, broadcasterId, room, params?)`

---

## 💻 Client-Side Implementation Example

### Broadcaster Setup (Webcam / Microphone)

```javascript
const peerConnections = new Map(); // viewerId -> RTCPeerConnection
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
document.getElementById("local-video").srcObject = localStream;

// Connect to WebSocket signaling route
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onopen = () => {
  // Announce live broadcast
  ws.send(JSON.stringify({
    type: "broadcaster_started",
    broadcasterId: myPeerId,
    broadcasterName: "Alice",
    streamTitle: "Deno WebRTC Live Stream",
    room: currentRoom
  }));
};

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "request_stream") {
    // Create new RTCPeerConnection for incoming viewer
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.set(msg.viewerId, pc);

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Send ICE candidates to viewer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.viewerId,
          candidate: e.candidate
        }));
      }
    };

    // Create & send SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({
      type: "webrtc_offer",
      from: myPeerId,
      to: msg.viewerId,
      sdp: offer,
      fromName: "Alice"
    }));
  }

  if (msg.type === "webrtc_answer") {
    const pc = peerConnections.get(msg.from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
  }

  if (msg.type === "webrtc_candidate") {
    const pc = peerConnections.get(msg.from);
    if (pc && msg.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  }
};
```

### Viewer Setup

```javascript
let pc = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "broadcaster_started") {
    // Request stream from active broadcaster
    ws.send(JSON.stringify({
      type: "request_stream",
      viewerId: myPeerId,
      viewerName: "Bob",
      broadcasterId: msg.broadcasterId,
      room: currentRoom
    }));
  }

  if (msg.type === "webrtc_offer") {
    pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (e) => {
      document.getElementById("remote-video").srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.from,
          candidate: e.candidate
        }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({
      type: "webrtc_answer",
      from: myPeerId,
      to: msg.from,
      sdp: answer,
      fromName: "Bob"
    }));
  }

  if (msg.type === "webrtc_candidate" && pc) {
    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
  }
};
```

````

---

## Arquivo: `docs/websocket-permissions.md`

````md
# 📡 Documentação: Permissionamento Inteligente em WebSockets (Dual Params)

O `@vanaware/wsrouter` possui um sistema nativo e robusto de permissionamento para WebSockets, permitindo que mensagens de broadcast sejam filtradas dinamicamente com base nos **parâmetros do destinatário (receiver)**, nos **parâmetros do remetente (sender)** e no **conteúdo da mensagem**.

---

## 🔑 Conceitos Fundamentais

### 1. `PermissionFn` (Função de Permissão Dual)
É um callback opcional passado ao método `group.broadcast()`. Sua assinatura recebe três argumentos:

```typescript
type PermissionFn = (
  receiverParams: RouteParams, // Parâmetros de quem VAI RECEBER a mensagem
  senderParams: RouteParams,   // Parâmetros de quem ENVIOU a mensagem
  message: string              // O conteúdo da mensagem
) => boolean;
```

---

## 🌍 Exemplos Práticos do Mundo Real

### Cenário 1: Isolamento de Salas de Chat (O Clássico)
**Objetivo:** Garantir que uma mensagem enviada na sala "geral" não vaze para a sala "vip".

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      // Filtra: O receiver deve estar na mesma sala que o sender
      (receiver, sender, _msg) => receiver.room === sender.room,
      params // Passamos os params do remetente
    );
  };
});
```

### Cenário 2: Controle de Acesso por Nível de Usuário (RBAC)
**Objetivo:** Apenas usuários com role `admin` podem enviar alertas de sistema críticos.

```typescript
app.ws("/dashboard/:role/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/dashboard/:role/:userId");
  
  ws.onmessage = (event) => {
    group.broadcast(
      `🚨 ALERTA: ${event.data}`,
      (_receiver, sender, _msg) => {
        // Só permite o broadcast se o SENDER for admin
        return sender.role === "admin";
      },
      params
    );
  };
});
```

### Cenário 3: Filtragem Baseada no Conteúdo da Mensagem
**Objetivo:** Impedir que mensagens contendo a palavra "spam" sejam propagadas.

```typescript
app.ws("/community/:serverId/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/community/:serverId/:userId");
  
  ws.onmessage = (event) => {
    group.broadcast(
      event.data,
      (_receiver, _sender, msgContent) => {
        // Bloqueia se a mensagem contiver "spam"
        return !msgContent.toLowerCase().includes("spam");
      },
      params
    );
  };
});
```

---

## 💡 A "Mágica" do Last Broadcast com Dual Params

Quando um novo membro entra na sala, o router reavalia o `lastBroadcast` usando os **Dual Params**.

```typescript
// 10:00:00 -> User A (room: "lobby") envia: "Olá a todos!"
// O router salva: { message: "Olá...", permissionFn: (r, s) => r.room === s.room, senderParams: { room: "lobby" } }

// 10:00:05 -> User B conecta na rota /chat/lobby/userB
// O router reavalia: permissionFn({ room: "lobby" }, { room: "lobby" }, "Olá...") -> TRUE
// User B recebe a mensagem histórica automaticamente!

// 10:00:10 -> User C conecta na rota /chat/vip/userC
// O router reavalia: permissionFn({ room: "vip" }, { room: "lobby" }, "Olá...") -> FALSE
// User C NÃO recebe a mensagem (Segurança garantida!).
```

## ⚠️ Melhores Práticas

1. **Mantenha a `PermissionFn` Leve:** Evite operações assíncronas (como consultas ao banco de dados) dentro da `PermissionFn`.
2. **Use `senderParams` Corretamente:** Sempre passe o terceiro argumento `params` no `group.broadcast(msg, fn, params)`. Sem isso, o `senderParams` será um objeto vazio `{}` e o recurso de "Last Broadcast" não funcionará corretamente.

````

---

## Arquivo: `docs/workers.md`

````md
# 🔧 Workers: Fallback Programável no Router

A função `app.worker()` permite registrar **handlers genéricos de fallback** que são executados quando nenhuma rota HTTP/WS casa com a requisição, mas **antes** de tentar servir arquivos estáticos.

---

## 🎯 Motivação

No projeto **Loco**, o pacote `@loco/server` possui um `workerHandler` no formato Cloudflare Worker (`fetch(request, env, ctx)`) que processa endpoints como `/ping`, `/push` e `/publickey`. Ao integrar o server com o router, precisamos de uma forma nativa de delegar requisições não roteadas para esse worker, sem duplicar rotas.

O padrão do `main.ts` do server era:

```typescript
// 1. Tenta o worker
const workerResponse = await workerHandler.fetch(req, env, ctx);

// 2. Se o worker retornou 404, tenta static files
if (workerResponse.status !== 404) {
  return workerResponse;
}

// 3. Senão, serveDir
return await serveDir(req, { fsRoot: "./build/dist" });
```

Com `app.worker()`, esse fluxo se torna nativo do router.

---

## 📐 Arquitetura

### Tipo `WorkerHandler`

```typescript
type WorkerHandler = (req: Request) => Promise<Response>;
```

O worker é uma **função simples** que recebe um `Request` e retorna um `Promise<Response>`. Não recebe `env` nem `ctx` — esses valores ficam capturados no **closure** pelo usuário. Isso mantém o router 100% agnóstico.

### Posição no Fluxo de Execução

```
Request
  │
  ├── forceHttps? → 301 redirect
  │
  ├── Middlewares (app.use)
  │
  ├── Rota HTTP encontrada? → executeHttpHandler
  │
  ├── HEAD sem rota? → tenta GET automático
  │
  ├── 405? → Method Not Allowed
  │
  ├── 🆕 Workers (app.worker) ← AQUI
  │     ├── worker1 → 200 → retorna
  │     ├── worker1 → 404 → worker2 → 200 → retorna
  │     └── todos → 404 → null
  │
  ├── Static files (GET/HEAD apenas)
  │
  └── 404 Not Found
```

### Por que depois do 405 e antes do static?

1. **Depois do 405:** Se uma rota existe com outro método, o comportamento HTTP correto é 405, não delegar para um worker.
2. **Antes do static:** Workers podem implementar APIs dinâmicas. Static files são o último recurso.

---

## 📝 API

### Registro

```typescript
app.worker(handler: WorkerHandler): this;
```

Retorna `this` para chaining. Múltiplos workers formam uma **cadeia de fallback**: se um retorna 404, o próximo é tentado.

### Comportamento da Cadeia

```typescript
app.worker(worker1);  // Tentado primeiro
app.worker(worker2);  // Tentado se worker1 retornar 404
app.worker(worker3);  // Tentado se worker2 retornar 404
```

- Se qualquer worker retornar status **≠ 404**, a resposta é retornada imediatamente.
- Se **todos** retornarem 404, o router prossegue para static files.
- Se um worker **lançar exceção**, o erro é logado e o próximo worker é tentado (resiliência).

### Middlewares

**Sim, middlewares funcionam para workers.** Como os workers são executados dentro do `executeFinalHandler`, que é chamado pela cadeia de middlewares, qualquer middleware registrado com `app.use()` intercepta a requisição antes do worker.

Isso significa que logging, CORS, autenticação e rate limiting funcionam automaticamente.

---

## 🌍 Exemplos Práticos

### 1. Integração com workerHandler do @loco/server

O caso de uso principal do projeto Loco:

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";
import workerHandler from "@loco/server/worker";

const env = Deno.env.toObject();
const ctx = {
  waitUntil: (p: Promise<unknown>) => { p.catch(console.error); },
  passThroughOnException: () => {},
};

const app = createDenoRouter({
  basePath: "",
  staticDir: "./build/dist",
});

// Rotas do router (têm prioridade sobre o worker)
app.get("/health", () => ({ body: "OK" }));

// Worker como fallback (antes de static files)
app.worker((req) => workerHandler.fetch(req, env, ctx));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

**Fluxo resultante:**

| Requisição | Resultado |
|---|---|
| `GET /health` | Rota do router → `OK` |
| `POST /ping` | Worker → `{ success: true, service: "loco-proxy" }` |
| `POST /push` | Worker → processa push notification |
| `GET /index.html` | Worker retorna 404 → Static file |
| `GET /nao-existe` | Worker 404 → Static 404 → `404 Not Found` |

### 2. Proxy reverso simples

```typescript
app.worker(async (req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/legacy/")) {
    return new Response("Not Found", { status: 404 });
  }
  // Encaminha para serviço legado
  const target = url.pathname.replace("/api/legacy/", "http://legacy-service:3000/");
  return await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
});
```

### 3. Múltiplos workers (API + Proxy)

```typescript
// Worker 1: APIs do server
app.worker((req) => workerHandler.fetch(req, env, ctx));

// Worker 2: Proxy para serviço externo
app.worker(async (req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/external/")) {
    return new Response("Not Found", { status: 404 });
  }
  return await fetch(url.pathname.replace("/external/", "https://api.externa.com/"));
});
```

---

## ⚠️ Considerações

### Rotas têm prioridade sobre workers

Se existir `app.get("/ping")` **e** um worker que também trata `/ping`, a rota do router **sempre vence**. O worker nunca é chamado para paths que já têm rota registrada.

### Performance

Cada request que não casa com nenhuma rota passa por **todos os workers** antes de chegar aos static files. Workers devem ser rápidos ao retornar 404 (ex: checar prefixo de URL antes de processar).

```typescript
// ✅ BOM: retorno rápido
app.worker(async (req) => {
  if (!new URL(req.url).pathname.startsWith("/api/")) {
    return new Response("Not Found", { status: 404 });
  }
  // ... processamento
});

// ❌ RUIM: processamento desnecessário
app.worker(async (req) => {
  const data = await heavyComputation(); // Executa mesmo para /index.html
  // ...
});
```

### env e ctx via closure

O router não conhece `env` nem `ctx`. Esses valores são capturados no closure do worker:

```typescript
// env e ctx vivem fora do router
const env = Deno.env.toObject();
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(console.error) };

// O closure captura env e ctx
app.worker((req) => workerHandler.fetch(req, env, ctx));
```

Isso é intencional: mantém o router agnóstico e permite que qualquer runtime forneça seu próprio contexto.

### Erros em workers

Se um worker lançar exceção, o erro é logado no console e o **próximo worker é tentado**. Isso garante que um worker com bug não derruba toda a aplicação.

---

## 📋 Resumo

| Aspecto | Detalhe |
|---|---|
| **Tipo** | `(req: Request) => Promise<Response>` |
| **Registro** | `app.worker(handler)` |
| **Múltiplos** | Sim, cadeia de fallback (404 → próximo) |
| **Middlewares** | Sim, executam antes dos workers |
| **Prioridade** | Rotas > Workers > Static files > 404 |
| **Erros** | Logados, próximo worker tentado |
| **env/ctx** | Via closure, router não conhece |

````

---

