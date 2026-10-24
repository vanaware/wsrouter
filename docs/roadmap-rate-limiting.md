# 🚦 Roadmap: Rate Limiting and Abuse Protection

`@vanaware/wsrouter` currently **does not include native rate limiting**. This document describes recommended strategies and the roadmap for possible future implementations.

---

## 📊 Current Status

| Feature | Status | Recommended Implementation |
|---------|--------|---------------------------|
| Rate Limiting by IP | ❌ | Custom middleware |
| Rate Limiting by User | ❌ | Custom middleware |
| Rate Limiting by WebSocket | ❌ | Custom middleware |
| Maximum Message Size | ❌ | Handler validation |
| Broadcast Backpressure | ❌ | Handler logic |

---

## 🛡️ Why Is Rate Limiting Important?

### Common Attacks

1. **Brute Force**: Massive login attempts
2. **DDoS**: Overloading the server with requests
3. **Credential Stuffing**: Testing leaked credentials
4. **Scraping**: Automated data extraction
5. **WebSocket Flood**: Massive message sending

### Impacts Without Rate Limiting

- **Degraded performance**: CPU/memory overloaded
- **High costs**: Excessive resource usage (especially in serverless)
- **Compromised data**: Accounts breached via brute force
- **Availability**: Service unavailable for legitimate users

---

## 💡 Recommended Implementations

### 1. Simple Rate Limiting (In Memory)

Suitable for single-instance applications:

```typescript
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use(async (req, _params, next) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const windowMs = 60000; // 1 minute
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

**Limitations:**
- Does not work across multiple instances
- Loses state on restart
- No persistence

---

### 2. Rate Limiting with Redis (Distributed)

For multi-instance applications:

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

**Advantages:**
- Works across multiple instances
- Persistent
- Atomicity guaranteed

---

### 3. Rate Limiting by Authenticated User

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
    return await next(); // Let the auth handler deal with it
  }
  
  const key = `ratelimit:user:${userId}`;
  // ... same rate limiting logic
  
  return await next();
});
```

---

### 4. WebSocket Rate Limiting

#### Message Limit per Second

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
    
    // Process the message normally
    const group = app.getWsGroupByPath("/chat/:room/:user");
    group.broadcast(event.data, /* ... */);
  };
});
```

#### Maximum Message Size

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
    
    // Process the message
  };
});
```

---

### 5. Broadcast Backpressure

When a client is slow, broadcasting can pile up messages:

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");
  const maxQueueSize = 100;
  let messageQueue: string[] = [];
  
  ws.onmessage = (event) => {
    // Normal broadcast
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  // Monitor bufferedAmount (WebSocket API)
  setInterval(() => {
    if (ws.bufferedAmount > 1024 * 1024) { // > 1 MB
      console.warn(`[WS] Client ${params.user} has a high buffer: ${ws.bufferedAmount}`);
      // Optional: close the connection or send an alert
      ws.send(JSON.stringify({
        type: "warning",
        message: "You're receiving messages faster than you can process them.",
      }));
    }
  }, 5000);
});
```

---

## 🔮 Possible Future Implementation in the Core

If rate limiting were added to the core, it could look like this:

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

### Challenges

1. **Storage**: In memory vs Redis vs database
2. **Distribution**: How to synchronize between instances
3. **Flexibility**: Different limits for different routes
4. **Performance**: Overhead of checking rate limits on every request

### Priority: **Medium**

Rate limiting is important, but mature solutions (middlewares, proxies) already exist and can be used. Implementing it in the core may be over-engineering.

---

## 📚 Recommended Libraries

### For Node.js

- **rate-limiter-flexible**: Supports Redis, MongoDB, memory
- **express-rate-limit**: Simple and popular
- **slow-down**: Adds delay instead of blocking

### For Deno

There are currently no mature libraries. Implement your own or use Redis directly.

### For Cloudflare

- **Cloudflare Rate Limiting Rules**: Configured in the dashboard
- **Workers KV**: For distributed rate limiting

---

## ✅ Rate Limiting Checklist

- [ ] Rate limit by IP on public endpoints
- [ ] More aggressive rate limit on `/login`, `/register`
- [ ] Rate limit by authenticated user
- [ ] WebSocket rate limiting (messages/second)
- [ ] Maximum WebSocket message size
- [ ] `X-RateLimit-*` headers on responses
- [ ] Logs of abuse attempts
- [ ] Alerts for anomalous traffic spikes

---

## 🎯 Recommendations by Application Size

### Small (Single Instance, < 1000 req/min)

- In-memory rate limiting
- No Redis
- Simple middleware

### Medium (Multi-Instance, < 10000 req/min)

- Redis for distributed rate limiting
- Different limits per route
- Basic monitoring

### Large (> 10000 req/min)

- Edge solution (Cloudflare, AWS WAF)
- Redis cluster
- Traffic pattern analysis
- Machine learning for anomaly detection

---

## 🤝 Contributing

If you have implemented a robust rate limiting solution, consider:

1. Sharing it as an example in `example/rate-limiting/`
2. Creating a separate package: `@vanaware/wsrouter-rate-limit`
3. Opening an issue discussing the approach

We are open to contributions! 🚀
