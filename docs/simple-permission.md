# Simple Example: The `/room` Route Without Parameters

When a route has no dynamic parameters, the `params` object received by the `permissionFn` will be an empty object `{}`. In that case, filtering must be based on the **message content** or on **external state** (such as a banned-user list).

## 📄 File: `monorepo/router/example/room/main.ts`

```typescript
// monorepo/router/example/room/main.ts
import { Router } from "../../src/mod.ts";

const app = new Router({ basePath: "/api" });

// External list of banned users (simulating a database)
const bannedUsers = new Set(["spammer1", "baduser2"]);

// ============================================================
// Simple WebSocket route: /room (no parameters)
// ============================================================
app.ws("/room", (ws, req, _params) => {
  // Extract the user name from a header (since we have no URL params)
  const user = req.headers.get("x-user-name") ?? "anonymous";

  console.log(`[WS] ${user} joined the room`);

  const group = app.getWsGroupByPath("/room");
  if (!group) return;

  ws.onmessage = (event) => {
    const message = event.data;

    // Example 1: Filter by message content
    // Example 2: Filter by banned user (external state)
    group.broadcast(
      `[${user}]: ${message}`,
      (_receiver, _sender, msg) => {
        // clientParams is {} (empty, because the route has no params)
        // msg is the message being sent

        // Rule 1: Block messages containing a forbidden word
        if (msg.toLowerCase().includes("spam")) {
          return false;
        }

        // Rule 2: Block messages from banned users
        // (we extract the user name from the "[user]:" prefix)
        const senderMatch = msg.match(/^\[([^\]]+)\]:/);
        if (senderMatch && bannedUsers.has(senderMatch[1])) {
          return false;
        }

        return true; // Allow all other messages
      },
      {}, // empty senderParams, since we have no params on the route
    );
  };

  ws.onclose = () => console.log(`[WS] ${user} left the room`);
});

// ============================================================
// Server
// ============================================================
const server = Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
console.log("🚀 Server running on http://localhost:3000");
console.log("🔌 WS: ws://localhost:3000/api/room (optional X-User-Name header)");
```

---

## 🔍 How the `permissionFn` Works Without Parameters

Because the `/room` route has no `:param`, the `params` object is always `{}`. So filtering must rely on other information:

| Data Source | How to Access | Example Use |
|-------------|---------------|-------------|
| **Message content** | The `msg` parameter of the `permissionFn` | Block forbidden words |
| **External state** | Variables outside the handler (e.g. `bannedUsers`) | Ban list, roles |
| **Request headers** | Captured in `onopen` and stored | Roles, access levels |

---

## 🧪 Testing

### Simple client (Node.js or browser)

```javascript
// Connect passing the name in a header (via fetch + manual WebSocket)
// In the browser, custom headers are not possible with WebSocket.
// Alternative: pass the name in the query string or first message.

const ws = new WebSocket("ws://localhost:3000/api/room");

ws.onopen = () => {
  // The first message identifies the user
  ws.send("__IDENTIFY__:joao");
};

ws.onmessage = (e) => console.log("Received:", e.data);
```

### Test cases

```bash
# ✅ Normal message → everyone receives it
ws.send("Hello everyone!")
# → [joao]: Hello everyone!

# ❌ Message containing "spam" → nobody receives it
ws.send("This is spam!")
# → (silence)

# ❌ Message from a banned user → nobody receives it
# (if the sender is "spammer1")
# → (silence)
```

---

## 💡 Alternative: Keep State in the Handler

If you need more complex filtering, you can keep information in the handler's closure:

```typescript
app.ws("/room", (ws, req, _params) => {
  // Local per-connection state
  const userRole = req.headers.get("x-role") ?? "visitor";
  const userName = req.headers.get("x-user-name") ?? "anonymous";

  const group = app.getWsGroupByPath("/room");
  if (!group) return;

  ws.onmessage = (event) => {
    group.broadcast(
      `[${userName}]: ${event.data}`,
      (_receiver, _sender, msg) => {
        // Here you can use the `userRole` from the closure
        // to decide whether the message should pass through
        if (userRole === "admin") return true; // Admin always passes
        if (msg.includes("@admin")) return false; // Visitors don't see mentions
        return true;
      },
      {},
    );
  };
});
```

---

## ✅ Summary

For routes **without parameters**:
- `params` will always be `{}`
- Use the `message` parameter of the `permissionFn` to filter by content
- Use external variables (closures, Maps, Sets) for shared state
- The permission logic remains `(receiverParams, senderParams, message) => boolean`
