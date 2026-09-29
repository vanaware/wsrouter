> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém os arquivos de CÓDIGO FONTE principais da aplicação exemplo (example).
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB [v0.4.0] - Modo: EXAMPLE

Gerado automaticamente em: 2026-09-29T00:13:12.000Z

---

## Arquivo: `example/main.ts`

```ts
// example/main.ts
console.log("Starting WsRouter Example Server v0.4.0");
/**
 * @file main.ts
 * @description Unified WsRouter example server showcasing WebRTC live streaming,
 * real-time online presence, JWT-authenticated WebSockets, and REST endpoints.
 */

import { createDenoRouter } from "../src/deno.ts";
import { SignJWT, jwtVerify } from "https://deno.land/x/jose@v5.2.0/index.ts";

/**
 * Procura o primeiro diretório válido entre os candidatos.
 * Retorna o caminho resolvido ou `null` se nenhum existir.
 */
async function resolveStaticDir(
  candidates: string[],
): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const stat = await Deno.stat(candidate);
      if (stat.isDirectory) {
        const absolute = await Deno.realPath(candidate);
        console.log(`✅ staticDir encontrado: "${candidate}" → ${absolute}`);
        return candidate;
      }
      console.warn(`⚠️  "${candidate}" existe, mas não é um diretório.`);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // Silencioso: era só um candidato que não existe.
      } else {
        console.warn(`⚠️  Erro ao testar "${candidate}":`, err);
      }
    }
  }
  console.error("❌ Nenhum staticDir válido encontrado entre os candidatos:");
  for (const c of candidates) console.error(`   - ${c}`);
  return null;
}

const staticDirCandidates = [
  "./example/public",
  "./public",
  "public",
  "/example/public",
  "example/public",
];

const resolvedStaticDir = await resolveStaticDir(staticDirCandidates);

if (!resolvedStaticDir) {
  console.error("🚨 Continuando sem arquivos estáticos — rotas de API ainda funcionarão.");
}

const PORT = Number(Deno.env.get("PORT") || 3000);
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "wsrouter-demo-secret-key-123456";
const encoder = new TextEncoder();

const app = createDenoRouter({
  basePath: "",
  staticDir: resolvedStaticDir ?? undefined,
  forceHttps: false,
});

// Enable CORS for API routes so static GitHub Pages or external frontends can query the backend
app.use(async (req, _params, next) => {
  const origin = req.headers.get("origin") || "*";
  const method = req.method;
  const url = req.url;
  const acrHeaders = req.headers.get("access-control-request-headers");

  // Preflight request
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": acrHeaders || "*",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  const res = await next(req);
  const response = (res instanceof Response) ? res : new Response(JSON.stringify(res), { 
    headers: { "Content-Type": "application/json" } 
  });
  
  // Clone headers to ensure they are mutable
  const headers = new Headers(response.headers);
  
  // Always set CORS headers on every response
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Credentials", "true");
  
  if (acrHeaders) {
    headers.set("Access-Control-Allow-Headers", acrHeaders);
  } else {
    headers.set("Access-Control-Allow-Headers", "*");
  }

  // Debug log to confirm middleware is running
  if (url.includes("/api/")) {
    console.log(`[CORS] ${method} ${url} -> Status ${response.status} (Origin: ${origin})`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
      version: "0.4.0",
      runtime: "Deno",
      timestamp: Date.now(),
      uptime: Math.round(performance.now() / 1000),
    }),
    init: {
      headers: {
        "Content-Type": "application/json",
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

```

---

## Arquivo: `example/public/components/ApiInspectorExample.js`

```js
// example/public/components/ApiInspectorExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { buildApiUrl } from './config.js';

const ENDPOINTS = [
  { method: 'GET', url: '/api/stream/main-stage', desc: 'Inspect active WebRTC stream and live viewers' },
  { method: 'GET', url: '/api/presence/general', desc: 'Inspect online presence list in #general' },
  { method: 'GET', url: '/api/presence', desc: 'Inspect all online presence groups and socket count' },
  { method: 'GET', url: '/api/echo/hello-wsrouter', desc: 'Test URL path parameter extraction' },
  { method: 'POST', url: '/api/echo', body: JSON.stringify({ message: 'Testing WsRouter body parsing', timestamp: Date.now() }, null, 2), desc: 'Test POST request body parsing & echo' },
  { method: 'POST', url: '/api/login', body: JSON.stringify({ username: 'admin', password: '123' }, null, 2), desc: 'Authenticate and receive signed HS256 JWT' },
];

export function ApiInspectorExample() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [customMethod, setCustomMethod] = useState(ENDPOINTS[0].method);
  const [customUrl, setCustomUrl] = useState(ENDPOINTS[0].url);
  const [customBody, setCustomBody] = useState(ENDPOINTS[0].body || '');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = (ep) => {
    setSelectedEndpoint(ep);
    setCustomMethod(ep.method);
    setCustomUrl(ep.url);
    setCustomBody(ep.body || '');
  };

  const executeRequest = async () => {
    setIsLoading(true);
    const startTime = performance.now();
    try {
      const options = {
        method: customMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      };

      if (customMethod === 'POST' && customBody.trim()) {
        options.body = customBody;
      }

      const res = await fetch(buildApiUrl(customUrl), options);
      const elapsed = Math.round(performance.now() - startTime);

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : res.status === 201 ? 'Created' : ''),
        time: elapsed,
        data,
      });
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        time: Math.round(performance.now() - startTime),
        data: { error: err.message },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return html`
    <div>
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-blue-400" style="font-size: 24px;">bolt</i>
          <div>
            <h5 class="m-0 font-bold text-white text-base">REST API & Route Inspector</h5>
            <p class="text-xs text-slate-400 m-0">
              Directly interact with WsRouter HTTP route handlers, path parameter extractors, and JSON response endpoints.
            </p>
          </div>
        </div>
      </article>

      <div class="grid">
        <!-- Preset Endpoints List -->
        <div class="s12 m5 l4">
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <strong class="text-xs uppercase text-slate-400 font-bold block mb-2">Available Endpoints</strong>
            <div class="flex flex-col gap-2">
              ${ENDPOINTS.map((ep, idx) => {
                const isSelected = selectedEndpoint.url === ep.url && selectedEndpoint.method === ep.method;
                return html`
                  <button
                    key=${idx}
                    type="button"
                    class="button border small text-left p-2 rounded justify-start"
                    style="background: ${isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(15, 23, 42, 0.4)'}; border-color: ${isSelected ? '#3b82f6' : '#334155'}; height: auto;"
                    onClick=${() => handleSelect(ep)}
                  >
                    <div class="w-full">
                      <div class="row items-center gap-2 mb-1">
                        <span class="chip small ${ep.method === 'GET' ? 'bg-blue-950 text-blue-300' : 'bg-emerald-950 text-emerald-300'}" style="font-size: 0.65rem; padding: 1px 6px;">
                          ${ep.method}
                        </span>
                        <code class="text-xs text-slate-200 font-bold">${ep.url}</code>
                      </div>
                      <div class="text-xs text-slate-400">${ep.desc}</div>
                    </div>
                  </button>
                `;
              })}
            </div>
          </article>
        </div>

        <!-- Request Builder & Response Viewer -->
        <div class="s12 m7 l8">
          <!-- Request Builder -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center gap-2 mb-2">
              <!-- Method -->
              <select
                class="button border small round bg-slate-900 text-white"
                value=${customMethod}
                onChange=${(e) => setCustomMethod(e.target.value)}
                style="width: 100px;"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>

              <!-- URL Input -->
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${customUrl}
                  onInput=${(e) => setCustomUrl(e.target.value)}
                  placeholder="/api/..."
                />
                <label>Target URL Path</label>
              </div>

              <!-- Send Button -->
              <button
                type="button"
                class="button fill primary small round"
                onClick=${executeRequest}
                disabled=${isLoading}
              >
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">send</i>
                <span>${isLoading ? 'Sending...' : 'Execute'}</span>
              </button>
            </div>

            <!-- Body editor for POST -->
            ${customMethod === 'POST' && html`
              <div class="mt-2">
                <label class="text-xs text-slate-400 bold block mb-1">JSON Request Body:</label>
                <textarea
                  class="font-mono text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200 w-full"
                  rows="4"
                  value=${customBody}
                  onInput=${(e) => setCustomBody(e.target.value)}
                  style="width: 100%; box-sizing: border-box;"
                ></textarea>
              </div>
            `}
          </article>

          <!-- Response Viewer -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-xs text-slate-400 font-mono">RESPONSE INSPECTOR</strong>
              ${response && html`
                <div class="row items-center gap-2">
                  <span class="chip small ${response.status >= 200 && response.status < 300 ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">
                    Status: ${response.status} ${response.statusText}
                  </span>
                  <span class="text-xs text-slate-400">${response.time} ms</span>
                </div>
              `}
            </div>

            <pre class="font-mono text-xs p-3 rounded bg-slate-950 text-emerald-400 overflow-x-auto m-0" style="min-height: 180px; max-height: 380px;">
              ${response ? JSON.stringify(response.data, null, 2) : '// Click "Execute" or select an endpoint on the left to see live response.'}
            </pre>
          </article>
        </div>
      </div>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/App.js`

```js
// example/public/components/App.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { Header } from './Header.js';
import { EntryGate } from './EntryGate.js';
import { WebRTCExample } from './WebRTCExample.js';
import { PresenceExample } from './PresenceExample.js';
import { JwtExample } from './JwtExample.js';
import { ApiInspectorExample } from './ApiInspectorExample.js';
import { ServerSettingsModal } from './ServerSettingsModal.js';
import { getCustomBackend } from './config.js';

