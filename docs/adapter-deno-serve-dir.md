# 🦕 Alternative Adapter: `deno-serve-dir`

`@vanaware/wsrouter` offers **two static file adapters** for Deno. This document describes the alternative adapter based on `serveDir` from `@std/http/file-server`.

---

## 🎯 Motivation

The primary adapter (`adapters/deno.ts`) implements file serving manually with `Deno.open`, `Deno.lstat` and `Deno.realPath`. This gives full control over headers and behavior, but:

- **Does not support Range Requests** (required for large video/audio/PDF files)
- **Does not handle `If-None-Match` / `If-Modified-Since`** (304 Not Modified)
- **~100 lines of code** to maintain

`serveDir` from `@std/http` solves all of this natively, since it is Deno's official implementation for file serving.

---

## 📐 Architecture: Two Adapters

```
src/adapters/
├── deno.ts              ← Manual: full control, zero extra dependencies
└── deno-serve-dir.ts    ← serveDir: native Range, 304, HEAD

src/
├── deno.ts              ← Entry point: createDenoRouter()
└── deno-serve-dir.ts    ← Entry point: createDenoServeDirRouter()
```

**Both share the same WebSocket upgrader** (`denoWebSocketUpgrader`), re-exported via:

```typescript
export { denoWebSocketUpgrader } from "./deno.ts";
```

---

## 📊 Comparison

| Aspect | `deno.ts` (Manual) | `deno-serve-dir.ts` (serveDir) |
|---|:---:|:---:|
| **Lines of code** | ~100 | ~50 |
| **Range Requests** | ❌ | ✅ Native |
| **ETag / 304** | ✅ Custom (size+mtime) | ✅ Native (more robust) |
| **Automatic HEAD** | ✅ Via core | ✅ Via serveDir |
| **Cache-Control** | ✅ Customizable | ⚠️ Fixed |
| **ETag format** | Custom: `"size-mtime"` | std internal |
| **Extra dependency** | None | `@std/http` |
| **Maintenance** | Manual | Community (std) |
| **Containment** | ✅ `Deno.realPath` | ✅ `resolve` |
| **Symlinks** | ✅ Rejected | ✅ Rejected |
| **Dotfiles** | ✅ Blocked | ✅ Blocked |

### When to use each one?

| Scenario | Adapter |
|---|---|
| Serving large video/audio/PDF files | `deno-serve-dir` |
| Need 304 Not Modified | `deno-serve-dir` |
| Need per-file custom Cache-Control | `deno` (manual) |
| Don't want the `@std/http` dependency | `deno` (manual) |
| Want less code to maintain | `deno-serve-dir` |

---

## 📝 API

### Entry Point

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
```

### `createDenoServeDirRouter(options)`

```typescript
interface DenoServeDirRouterOptions {
  basePath?: string;
  staticDir?: string | null;
  embeddedDir?: string | null;
  forceHttps?: boolean;
  trustProxy?: boolean;
  allowDotfiles?: boolean;
  lastBroadcastDelay?: number;
  /** serveDir-specific options */
  serveDir?: {
    showDirListing?: boolean;  // Default: false
    enableCors?: boolean;      // Default: false
  };
}
```

### `createDenoServeDirStaticFileHandler(staticDir, embeddedDir, options)`

Creates only the `StaticFileHandler` without instantiating the full Router:

```typescript
interface DenoServeDirOptions {
  allowDotfiles?: boolean;   // Default: false
  showDirListing?: boolean;  // Default: false
  enableCors?: boolean;      // Default: false
}
```

---

## 🌍 Examples

### Basic

```typescript
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";

const app = createDenoServeDirRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({ body: "Hello!" }));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

### With CORS and dir listing

```typescript
const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./public",
  serveDir: {
    showDirListing: true,   // Shows directory listing
    enableCors: true,       // Adds CORS headers
  },
});
```

### Using only the handler (no entry point)

```typescript
import { Router } from "@vanaware/wsrouter";
import { denoWebSocketUpgrader } from "@vanaware/wsrouter/adapters/deno";
import { createDenoServeDirStaticFileHandler } from "@vanaware/wsrouter/adapters/deno-serve-dir";

const app = new Router({
  basePath: "/api",
  webSocketUpgrader: denoWebSocketUpgrader,
  staticFileHandler: createDenoServeDirStaticFileHandler("./public", null, {
    allowDotfiles: false,
    showDirListing: false,
  }),
});
```

### Integration with the Loco server/main.ts

Replacing the manual `serveDir` in `main.ts`:

```typescript
// BEFORE (manual main.ts):
import { serveDir } from "@std/http/file-server";
const staticResponse = await serveDir(req, {
  fsRoot: "./build/dist",
  showDirListing: false,
  quiet: true,
});

// AFTER (with router):
import { createDenoServeDirRouter } from "@vanaware/wsrouter/deno-serve-dir";
import workerHandler from "./worker.ts";

const env = Deno.env.toObject();
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(console.error) };

const app = createDenoServeDirRouter({
  basePath: "",
  staticDir: "./build/dist",
});

app.worker((req) => workerHandler.fetch(req, env, ctx));

Deno.serve({ port: Number(env.PORT || 3000) }, app.handleRequest.bind(app));
```

---

## 🔒 Security

The `deno-serve-dir` adapter keeps the **same security policies** as the manual adapter:

### Containment

Before delegating to `serveDir`, the path is resolved and verified:

```typescript
const fullPath = resolve(baseDir, "." + pathname);
const resolvedBase = resolve(baseDir);

if (!fullPath.startsWith(resolvedBase + "/") && fullPath !== resolvedBase) {
  return null; // Path attempts to escape the directory
}
```

### Symlinks

Symlinks are rejected with `Deno.lstat` before reaching `serveDir`:

```typescript
const info = await Deno.lstat(fullPath);
if (info.isSymlink) {
  console.warn(`[Static] Symlink rejected: ${fullPath}`);
  return null;
}
```

### Dotfiles

Controlled by the `allowDotfiles` option (default: `false`), which is passed as `showDotfiles` to `serveDir`.

---

## 🧪 Tests

The adapter has dedicated tests in `tests/adapters_serve_dir_test.ts`:

```bash
deno test tests/adapters_serve_dir_test.ts --allow-read --allow-write --allow-net --allow-env
```

Current tests:
- ✅ Serves existing files
- ✅ Blocks dotfiles by default

Recommended tests to add:
- ⏳ Range Request returns 206 Partial Content
- ⏳ If-None-Match returns 304
- ⏳ HEAD returns headers without body
- ⏳ Symlink is rejected
- ⏳ Path traversal is blocked

---

## 📋 Dependencies

This adapter requires `@std/http` in `deno.jsonc`:

```jsonc
{
  "imports": {
    "@std/http": "jsr:@std/http@^1"
  }
}
```

The manual adapter (`deno.ts`) **does not require** this dependency.

---

## 📋 Summary

| Item | Value |
|---|---|
| **Adapter file** | `src/adapters/deno-serve-dir.ts` |
| **Entry point** | `src/deno-serve-dir.ts` |
| **Export in deno.jsonc** | `"./adapters/deno-serve-dir"` |
| **Main function** | `createDenoServeDirRouter()` |
| **Handler factory** | `createDenoServeDirStaticFileHandler()` |
| **Dependency** | `@std/http` |
| **WS Upgrader** | Re-exported from `deno.ts` |
| **Security** | Containment + Symlinks + Dotfiles |
| **Main advantage** | Native Range Requests + 304 |
