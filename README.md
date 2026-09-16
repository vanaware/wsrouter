# 🚂 @vanaware/wsrouter

[![Deno](https://img.shields.io/badge/Deno-1.40+-black?logo=deno)](https://deno.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Router HTTP/WebSocket runtime-agnostic para Deno** — Rápido, seguro e extensível.

O `@vanaware/wsrouter` é um router moderno com suporte completo a HTTP e WebSockets, projetado com arquitetura agnóstica que permite execução em múltiplos runtimes JavaScript. Atualmente oferece suporte oficial para **Deno**, com adaptadores para Node.js, Bun e Cloudflare Workers em desenvolvimento.

## ✨ Features Principais

### 🌐 HTTP Routing
- ✅ Todos os métodos HTTP: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`
- ✅ Parâmetros de rota nomeados (`:id`) e catch-all (`*`)
- ✅ **HEAD automático** baseado em rotas GET (semântica HTTP correta)
- ✅ **405 Method Not Allowed** com header `Allow` quando método não é permitido
- ✅ Base path configurável com normalização inteligente

### 🔌 WebSockets
- ✅ Upgrade automático com adaptadores por runtime
- ✅ **Grupos de WebSocket** com broadcast inteligente
- ✅ **Dual Params PermissionFn**: filtra por receiver, sender e conteúdo da mensagem
- ✅ **Last Broadcast automático**: novos membros recebem a última mensagem ao conectar
- ✅ Handlers `onclose`/`onerror` não são sobrescritos pelo router
- ✅ Graceful shutdown com `closeAllWebSockets()`

### 🛡️ Segurança
- ✅ **Force HTTPS** com redirect automático (ignora localhost)
- ✅ **HSTS** (HTTP Strict Transport Security) em respostas HTTPS
- ✅ **Trust Proxy** explícito para headers `X-Forwarded-*`
- ✅ **Bloqueio de dotfiles** (`.env`, `.git`, etc.) por padrão
- ✅ **Recusa de symlinks** para evitar vazamento de arquivos
- ✅ **Path traversal protection** com sanitização e containment real
- ✅ Headers completos em arquivos estáticos (`ETag`, `Last-Modified`, `Cache-Control`)

### 🎯 Middlewares
- ✅ Cadeia de middlewares com `next()`
- ✅ **Rewrite de rotas** via `next(newReq)`
- ✅ Execução mesmo em 404 (útil para logging e CORS)
- ✅ Proteção contra múltiplas chamadas de `next()`

### 📂 Arquivos Estáticos
- ✅ Servir arquivos de diretório local
- ✅ Fallback automático para `index.html` e `index.htm`
- ✅ **Redirect 301** para diretórios sem barra final
- ✅ MIME types modernos (`.webp`, `.avif`, `.webmanifest`, etc.)
- ✅ Suporte a diretórios embutidos (embedded)

---

## 📦 Instalação

### Deno

```typescript
import { createDenoRouter } from "jsr:@vanaware/wsrouter@1.0.0/deno";
```

Ou via import map no `deno.json`:

```json
{
  "imports": {
    "@vanaware/wsrouter": "jsr:@vanaware/wsrouter@1.0.0"
  }
}
```

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";
```

---

## 🚀 Quick Start

### Servidor HTTP Simples

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

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
console.log("🚀 Servidor rodando em http://localhost:3000");
```

### Chat WebSocket com Salas

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room/:user", (ws, _req, params) => {
  const room = params.room as string;
  const user = params.user as string;
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  if (!group) {
    ws.close(1011, "Internal error");
    return;
  }
  
  console.log(`✅ ${user} entrou na sala ${room}`);
  
  ws.onmessage = (event) => {
    // Broadcast apenas para usuários na mesma sala
    group.broadcast(
      `[${user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  ws.onclose = () => {
    console.log(`❌ ${user} saiu da sala ${room}`);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 🌐 Roteamento HTTP

### Métodos Suportados

```typescript
app.get("/path", handler);
app.post("/path", handler);
app.put("/path", handler);
app.delete("/path", handler);
app.patch("/path", handler);
app.options("/path", handler);
app.head("/path", handler);
```

### Formato do Handler

Os handlers retornam um objeto com `body` e opcionalmente `init`:

```typescript
type HttpHandler = (
  req: Request,
  params: RouteParams,
) => { body: BodyInit; init?: ResponseInit } | Promise<{ body: BodyInit; init?: ResponseInit }>;
```

#### Exemplos

**Resposta JSON:**
```typescript
app.get("/api/user/:id", async (_req, params) => {
  const user = await db.getUser(params.id);
  return {
    body: JSON.stringify(user),
    init: {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  };
});
```

**Resposta de Texto:**
```typescript
app.get("/hello", () => ({
  body: "Hello, World!",
}));
```

**Status Customizado:**
```typescript
app.post("/users", async (req) => {
  const data = await req.json();
  const user = await db.createUser(data);
  return {
    body: JSON.stringify(user),
    init: {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  };
});
```

**No Content (204):**
```typescript
app.delete("/users/:id", async (_req, params) => {
  await db.deleteUser(params.id);
  return {
    body: "",
    init: { status: 204 },
  };
});
```

**Redirect:**
```typescript
app.get("/old-page", () => ({
  body: "",
  init: {
    status: 301,
    headers: { "Location": "/new-page" },
  },
}));
```

### Parâmetros de Rota

```typescript
// Parâmetros nomeados
app.get("/users/:id/posts/:postId", (_req, params) => {
  console.log(params.id);      // "123"
  console.log(params.postId);  // "456"
  return { body: "OK" };
});

// Catch-all com *
app.get("/files/*", (_req, params) => {
  console.log(params.catch);  // ["path", "to", "file.txt"]
  return { body: JSON.stringify(params.catch) };
});

// Combinação
app.get("/api/:version/*", (_req, params) => {
  console.log(params.version);  // "v1"
  console.log(params.catch);    // ["users", "123"]
  return { body: "OK" };
});
```

### HEAD Automático

O router automaticamente suporta `HEAD` para rotas `GET` registradas:

```typescript
app.get("/resource", () => ({
  body: "data",
  init: { headers: { "X-Custom": "value" } },
}));

// GET /resource → 200 com body "data"
// HEAD /resource → 200 com headers mas body vazio
```

### 405 Method Not Allowed

Quando um path existe mas o método não é permitido:

```typescript
app.get("/resource", () => ({ body: "data" }));
app.post("/resource", () => ({ body: "created", init: { status: 201 } }));

// PUT /resource → 405 Method Not Allowed
// Headers: Allow: GET, POST
```

---

## 🎯 Middlewares

Middlewares executam antes do handler final e podem modificar a requisição, abortar o fluxo ou passar controle adiante.

### Básico

```typescript
app.use(async (req, params, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  return await next();
});
```

### Abortar Fluxo

```typescript
app.use(async (req, _params, next) => {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }
  return await next();
});
```

### Modificar Resposta

```typescript
app.use(async (_req, _params, next) => {
  const res = await next();
  res.headers.set("X-Custom-Header", "value");
  return res;
});
```

### Rewrite de Rota

Você pode passar uma nova `Request` para `next()` para reescrever a rota:

```typescript
app.use(async (req, _params, next) => {
  // Reescreve /old-api/* para /api/*
  if (req.url.includes("/old-api/")) {
    const newUrl = req.url.replace("/old-api/", "/api/");
    const newReq = new Request(newUrl, req);
    return next(newReq);
  }
  return next();
});
```

### Logging com Tempo

```typescript
app.use(async (req, _params, next) => {
  const start = Date.now();
  const res = await next();
  const ms = Date.now() - start;
  console.log(`${req.method} ${req.url} → ${res.status} (${ms}ms)`);
  return res;
});
```

### CORS

```typescript
app.use(async (req, _params, next) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  const res = await next();
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
});
```

---

## 📂 Arquivos Estáticos

### Configuração Básica

```typescript
const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",  // Diretório de arquivos estáticos
});
```

### Com Diretório Embutido

```typescript
const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
  embeddedDir: "./dist",  // Tenta embedded primeiro, depois static
});
```

### Comportamento

- Serve arquivos de `staticDir` quando rota HTTP não é encontrada
- Fallback automático: `/docs` → `/docs.html` → `/docs/index.html`
- **Redirect 301** para diretórios sem barra final: `/docs` → `/docs/`
- Apenas métodos `GET` e `HEAD` são servidos
- Headers completos: `Content-Type`, `Content-Length`, `Last-Modified`, `ETag`, `Cache-Control`

### MIME Types Modernos

Suporte nativo para:
- Imagens: `.webp`, `.avif`, `.png`, `.jpg`, `.gif`, `.svg`
- Web: `.html`, `.css`, `.js`, `.mjs`, `.json`, `.webmanifest`
- Fontes: `.woff`, `.woff2`, `.ttf`, `.otf`
- Mídia: `.mp3`, `.mp4`, `.webm`
- Outros: `.pdf`, `.xml`, `.wasm`, `.ts`, `.tsx`, `.jsx`

---

## 🔌 WebSockets

### Upgrade Automático

```typescript
app.ws("/chat/:room", (ws, req, params) => {
  console.log(`Cliente conectou na sala ${params.room}`);
  
  ws.onmessage = (event) => {
    ws.send(`Echo: ${event.data}`);
  };
  
  ws.onclose = () => {
    console.log("Cliente desconectou");
  };
});
```

### Grupos de WebSocket

Cada rota WS tem seu próprio grupo automaticamente:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  ws.onmessage = (event) => {
    // Broadcast para todos na mesma rota
    group.broadcast(event.data);
  };
});
```

### Dual Params PermissionFn

Filtre broadcasts com base em **receiver**, **sender** e **mensagem**:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, message) => {
        // Regra 1: Mesma sala
        if (receiver.room !== sender.room) return false;
        
        // Regra 2: Não enviar para o próprio sender
        if (receiver.user === sender.user) return false;
        
        // Regra 3: Bloquear spam
        if (message.toLowerCase().includes("spam")) return false;
        
        return true;
      },
      params  // senderParams
    );
  };
});
```

### Last Broadcast Automático

Novos membros recebem a última mensagem ao conectar:

```typescript
// 10:00:00 → User A envia: "Olá a todos!"
// Router salva: { message: "Olá...", permissionFn: ..., senderParams: { room: "lobby" } }

// 10:00:05 → User B conecta em /chat/lobby/userB
// Router reavalia: permissionFn({ room: "lobby" }, { room: "lobby" }, "Olá...") → TRUE
// User B recebe "Olá a todos!" automaticamente!

// 10:00:10 → User C conecta em /chat/vip/userC
// Router reavalia: permissionFn({ room: "vip" }, { room: "lobby" }, "Olá...") → FALSE
// User C NÃO recebe (segurança garantida!)
```

### Fechar Grupos

```typescript
// Fechar grupo específico
app.closeGroupByPath("/chat/:room/:user");

// Fechar todos os WebSockets (graceful shutdown)
app.closeAllWebSockets();
```

---

## 🛡️ Segurança

### Force HTTPS

Redireciona HTTP → HTTPS automaticamente em produção:

```typescript
const app = createDenoRouter({
  forceHttps: true,
});
```

**Comportamento:**
- Redireciona com status `301 Moved Permanently`
- Ignora automaticamente `localhost`, `127.0.0.1` e `[::1]` (IPv6)
- Adiciona header `Strict-Transport-Security` (HSTS)

### Trust Proxy

Quando atrás de proxy reverso (nginx, Cloudflare, etc.):

```typescript
const app = createDenoRouter({
  forceHttps: true,
  trustProxy: true,  // ⚠️ Apenas se estiver atrás de proxy confiável
});
```

Com `trustProxy: true`, o router respeita o header `X-Forwarded-Proto`.

**⚠️ AVISO:** Nunca ative `trustProxy` se o servidor estiver exposto diretamente à internet.

### Bloqueio de Dotfiles

Por padrão, arquivos que começam com `.` são bloqueados:

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: false,  // Default: false
});
```

**Bloqueados:** `.env`, `.git/config`, `.DS_Store`, `.htaccess`, etc.

Se precisar servir dotfiles (não recomendado):

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: true,  // ⚠️ Risco de segurança
});
```

### Proteção contra Path Traversal

O router sanitiza caminhos e verifica containment real:

```typescript
// Requisição maliciosa
GET /../../etc/passwd
GET /..%2F..%2Fetc%2Fpasswd

// Resultado: 404 (caminho sanitizado e verificado)
```

### Recusa de Symlinks

O adaptador Deno recusa symlinks por padrão para evitar vazamento:

```bash
# Se existir: public/secret -> /etc/passwd
# Requisição: GET /secret
# Resultado: 404 (symlink recusado)
```

### Headers de Segurança

Adicione via middleware:

```typescript
app.use(async (_req, _params, next) => {
  const res = await next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  return res;
});
```

---

## 🔌 Adaptadores

### Deno (Oficial)

Suporte completo e testado:

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
  forceHttps: true,
  trustProxy: true,
  allowDotfiles: false,
});
```

**Features:**
- ✅ HTTP Routing
- ✅ WebSockets (via `Deno.upgradeWebSocket`)
- ✅ Static Files (via `Deno.open` + `Deno.stat`)
- ✅ Containment real e recusa de symlinks
- ✅ Headers completos (ETag, Last-Modified, etc.)

### Outros Runtimes (Roadmap)

O core é runtime-agnostic. Adaptadores para outros runtimes estão em desenvolvimento:

#### Node.js (Planejado)

```typescript
// Futuro
import { createNodeRouter } from "@vanaware/wsrouter/node";
```

**Desafios:**
- URLPattern disponível apenas em Node 18.17+
- WebSocket requer biblioteca externa (`ws`, `uWebSockets.js`)
- Static files via módulo `fs`

#### Bun (Planejado)

```typescript
// Futuro
import { createBunRouter } from "@vanaware/wsrouter/bun";
```

**Vantagens:**
- Compatível com APIs Node.js
- Suporte nativo a WebSocket via `Bun.serve`
- Performance excelente

#### Cloudflare Workers (Removido do Core)

Os adaptadores Cloudflare foram **removidos do core** na versão 1.0 devido a limitações de estado compartilhado. Para WebSockets em Cloudflare, use **Durable Objects**.

Para static files, use a nova feature **Static Assets** do Cloudflare Workers.

Veja [docs/roadmap-adapters.md](./docs/roadmap-adapters.md) para detalhes.

### Criando seu Próprio Adaptador

Implemente as interfaces:

```typescript
interface WebSocketUpgrader {
  upgrade(req: Request): { socket: WebSocket; response: Response };
}