export function App() {
  // User Identity State
  const [user, setUser] = useState(() => {
    const savedName = localStorage.getItem('wsrouter_user_name');
    const savedAvatar = localStorage.getItem('wsrouter_user_avatar') || '👨‍💻';
    const savedRoom = localStorage.getItem('wsrouter_user_room') || 'main-stage';
    let savedId = localStorage.getItem('wsrouter_user_id');

    if (!savedId) {
      savedId = `usr_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('wsrouter_user_id', savedId);
    }

    return {
      userId: savedId,
      name: savedName || '',
      avatar: savedAvatar,
      room: savedRoom,
      isRegistered: Boolean(savedName),
    };
  });

  // UI Navigation State
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'webrtc';
  });

  const [activeMobileSubTab, setActiveMobileSubTab] = useState('stream');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Sync tab with URL query parameter
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
  };

  const handleRegisterProfile = ({ name, avatar, room }) => {
    localStorage.setItem('wsrouter_user_name', name);
    localStorage.setItem('wsrouter_user_avatar', avatar);
    localStorage.setItem('wsrouter_user_room', room);

    setUser((prev) => ({
      ...prev,
      name,
      avatar,
      room,
      isRegistered: true,
    }));
    setIsEditingProfile(false);
  };

  const handleOpenViewerTab = () => {
    const randomGuestNum = Math.floor(Math.random() * 900 + 100);
    const viewerId = `usr_guest_${randomGuestNum}`;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'webrtc');
    url.searchParams.set('autojoin', '1');
    url.searchParams.set('name', `Viewer_${randomGuestNum}`);
    url.searchParams.set('avatar', '👀');
    url.searchParams.set('userId', viewerId);
    window.open(url.toString(), '_blank');
  };

  // Support autojoin via URL query params (e.g. for viewer tabs)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autojoin') === '1') {
      const qName = urlParams.get('name') || `Guest ${Math.floor(Math.random() * 1000)}`;
      const qAvatar = urlParams.get('avatar') || '👀';
      const qId = urlParams.get('userId') || `usr_${Math.random().toString(36).substring(2, 8)}`;
      const qRoom = urlParams.get('room') || 'main-stage';

      setUser({
        userId: qId,
        name: qName,
        avatar: qAvatar,
        room: qRoom,
        isRegistered: true,
      });
    }
  }, []);

  // If user hasn't registered a name, display initial gate
  if (!user.isRegistered) {
    return html`
      <div class="app-root-container p-4">
        <${EntryGate}
          initialName=${user.name}
          initialAvatar=${user.avatar}
          initialRoom=${user.room}
          onSubmit=${handleRegisterProfile}
        />
      </div>
    `;
  }

  return html`
    <div class="app-root-container p-3 sm:p-4 max">
      <!-- Top Navigation & Header -->
      <${Header}
        activeTab=${activeTab}
        onSelectTab=${handleSelectTab}
        user=${user}
        onEditProfile=${() => setIsEditingProfile(true)}
        showStats=${showStats}
        onToggleStats=${() => setShowStats(!showStats)}
        onOpenViewerTab=${handleOpenViewerTab}
        activeMobileSubTab=${activeMobileSubTab}
        onSelectMobileSubTab=${setActiveMobileSubTab}
        onOpenSettings=${() => setIsSettingsOpen(true)}
        isCustomBackend=${Boolean(getCustomBackend())}
      />

      <!-- Pages View Area -->
      <main class="pages-wrapper">
        <!-- 🎥 WebRTC Live Streaming Page -->
        <div class="page ${activeTab === 'webrtc' ? 'active' : 'hidden'}" id="page-webrtc">
          ${activeTab === 'webrtc' && html`
            <${WebRTCExample}
              user=${user}
              activeMobileTab=${activeMobileSubTab}
              showStats=${showStats}
              setShowStats=${setShowStats}
              onOpenViewerTab=${handleOpenViewerTab}
            />
          `}
        </div>

        <!-- 👥 Presence Tracker Page -->
        <div class="page ${activeTab === 'presence' ? 'active' : 'hidden'}" id="page-presence">
          ${activeTab === 'presence' && html`
            <${PresenceExample}
              user=${user}
            />
          `}
        </div>

        <!-- 🔐 JWT Auth & WebSocket Page -->
        <div class="page ${activeTab === 'jwt' ? 'active' : 'hidden'}" id="page-jwt">
          ${activeTab === 'jwt' && html`
            <${JwtExample} />
          `}
        </div>

        <!-- ⚡ REST Route & Parameter Inspector Page -->
        <div class="page ${activeTab === 'rest' ? 'active' : 'hidden'}" id="page-rest">
          ${activeTab === 'rest' && html`
            <${ApiInspectorExample} />
          `}
        </div>
      </main>

      <!-- Profile Edit Modal -->
      ${isEditingProfile && html`
        <${EntryGate}
          initialName=${user.name}
          initialAvatar=${user.avatar}
          initialRoom=${user.room}
          onSubmit=${handleRegisterProfile}
          isModal=${true}
          onClose=${() => setIsEditingProfile(false)}
        />
      `}

      <!-- Backend Server Settings Modal -->
      <${ServerSettingsModal}
        isOpen=${isSettingsOpen}
        onClose=${() => setIsSettingsOpen(false)}
      />
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/ChatPanel.js`

```js
// example/public/components/ChatPanel.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useRef, useEffect } from 'https://esm.sh/preact/hooks';

export function ChatPanel({ messages, onSendMessage, user, isLive, broadcasterId }) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const quickSendEmoji = (emoji) => {
    onSendMessage(emoji);
  };

  return html`
    <article class="round border surface p-3 chat-panel-article flex flex-col" style="background: #1e293b; color: #f8fafc; height: 100%;">
      <!-- Header -->
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-blue-400" style="font-size: 20px;">forum</i>
          <h6 class="m-0 font-bold text-white text-sm">Live Room Chat</h6>
        </div>
        <span class="text-xs text-slate-400">${messages.length} messages</span>
      </div>

      <!-- Messages Scroll Area -->
      <div class="chat-messages-container max flex-1 overflow-y-auto mb-2 pr-1" ref=${scrollRef} style="min-height: 220px; max-height: 380px;">
        ${messages.length === 0 && html`
          <div class="text-center p-4 text-slate-500 text-xs">
            <i class="material-symbols-outlined mb-1" style="font-size: 28px;">chat_bubble_outline</i>
            <div>No messages yet in this room. Say hello! 👋</div>
          </div>
        `}

        ${messages.map((msg, index) => {
          const isMe = msg.userId === user.userId;
          const isBroadcaster = isLive && msg.userId === broadcasterId;
          const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return html`
            <div key=${msg.id || index} class="chat-message-row mb-2 ${isMe ? 'is-me' : ''}">
              <div class="row items-start gap-2">
                <span class="chat-avatar" style="font-size: 18px; line-height: 1;">${msg.avatar || '👤'}</span>
                <div class="chat-bubble flex-1" style="background: ${isMe ? 'rgba(37, 99, 235, 0.25)' : 'rgba(51, 65, 85, 0.4)'}; border: 1px solid ${isMe ? 'rgba(59, 130, 246, 0.4)' : 'rgba(71, 85, 105, 0.4)'}; border-radius: 8px; padding: 6px 10px;">
                  <div class="row items-center justify-between gap-1 mb-1">
                    <div class="row items-center gap-1">
                      <strong class="text-xs ${isMe ? 'text-blue-300' : 'text-slate-200'}">${msg.from || 'User'}</strong>
                      ${isBroadcaster && html`
                        <span class="chip small border bg-red-950 text-red-300" style="font-size: 0.6rem; padding: 0 4px;">
                          HOST
                        </span>
                      `}
                      ${isMe && html`
                        <span class="text-slate-400 text-xs" style="font-size: 0.65rem;">(you)</span>
                      `}
                    </div>
                    <span class="text-xs text-slate-500" style="font-size: 0.65rem;">${time}</span>
                  </div>
                  <div class="chat-text text-sm break-words text-slate-100">${msg.text}</div>
                </div>
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Quick Emoji Bar -->
      <div class="row items-center gap-1 mb-2 pt-1 border-t border-slate-700">
        <span class="text-xs text-slate-400 mr-1">Quick:</span>
        ${['👍', '❤️', '🔥', '🚀', '👋', '🎉'].map(
          (emoji) => html`
            <button
              type="button"
              class="button circle small transparent"
              style="min-width: 28px; width: 28px; height: 28px; padding: 0; font-size: 14px;"
              onClick=${() => quickSendEmoji(emoji)}
            >
              ${emoji}
            </button>
          `
        )}
      </div>

      <!-- Input Form -->
      <form onSubmit=${handleSubmit} class="row items-center gap-2">
        <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
          <input
            type="text"
            id="chat-message-input"
            value=${inputText}
            onInput=${(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
          />
          <label>Chat message</label>
        </div>
        <button type="submit" class="button fill primary circle" style="width: 40px; height: 40px; padding: 0;" title="Send message">
          <i class="material-symbols-outlined" style="font-size: 18px;">send</i>
        </button>
      </form>
    </article>
  `;
}

```

---

## Arquivo: `example/public/components/EntryGate.js`

```js
// example/public/components/EntryGate.js
import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';

const AVATARS = ['👨‍💻', '👩‍💻', '🦊', '🚀', '🧙‍♂️', '🎨', '🐱', '🦁', '🤖', '👑', '⚡', '🎧'];

export function EntryGate({ initialName, initialAvatar, initialRoom, onSubmit, isModal = false, onClose }) {
  const [name, setName] = useState(initialName || '');
  const [avatar, setAvatar] = useState(initialAvatar || '👨‍💻');
  const [room, setRoom] = useState(initialRoom || 'main-stage');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter your name before joining.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    setError('');
    onSubmit({ name: cleanName, avatar, room: room.trim() || 'main-stage' });
  };

  const content = html`
    <article class="round border surface p-4" style="max-width: 480px; margin: 0 auto; background: #1e293b; color: #f8fafc; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
      <div class="row items-center justify-between mb-3">
        <div class="row items-center gap-2">
          <span style="font-size: 32px;">🎥</span>
          <div>
            <h5 class="m-0 font-bold text-white">${isModal ? 'Edit Profile' : 'Join Live Stream Room'}</h5>
            <div class="text-xs text-slate-400">Choose your name and avatar to interact</div>
          </div>
        </div>
        ${isModal && html`
          <button class="button circle transparent small text-slate-400" onClick=${onClose}>
            <i class="material-symbols-outlined">close</i>
          </button>
        `}
      </div>

      <form onSubmit=${handleSubmit}>
        <!-- Name Input -->
        <div class="field label border small mb-3">
          <input
            type="text"
            id="entry-gate-name-input"
            value=${name}
            onInput=${(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Alex Dev, Sarah, John"
            required
            autoFocus
          />
          <label>Your Display Name</label>
        </div>

        <!-- Room Selector -->
        <div class="field label border small mb-3">
          <input
            type="text"
            id="entry-gate-room-input"
            value=${room}
            onInput=${(e) => setRoom(e.target.value)}
            placeholder="e.g. main-stage, gaming, tech-talk"
          />
          <label>Stream Room ID</label>
        </div>

        <!-- Avatar Selection Grid -->
        <div class="mb-3">
          <label class="text-xs text-slate-300 bold block mb-2">Pick an Avatar</label>
          <div class="row wrap gap-2">
            ${AVATARS.map(
              (av) => html`
                <button
                  type="button"
                  class="button square ${avatar === av ? 'fill primary' : 'border'}"
                  style="font-size: 20px; width: 44px; height: 44px;"
                  onClick=${() => setAvatar(av)}
                >
                  ${av}
                </button>
              `
            )}
          </div>
        </div>

        ${error && html`
          <div class="chip small border red text-white mb-3" style="width: 100%;">
            <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">error</i>
            <span>${error}</span>
          </div>
        `}

        <div class="row gap-2 justify-end mt-4">
          ${isModal && html`
            <button type="button" class="button border text-slate-300" onClick=${onClose}>
              Cancel
            </button>
          `}
          <button type="submit" class="button fill primary max">
            <i class="material-symbols-outlined" style="font-size: 18px; margin-right: 4px;">login</i>
            <span>${isModal ? 'Save Profile' : 'Enter Live Room'}</span>
          </button>
        </div>
      </form>
    </article>
  `;

  if (isModal) {
    return html`
      <div
        class="modal-backdrop active"
        style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
      >
        ${content}
      </div>
    `;
  }

  return html`
    <div class="flex items-center justify-center p-4" style="min-height: 70vh;">
      ${content}
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/Header.js`

```js
// example/public/components/Header.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { APP_VERSION } from './version.js';
import { subscribeBackendHealth, isHostedOnDenoServer } from './config.js';

export function Header({
  activeTab,
  onSelectTab,
  user,
  onEditProfile,
  showStats,
  onToggleStats,
  onOpenViewerTab,
  activeMobileSubTab,
  onSelectMobileSubTab,
  onOpenSettings,
  isCustomBackend,
}) {
  const [health, setHealth] = useState({ isChecking: false, isOnline: false });

  useEffect(() => {
    const unsubscribe = subscribeBackendHealth((status) => {
      setHealth(status);
    });
    return unsubscribe;
  }, []);

  const tabs = [
    { id: 'webrtc', label: 'WebRTC Live Stream', icon: 'videocam', badge: 'Main' },
    { id: 'presence', label: 'Presence Tracker', icon: 'groups' },
    { id: 'jwt', label: 'JWT Protected WS', icon: 'lock' },
    { id: 'rest', label: 'REST Inspector', icon: 'bolt' },
  ];

  return html`
    <header class="app-header responsive max mb-3">
      <!-- Top Navigation Bar -->
      <nav class="transparent p-0" style="display: flex; flex-wrap: wrap; gap: 8px 12px; max-width: 100%; width: 100%; justify-content: space-between; align-items: center; min-height: 48px;">
        <!-- Logo & Branding -->
        <div class="row items-center gap-2" style="flex-shrink: 0;">
          <div class="header-logo-icon">
            <span style="font-size: 24px;">⚡</span>
          </div>
          <div>
            <h5 class="m-0 font-bold text-white tracking-tight text-base sm:text-lg">
              WsRouter <span class="chip small border text-blue-300 ml-1" style="font-size: 0.65rem; padding: 1px 6px; background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3);">v${APP_VERSION}</span>
            </h5>
            <div class="text-xs text-slate-400 hide-on-mobile">High-Performance WebSocket & HTTP Router for Deno</div>
          </div>
        </div>

        <!-- Right Side Actions (Targeted by Focus Mode) -->
        <div class="row items-center gap-1.5 sm:gap-2" style="flex-grow: 1; justify-content: flex-end; min-width: 120px;">
          ${activeTab === 'webrtc' && html`
            <button
              type="button"
              class="button border small round ${showStats ? 'fill amber text-black' : 'text-slate-300'}"
              onClick=${onToggleStats}
              title="Toggle WebRTC Diagnostics & ICE Stats"
              style="padding: 0 8px; height: 32px; flex-shrink: 0;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">analytics</i>
              <span class="hide-on-mobile">Stats</span>
            </button>

            <button
              type="button"
              class="button border small round text-slate-300"
              onClick=${onOpenViewerTab}
              title="Open a new browser tab as a viewer to test multi-user P2P stream"
              style="padding: 0 8px; height: 32px; flex-shrink: 0;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">open_in_new</i>
              <span class="hide-on-mobile">+ Viewer Tab</span>
            </button>
          `}

          <!-- Server / Endpoint Settings Button with Heartbeat Status -->
          <button
            type="button"
            class="button border small round ${isCustomBackend ? 'fill blue-900 text-blue-200' : 'text-slate-300'}"
            onClick=${onOpenSettings}
            title=${health.isOnline ? `Backend Online (${health.latencyMs}ms)` : health.isChecking ? 'Checking backend heartbeat...' : 'Backend unreachable / offline'}
            style="position: relative; padding: 0 8px; height: 32px; flex-shrink: 0;"
          >
            <span
              class="live-dot-indicator ${health.isOnline ? 'live' : 'offline'}"
              style="width: 8px; height: 8px; margin-right: 4px; background-color: ${health.isOnline ? '#10b981' : health.isChecking ? '#f59e0b' : '#ef4444'}; box-shadow: 0 0 6px ${health.isOnline ? '#10b981' : health.isChecking ? '#f59e0b' : '#ef4444'};"
            ></span>
            <i class="material-symbols-outlined" style="font-size: 15px;">dns</i>
            <span class="hide-on-mobile">${isCustomBackend ? 'Custom' : 'Server'}</span>
          </button>

          <!-- User Profile Chip -->
          <button
            type="button"
            class="button border small round text-white"
            onClick=${onEditProfile}
            style="background: rgba(30, 41, 59, 0.7); border-color: #475569; padding: 0 8px; height: 32px; max-width: 140px; flex-shrink: 0;"
            title="Click to edit your display name or avatar"
          >
            <span style="font-size: 15px; margin-right: 4px;">${user.avatar || '👤'}</span>
            <span class="bold text-xs" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;">${user.name || 'Set Name'}</span>
          </button>
        </div>
      </nav>

      <!-- Navigation Tabs Strip (Targeted by Focus Mode) - Scrollable on mobile -->
      <div class="row items-center gap-1.5 mt-2 pb-1 border-b border-slate-800" style="overflow-x: auto; flex-wrap: nowrap; width: 100%; max-width: 100%; scrollbar-width: none; -ms-overflow-style: none;">
        <style>
          .app-header .row::-webkit-scrollbar { display: none; }
        </style>
        ${tabs.map(
          (t) => html`
            <button
              type="button"
              class="button small round ${activeTab === t.id ? 'fill primary' : 'transparent text-slate-300'}"
              onClick=${() => onSelectTab(t.id)}
              style="white-space: nowrap; flex-shrink: 0; font-size: 0.8rem; padding: 0 10px; height: 32px;"
            >
              <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">${t.icon}</i>
              <span>${t.label}</span>
              ${t.badge && html`
                <span class="chip small fill red text-white ml-1" style="font-size: 0.6rem; padding: 0 4px;">
                  ${t.badge}
                </span>
              `}
            </button>
          `
        )}
      </div>

      <!-- Mobile Sub-Navigation for WebRTC -->
      ${activeTab === 'webrtc' && html`
        <div class="row items-center gap-1.5 mt-2 show-on-mobile" style="width: 100%; max-width: 100%; flex-wrap: wrap; box-sizing: border-box;">
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'stream' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('stream')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">videocam</i>
            <span>Stream</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'chat' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('chat')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">forum</i>
            <span>Chat</span>
          </button>
          <button
            type="button"
            class="button small round flex-1 ${activeMobileSubTab === 'users' ? 'fill primary' : 'border text-slate-300'}"
            onClick=${() => onSelectMobileSubTab('users')}
            style="min-width: 0; padding: 0 6px; height: 32px; font-size: 0.8rem;"
          >
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">people</i>
            <span>Online</span>
          </button>
        </div>
      `}
    </header>
  `;
}

```

---

## Arquivo: `example/public/components/JwtExample.js`

```js
// example/public/components/JwtExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useRef, useEffect } from 'https://esm.sh/preact/hooks';
import { buildWsUrl, buildApiUrl } from './config.js';

export function JwtExample() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [token, setToken] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [room, setRoom] = useState('secure-channel');
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [logs, setLogs] = useState([]);
  const [authError, setAuthError] = useState('');

  const wsRef = useRef(null);
  const logScrollRef = useRef(null);
  const msgScrollRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-50), { text: msg, time, type, id: Math.random() }]);
  };

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (msgScrollRef.current) msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
  }, [messages]);

  // Step 1: POST /api/login
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError('');
    addLog(`POST /api/login (user: ${username})...`, 'info');

    try {
      const res = await fetch(buildApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success && data.token) {
        setToken(data.token);
        setUserProfile(data.user);
        addLog(`✅ JWT Token Acquired (HS256 signed)`, 'success');
      } else {
        setAuthError(data.error || 'Authentication failed');
        addLog(`❌ Login Error: ${data.error}`, 'error');
      }
    } catch (err) {
      setAuthError(err.message);
      addLog(`❌ Network Error: ${err.message}`, 'error');
    }
  };

  // Step 2: Connect WebSocket with Bearer subprotocol
  const handleConnectWs = (customToken = token) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = buildWsUrl(`/api/jwt-chat/${room}`);
    addLog(`Connecting WebSocket with subprotocol Bearer to ${wsUrl}...`, 'info');

    try {
      const socket = new WebSocket(wsUrl, ['Bearer', customToken]);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsWsConnected(true);
        addLog(`🟢 WebSocket Connected & Subprotocol Authenticated!`, 'success');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_success') {
            addLog(`🛡️ Server: ${data.message}`, 'success');
            return;
          }
          if (data.type === 'error') {
            addLog(`⚠️ Server Error: ${data.error}`, 'error');
            return;
          }
          if (data.type === 'chat') {
            setMessages((prev) => [...prev, data]);
            addLog(`📨 Message from ${data.from}: ${data.text}`, 'info');
          }
        } catch {
          addLog(`📨 Raw message: ${event.data}`, 'info');
        }
      };

      socket.onclose = (event) => {
        setIsWsConnected(false);
        addLog(`🔴 WebSocket Closed (Code: ${event.code}, Reason: ${event.reason || 'Normal'})`, event.code === 1008 ? 'error' : 'info');
      };

      socket.onerror = () => {
        addLog(`⚠️ WebSocket error encountered`, 'error');
      };
    } catch (err) {
      addLog(`❌ Failed to instantiate WebSocket: ${err.message}`, 'error');
    }
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    setInputMsg('');
  };

  const handleTestTamper = () => {
    addLog(`🧪 Testing connection with TAMPERED / INVALID token...`, 'warning');
    handleConnectWs('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD_TAMPERED.SIGNATURE');
  };

  const handleTestMissingToken = () => {
    addLog(`🧪 Testing connection WITHOUT token...`, 'warning');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/jwt-chat/${room}`;
    const socket = new WebSocket(wsUrl);
    socket.onclose = (ev) => {
      addLog(`🔴 Correctly rejected: Code ${ev.code} (${ev.reason})`, 'error');
    };
  };

  return html`
    <div>
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-amber-400" style="font-size: 24px;">lock</i>
          <div>
            <h5 class="m-0 font-bold text-white text-base">JWT Authentication & Protected WebSocket</h5>
            <p class="text-xs text-slate-400 m-0">
              Demonstrates token issuance (POST /api/login) and handshake authentication via <code class="text-amber-300">Sec-WebSocket-Protocol: Bearer, &lt;token&gt;</code>.
            </p>
          </div>
        </div>
      </article>

      <div class="grid">
        <!-- Step 1 & Step 2 Controllers -->
        <div class="s12 m6 l5">
          <!-- Step 1: Login Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-sm text-blue-300">1. Authenticate (POST /api/login)</strong>
              <span class="chip small border bg-blue-950 text-blue-200" style="font-size: 0.65rem;">Step 1</span>
            </div>

            <form onSubmit=${handleLogin}>
              <div class="grid small-space mb-2">
                <div class="s6">
                  <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
                    <input
                      type="text"
                      value=${username}
                      onInput=${(e) => setUsername(e.target.value)}
                      placeholder="admin or demo"
                      required
                    />
                    <label>Username</label>
                  </div>
                </div>
                <div class="s6">
                  <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
                    <input
                      type="password"
                      value=${password}
                      onInput=${(e) => setPassword(e.target.value)}
                      placeholder="123"
                      required
                    />
                    <label>Password (123)</label>
                  </div>
                </div>
              </div>

              ${authError && html`
                <div class="chip small border red text-white mb-2" style="width: 100%;">
                  ${authError}
                </div>
              `}

              <div class="row items-center justify-between">
                <button type="submit" class="button fill primary small round">
                  <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">key</i>
                  <span>Get JWT Token</span>
                </button>
                <span class="text-xs text-slate-400">Demo: admin / 123</span>
              </div>
            </form>

            ${token && html`
              <div class="mt-3 p-2 rounded bg-slate-900 border border-slate-700">
                <div class="row items-center justify-between text-xs mb-1">
                  <span class="text-emerald-400 font-bold">✓ Signed Token (HS256)</span>
                  <span class="text-slate-400">Role: ${userProfile?.role}</span>
                </div>
                <div class="font-mono text-xs text-slate-300 break-all" style="max-height: 50px; overflow-y: auto;">
                  ${token}
                </div>
              </div>
            `}
          </article>

          <!-- Step 2: Connect WebSocket Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-sm text-emerald-300">2. WebSocket Subprotocol Handshake</strong>
              <span class="chip small border bg-emerald-950 text-emerald-200" style="font-size: 0.65rem;">Step 2</span>
            </div>

            <div class="field label border small mb-2" style="background: rgba(15, 23, 42, 0.6);">
              <input
                type="text"
                value=${room}
                onInput=${(e) => setRoom(e.target.value)}
                placeholder="secure-channel"
              />
              <label>Room Name</label>
            </div>

            <div class="row wrap gap-2 mb-3">
              <button
                type="button"
                class="button fill ${isWsConnected ? 'green' : 'primary'} small round"
                onClick=${() => handleConnectWs(token)}
                disabled=${!token}
              >
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">
                  ${isWsConnected ? 'check_circle' : 'cable'}
                </i>
                <span>${isWsConnected ? 'Connected (Authenticated)' : 'Connect with Token'}</span>
              </button>

              ${isWsConnected && html`
                <button
                  type="button"
                  class="button border red small round"
                  onClick=${() => wsRef.current?.close()}
                >
                  Disconnect
                </button>
              `}
            </div>

            <!-- Security Tests / Tampering Tools -->
            <div class="pt-2 border-t border-slate-700">
              <span class="text-xs text-slate-400 bold block mb-1">🛡️ Security Verification Tests:</span>
              <div class="row gap-2">
                <button
                  type="button"
                  class="button border text-amber-300 small round"
                  onClick=${handleTestTamper}
                  title="Test server rejection on forged JWT"
                >
                  <span>Test Forged Token</span>
                </button>
                <button
                  type="button"
                  class="button border text-red-300 small round"
                  onClick=${handleTestMissingToken}
                  title="Test server rejection without token"
                >
                  <span>Test No Token</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- Authenticated Chat & Live Logs -->
        <div class="s12 m6 l7">
          <!-- Chat Box -->
          <article class="round border surface p-3 mb-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 260px;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-blue-400" style="font-size: 18px;">lock</i>
                <strong class="text-sm">Protected Channel (#${room})</strong>
              </div>
              <span class="chip small border ${isWsConnected ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">
                ${isWsConnected ? 'Authorized' : 'Disconnected'}
              </span>
            </div>

            <div class="max flex-1 overflow-y-auto mb-2 pr-1" ref=${msgScrollRef}>
              ${messages.length === 0 && html`
                <div class="text-center p-3 text-slate-500 text-xs">
                  ${isWsConnected ? 'Authenticated session ready. Type a message!' : 'Connect to send and receive secure messages.'}
                </div>
              `}
              ${messages.map((m, idx) => html`
                <div key=${idx} class="p-2 mb-1 rounded" style="background: rgba(15, 23, 42, 0.6);">
                  <div class="row items-center justify-between text-xs mb-1">
                    <strong class="text-blue-300">${m.avatar} ${m.from} (${m.role})</strong>
                    <span class="text-slate-500">${new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div class="text-sm text-slate-100">${m.text}</div>
                </div>
              `)}
            </div>

            <form onSubmit=${handleSendMessage} class="row items-center gap-2">
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${inputMsg}
                  onInput=${(e) => setInputMsg(e.target.value)}
                  placeholder="Type secure message..."
                  disabled=${!isWsConnected}
                />
                <label>Secure Message</label>
              </div>
              <button
                type="submit"
                class="button fill primary circle"
                style="width: 36px; height: 36px; padding: 0;"
                disabled=${!isWsConnected}
              >
                <i class="material-symbols-outlined" style="font-size: 16px;">send</i>
              </button>
            </form>
          </article>

          <!-- Audit & Protocol Log -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <strong class="text-xs text-amber-400 font-mono">PROTOCOL & SECURITY LOGS</strong>
              <button class="button transparent circle small text-slate-400" onClick=${() => setLogs([])}>
                <i class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</i>
              </button>
            </div>
            <div class="font-mono text-xs overflow-y-auto" ref=${logScrollRef} style="max-height: 140px;">
              ${logs.length === 0 && html`<div class="text-slate-500">Ready. Authenticate or connect above.</div>`}
              ${logs.map((l) => html`
                <div key=${l.id} class="p-1 mb-1 rounded" style="background: rgba(30, 41, 59, 0.4);">
                  <span class="text-slate-500 mr-2">[${l.time}]</span>
                  <span class="${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}">
                    ${l.text}
                  </span>
                </div>
              `)}
            </div>
          </article>
        </div>
      </div>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/OnlineUsers.js`

```js
// example/public/components/OnlineUsers.js
import { html } from 'https://esm.sh/htm/preact';

export function OnlineUsers({ users, currentUserId, isLive, broadcasterId }) {
  const broadcasters = users.filter((u) => u.data.role === 'broadcaster' || (isLive && u.userId === broadcasterId));
  const viewers = users.filter((u) => u.data.role !== 'broadcaster' && (!isLive || u.userId !== broadcasterId));

  return html`
    <article class="round border surface p-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 100%;">
      <!-- Header -->
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-emerald-400" style="font-size: 20px;">people</i>
          <h6 class="m-0 font-bold text-white text-sm">Who is Online</h6>
        </div>
        <span class="chip small border bg-emerald-950 text-emerald-300" style="font-size: 0.7rem; padding: 2px 8px;">
          ${users.length} connected
        </span>
      </div>

      <!-- Users List -->
      <div class="users-scroll-container max flex-1 overflow-y-auto pr-1" style="min-height: 180px; max-height: 380px;">
        ${users.length === 0 && html`
          <div class="text-center p-3 text-slate-500 text-xs">
            No other users connected.
          </div>
        `}

        <!-- Broadcaster Section (if any) -->
        ${broadcasters.length > 0 && html`
          <div class="text-xs uppercase text-slate-400 font-bold mb-1 tracking-wider">🎥 Streamer (${broadcasters.length})</div>
          ${broadcasters.map((u) => {
            const isMe = u.userId === currentUserId;
            return html`
              <div key=${u.userId} class="row items-center justify-between p-2 rounded mb-1" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);">
                <div class="row items-center gap-2">
                  <span style="font-size: 20px;">${u.data.avatar || '👤'}</span>
                  <div>
                    <div class="row items-center gap-1">
                      <span class="bold text-sm text-red-200">${u.data.name || u.userId}</span>
                      ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                    </div>
                    <div class="text-xs text-red-400">Broadcasting live</div>
                  </div>
                </div>
                <div class="row items-center gap-1">
                  ${u.connections > 1 && html`
                    <span class="chip small border" style="font-size: 0.65rem;" title="${u.connections} open tabs/devices">
                      ${u.connections} tabs
                    </span>
                  `}
                  <span class="chip small fill red text-white" style="font-size: 0.65rem; padding: 1px 6px;">
                    LIVE
                  </span>
                </div>
              </div>
            `;
          })}
        `}

        <!-- Viewers Section -->
        <div class="text-xs uppercase text-slate-400 font-bold mt-2 mb-1 tracking-wider">👁️ Viewers (${viewers.length})</div>
        ${viewers.length === 0 && html`
          <div class="text-xs text-slate-500 italic p-2">No viewers currently watching.</div>
        `}
        ${viewers.map((u) => {
          const isMe = u.userId === currentUserId;
          return html`
            <div key=${u.userId} class="row items-center justify-between p-2 rounded mb-1" style="background: ${isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(51, 65, 85, 0.25)'}; border: 1px solid ${isMe ? 'rgba(59, 130, 246, 0.3)' : 'rgba(71, 85, 105, 0.2)'};">
              <div class="row items-center gap-2">
                <span style="font-size: 18px;">${u.data.avatar || '👤'}</span>
                <div>
                  <div class="row items-center gap-1">
                    <span class="text-sm ${isMe ? 'bold text-blue-300' : 'text-slate-200'}">${u.data.name || u.userId}</span>
                    ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                  </div>
                  <div class="text-xs text-slate-400">Viewer</div>
                </div>
              </div>
              <div class="row items-center gap-1">
                ${u.connections > 1 && html`
                  <span class="chip small border" style="font-size: 0.65rem;" title="${u.connections} open tabs">
                    ${u.connections} tabs
                  </span>
                `}
                <span class="status-dot-green" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              </div>
            </div>
          `;
        })}
      </div>
    </article>
  `;
}

```

---

## Arquivo: `example/public/components/PresenceExample.js`

```js
// example/public/components/PresenceExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { buildWsUrl, buildApiUrl } from './config.js';

const ROOMS = ['general', 'engineering', 'lounge'];
const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#10b981', icon: '🟢' },
  { value: 'away', label: 'Away', color: '#f59e0b', icon: '🟡' },
  { value: 'busy', label: 'Busy / DND', color: '#ef4444', icon: '🔴' },
  { value: 'meeting', label: 'In Meeting', color: '#8b5cf6', icon: '🟣' },
];

export function PresenceExample({ user }) {
  const [currentRoom, setCurrentRoom] = useState('general');
  const [status, setStatus] = useState('online');
  const [customStatus, setCustomStatus] = useState('');
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputChat, setInputChat] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const wsRef = useRef(null);
  const chatScrollRef = useRef(null);
  const eventsScrollRef = useRef(null);

  const addEvent = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setEvents((prev) => [...prev.slice(-40), { text, time, type, id: Math.random() }]);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (eventsScrollRef.current) {
      eventsScrollRef.current.scrollTop = eventsScrollRef.current.scrollHeight;
    }
  }, [events]);

  // Connect to presence WebSocket room
  useEffect(() => {
    let isCancelled = false;
    let reconnectTimer = null;
    let retryDelay = 2000;

    const connect = () => {
      if (isCancelled) return;
      const wsUrl = buildWsUrl(`/api/presence-chat/${currentRoom}?userId=${encodeURIComponent(user.userId)}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.avatar)}&status=${encodeURIComponent(status)}&customStatus=${encodeURIComponent(customStatus)}`);

      addEvent(`Connecting to room #${currentRoom}...`, 'info');
      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          retryDelay = 2000;
          setIsConnected(true);
          addEvent(`Connected to #${currentRoom}`, 'success');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'presence_state') {
              setUsers(data.users || []);
              addEvent(`Received initial presence snapshot (${data.users?.length || 0} users)`, 'info');
              return;
            }

            if (data.type === 'presence_join') {
              setUsers((prev) => {
                const existing = prev.filter((u) => u.userId !== data.user.userId);
                return [...existing, data.user];
              });
              addEvent(`👋 ${data.user.data?.name || data.user.userId} joined #${currentRoom}`, 'join');
              return;
            }

            if (data.type === 'presence_leave') {
              setUsers((prev) => {
                const departing = prev.find((u) => u.userId === data.userId);
                if (departing) {
                  addEvent(`🚪 ${departing.data?.name || data.userId} left #${currentRoom}`, 'leave');
                }
                return prev.filter((u) => u.userId !== data.userId);
              });
              return;
            }

            if (data.type === 'presence_update') {
              setUsers((prev) =>
                prev.map((u) => {
                  if (u.userId === data.userId) {
                    addEvent(`🔄 ${u.data?.name || data.userId} is now ${data.data?.status || 'updated'}`, 'update');
                    return { ...u, data: { ...u.data, ...data.data } };
                  }
                  return u;
                })
              );
              return;
            }

            if (data.type === 'chat') {
              setChatMessages((prev) => [...prev, data]);
              return;
            }
          } catch {
            // ignore parse errors
          }
        };

        socket.onerror = () => {
          // Handled gracefully via onclose
        };

        socket.onclose = () => {
          setIsConnected(false);
          addEvent(`Disconnected from #${currentRoom}`, 'leave');
          if (!isCancelled) {
            reconnectTimer = setTimeout(connect, retryDelay);
            retryDelay = Math.min(retryDelay * 1.5, 10000);
          }
        };
      } catch {
        if (!isCancelled) {
          reconnectTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 10000);
        }
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentRoom, user.userId, user.name, user.avatar]);

  // Update status handler
  const handleUpdateStatus = (newStatus, newCustom = customStatus) => {
    setStatus(newStatus);
    setCustomStatus(newCustom);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_presence',
          status: newStatus,
          customStatus: newCustom,
        })
      );
    }
  };

  const handleSendChat = (e) => {
    e?.preventDefault();
    const text = inputChat.trim();
    if (!text) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat',
          text,
        })
      );
    }
    setInputChat('');
  };

  const fetchRoomPresenceApi = async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/presence/${currentRoom}`));
      const data = await res.json();
      setApiResponse({ endpoint: `/api/presence/${currentRoom}`, data });
      setShowApiModal(true);
    } catch (err) {
      setApiResponse({ endpoint: `/api/presence/${currentRoom}`, error: err.message });
      setShowApiModal(true);
    }
  };

  const fetchAllPresenceApi = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/presence'));
      const data = await res.json();
      setApiResponse({ endpoint: '/api/presence', data });
      setShowApiModal(true);
    } catch (err) {
      setApiResponse({ endpoint: '/api/presence', error: err.message });
      setShowApiModal(true);
    }
  };

  return html`
    <div>
      <!-- Top Room Switcher & API Diagnostics Bar -->
      <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
        <div class="row items-center justify-between wrap gap-3">
          <!-- Room Tabs -->
          <div class="row items-center gap-2">
            <span class="bold text-xs uppercase text-slate-400">Select Room:</span>
            <div class="row gap-1">
              ${ROOMS.map(
                (r) => html`
                  <button
                    type="button"
                    class="button small round ${currentRoom === r ? 'fill primary' : 'border'}"
                    onClick=${() => setCurrentRoom(r)}
                  >
                    <span>#${r}</span>
                  </button>
                `
              )}
            </div>
          </div>

          <!-- REST API Buttons -->
          <div class="row items-center gap-2">
            <button
              type="button"
              class="button border small round text-white"
              onClick=${fetchRoomPresenceApi}
              title="Query active room presence via REST API"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">api</i>
              <span>GET /api/presence/${currentRoom}</span>
            </button>
            <button
              type="button"
              class="button border small round text-white"
              onClick=${fetchAllPresenceApi}
              title="Query global presence via REST API"
            >
              <i class="material-symbols-outlined" style="font-size: 16px;">public</i>
              <span>GET /api/presence</span>
            </button>
          </div>
        </div>
      </article>

      <!-- Main Layout -->
      <div class="grid">
        <!-- Left Column: Status Controller & Online Users List -->
        <div class="s12 m7 l7">
          <!-- Status Switcher Card -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <h6 class="m-0 font-bold text-white text-sm mb-2">My Live Status & Mood</h6>
            <div class="row wrap gap-2 items-center mb-3">
              ${STATUS_OPTIONS.map(
                (opt) => html`
                  <button
                    type="button"
                    class="button small round ${status === opt.value ? 'fill primary' : 'border'}"
                    style="border-color: ${opt.color};"
                    onClick=${() => handleUpdateStatus(opt.value)}
                  >
                    <span class="mr-1">${opt.icon}</span>
                    <span>${opt.label}</span>
                  </button>
                `
              )}
            </div>

            <!-- Custom status field -->
            <div class="field label border small m-0" style="background: rgba(15, 23, 42, 0.6);">
              <input
                type="text"
                value=${customStatus}
                onInput=${(e) => handleUpdateStatus(status, e.target.value)}
                placeholder="e.g. Coding WebRTC routers, reviewing PR, in sprint planning"
              />
              <label>Custom status message</label>
            </div>
          </article>

          <!-- Active Room Presence Grid -->
          <article class="round border surface p-3 mb-3" style="background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-3">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-emerald-400" style="font-size: 20px;">group</i>
                <h6 class="m-0 font-bold text-white text-sm">Online Users in #${currentRoom}</h6>
              </div>
              <span class="chip small border bg-emerald-950 text-emerald-300">
                ${users.length} active
              </span>
            </div>

            <div class="grid small-space">
              ${users.length === 0 && html`
                <div class="s12 text-center p-4 text-slate-500 text-xs">
                  No users connected to this room.
                </div>
              `}

              ${users.map((u) => {
                const isMe = u.userId === user.userId;
                const statusObj = STATUS_OPTIONS.find((s) => s.value === u.data.status) || STATUS_OPTIONS[0];

                return html`
                  <div class="s12 m6">
                    <div class="p-3 rounded border" style="background: ${isMe ? 'rgba(37, 99, 235, 0.15)' : 'rgba(30, 41, 59, 0.6)'}; border-color: ${isMe ? 'rgba(59, 130, 246, 0.4)' : '#334155'};">
                      <div class="row items-start justify-between">
                        <div class="row items-center gap-2">
                          <span style="font-size: 24px;">${u.data.avatar || '👤'}</span>
                          <div>
                            <div class="row items-center gap-1">
                              <strong class="text-sm ${isMe ? 'text-blue-300' : 'text-slate-100'}">${u.data.name || u.userId}</strong>
                              ${isMe && html`<span class="text-slate-400 text-xs">(you)</span>`}
                            </div>
                            <div class="row items-center gap-1 mt-1">
                              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusObj.color}; display: inline-block;"></span>
                              <span class="text-xs text-slate-300">${statusObj.label}</span>
                            </div>
                          </div>
                        </div>

                        ${u.connections > 1 && html`
                          <span class="chip small border text-amber-300 bg-amber-950" style="font-size: 0.65rem;" title="${u.connections} open tabs for this user">
                            ${u.connections} tabs
                          </span>
                        `}
                      </div>

                      ${u.data.customStatus && html`
                        <div class="text-xs text-slate-400 mt-2 p-1 rounded bg-slate-900 border border-slate-800 italic">
                          "${u.data.customStatus}"
                        </div>
                      `}
                    </div>
                  </div>
                `;
              })}
            </div>
          </article>
        </div>

        <!-- Right Column: Room Chat & Real-Time Event Log -->
        <div class="s12 m5 l5">
          <!-- Room Chat -->
          <article class="round border surface p-3 mb-3 flex flex-col" style="background: #1e293b; color: #f8fafc; height: 320px;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <h6 class="m-0 font-bold text-white text-sm">Room Chat</h6>
              <span class="text-xs text-slate-400">${chatMessages.length} msgs</span>
            </div>

            <div class="max flex-1 overflow-y-auto mb-2 pr-1" ref=${chatScrollRef}>
              ${chatMessages.length === 0 && html`
                <div class="text-center p-4 text-slate-500 text-xs">Say hello to room #${currentRoom}!</div>
              `}
              ${chatMessages.map((msg, i) => html`
                <div key=${i} class="mb-2 p-2 rounded" style="background: rgba(15, 23, 42, 0.5);">
                  <div class="row items-center justify-between text-xs mb-1">
                    <strong class="text-blue-300">${msg.avatar || '👤'} ${msg.from}</strong>
                    <span class="text-slate-500">${new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <div class="text-sm text-slate-200">${msg.text}</div>
                </div>
              `)}
            </div>

            <form onSubmit=${handleSendChat} class="row items-center gap-2">
              <div class="field label border small m-0 flex-1" style="background: rgba(15, 23, 42, 0.6);">
                <input
                  type="text"
                  value=${inputChat}
                  onInput=${(e) => setInputChat(e.target.value)}
                  placeholder="Type message..."
                />
                <label>Chat</label>
              </div>
              <button type="submit" class="button fill primary circle" style="width: 36px; height: 36px; padding: 0;">
                <i class="material-symbols-outlined" style="font-size: 16px;">send</i>
              </button>
            </form>
          </article>

          <!-- Live Event Diff Stream -->
          <article class="round border surface p-3" style="background: #0f172a; color: #f8fafc; border-color: #334155;">
            <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
              <div class="row items-center gap-2">
                <i class="material-symbols-outlined text-amber-400" style="font-size: 18px;">history</i>
                <h6 class="m-0 font-bold text-white text-sm">Presence Diffs & Events</h6>
              </div>
              <button class="button transparent circle small text-slate-400" onClick=${() => setEvents([])} title="Clear logs">
                <i class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</i>
              </button>
            </div>

            <div class="overflow-y-auto font-mono text-xs" ref=${eventsScrollRef} style="max-height: 180px;">
              ${events.length === 0 && html`
                <div class="text-slate-500 p-2 text-center">Waiting for presence events...</div>
              `}
              ${events.map((ev) => html`
                <div key=${ev.id} class="p-1 mb-1 rounded" style="background: rgba(30, 41, 59, 0.5);">
                  <span class="text-slate-500 mr-2">[${ev.time}]</span>
                  <span class="text-slate-300">${ev.text}</span>
                </div>
              `)}
            </div>
          </article>
        </div>
      </div>

      <!-- REST API Modal -->
      ${showApiModal && apiResponse && html`
        <div
          class="modal-backdrop active"
          style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
        >
          <article class="round border surface p-4" style="max-width: 600px; width: 100%; background: #1e293b; color: #f8fafc;">
            <div class="row items-center justify-between mb-3">
              <strong class="text-sm text-blue-300">Response: ${apiResponse.endpoint}</strong>
              <button class="button circle transparent small text-slate-400" onClick=${() => setShowApiModal(false)}>
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>
            <pre class="p-3 rounded bg-slate-900 overflow-x-auto text-xs text-emerald-400 font-mono" style="max-height: 300px;">
              ${JSON.stringify(apiResponse.data || apiResponse.error, null, 2)}
            </pre>
            <div class="row justify-end mt-3">
              <button class="button fill primary small" onClick=${() => setShowApiModal(false)}>Close</button>
            </div>
          </article>
        </div>
      `}
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/ReactionOverlay.js`

```js
// example/public/components/ReactionOverlay.js
import { html } from 'https://esm.sh/htm/preact';

