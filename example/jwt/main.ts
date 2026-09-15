// monorepo/router/example/jwt/main.ts
import { createDenoRouter } from "../../src/deno.ts";
import { SignJWT, jwtVerify } from "jose";

// ⚠️ Apenas para exemplo. Em produção use variável de ambiente.
const JWT_SECRET = "meu-segredo-super-secreto-123";
const encoder = new TextEncoder();

const app = createDenoRouter({
  basePath: "/api",
  staticDir: "./example/jwt/public", // 🚀 CORRETO
});

// 🚀 NOVA ROTA: Login
app.post("/login", async (req) => {
  try {
    const { username, password } = await req.json();
    
    // Validação simples (em produção, use banco de dados)
    if (username === "admin" && password === "123") {
      const token = await new SignJWT({ userId: "1", username: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(encoder.encode(JWT_SECRET));
      
      return {
        body: JSON.stringify({ token }),
        init: { headers: { "Content-Type": "application/json" } },
      };
    } else {
      return {
        body: JSON.stringify({ error: "Credenciais inválidas" }),
        init: { status: 401, headers: { "Content-Type": "application/json" } },
      };
    }
  } catch {
    return {
      body: JSON.stringify({ error: "Request inválido" }),
      init: { status: 400, headers: { "Content-Type": "application/json" } },
    };
  }
});

app.use(async (req, _params, next) => {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return await next();
  }
  const protocol = req.headers.get("sec-websocket-protocol") ?? "";
  const protocols = protocol.split(",").map((p) => p.trim());
  const bearerIndex = protocols.findIndex((p) => p === "Bearer");
  const token = bearerIndex !== -1 ? protocols[bearerIndex + 1] : null;
  if (!token) {
    console.error("[Middleware] ❌ Token ausente");
    return new Response("Token required", { status: 401 });
  }
  try {
    await jwtVerify(token, encoder.encode(JWT_SECRET), { algorithms: ["HS256"] });
    console.log("[Middleware] ✅ Token válido, permitindo upgrade");
    return await next();
  } catch {
    console.error("[Middleware] ❌ Token inválido");
    return new Response("Invalid token", { status: 403 });
  }
});

app.ws("/chat/:room", (ws, _req, params) => {
  const room = params.room as string;
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;
  ws.onmessage = (event) => {
    group.broadcast(
      `[room ${room}]: ${event.data}`,
      (receiver, sender, _msg) => receiver.room === sender.room,
      params,
    );
  };
});

Deno.serve({ port: 8000 }, app.handleRequest.bind(app));
console.log("🚀 Servidor JWT rodando em http://localhost:8000");
console.log("🔐 Login: POST http://localhost:8000/api/login");
console.log("🔌 WS: ws://localhost:8000/api/chat/:room");