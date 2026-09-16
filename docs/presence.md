# 👥 Online Presence Tracking Suite

`@vanaware/wsrouter` includes a built-in `PresenceTracker` engine for tracking online users, status states (e.g. *Online*, *Away*, *Busy*, *In Meeting*), custom metadata, and handling multi-tab connections without duplicate events.

---

## ✨ Features

- **Initial State Snapshots (`presence_state`)**: New WebSocket connections immediately receive a complete roster of online users.
- **Real-Time Diff Broadcasts**: Automatically emits `presence_join`, `presence_leave`, and `presence_update` events to group peers.
- **Multi-Tab Deduplication**: Sockets are grouped by `userId`. When a user opens 3 tabs, an internal `connections` counter increases to 3 without firing extra `presence_join` messages. A `presence_leave` event is only fired when their last tab closes.
- **Dead Connection Pruning**: Automatically detects and prunes disconnected/closed sockets to prevent ghost entries.
- **WebSocketGroup & Router Integration**: Direct helper methods on `WebSocketGroup` and `Router`.

---

## 🚀 Server-Side Setup

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/chat/:room", (ws, req, params) => {
  const room = (params.room as string) || "lobby";
  const group = app.getWsGroupByPath("/chat/:room");
  if (!group) return;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "anonymous";
  const name = url.searchParams.get("name") || "Guest";

  // Automatically registers presence and announces presence_join/presence_state
  group.track(ws, {
    userId,
    name,
    status: "online",
    statusMessage: "Coding with WsRouter",
    room,
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "update_status") {
        // Broadcasts presence_update to everyone in the room
        group.updatePresence(ws, {
          status: data.status,
          statusMessage: data.statusMessage,
        });
      }
    } catch {
      // Handle standard chat messages
    }
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 Presence Events Protocol

Clients receive typed JSON payloads:

### 1. `presence_state` (Snapshot)
Sent exclusively to a newly connected client:
```json
{
  "type": "presence_state",
  "users": [
    {
      "userId": "user-1",
      "name": "Alice",
      "status": "online",
      "joinedAt": 1726500000000,
      "connections": 1
    }
  ]
}
```

### 2. `presence_join` (Broadcast)
Sent to peers when a new user enters:
```json
{
  "type": "presence_join",
  "user": {
    "userId": "user-2",
    "name": "Bob",
    "status": "online",
    "joinedAt": 1726500010000,
    "connections": 1
  }
}
```

### 3. `presence_leave` (Broadcast)
Sent when a user's final connection closes:
```json
{
  "type": "presence_leave",
  "userId": "user-2"
}
```

### 4. `presence_update` (Broadcast)
Sent when user metadata is updated:
```json
{
  "type": "presence_update",
  "user": {
    "userId": "user-1",
    "name": "Alice",
    "status": "busy",
    "statusMessage": "In a call"
  }
}
```

---

## 🛠️ API Reference

### `WebSocketGroup` Presence Methods
- `group.track(ws, user)`: Associates socket with identity and emits snapshot/join diffs.
- `group.untrack(ws)`: Disassociates socket and emits leave diff if no more tabs exist.
- `group.updatePresence(wsOrUserId, partialData)`: Merges new data and emits `presence_update`.
- `group.getPresenceList()`: Snapshot array of all online `PresenceUser` objects.
- `group.getPresenceUser(userId)`: Looks up a specific user record.
- `group.presenceSize`: Count of unique online users.

### `Router` Presence Methods
- `router.getPresence(pathOrPattern)`: Gets online users for a route pattern.
- `router.getPresenceUser(pathOrPattern, userId)`: Looks up a user on a route pattern.
