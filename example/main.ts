// example/main.ts
/**
 * @file main.ts
 * @description Unified WsRouter example server showcasing WebRTC live streaming,
 * real-time online presence, JWT-authenticated WebSockets, and REST endpoints.
 */

import { createDenoRouter } from "../src/deno.ts";
import { SignJWT, jwtVerify } from "jose";

const PORT = Number(Deno.env.get("PORT") || 3000);
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "wsrouter-demo-secret-key-123456";
const encoder = new TextEncoder();

const app = createDenoRouter({
  basePath: "",
  staticDir: "./example/public",
  forceHttps: false,
});

// Enable CORS for API routes so static GitHub Pages or external frontends can query the backend
app.use("/api/*", async (req, _params, next) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = await next(req);
  if (res) {
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return res;
});

// Helper function to safely send message over WebSocket checking readyState
function safeWsSend(ws: WebSocket, data: string): boolean {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(data);
      return true;
    } catch {
      return false;
    }
  } else if (ws.readyState === WebSocket.CONNECTING) {
    const handleOpen = () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      } catch {
        // ignore send error on closed socket
      }
    };
    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("open", handleOpen, { once: true });
    } else {
      const prev = ws.onopen;
      ws.onopen = (ev) => {
        if (prev) prev.call(ws, ev);
        handleOpen();
      };
    }
    return true;
  }
  return false;
}

// Health check / heartbeat endpoint
app.get("/api/health", () => {
  return {
    body: JSON.stringify({
      status: "ok",
      server: "WsRouter",
      version: "0.1.0",
      runtime: "Deno",
      timestamp: Date.now(),
      uptime: Math.round(performance.now() / 1000),
    }),
    init: {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  };
});

// ==========================================
// 1. 🎥 WebRTC Live Video Streaming & Signaling
// ==========================================
app.ws("/api/webrtc/:room", (ws, req, params) => {
  const room = (params.room as string) || "main-stage";
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || `user_${crypto.randomUUID().slice(0, 6)}`;
  const name = url.searchParams.get("name") || `Guest ${userId.slice(-4)}`;
  const avatar = url.searchParams.get("avatar") || "👤";
  const role = url.searchParams.get("role") || "viewer";

  const group = app.getWsGroupByPath("/api/webrtc/:room");
  if (!group) {
    ws.close(1011, "WebRTC room group not found");
    return;
  }

  // Track user presence in the WebRTC room
  group.track(ws, {
    userId,
    name,
    avatar,
    role,
    room,
    joinedAt: Date.now(),
  });

  // Register peer in signaling hub
  group.signaling.registerPeer(ws, userId);
  console.log(`[WebRTC] 🟢 ${name} (${userId}) joined room #${room} as [${role}]`);

  // Send current active stream info if broadcaster is already live
  const currentStream = group.signaling.getActiveStream(room);
  if (currentStream) {
    safeWsSend(
      ws,
      JSON.stringify({
        type: "broadcaster_started",
        ...currentStream,
      }),
    );
  }

  // Handle incoming signaling and chat messages
  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

      if (
        data.type?.startsWith("webrtc_") ||
        data.type?.startsWith("broadcaster_") ||
        data.type === "request_stream" ||
        data.type === "stream_reaction"
      ) {
        group.handleSignaling(ws, data, params);

        if (data.type === "broadcaster_started") {
          group.updatePresence(ws, { role: "broadcaster" });
        } else if (data.type === "broadcaster_stopped") {
          group.updatePresence(ws, { role: "viewer" });
        }
        return;
      }

      if (data.type === "chat") {
        group.broadcast(
          JSON.stringify({
            type: "chat",
            from: name,
            userId,
            avatar,
            text: data.text,
            timestamp: Date.now(),
          }),
          (recvParams, sendParams) => recvParams.room === sendParams.room,
          params,
        );
      }
    } catch (err) {
      console.error("[WebRTC] Error handling message:", err);
    }
  };

  ws.onclose = () => {
    console.log(`[WebRTC] 🔴 ${name} (${userId}) disconnected from #${room}`);
  };
});

