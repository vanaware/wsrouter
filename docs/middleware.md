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

Deno.serve({ port: 8000 }, app.handleRequest.bind(app));
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
