# 🔒 @vanaware/wsrouter Security Guide

This document describes the recommended security practices when using `@vanaware/wsrouter` in production.

## 📋 Index

1. [HTTPS and HSTS](#https-and-hsts)
2. [Static File Protection](#static-file-protection)
3. [WebSocket Security](#websocket-security)
4. [Authentication and Authorization](#authentication-and-authorization)
5. [Rate Limiting](#rate-limiting)
6. [Security Headers](#security-headers)

---

## 🌐 HTTPS and HSTS

### Force HTTPS

The router supports automatic HTTP-to-HTTPS redirection:

```typescript
const app = createDenoRouter({
  basePath: "/api",
  forceHttps: true, // Redirects HTTP → HTTPS
});
```

**Behavior:**
- Redirects with status `301 Moved Permanently`
- Automatically ignores `localhost` and `127.0.0.1` to ease development
- Supports IPv6 `[::1]`

### Proxy Trust (`trustProxy`)

When running behind a reverse proxy (nginx, Cloudflare, etc.), the router can trust the `X-Forwarded-Proto` header:

```typescript
const app = createDenoRouter({
  forceHttps: true,
  trustProxy: true, // ⚠️ Only if behind a trusted proxy
});
```

**⚠️ WARNING:** Never enable `trustProxy` if the server is exposed directly to the internet. An attacker could send `X-Forwarded-Proto: https` and bypass the redirect.

### HSTS (HTTP Strict Transport Security)

When `forceHttps` is active and the request is already HTTPS, the router automatically adds:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This instructs browsers to always use HTTPS for your domain.

---

## 📂 Static File Protection

### Dotfiles and Traversal Defense-in-Depth

By default, files that begin with `.` are blocked:

```typescript
const app = createDenoRouter({
  staticDir: "./public",
  allowDotfiles: false, // Default: false
});
```

**Blocked by default:**
- `.env`, `.env.local`
- `.git/config`, `.git/HEAD`
- `.DS_Store`
- `.htaccess`

Even when `allowDotfiles: true` is enabled (for example, to serve `.well-known`), relative directory segments such as `..` and `.` remain **strictly forbidden and blocked with 404**, guaranteeing that enabling dotfiles never opens path traversal gaps.

### Symlinks and Symlinked Directories

The Deno adapter **rejects symlinks** directly and validates the physical resolution with `Deno.realPath`:
- Direct symlinks are detected via `Deno.lstat` and rejected.
- Intermediate symlinked directories are validated against `resolvedBase`, preventing symlinked directories pointing outside the `staticDir` from being accessed.

### Static File Headers & MIME Protection

The Deno adapter automatically injects:
- `X-Content-Type-Options: nosniff` (preventing MIME sniffing attacks)
- `ETag` and transparent `If-None-Match` support (returning `304 Not Modified` and cancelling the stream to save I/O)
- `Cache-Control` and `Last-Modified`
- Safe handling of `HEAD` requests, cancelling the opened stream to avoid file descriptor leaks.

### Path Traversal

The router sanitizes paths to prevent path traversal attacks:

```typescript
// Malicious request
GET /../../etc/passwd
GET /..%2F..%2Fetc%2Fpasswd

// Result: 404 (path sanitized before access)
```

### Containment

The Deno adapter verifies that the resolved path is strictly inside the `staticDir`:

```typescript
const app = createDenoRouter({
  staticDir: "/var/www/public",
});

// Request: GET /../../etc/passwd
// Even after sanitization, the resolved path is verified
// Result: 404 if it attempts to escape the directory
```

---

## 🔌 WebSocket Security

### Origin Validation

WebSockets are vulnerable to Cross-Site WebSocket Hijacking (CSWSH) attacks. Validate the `Origin` header:

```typescript
const allowedOrigins = ["https://mysite.com", "https://app.mysite.com"];

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

### Authentication via Subprotocol

The JWT example demonstrates how to pass tokens through the WebSocket subprotocol:

```javascript
// Client
const ws = new WebSocket("wss://api.site.com/chat", ["Bearer", token]);

// Server (middleware)
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

### Room Isolation

Use `permissionFn` to ensure messages do not leak between rooms:

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

**Without `permissionFn`, the broadcast sends to ALL sockets on the route**, not only to the same room.

---

## 🔐 Authentication and Authorization

### JWT with Expiration

Always set expiration on JWT tokens:

```typescript
import { SignJWT } from "jose";

const token = await new SignJWT({ userId: "123", role: "user" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h") // ⚠️ Always set
  .setIssuedAt()
  .sign(secret);
```

### Algorithm Validation

When verifying JWTs, specify the allowed algorithms:

```typescript
import { jwtVerify } from "jose";

await jwtVerify(token, secret, {
  algorithms: ["HS256"], // ⚠️ Avoid "none" and weak algorithms
});
```

### Secrets in Environment Variables

Never hardcode secrets in production:

```typescript
// ❌ BAD
const JWT_SECRET = "my-secret-123";

// ✅ GOOD
const JWT_SECRET = Deno.env.get("JWT_SECRET");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not configured");
}
```

---

## 🚦 Rate Limiting

The router **does not include native rate limiting**. Use middlewares to protect against abuse:

```typescript
// Simple example of rate limiting by IP
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
      },
    });
  }

  return await next();
});
```

For production, consider:
- Redis for distributed rate limiting
- Specialized libraries such as `rate-limiter-flexible`
- Edge solutions (Cloudflare, AWS WAF)

---

## 🛡️ Security Headers

Add security headers via middleware:

```typescript
app.use(async (req, _params, next) => {
  const res = await next();

  // Prevent clickjacking
  res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer Policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (adjust as needed)
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  return res;
});
```

---

## ✅ Production Security Checklist

- [ ] `forceHttps: true` enabled
- [ ] `trustProxy: true` only if behind a trusted proxy
- [ ] `allowDotfiles: false` (default)
- [ ] `Origin` validation on WebSockets
- [ ] JWT tokens with expiration and restricted algorithms
- [ ] Secrets in environment variables
- [ ] Rate limiting implemented
- [ ] Security headers added
- [ ] Audit logs for authentication
- [ ] HTTPS/WSS in production (never HTTP/WS)

---

## 📚 Additional Resources

- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [MDN: HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