export const EMOJIS = ['👏', '❤️', '🔥', '🚀', '👍', '🎉'];

export function ReactionOverlay({ floatingReactions, onSendReaction }) {
  return html`
    <div>
      <!-- Floating Particles Area -->
      <div class="floating-reactions-layer">
        ${floatingReactions.map(
          (reaction) => html`
            <span
              key=${reaction.id}
              class="floating-emoji-item"
              style="left: ${reaction.left}%; animation-duration: ${reaction.duration}s;"
            >
              ${reaction.emoji}
            </span>
          `
        )}
      </div>

      <!-- Instant Reaction Bar -->
      <div class="reaction-bar row items-center gap-1">
        ${EMOJIS.map(
          (emoji) => html`
            <button
              type="button"
              class="button circle small transparent reaction-btn"
              onClick=${() => onSendReaction(emoji)}
              title="Send ${emoji} reaction"
            >
              <span>${emoji}</span>
            </button>
          `
        )}
      </div>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/ServerSettingsModal.js`

```js
// example/public/components/ServerSettingsModal.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import {
  getCustomBackend,
  setCustomBackend,
  isGitHubPages,
  isHostedOnDenoServer,
  getBackendHttpOrigin,
  getBackendWsOrigin,
  checkBackendHealth,
  subscribeBackendHealth,
  DEFAULT_REMOTE_BACKEND,
} from './config.js';

export function ServerSettingsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [backendUrl, setBackendUrlState] = useState(getCustomBackend());
  const [saveStatus, setSaveStatus] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [healthInfo, setHealthInfo] = useState({ isChecking: false, isOnline: false, latencyMs: null });
  const [showOverrideForm, setShowOverrideForm] = useState(!isHostedOnDenoServer() || Boolean(getCustomBackend()));

  // Subscribe to live heartbeat diagnostics
  useEffect(() => {
    const unsubscribe = subscribeBackendHealth((status) => {
      setHealthInfo(status);
    });
    // Trigger a fresh probe when modal opens
    checkBackendHealth().catch(() => {});
    return unsubscribe;
  }, [isOpen]);

  const handleCopy = (text, label) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyFeedback(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  const handleSave = (e) => {
    e?.preventDefault();
    setCustomBackend(backendUrl);
    setSaveStatus('Settings saved! Testing connection and reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleReset = () => {
    setBackendUrlState('');
    setCustomBackend('');
    setSaveStatus('Reset to default origin! Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const currentHttp = getBackendHttpOrigin();
  const currentWs = getBackendWsOrigin();
  const isDenoHost = isHostedOnDenoServer() && !getCustomBackend();
  const configJsSnippet = `export const DEFAULT_REMOTE_BACKEND = '${currentHttp}';`;

  return html`
    <div
      class="modal-backdrop active"
      style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;"
    >
      <article
        class="round border surface p-4"
        style="max-width: 580px; width: 100%; margin: 0 auto; background: #1e293b; color: #f8fafc; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); max-height: 90vh; overflow-y: auto;"
      >
        <!-- Modal Header -->
        <div class="row items-center justify-between mb-3">
          <div class="row items-center gap-2">
            <div class="header-logo-icon" style="width: 32px; height: 32px; font-size: 16px;">
              <span>⚡</span>
            </div>
            <div>
              <h5 class="m-0 font-bold text-white text-base">WsRouter Server & Endpoint Hub</h5>
              <div class="text-xs text-slate-400">Connection status, heartbeats, and GitHub Pages export</div>
            </div>
          </div>
          <button class="button circle transparent small text-slate-400" onClick=${onClose}>
            <i class="material-symbols-outlined">close</i>
          </button>
        </div>

        <!-- Live Server Status Banner -->
        <div
          class="border round p-3 mb-3 row items-center justify-between"
          style="background: ${healthInfo.isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-color: ${healthInfo.isOnline ? '#059669' : '#dc2626'};"
        >
          <div class="row items-center gap-2">
            <span
              class="live-dot-indicator ${healthInfo.isOnline ? 'live' : 'offline'}"
              style="background-color: ${healthInfo.isOnline ? '#10b981' : '#ef4444'}; box-shadow: 0 0 8px ${healthInfo.isOnline ? '#10b981' : '#ef4444'};"
            ></span>
            <div>
              <div class="bold text-sm text-white">
                ${healthInfo.isChecking
                  ? 'Checking Heartbeat...'
                  : healthInfo.isOnline
                  ? 'Backend Server Online'
                  : 'Backend Offline / Unreachable'}
              </div>
              <div class="text-xs text-slate-300">
                ${healthInfo.isOnline
                  ? `Response latency: ${healthInfo.latencyMs}ms • Server: ${healthInfo.serverInfo?.server || 'WsRouter'}`
                  : healthInfo.error || 'Check server connection or CORS settings'}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="button border small round text-slate-200"
            onClick=${() => checkBackendHealth()}
            disabled=${healthInfo.isChecking}
            title="Probe backend heartbeat now"
          >
            <i class="material-symbols-outlined" style="font-size: 14px;">refresh</i>
            <span>${healthInfo.isChecking ? 'Probing...' : 'Recheck'}</span>
          </button>
        </div>

        ${!healthInfo.isOnline && currentHttp.includes('ais-dev-') && html`
          <div class="chip small border amber text-amber-200 mb-3" style="width: 100%; white-space: normal; height: auto; padding: 8px;">
            <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">warning</i>
            <span>
              <strong>AI Studio Limitation:</strong> Accessing a preview URL from an external site (like GitHub Pages) requires an active session. 
              Try opening <a href="${currentHttp}/api/health" target="_blank" class="text-white underline">${currentHttp}/api/health</a> in a new tab first to "wake up" the session, then return here and click Recheck.
            </span>
          </div>
        `}

        ${copyFeedback && html`
          <div class="chip small border green text-white mb-3" style="width: 100%;">
            <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">check_circle</i>
            <span>${copyFeedback}</span>
          </div>
        `}

        <!-- Mode 1: Read-Only Info View (When hosted directly on Deno Server) -->
        ${isDenoHost && !showOverrideForm && html`
          <div>
            <div class="chip small border blue text-blue-200 mb-3" style="width: 100%; white-space: normal; height: auto; padding: 8px;">
              <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">info</i>
              <span>
                <strong>Copy this URL</strong> and paste it into the "Custom WsRouter Backend" field of your GitHub Pages app to connect them.
              </span>
            </div>

            <!-- Primary Backend URL (The one users actually need) -->
            <div class="mb-4">
              <div class="row items-center justify-between mb-1">
                <label class="text-xs text-blue-400 bold uppercase tracking-wider">Primary Backend URL</label>
                <span class="text-[10px] text-slate-500">Copy this to GitHub Pages "Custom Backend"</span>
              </div>
              <div class="row items-center gap-2 p-3 rounded bg-blue-900 bg-opacity-20 border-2 border-blue-500 border-opacity-40">
                <input
                  type="text"
                  readonly
                  class="flex-1 text-base text-blue-300 bg-transparent border-none font-mono"
                  value=${currentHttp}
                  style="outline: none;"
                />
                <button
                  type="button"
                  class="button fill primary medium round"
                  onClick=${() => handleCopy(currentHttp, 'Backend URL')}
                  title="Copy this URL to use in GitHub Pages"
                >
                  <i class="material-symbols-outlined">content_copy</i>
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <!-- Advanced / Technical Details (Collapsed by default) -->
            <details class="mb-4 border border-slate-700 rounded overflow-hidden">
              <summary class="p-2 bg-slate-800 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">
                <span class="row items-center gap-1">
                  <i class="material-symbols-outlined" style="font-size: 14px;">settings</i>
                  Technical Details (WebSocket & Code)
                </span>
              </summary>
              <div class="p-3 bg-slate-900 space-y-3">
                <div class="row items-center justify-between">
                  <span class="text-xs text-slate-500">WebSocket (WSS) Origin:</span>
                  <button
                    type="button"
                    class="button transparent small text-emerald-500 p-1 h-auto"
                    onClick=${() => handleCopy(currentWs, 'WebSocket URL')}
                  >
                    <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">content_copy</i>
                    <span class="text-[10px]">Copy WSS</span>
                  </button>
                </div>
                <div class="p-2 bg-slate-950 rounded font-mono text-[10px] text-emerald-600 truncate">
                  ${currentWs}
                </div>
              </div>
            </details>

            <div class="row justify-between items-center mt-4 border-t border-slate-800 pt-3">
              <button
                type="button"
                class="button transparent small text-slate-400"
                onClick=${() => setShowOverrideForm(true)}
              >
                <i class="material-symbols-outlined" style="font-size: 14px;">edit</i>
                <span>Override with Custom URL</span>
              </button>

              <button type="button" class="button border small text-slate-300 round" onClick=${onClose}>
                Close
              </button>
            </div>
          </div>
        `}

        <!-- Mode 2: Custom / Override Endpoint Config Form -->
        ${(!isDenoHost || showOverrideForm) && html`
          <div>
            ${isGitHubPages() && html`
              <div class="chip small border amber text-amber-200 mb-3" style="width: 100%; white-space: normal; height: auto; padding: 8px;">
                <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">info</i>
                <span>
                  <strong>GitHub Pages Static Deployment:</strong> Point this frontend to your deployed WsRouter Deno instance (e.g., Deno Deploy, Fly.io, Cloud Run, or localhost via tunnel).
                </span>
              </div>
            `}

            <form onSubmit=${handleSave}>
              <div class="field label border small mb-2">
                <input
                  type="text"
                  id="server-settings-backend-url-input"
                  value=${backendUrl}
                  onInput=${(e) => setBackendUrlState(e.target.value)}
                  placeholder="e.g. https://my-wsrouter.deno.dev"
                />
                <label>Custom Backend URL</label>
              </div>

              ${DEFAULT_REMOTE_BACKEND && html`
                <div class="text-xs text-slate-400 mb-3">
                  <span>Default from config: </span>
                  <code class="text-amber-300 font-mono">${DEFAULT_REMOTE_BACKEND}</code>
                </div>
              `}

              ${saveStatus && html`
                <div class="chip small border green text-white mb-3" style="width: 100%;">
                  <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">check_circle</i>
                  <span>${saveStatus}</span>
                </div>
              `}

              <div class="row gap-2 justify-between items-center mt-4 border-t border-slate-800 pt-3">
                <div class="row gap-1">
                  <button type="button" class="button border small text-slate-300 round" onClick=${handleReset} title="Reset to default origin">
                    Reset
                  </button>
                  ${isHostedOnDenoServer() && html`
                    <button type="button" class="button transparent small text-slate-400" onClick=${() => setShowOverrideForm(false)}>
                      View Info
                    </button>
                  `}
                </div>

                <div class="row gap-2">
                  <button type="button" class="button border small text-slate-300 round" onClick=${onClose}>
                    Cancel
                  </button>
                  <button type="submit" class="button fill primary small round">
                    <i class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">save</i>
                    <span>Save & Reload</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        `}
      </article>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/StreamStats.js`

```js
// example/public/components/StreamStats.js
import { html } from 'https://esm.sh/htm/preact';

export function StreamStats({ stats, room, user, isBroadcasting, isLive, onClose }) {
  return html`
    <article class="round border surface p-3 mb-3" style="background: #0f172a; border-color: #334155; color: #f8fafc;">
      <div class="row items-center justify-between pb-2 border-b border-slate-700 mb-2">
        <div class="row items-center gap-2">
          <i class="material-symbols-outlined text-amber-400" style="font-size: 18px;">analytics</i>
          <strong class="text-sm">WebRTC & Connection Diagnostics</strong>
        </div>
        <button class="button circle transparent small text-slate-400" onClick=${onClose}>
          <i class="material-symbols-outlined" style="font-size: 16px;">close</i>
        </button>
      </div>

      <div class="grid small-space text-xs">
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Signaling WS</span>
            <span class="bold ${stats.wsConnected ? 'text-emerald-400' : 'text-red-400'}">
              ${stats.wsConnected ? 'Connected (WSS)' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">P2P ICE State</span>
            <span class="bold text-blue-400">${stats.iceState || 'new / idle'}</span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Active Peer Links</span>
            <span class="bold text-amber-400">${stats.peerCount || 0} peers</span>
          </div>
        </div>
        <div class="s6 m3">
          <div class="p-2 rounded bg-slate-800">
            <span class="text-slate-400 block">Room ID</span>
            <span class="bold text-slate-200">#${room}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

```

---

## Arquivo: `example/public/components/StreamView.js`

```js
// example/public/components/StreamView.js
import { html } from 'https://esm.sh/htm/preact';
import { useRef, useEffect, useState } from 'https://esm.sh/preact/hooks';
import { ReactionOverlay } from './ReactionOverlay.js';

export function StreamView({
  isBroadcasting,
  isLive,
  broadcasterName,
  broadcasterAvatar,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onStartBroadcast,
  onStopBroadcast,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  floatingReactions,
  onSendReaction,
  user,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPaused, setIsPaused] = useState(true);

  // Bind local or remote media stream to video element
  useEffect(() => {
    if (!videoRef.current) return;
    const streamToAttach = isBroadcasting ? localStream : remoteStream;
    
    if (streamToAttach) {
      if (videoRef.current.srcObject !== streamToAttach) {
        videoRef.current.srcObject = streamToAttach;
      }
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPaused(false)).catch((err) => {
          console.warn('[StreamView] Autoplay blocked:', err);
          setIsPaused(true);
        });
      }
    } else {
      videoRef.current.srcObject = null;
      setIsPaused(true);
    }
  }, [localStream, remoteStream, isBroadcasting]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPaused(false))
        .catch(err => {
          console.error("Manual play failed:", err);
          setIsPaused(true);
        });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isVideoVisible = (isBroadcasting && localStream) || (!isBroadcasting && remoteStream);

  return html`
    <div class="stream-view-container">
      <!-- 16:9 Video Player Stage -->
      <div class="video-stage mb-3" ref=${containerRef}>
        <!-- Top Status Badge -->
        <div class="video-overlay-badge">
          <span class="live-dot-indicator ${isLive ? 'live' : 'offline'}"></span>
          <span class="bold text-xs uppercase">${isLive ? 'LIVE' : 'OFFLINE'}</span>
          ${isLive && broadcasterName && html`
            <span class="opacity-80 text-xs ml-1">• ${broadcasterAvatar || '👤'} ${broadcasterName}</span>
          `}
          ${isBroadcasting && html`
            <span class="chip small border bg-blue-900 text-blue-200 ml-2" style="font-size: 0.65rem; padding: 1px 6px;">
              YOU ARE BROADCASTING
            </span>
          `}
        </div>

        <!-- Floating Reactions Particles Layer (Active only when live stream or broadcasting) -->
        ${(isLive || isBroadcasting) && html`
          <${ReactionOverlay}
            floatingReactions=${floatingReactions}
            onSendReaction=${onSendReaction}
          />
        `}

        <!-- Active Video Element -->
        <video
          ref=${videoRef}
          autoplay
          playsinline
          muted=${isBroadcasting}
          class="stage-video-element ${isVideoVisible ? 'visible' : 'hidden'}"
          onClick=${handleManualPlay}
        ></video>

        <!-- Autoplay Blocked / Manual Play Overlay -->
        ${isVideoVisible && !isBroadcasting && html`
          <div 
            class="video-manual-play-overlay ${isPaused ? 'visible' : 'hidden'}"
            onClick=${handleManualPlay}
            style="position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); cursor: pointer;"
          >
            <button class="button circle extra large primary">
              <i class="material-symbols-outlined" style="font-size: 48px;">play_arrow</i>
            </button>
            <div class="absolute bottom-10 text-white bold text-shadow">Click to Start Stream</div>
          </div>
        `}

        <!-- Loading / Connecting State -->
        ${isLive && !isBroadcasting && !remoteStream && html`
          <div class="stage-placeholder text-center p-4">
            <div class="progress circle large white mb-3"></div>
            <h6 class="m-0 font-bold text-slate-200">Connecting to Stream...</h6>
            <p class="text-sm text-slate-400 mt-1">Establishing P2P connection with broadcaster</p>
          </div>
        `}

        <!-- Offline / Waiting Placeholder State -->
        ${!isLive && !isBroadcasting && html`
          <div class="stage-placeholder text-center p-4">
            <div class="avatar-pulse mb-3">
              <i class="material-symbols-outlined text-slate-500" style="font-size: 56px;">videocam_off</i>
            </div>
            <h6 class="m-0 font-bold text-slate-200">No Live Stream Currently Active</h6>
            <p class="text-sm text-slate-400 mt-1 mb-3" style="max-width: 360px; margin-left:auto; margin-right:auto;">
              Click below to start broadcasting your webcam or screen share to everyone online in this room.
            </p>
            <button
              class="button fill primary round"
              onClick=${onStartBroadcast}
            >
              <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">videocam</i>
              <span>Start Webcam Broadcast</span>
            </button>
          </div>
        `}

        <!-- Bottom Controls Bar inside Video Stage -->
        <div class="video-bottom-bar row items-center justify-between p-2">
          <div class="row items-center gap-2">
            ${isBroadcasting && html`
              <span class="chip small border bg-emerald-950 text-emerald-300">
                <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">sensors</i>
                Streaming to Peers
              </span>
            `}
            ${!isBroadcasting && isLive && html`
              <span class="chip small border bg-blue-950 text-blue-300">
                <i class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">visibility</i>
                Watching Live Stream
              </span>
            `}
          </div>

          <div class="row items-center gap-2">
            <button
              class="button circle small transparent text-white"
              onClick=${toggleFullscreen}
              title="Toggle Fullscreen"
            >
              <i class="material-symbols-outlined" style="font-size: 20px;">fullscreen</i>
            </button>
          </div>
        </div>
      </div>

      <!-- Action & Media Controls Deck -->
      <article class="round border p-3 mb-3" style="background: ${isBroadcasting ? '#1e293b' : 'transparent'}; border-color: ${isBroadcasting ? '#475569' : '#1e293b'}; color: #f8fafc;">
        <div class="row items-center justify-between wrap gap-3">
          <!-- Left: Broadcast Master Button -->
          <div class="row items-center gap-2">
            ${!isBroadcasting ? html`
              <button
                class="button fill primary round"
                onClick=${onStartBroadcast}
                title="Start broadcasting your webcam and microphone"
              >
                <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">videocam</i>
                <span>Go Live</span>
              </button>
            ` : html`
              <button
                class="button fill red round"
                onClick=${onStopBroadcast}
                title="End webcam streaming session"
              >
                <i class="material-symbols-outlined" style="font-size: 20px; margin-right: 6px;">stop_circle</i>
                <span>End Broadcast</span>
              </button>
            `}
            
            ${!isBroadcasting && html`
              <div class="text-xs text-slate-400 hide-on-mobile ml-2">
                ${isLive ? '💡 Watching live P2P stream.' : '💡 Ready to host? Click "Go Live" to start.'}
              </div>
            `}
          </div>

          <!-- Middle: Broadcaster Media Controls -->
          ${isBroadcasting && html`
            <div class="row items-center gap-2">
              <!-- Mute / Unmute Microphone -->
              <button
                class="button small round ${isMuted ? 'fill red' : 'border text-white'}"
                onClick=${onToggleMic}
                title=${isMuted ? 'Unmute microphone' : 'Mute microphone'}
                style="padding: 0 8px; height: 32px;"
              >
                <i class="material-symbols-outlined" style="font-size: 18px; ${!isMuted ? '' : 'margin-right: 4px;'}">
                  ${isMuted ? 'mic_off' : 'mic'}
                </i>
                <span class="hide-on-mobile">${isMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              <!-- Turn Video On / Off -->
              <button
                class="button small round ${isVideoOff ? 'fill red' : 'border text-white'}"
                onClick=${onToggleCamera}
                title=${isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                style="padding: 0 8px; height: 32px;"
              >
                <i class="material-symbols-outlined" style="font-size: 18px; ${!isVideoOff ? '' : 'margin-right: 4px;'}">
                  ${isVideoOff ? 'videocam_off' : 'videocam'}
                </i>
                <span class="hide-on-mobile">${isVideoOff ? 'Camera Off' : 'Camera On'}</span>
              </button>

              <!-- Screen Share Toggle -->
              <button
                class="button small round ${isScreenSharing ? 'fill primary' : 'border text-white'}"
                onClick=${onToggleScreenShare}
                title=${isScreenSharing ? 'Switch back to webcam' : 'Share your screen'}
                style="padding: 0 8px; height: 32px;"
              >
                <i class="material-symbols-outlined" style="font-size: 18px; ${!isScreenSharing ? '' : 'margin-right: 4px;'}">
                  ${isScreenSharing ? 'screen_share' : 'present_to_all'}
                </i>
                <span class="hide-on-mobile">${isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
              </button>
            </div>
          `}

          <!-- Right: Peer & Room Summary -->
          <div class="row items-center gap-2">
            <span class="chip small border" style="font-size: 0.75rem; background: rgba(30, 41, 59, 0.4);">
              Room: <strong class="ml-1 text-slate-200">#${user.room || 'main-stage'}</strong>
            </span>
          </div>
        </div>
      </article>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/WebRTCExample.js`

```js
// example/public/components/WebRTCExample.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact/hooks';
import { StreamView } from './StreamView.js';
import { ChatPanel } from './ChatPanel.js';
import { OnlineUsers } from './OnlineUsers.js';
import { StreamStats } from './StreamStats.js';
import { buildWsUrl } from './config.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export function WebRTCExample({ user, activeMobileTab, showStats, setShowStats, onOpenViewerTab }) {
  // Connection & Presence State
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // WebRTC & Stream State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState(null);
  const [broadcasterName, setBroadcasterName] = useState('');
  const [broadcasterAvatar, setBroadcasterAvatar] = useState('👤');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Diagnostic Stats
  const [stats, setStats] = useState({
    wsConnected: false,
    iceState: 'idle',
    peerCount: 0,
  });

  // Refs for persistent connection state
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Map<peerId, RTCPeerConnection>
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const broadcasterIdRef = useRef(null);
  const isBroadcastingRef = useRef(false);

  localStreamRef.current = localStream;
  remoteStreamRef.current = remoteStream;
  broadcasterIdRef.current = broadcasterId;
  isBroadcastingRef.current = isBroadcasting;

  const sendSignaling = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const spawnReaction = useCallback((emoji) => {
    const id = `${Date.now()}_${Math.random()}`;
    const left = Math.floor(Math.random() * 60) + 20; // 20% - 80%
    const duration = (Math.random() * 0.6 + 1.8).toFixed(2);
    setFloatingReactions((prev) => [...prev, { id, emoji, left, duration }]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, parseFloat(duration) * 1000);
  }, []);

  // Broadcaster: connect to a new viewer
  const connectToViewer = useCallback(async (viewerId) => {
    if (!localStreamRef.current) return;
    
    // Prevent redundant connections if already exists and active
    const existing = peerConnectionsRef.current.get(viewerId);
    if (existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting')) {
      return;
    }
    if (existing) existing.close();

    try {
      console.log(`[WebRTC] Creating RTCPeerConnection to viewer: ${viewerId}`);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(viewerId, pc);

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling({
            type: 'webrtc_candidate',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            from: user.userId,
            to: viewerId,
            room: user.room,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setStats((prev) => ({
          ...prev,
          iceState: pc.iceConnectionState,
          peerCount: peerConnectionsRef.current.size,
        }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignaling({
        type: 'webrtc_offer',
        sdp: offer,
        from: user.userId,
        to: viewerId,
        room: user.room,
      });

      setStats((prev) => ({
        ...prev,
        peerCount: peerConnectionsRef.current.size,
      }));
    } catch (err) {
      console.error(`[WebRTC] Error connecting to viewer ${viewerId}:`, err);
    }
  }, [user.userId, user.room, sendSignaling]);

  // Viewer: handle incoming offer from broadcaster
  const handleReceiveOffer = useCallback(async (data) => {
    try {
      console.log(`[WebRTC] Received offer from broadcaster: ${data.from}`);
      
      const existing = peerConnectionsRef.current.get(data.from);
      if (existing) existing.close();

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(data.from, pc);

      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote stream track:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setIsLive(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling({
            type: 'webrtc_candidate',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            from: user.userId,
            to: data.from,
            room: user.room,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setStats((prev) => ({
          ...prev,
          iceState: pc.iceConnectionState,
          peerCount: peerConnectionsRef.current.size,
        }));
      };

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignaling({
        type: 'webrtc_answer',
        sdp: answer,
        from: user.userId,
        to: data.from,
        room: user.room,
      });

      setStats((prev) => ({
        ...prev,
        peerCount: peerConnectionsRef.current.size,
      }));
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }, [user.userId, user.room, sendSignaling]);

  // Broadcaster: handle answer
  const handleReceiveAnswer = useCallback(async (data) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('[WebRTC] Error setting remote answer:', err);
      }
    }
  }, []);

  // Handle ICE candidate
  const handleReceiveCandidate = useCallback(async (data) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  }, []);

  // Media Broadcast controls
  const handleStartBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      setLocalStream(stream);
      setIsBroadcasting(true);
      setIsLive(true);
      setBroadcasterId(user.userId);
      setBroadcasterName(user.name);
      setBroadcasterAvatar(user.avatar);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsScreenSharing(false);

      sendSignaling({
        type: 'broadcaster_started',
        broadcasterId: user.userId,
        broadcasterName: user.name,
        broadcasterAvatar: user.avatar,
        room: user.room,
      });

      users.forEach((u) => {
        if (u.userId !== user.userId) {
          connectToViewer(u.userId);
        }
      });
    } catch (err) {
      console.error('[WebRTC] Camera access denied or failed:', err);
      alert('Could not access camera or microphone: ' + err.message);
    }
  };

  const handleStopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setLocalStream(null);
    setIsBroadcasting(false);
    setIsLive(false);
    setBroadcasterId(null);
    setBroadcasterName('');
    setIsScreenSharing(false);

    sendSignaling({
      type: 'broadcaster_stopped',
      broadcasterId: user.userId,
      room: user.room,
    });
  };

  const handleToggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const handleToggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!isBroadcasting) return;

    if (isScreenSharing) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted });
        const newVideoTrack = camStream.getVideoTracks()[0];

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack);
        });

        setLocalStream(camStream);
        setIsScreenSharing(false);
      } catch (err) {
        console.error('Error switching back to webcam:', err);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          handleToggleScreenShare();
        };

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        setLocalStream(screenStream);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  };

  const handleSendMessage = (text) => {
    if (!text) return;
    sendSignaling({
      type: 'chat',
      text,
      room: user.room,
    });
  };

  const handleSendReaction = (emoji) => {
    spawnReaction(emoji);
    sendSignaling({
      type: 'stream_reaction',
      emoji,
      from: user.name,
      room: user.room,
    });
  };

  // WebSocket lifecycle
  useEffect(() => {
    if (!user.isRegistered) return;

    let reconnectTimer = null;
    let isCancelled = false;
    let retryDelay = 2000;

    const connectWebSocket = () => {
      if (isCancelled) return;
      const wsUrl = buildWsUrl(`/api/webrtc/${encodeURIComponent(user.room)}?userId=${encodeURIComponent(user.userId)}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.avatar)}&role=${isBroadcastingRef.current ? 'broadcaster' : 'viewer'}`);

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          retryDelay = 2000;
          setIsConnected(true);
          setStats((prev) => ({ ...prev, wsConnected: true }));

          if (!isBroadcastingRef.current) {
            socket.send(JSON.stringify({
              type: 'request_stream',
              viewerId: user.userId,
              viewerName: user.name,
              room: user.room,
            }));
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'presence_state') {
              setUsers(data.users || []);
              return;
            }
            if (data.type === 'presence_join') {
              setUsers((prev) => {
                const existing = prev.filter((u) => u.userId !== data.user.userId);
                return [...existing, data.user];
              });

              if (isBroadcastingRef.current && data.user.userId !== user.userId) {
                connectToViewer(data.user.userId);
              }
              return;
            }
            if (data.type === 'presence_leave') {
              setUsers((prev) => prev.filter((u) => u.userId !== data.userId));
              const pc = peerConnectionsRef.current.get(data.userId);
              if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(data.userId);
              }
              return;
            }
            if (data.type === 'presence_update') {
              setUsers((prev) =>
                prev.map((u) => (u.userId === data.userId ? { ...u, data: { ...u.data, ...data.data } } : u))
              );
              return;
            }

            if (data.type === 'broadcaster_started') {
              setIsLive(true);
              setBroadcasterId(data.broadcasterId);
              setBroadcasterName(data.broadcasterName || 'Host');
              setBroadcasterAvatar(data.broadcasterAvatar || '👤');

              if (!isBroadcastingRef.current && data.broadcasterId !== user.userId) {
                socket.send(JSON.stringify({
                  type: 'request_stream',
                  viewerId: user.userId,
                  viewerName: user.name,
                  room: user.room,
                }));
              }
              return;
            }

            if (data.type === 'broadcaster_stopped') {
              setIsLive(false);
              setBroadcasterId(null);
              setBroadcasterName('');
              setRemoteStream(null);
              peerConnectionsRef.current.forEach((pc) => pc.close());
              peerConnectionsRef.current.clear();
              return;
            }

            if (data.type === 'request_stream' && isBroadcastingRef.current) {
              connectToViewer(data.viewerId);
              return;
            }

            if (data.type === 'webrtc_offer' && data.to === user.userId) {
              handleReceiveOffer(data);
              return;
            }

            if (data.type === 'webrtc_answer' && data.to === user.userId) {
              handleReceiveAnswer(data);
              return;
            }

            if (data.type === 'webrtc_candidate' && data.to === user.userId) {
              handleReceiveCandidate(data);
              return;
            }

            if (data.type === 'chat') {
              setMessages((prev) => [...prev, data]);
              return;
            }

            if (data.type === 'stream_reaction') {
              spawnReaction(data.emoji);
              return;
            }
          } catch {
            // graceful parse fallback
          }
        };

        socket.onerror = () => {
          // Socket error will trigger onclose
        };

        socket.onclose = () => {
          setIsConnected(false);
          setStats((prev) => ({ ...prev, wsConnected: false }));
          if (!isCancelled) {
            reconnectTimer = setTimeout(connectWebSocket, retryDelay);
            retryDelay = Math.min(retryDelay * 1.5, 10000);
          }
        };
      } catch {
        if (!isCancelled) {
          reconnectTimer = setTimeout(connectWebSocket, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 10000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isCancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Cleanup all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [user.isRegistered, user.room, user.userId, user.name, user.avatar, connectToViewer, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, spawnReaction]);

  return html`
    <div>
      <!-- Optional Diagnostic Stats Drawer -->
      ${showStats && html`
        <${StreamStats}
          stats=${stats}
          room=${user.room}
          user=${user}
          isBroadcasting=${isBroadcasting}
          isLive=${isLive}
          onClose=${() => setShowStats(false)}
        />
      `}

      <!-- Main Responsive Grid -->
      <div class="grid">
        <!-- Main Column: Stream Player & Broadcaster Deck -->
        <div class="s12 m7 l8 ${activeMobileTab !== 'stream' ? 'hide-on-mobile' : ''}">
          <${StreamView}
            isBroadcasting=${isBroadcasting}
            isLive=${isLive}
            broadcasterName=${broadcasterName}
            broadcasterAvatar=${broadcasterAvatar}
            localStream=${localStream}
            remoteStream=${remoteStream}
            isMuted=${isMuted}
            isVideoOff=${isVideoOff}
            isScreenSharing=${isScreenSharing}
            onStartBroadcast=${handleStartBroadcast}
            onStopBroadcast=${handleStopBroadcast}
            onToggleMic=${handleToggleMic}
            onToggleCamera=${handleToggleCamera}
            onToggleScreenShare=${handleToggleScreenShare}
            floatingReactions=${floatingReactions}
            onSendReaction=${handleSendReaction}
            streamStats=${stats}
            user=${user}
          />
        </div>

        <!-- Sidebar Column: Chat Panel & Who is Online -->
        <div class="s12 m5 l4">
          <!-- Chat Panel -->
          <div class="mb-3 ${activeMobileTab === 'users' ? 'hide-on-mobile' : ''}">
            <${ChatPanel}
              messages=${messages}
              onSendMessage=${handleSendMessage}
              user=${user}
              isLive=${isLive}
              broadcasterId=${broadcasterId}
            />
          </div>

          <!-- Who is Online Panel -->
          <div class="${activeMobileTab === 'chat' ? 'hide-on-mobile' : ''}">
            <${OnlineUsers}
              users=${users}
              currentUserId=${user.userId}
              isLive=${isLive}
              broadcasterId=${broadcasterId}
            />
          </div>
        </div>
      </div>
    </div>
  `;
}

```

---

## Arquivo: `example/public/components/config.js`

```js
// example/public/components/config.js
/**
 * @file config.js
 * @description Centralized configuration, URL builder, heartbeat health-checker,
 * and graceful fallback engine for WsRouter.
 * 
 * Supports both Deno-hosted runtime servers and static GitHub Pages deployments.
 */

/**
 * OPTIONAL: You can hardcode a default remote Deno WsRouter backend instance here.
 * If empty (""), the app will default to current window.location on Deno server,
 * or prompt to configure a backend when hosted statically on GitHub Pages.
 * 
 * Example: export const DEFAULT_REMOTE_BACKEND = 'https://my-wsrouter.deno.dev';
 */
export const DEFAULT_REMOTE_BACKEND = 'https://wsrouter.vanaware.deno.net';

/**
 * Detects if the current client is hosted on GitHub Pages static hosting
 */
export function isGitHubPages() {
  return window.location.hostname.endsWith('github.io');
}

/**
 * Detects if the client is running directly from the Deno server
 */
export function isHostedOnDenoServer() {
  return !isGitHubPages();
}

/**
 * Retrieves the currently active custom backend URL (localStorage takes precedence over hardcoded default)
 */
export function getCustomBackend() {
  const stored = localStorage.getItem('wsrouter_custom_backend');
  if (stored !== null && stored !== undefined) {
    return stored.trim();
  }
  return DEFAULT_REMOTE_BACKEND ? DEFAULT_REMOTE_BACKEND.trim() : '';
}

/**
 * Sets or clears the custom backend URL in localStorage
 */
export function setCustomBackend(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('wsrouter_custom_backend');
  } else {
    localStorage.setItem('wsrouter_custom_backend', url.trim().replace(/\/+$/, ''));
  }
}