interface StaticFileHandler {
  handle(path: string): Promise<Response | null>;
}
```

Use o core diretamente:

```typescript
import { Router } from "@vanaware/wsrouter";

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: myCustomUpgrader,
  staticFileHandler: myCustomStaticHandler,
});
```

---

## 📚 API Reference

### `createDenoRouter(options)`

```typescript
interface DenoRouterOptions {
  basePath?: string;           // Prefixo para todas as rotas
  staticDir?: string | null;   // Diretório de arquivos estáticos (default: null)
  embeddedDir?: string | null; // Diretório embutido (opcional)
  forceHttps?: boolean;        // Redirecionar HTTP → HTTPS
  trustProxy?: boolean;        // Confiar em X-Forwarded-*
  allowDotfiles?: boolean;     // Permitir arquivos .env, .git, etc.
  lastBroadcastDelay?: number; // Delay antes de enviar last broadcast (default: 0ms)
}
```

### `Router` Methods

```typescript
// Registro de rotas
app.get(path, handler)
app.post(path, handler)
app.put(path, handler)
app.delete(path, handler)
app.patch(path, handler)
app.options(path, handler)
app.head(path, handler)
app.ws(path, handler)

// Middlewares
app.use(middleware)

// WebSockets
app.getWsGroupByPath(pattern): WebSocketGroup | undefined
app.closeGroupByPath(pattern): boolean
app.closeAllWebSockets(): void