// REST API: Get WebRTC stream status and viewers for a room
app.get("/api/stream/:room", (_req, params) => {
  const room = params.room as string;
  const group = app.getWsGroupByPath("/api/webrtc/:room");
  const activeStream = group?.signaling.getActiveStream(room);
  const users = (group?.getPresenceList() ?? []).filter((u) => u.data.room === room);

  return {
    body: JSON.stringify({
      room,
      isLive: Boolean(activeStream),
      stream: activeStream ?? null,
      totalOnline: users.length,
      viewers: users.filter((u) => u.data.role !== "broadcaster"),
      broadcasters: users.filter((u) => u.data.role === "broadcaster"),
    }),
    init: { headers: { "Content-Type": "application/json" } },
  };
});

// ==========================================
// 2. 👥 Multi-Room Presence Tracker & Chat
// ==========================================
app.ws("/api/presence-chat/:room", (ws, req, params) => {
  const room = (params.room as string) || "general";
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || `user_${crypto.randomUUID().slice(0, 6)}`;
  const name = url.searchParams.get("name") || `User ${userId.slice(-4)}`;
  const avatar = url.searchParams.get("avatar") || "👤";
  const status = url.searchParams.get("status") || "online";
  const customStatus = url.searchParams.get("customStatus") || "";

  const group = app.getWsGroupByPath("/api/presence-chat/:room");
  if (!group) {
    ws.close(1011, "Presence group not found");
    return;
  }

  // Track presence
  group.track(ws, {
    userId,
    name,
    avatar,
    status,
    customStatus,
    room,
  });

  console.log(`[Presence] 🟢 ${name} (${userId}) joined room #${room}`);

  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

      if (data.type === "update_presence") {
        group.updatePresence(ws, {
          status: data.status,
          customStatus: data.customStatus,
        });
        console.log(`[Presence] 🔄 ${name} updated status to "${data.status}"`);
        return;
      }

      if (data.type === "chat") {
        group.broadcast(
          JSON.stringify({
            type: "chat",
            from: name,
            userId,
            avatar,
            text: data.text,
            timestamp: Date.now(),
          }),
          (recvParams, sendParams) => recvParams.room === sendParams.room,
          params,
        );
      }
    } catch (err) {
      console.error("[Presence] Error handling message:", err);
    }
  };

  ws.onclose = () => {
    console.log(`[Presence] 🔴 ${name} (${userId}) left room #${room}`);
  };
});

// REST API: Get Presence for a specific room
app.get("/api/presence/:room", (_req, params) => {
  const room = params.room as string;
  const group = app.getWsGroupByPath("/api/presence-chat/:room");
  const allUsers = group?.getPresenceList() ?? [];
  const roomUsers = allUsers.filter((u) => u.data.room === room);

  return {
    body: JSON.stringify({
      room,
      onlineCount: roomUsers.length,
      users: roomUsers,
    }),
    init: { headers: { "Content-Type": "application/json" } },
  };
});

// REST API: Get all online users across all presence groups
app.get("/api/presence", () => {
  const routes = app.getWsRoutes();
  const allPresence = routes.map((r) => ({
    path: r.path,
    users: r.group.getPresenceList(),
  }));

  return {
    body: JSON.stringify({
      totalGroups: routes.length,
      groups: allPresence,
    }),
    init: { headers: { "Content-Type": "application/json" } },
  };
});

// ==========================================
// 3. 🔐 JWT Authentication & Protected WebSocket
// ==========================================

