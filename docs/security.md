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

### Dotfiles

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

Se precisar servir dotfiles (não recomendado):

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: true, // ⚠️ Risco de segurança
});
```

### Symlinks

O adaptador Deno **recusa symlinks** por padrão para evitar vazamento de arquivos fora do diretório público.

**Exemplo de ataque bloqueado:**
```bash
# Se existir: public/secret -> /etc/passwd
# Requisição: GET /secret
# Resultado: 404 (não serve o arquivo)
```

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