// Handler principal
app.handleRequest(req: Request): Promise<Response>
```

### `WebSocketGroup` Methods

```typescript
group.addSocket(ws, params)
group.removeSocket(ws)
group.size: number

group.broadcast(message, permissionFn?, senderParams?)
group.sendLastBroadcastTo(ws, receiverParams)
group.closeGroup()
```

### `PermissionFn`

```typescript
type PermissionFn = (
  receiverParams: RouteParams,
  senderParams: RouteParams,
  message: string,
) => boolean;
```

---

## 📖 Exemplos Completos

### Autenticação JWT

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET"));

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
});

// Rota de login
app.post("/login", async (req) => {
  const { username, password } = await req.json();
  
  if (username === "admin" && password === "secret") {
    const token = await new SignJWT({ userId: "1", username })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(JWT_SECRET);
    
    return {
      body: JSON.stringify({ token }),
      init: { headers: { "Content-Type": "application/json" } },
    };
  }
  
  return {
    body: JSON.stringify({ error: "Invalid credentials" }),
    init: { status: 401 },
  };
});

// Middleware de autenticação WebSocket
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
    await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    return await next();
  } catch {
    return new Response("Invalid token", { status: 403 });
  }
});

// Rota WebSocket protegida
app.ws("/chat/:room", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room");
  
  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.room}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
});
```