/**
 * Resolves the absolute HTTP origin for API requests
 */
export function getBackendHttpOrigin() {
  const custom = getCustomBackend();
  if (custom) {
    if (custom.startsWith('http://') || custom.startsWith('https://')) {
      return custom.replace(/\/+$/, '');
    }
    if (custom.startsWith('wss://')) return custom.replace('wss://', 'https://').replace(/\/+$/, '');
    if (custom.startsWith('ws://')) return custom.replace('ws://', 'http://').replace(/\/+$/, '');
    return `https://${custom.replace(/\/+$/, '')}`;
  }
  return window.location.origin;
}

/**
 * Resolves the absolute WebSocket origin (ws:// or wss://)
 */
export function getBackendWsOrigin() {
  const custom = getCustomBackend();
  if (custom) {
    if (custom.startsWith('wss://') || custom.startsWith('ws://')) {
      return custom.replace(/\/+$/, '');
    }
    if (custom.startsWith('https://')) return custom.replace('https://', 'wss://').replace(/\/+$/, '');
    if (custom.startsWith('http://')) return custom.replace('http://', 'ws://').replace(/\/+$/, '');
    return `wss://${custom.replace(/\/+$/, '')}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

/**
 * Builds a full WebSocket URL for a given path and query
 */
export function buildWsUrl(pathAndQuery) {
  const wsOrigin = getBackendWsOrigin();
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${wsOrigin}${path}`;
}

/**
 * Builds a full HTTP API URL for a given endpoint path
 */
export function buildApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const custom = getCustomBackend();
  if (!custom && isHostedOnDenoServer()) {
    return cleanPath;
  }
  return `${getBackendHttpOrigin()}${cleanPath}`;
}

