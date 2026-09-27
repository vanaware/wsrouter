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