// Login endpoint: Generate JWT token
app.post("/api/login", async (req) => {
  try {
    const { username, password } = await req.json();

    if ((username === "admin" || username === "demo" || username) && (password === "123" || password === "admin" || password === "password")) {
      const token = await new SignJWT({
        userId: `usr_${username}`,
        username: username || "admin",
        role: username === "admin" ? "administrator" : "member",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(encoder.encode(JWT_SECRET));

      return {
        body: JSON.stringify({
          success: true,
          token,
          user: { username, role: username === "admin" ? "administrator" : "member" },
        }),
        init: { headers: { "Content-Type": "application/json" } },
      };
    } else {
      return {
        body: JSON.stringify({ success: false, error: "Invalid credentials. Try username: admin, password: 123" }),
        init: { status: 401, headers: { "Content-Type": "application/json" } },
      };
    }
  } catch {
    return {
      body: JSON.stringify({ success: false, error: "Invalid request payload" }),
      init: { status: 400, headers: { "Content-Type": "application/json" } },
    };
  }
});

// Protected WebSocket Endpoint with JWT Token Verification
app.ws("/api/jwt-chat/:room", async (ws, req, params) => {
  const room = (params.room as string) || "secure-channel";
  
  // Extract token from Sec-WebSocket-Protocol (e.g. Bearer, <token>) or query string
  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map((p) => p.trim());
  const bearerIndex = protocols.findIndex((p) => p.toLowerCase() === "bearer");
  let token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;

  if (!token) {
    const url = new URL(req.url);
    token = url.searchParams.get("token");
  }

  if (!token) {
    console.warn(`[JWT-WS] ❌ Unauthorized attempt on room #${room}: missing token`);
    safeWsSend(ws, JSON.stringify({ type: "error", error: "Authentication required: Missing JWT token" }));
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1008, "Token required");
    }
    return;
  }

  let payload: Record<string, unknown> = {};
  try {
    const verified = await jwtVerify(token, encoder.encode(JWT_SECRET), { algorithms: ["HS256"] });
    payload = verified.payload as Record<string, unknown>;
  } catch (err) {
    console.warn(`[JWT-WS] ❌ Invalid or expired token:`, err);
    safeWsSend(ws, JSON.stringify({ type: "error", error: "Authentication failed: Invalid or expired token" }));
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1008, "Invalid token");
    }
    return;
  }

  const username = (payload.username as string) || "Authenticated User";
  const userRole = (payload.role as string) || "member";
  console.log(`[JWT-WS] ✅ ${username} (${userRole}) authorized on room #${room}`);

  const group = app.getWsGroupByPath("/api/jwt-chat/:room");
  if (!group) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, "JWT chat group not found");
    }
    return;
  }

  // Track presence
  group.track(ws, {
    userId: String(payload.userId || username),
    name: username,
    role: userRole,
    avatar: userRole === "administrator" ? "🛡️" : "🔐",
    room,
  });

  safeWsSend(
    ws,
    JSON.stringify({
      type: "auth_success",
      message: `Welcome ${username}! You are securely connected.`,
      user: { username, role: userRole },
    }),
  );

  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data.type === "chat") {
        group.broadcast(
          JSON.stringify({
            type: "chat",
            from: username,
            role: userRole,
            avatar: userRole === "administrator" ? "🛡️" : "🔐",
            text: data.text,
            timestamp: Date.now(),
          }),
          (recv, send) => recv.room === send.room,
          params,
        );
      }
    } catch {
      // ignore
    }
  };
});

// ==========================================
// 4. ⚡ REST Route & Parameter Inspector Endpoints
// ==========================================
app.get("/api/echo/:param", (_req, params) => {
  return {
    body: JSON.stringify({
      route: "/api/echo/:param",
      params,
      timestamp: new Date().toISOString(),
      method: "GET",
    }),
    init: { headers: { "Content-Type": "application/json" } },
  };
});

app.post("/api/echo", async (req) => {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = await req.text();
  }
  return {
    body: JSON.stringify({
      route: "/api/echo",
      receivedBody: body,
      method: "POST",
      timestamp: new Date().toISOString(),
    }),
    init: { status: 201, headers: { "Content-Type": "application/json" } },
  };
});

// Start Deno HTTP/WS Server
const server = Deno.serve({ port: PORT }, app.handleRequest.bind(app));
console.log(`🚀 WsRouter Unified Server running on http://localhost:${PORT}`);
console.log(`📡 Static Files: http://localhost:${PORT}/index.html`);
console.log(`🎥 WebRTC WS:   ws://localhost:${PORT}/api/webrtc/:room`);
console.log(`👥 Presence WS: ws://localhost:${PORT}/api/presence-chat/:room`);
console.log(`🔐 JWT WS:      ws://localhost:${PORT}/api/jwt-chat/:room`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, () => {
    console.log(`\n🛑 ${signal} received. Gracefully shutting down...`);
    app.closeAllWebSockets();
    server.shutdown().then(() => {
      console.log("✅ Server successfully closed.");
      Deno.exit(0);
    }).catch((err) => {
      console.error("❌ Error during shutdown:", err);
      Deno.exit(1);
    });
  });
}