### Rate Limiting

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
      },
    });
  }
  
  const res = await next();
  res.headers.set("X-RateLimit-Limit", maxRequests.toString());
  res.headers.set("X-RateLimit-Remaining", (maxRequests - record.count).toString());
  return res;
});
```

---

## 🧪 Testes

Execute a suíte completa de testes:

```bash
deno task tests
```

Ou separadamente:

```bash
# Type checking
deno task check

# Testes unitários
deno task test

# Formatação
deno task fmt

# Linting
deno task lint
```

---

## 📚 Documentação

- [Guia de Segurança](./docs/security.md)
- [Roadmap de Adaptadores](./docs/roadmap-adapters.md)
- [Roadmap de Rate Limiting](./docs/roadmap-rate-limiting.md)
- [Arquitetura Runtime-Agnostic](./docs/runtime-agnostic.md)
- [Middlewares](./docs/middleware.md)
- [Permissões WebSocket](./docs/websocket-permissions.md)
- [Retorno de Handlers](./docs/return.md)

---

## 🗺️ Roadmap

### Versão 1.0 (Atual)
- ✅ Core agnóstico estável
- ✅ Adaptador Deno completo
- ✅ Sistema de permissões Dual Params
- ✅ Segurança reforçada (HSTS, trustProxy, dotfiles, symlinks)

### Versão 1.1 (Planejado)
- ⏳ Adaptador Node.js oficial
- ⏳ Adaptador Bun oficial
- ⏳ Suporte a Range Requests para arquivos grandes
- ⏳ Validação de Origin em WebSockets

### Versão 2.0 (Futuro)
- ⏳ Rate limiting nativo no core
- ⏳ Integração com OpenTelemetry
- ⏳ Suporte a HTTP/2 Server Push
- ⏳ Compressão automática (gzip, brotli)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Desenvolvimento Local / AI Studio

Devido às restrições do ambiente AI Studio e para compatibilidade com a plataforma, o projeto utiliza a porta `3000` para o servidor de desenvolvimento. A infraestrutura inclui um arquivo `package.json` ponte que executa o `install-script.sh` antes de invocar o `deno task`. Isso garante que o Deno seja baixado e configurado se não estiver no ambiente.

```bash
# Iniciar o servidor de desenvolvimento
npm run dev

# Rodar a checagem completa de testes, tipos e linting
npm run test
```

Caso esteja rodando localmente (fora do AI Studio) com o Deno já instalado:

```bash
# Clone o repositório
git clone https://github.com/vanaware/wsrouter.git
cd wsrouter

# Execute testes
deno task check-all

# Execute exemplo principal
deno task dev
```

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](./LICENSE) para detalhes.


<!-- START:changelog -->
<!-- END:changelog -->