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
