# wsrouter

A high-performance, runtime-agnostic WebSocket and HTTP router for Deno. Fast, secure, and extensible.

## Installation

```bash
deno add jsr:@vanaware/wsrouter
```

## Usage

### Simple HTTP Server

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./public",
});

app.get("/hello", () => ({
  body: JSON.stringify({ message: "Hello, World!" }),
  init: { headers: { "Content-Type": "application/json" } },
}));

app.get("/users/:id", (_req, params) => ({
  body: JSON.stringify({ userId: params.id }),
}));

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Server running on http://localhost:3000");
```

### WebSocket Chat with Rooms

```ts
import { createDenoRouter } from "jsr:@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room/:user", (ws, _req, params) => {
  const room = params.room as string;
  const user = params.user as string;
  const group = app.getWsGroupByPath("/chat/:room/:user");
  
  if (!group) {
    ws.close(1011, "Internal error");
    return;
  }
  
  console.log(`✅ ${user} joined room ${room}`);
  
  ws.onmessage = (event) => {
    // Broadcast only to users in the same room
    group.broadcast(
      `[${user}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params
    );
  };
  
  ws.onclose = () => {
    console.log(`❌ ${user} left room ${room}`);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

## Features

- ✅ **HTTP Routing**: Named parameters, catch-all routes, automatic HEAD support, and 405 Method Not Allowed handling.
- ✅ **WebSockets**: Automatic upgrades, smart broadcasting with `PermissionFn`, and multi-room support.
- ✅ **WebRTC Signaling**: High-performance hub for P2P signaling (SDP, ICE candidates) and live stream management.
- ✅ **Online Presence**: Real-time tracking of users with multi-tab/multi-device deduplication and status updates.
- ✅ **Middlewares**: Onion-model execution chain with `next()` and route rewriting capabilities.
- ✅ **Security**: Force HTTPS, HSTS, trust proxy support, dotfile blocking, and path traversal protection.
- ✅ **Static Files**: Fast serving of local directories with directory indexing and MIME type detection.

## Documentation

For full API reference and advanced guides, visit the
[JSR package page](https://jsr.io/@vanaware/wsrouter).

## Guides

- [WebRTC Live Streaming Guide](./docs/webrtc.md)
- [Online Presence Tracking Guide](./docs/presence.md)
- [Security Guide](./docs/security.md)
- [Middleware Guide](./docs/middleware.md)

## License

MIT - see [LICENSE](./LICENSE) for details.