// ==========================================
// 💓 Heartbeat & Backend Health Diagnostics
// ==========================================

let lastHealthStatus = {
  isChecking: false,
  isOnline: false,
  latencyMs: null,
  timestamp: Date.now(),
  serverInfo: null,
  error: null,
};

const healthListeners = new Set();

function notifyHealthListeners() {
  for (const listener of healthListeners) {
    try {
      listener({ ...lastHealthStatus });
    } catch {
      // Ignore listener errors
    }
  }
}

export function subscribeBackendHealth(callback) {
  healthListeners.add(callback);
  callback({ ...lastHealthStatus });
  return () => healthListeners.delete(callback);
}

export function getLastBackendHealth() {
  return { ...lastHealthStatus };
}

/**
 * Gracefully checks backend heartbeat without throwing unhandled exceptions.
 */
export async function checkBackendHealth(timeoutMs = 3500) {
  lastHealthStatus.isChecking = true;
  notifyHealthListeners();

  const startTime = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const customBackend = getCustomBackend();
  const isGH = isGitHubPages();

  // If on static hosting and no backend configured, don't even try to fetch
  if (isGH && !customBackend) {
    lastHealthStatus = {
      isChecking: false,
      isOnline: false,
      latencyMs: 0,
      timestamp: Date.now(),
      serverInfo: null,
      error: 'No remote backend configured. Please set one in Settings.',
    };
    notifyHealthListeners();
    return { ...lastHealthStatus };
  }

  const healthUrl = buildApiUrl('/api/health');
  console.log(`[Health] Probing: ${healthUrl}`);

  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      credentials: 'omit', // Try without credentials first to avoid AI Studio redirect if possible
      redirect: 'follow',
    });
    clearTimeout(timer);

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[Health] Response: ${res.status} in ${elapsed}ms`);

    // Handle opaque or redirected responses that might fail res.ok
    if (res.status === 302 || res.status === 0) {
       throw new Error('Backend requires authentication (AI Studio Login)');
    }

    if (res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = { status: 'ok' };
      }

      lastHealthStatus = {
        isChecking: false,
        isOnline: true,
        latencyMs: elapsed,
        timestamp: Date.now(),
        serverInfo: data,
        error: null,
      };
    } else {
      lastHealthStatus = {
        isChecking: false,
        isOnline: false,
        latencyMs: elapsed,
        timestamp: Date.now(),
        serverInfo: null,
        error: `Server responded with HTTP ${res.status}`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = err.name === 'AbortError';

    lastHealthStatus = {
      isChecking: false,
      isOnline: false,
      latencyMs: elapsed,
      timestamp: Date.now(),
      serverInfo: null,
      error: isTimeout ? `Request timed out after ${timeoutMs}ms` : (err.message || 'Connection unreachable / offline'),
    };
  }

  notifyHealthListeners();
  return { ...lastHealthStatus };
}

// Initial background probe on load
setTimeout(() => {
  checkBackendHealth().catch(() => {});
}, 300);

// Recurring heartbeat probe every 30 seconds
setInterval(() => {
  checkBackendHealth().catch(() => {});
}, 30000);

```

