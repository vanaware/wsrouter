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
 │  - Router, WebSocketGroup, tipos                        │
 │  - ZERO dependência de runtime                          │
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

Deno.serve({ port: 8000 }, app.handleRequest.bind(app));
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
