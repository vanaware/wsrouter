# 📌 CURRENT.md: Project Status & Directive

**Project**: `@vanaware/wsrouter`  
**Version**: `0.1.0`  
**Runtime**: Deno 2.x  
**Last Update**: September 2026  

---

## 🎯 Executive Summary & Status

WsRouter is a high-performance, runtime-agnostic WebSocket and HTTP router designed for modern JavaScript runtimes with first-class Deno support. All core modular classes (`Router`, `HttpRoute`, `WsRoute`, `MiddlewareRoute`, `MiddlewareChain`, `WorkerRoute`, `WebSocketGroup`) are implemented, tested, and strictly validated against TypeScript strict mode.

---

## 🛡️ Security Audit & Hardening (Completed)

A comprehensive security audit of the codebase was conducted across routing, static file serving, WebSocket connection lifecycle, and proxy handling. All identified vectors have been hardened and verified with automated BDD tests (`tests/security_audit_test.ts`):

1. **Static File Path Traversal Defense-in-Depth**:
   - Sanitized paths are verified to ensure that traversal segments (`..` or `.`) are strictly rejected with `404 Not Found` even when `allowDotfiles: true` is configured (preventing `.well-known` allowlists from accidentally exposing parent folders).
   - Pre-validation ensures `normalize("/" + adjustedPathname)` cannot begin with `/..`.

2. **Symlink Directory Containment**:
   - In `src/adapters/deno.ts`, `Deno.lstat` checks if candidate files are symlinks.
   - In addition, `Deno.realPath` resolution verifies that the file and any parent directories stay strictly within `resolvedBase`, preventing symlinked directories from escaping the public folder.

3. **MIME Confusion & Sniffing Protection**:
   - Added `"X-Content-Type-Options": "nosniff"` to static file responses in `src/adapters/deno.ts`.

4. **Resource / File Descriptor Leak Prevention on HEAD Requests**:
   - When handling `HEAD` requests for static files, the opened `file.readable` stream is explicitly cancelled via `await staticRes.body.cancel()` prior to returning the null-body Response, ensuring no lingering file descriptors in the Deno runtime.

5. **HTTP Caching & 304 Not Modified Support**:
   - Integrated `If-None-Match` verification matching the static file `ETag`. Returns `304 Not Modified` with headers intact and cancels body streaming to save bandwidth and improve throughput.

6. **Directory Redirect BasePath Preservation**:
   - Directory 301 redirects (e.g. `/docs` -> `/docs/`) preserve `this.basePath`, ensuring clients are correctly redirected to `/base/docs/` instead of losing their path prefix.

7. **Host Header & Proxy Sanitization**:
   - When `trustProxy: true` is enabled, `X-Forwarded-Proto` values are normalized and `X-Forwarded-Host` is validated against `/^[\w.:-]+$/` to prevent host header injection and open redirects.

8. **WebSocket Connection Pool Lifecycle**:
   - `WebSocketGroup.broadcast` automatically cleans up closed and closing sockets (`WebSocket.CLOSED` / `CLOSING`) from the pool.
   - `sendLastBroadcastTo` validates that the recipient socket is still registered in the group before sending, preventing message delivery to connections that departed during the delay window.
   - `closeAllWebSockets` and `closeGroup` safely close sockets in `CONNECTING` state as well as `OPEN` state.

---

## 🧪 Test Suite & Validation Status

- **Framework**: `@std/testing/bdd` (`describe`, `it`) & `@std/assert`.
- **Total Tests**: **124 tests (49 sub-steps)** passing cleanly.
- **Type Checking**: `deno task check` passes with 0 type errors.
- **Linting**: `npm run lint` (`deno lint`) checked 20 files with 0 warnings or errors.

### Test Coverage Files
- `tests/router-test.ts`: Core routing, mounting, and parameters.
- `tests/router_http_test.ts`: HTTP methods, status codes, and headers.
- `tests/router_http_methods_test.ts`: Advanced methods (`OPTIONS`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `405`).
- `tests/router_static_test.ts`: Static file resolution and directory indices.
- `tests/routes_class_test.ts`: Modular OOP route classes (`HttpRoute`, `WsRoute`, `MiddlewareRoute`, `WorkerRoute`).
- `tests/security_test.ts`: Base security features (`forceHttps`, `trustProxy`, `HSTS`, `dotfiles`, `symlinks`).
- `tests/security_audit_test.ts`: Hardened security suite (`nosniff`, `If-None-Match 304`, `HEAD stream cancel`, `path traversal with allowDotfiles`, `X-Forwarded-Host validation`, `WebSocket lifecycle cleanup`).
- `tests/path_traversal_test.ts`: Path traversal resistance with nested and encoded patterns.
- `tests/websocket_group_test.ts` & `tests/websocket_real_test.ts`: WebSocket groups, filtering permissions, and real TCP connections.
- `tests/worker_test.ts`: Worker fallback hierarchy and error handling.
- `tests/adapters_serve_dir_test.ts` & `tests/adapters_test.ts`: Static file adapter comparisons.
- `tests/middleware_test.ts` & `tests/complementary_test.ts`: Middleware chain ordering and short-circuiting.

---

## 📚 Documentation Status

- `README.md`: Comprehensive guide with examples for HTTP routing, WebSockets, static files, middleware, and configuration options.
- `docs/security.md`: Production security guide covering HTTPS, HSTS, reverse proxy trust, dotfiles, symlinks, path containment, WebSocket CSWSH origin validation, and rate limiting.
- `docs/return.md`: HTTP return values guide covering both `{ body, init }` objects and native standard `Response` / `Response.json(...)` instances.
- `docs/adapter-deno-serve-dir.md`: Comparison and setup for the alternative `serveDir` adapter.
- `docs/middleware.md`: Onion-model execution and route rewriting.
- `docs/websocket-permissions.md`: Granular multi-room broadcast filtering with `PermissionFn`.
- `docs/workers.md`: Fallback worker execution tier.
- `docs/roadmap-adapters.md`: Architecture for future Bun, Node.js, and Cloudflare Workers adapters.
- `docs/roadmap-rate-limiting.md`: Architectural blueprint for built-in sliding window rate limiter.

---

## 🚀 Next Planned Tasks

1. **Rate Limiting Middleware Module**:
   - Implement native sliding-window rate limiting middleware with pluggable storage (in-memory `Map` default, extensible for Redis/KV).
2. **Additional Runtime Adapters (Phase 2)**:
   - Implement `src/adapters/bun.ts` using Bun's native `Bun.serve` and WebSocket API.
   - Implement `src/adapters/node.ts` for Node.js using `node:http` and `ws`.