---

## Arquivo: `example/public/components/version.js`

```js
// example/public/components/version.js
export const APP_VERSION = '0.4.0';

```

---

## Arquivo: `example/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WsRouter v0.4.0 • WebRTC & Real-time Showcase</title>
  <meta name="description" content="WsRouter v0.4.0: Unified example showcase featuring WebRTC live webcam streaming, online presence tracking, JWT authentication, and REST routing.">
  
  <!-- BeerCSS CDN & Material Symbols -->
  <link href="https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.css" rel="stylesheet">
  <script type="module" src="https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.js"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
  <link rel="manifest" href="./manifest.json">
  <link rel="icon" href="data:,">
  <meta name="theme-color" content="#2563eb">

  <style>
    :root {
      --primary: #2563eb;
      --primary-container: #1d4ed8;
      --surface: #1e293b;
      --background: #0f172a;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      background-color: #0f172a;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      max-width: 100vw;
      overflow-x: hidden;
    }

    #app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100vw;
      overflow-x: hidden;
    }

    .app-root-container {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      padding: 0 12px;
    }

    /* Video Player Stage */
    .video-stage {
      position: relative;
      width: 100%;
      background: #020617;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #1e293b;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .stage-video-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .stage-video-element.hidden {
      display: none;
    }

    .video-manual-play-overlay {
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .video-manual-play-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .video-manual-play-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .stage-placeholder {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #1e293b 0%, #020617 100%);
      z-index: 2;
    }

    .video-overlay-badge {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 10;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 0.82rem;
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .video-bottom-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      background: linear-gradient(to top, rgba(2, 6, 23, 0.9) 0%, transparent 100%);
    }

    /* Live Dot Indicator */
    .live-dot-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .live-dot-indicator.live {
      background-color: #ef4444;
      box-shadow: 0 0 8px #ef4444;
      animation: pulse-dot 1.5s infinite;
    }

    .live-dot-indicator.offline {
      background-color: #64748b;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Floating Reactions */
    .floating-reactions-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 20;
    }

    .floating-emoji-item {
      position: absolute;
      bottom: 20px;
      font-size: 2.2rem;
      animation: float-up-fade ease-out forwards;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
    }

    @keyframes float-up-fade {
      0% {
        transform: translateY(0) scale(0.6);
        opacity: 0;
      }
      15% {
        transform: translateY(-20px) scale(1.3);
        opacity: 1;
      }
      80% {
        opacity: 0.9;
      }
      100% {
        transform: translateY(-260px) scale(1);
        opacity: 0;
      }
    }

    .reaction-bar {
      position: absolute;
      bottom: 42px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 15;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .reaction-btn {
      font-size: 1.25rem !important;
      transition: transform 0.15s ease;
    }

    .reaction-btn:hover {
      transform: scale(1.3);
    }

    .reaction-btn:active {
      transform: scale(0.9);
    }

    .header-logo-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }

    .pages-wrapper .page.hidden {
      display: none !important;
    }

    .pages-wrapper .page.active {
      display: block !important;
    }

    /* Responsive adjustments */
    @media (max-width: 600px) {
      .hide-on-mobile {
        display: none !important;
      }
      .show-on-mobile {
        display: flex !important;
      }
    }

    @media (min-width: 601px) {
      .show-on-mobile {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <!-- Preact & Application Entry -->
  <script type="module">
    import { h, render } from 'https://esm.sh/preact';
    import { App } from './components/App.js';

    render(h(App, null), document.getElementById('app'));

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('ServiceWorker registration failed: ', err);
        });
      });
    }
  </script>
