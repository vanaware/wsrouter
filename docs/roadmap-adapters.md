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