</body>
</html>

```

---

## Arquivo: `example/public/manifest.json`

```json
{
  "name": "WsRouter Showcase",
  "short_name": "WsRouter",
  "description": "Unified WsRouter example featuring WebRTC, Presence and JWT.",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png",
      "sizes": "48x48",
      "type": "image/png"
    },
    {
      "src": "https://www.gstatic.com/images/branding/product/2x/googleg_96dp.png",
      "sizes": "96x96",
      "type": "image/png"
    }
  ]
}

```

---

## Arquivo: `example/public/sw.js`

```js
// example/public/sw.js
const CACHE_NAME = 'wsrouter-v0.4.0';
const ASSETS = [
  './',
  './index.html',
  './components/App.js',
  './components/Header.js',
  './components/EntryGate.js',
  './components/WebRTCExample.js',
  './components/PresenceExample.js',
  './components/JwtExample.js',
  './components/ApiInspectorExample.js',
  './components/ServerSettingsModal.js',
  './components/config.js',
  './components/version.js',
  './components/StreamView.js',
  './components/ChatPanel.js',
  './components/OnlineUsers.js',
  './components/StreamStats.js',
  './components/ReactionOverlay.js',
  'https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.css',
  'https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.js',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;

  // Skip Service Worker for cross-origin API calls or external resources (except CDNs)
  if (!isLocal) {
    const isCdn = url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('gstatic.com');
    if (!isCdn) return;
  }

  // Skip caching for local API requests too
  if (isLocal && url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Only cache local assets or specific trusted CDNs
        const isCdn = url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('gstatic.com');

        if (response.status === 200 && (isLocal || isCdn)) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      });
    })
  );
});

```

---

