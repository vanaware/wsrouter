# 📡 Documentation: Smart Permissioning in WebSockets (Dual Params)

`@vanaware/wsrouter` has a native and robust permissioning system for WebSockets, allowing broadcast messages to be filtered dynamically based on the **receiver parameters**, the **sender parameters**, and the **message content**.

---

## 🔑 Fundamental Concepts

### 1. `PermissionFn` (Dual Permission Function)
It is an optional callback passed to the `group.broadcast()` method. Its signature receives three arguments:

```typescript
type PermissionFn = (
  receiverParams: RouteParams, // Parameters of who WILL RECEIVE the message
  senderParams: RouteParams,   // Parameters of who SENT the message
  message: string              // The message content
) => boolean;
```

---

## 🌍 Practical Real-World Examples

### Scenario 1: Chat Room Isolation (The Classic)
**Goal:** Ensure a message sent in the "general" room does not leak into the "vip" room.

```typescript
app.ws("/chat/:room/:user", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/chat/:room/:user");

  ws.onmessage = (event) => {
    group.broadcast(
      `[${params.user}]: ${event.data}`,
      // Filter: the receiver must be in the same room as the sender
      (receiver, sender, _msg) => receiver.room === sender.room,
      params // We pass the sender's params
    );
  };
});
```

### Scenario 2: Access Control by User Level (RBAC)
**Goal:** Only users with the `admin` role may send critical system alerts.

```typescript
app.ws("/dashboard/:role/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/dashboard/:role/:userId");

  ws.onmessage = (event) => {
    group.broadcast(
      `🚨 ALERT: ${event.data}`,
      (_receiver, sender, _msg) => {
        // Only allow the broadcast if the SENDER is admin
        return sender.role === "admin";
      },
      params
    );
  };
});
```

### Scenario 3: Filtering Based on Message Content
**Goal:** Prevent messages containing the word "spam" from being propagated.

```typescript
app.ws("/community/:serverId/:userId", (ws, _req, params) => {
  const group = app.getWsGroupByPath("/community/:serverId/:userId");

  ws.onmessage = (event) => {
    group.broadcast(
      event.data,
      (_receiver, _sender, msgContent) => {
        // Block if the message contains "spam"
        return !msgContent.toLowerCase().includes("spam");
      },
      params
    );
  };
});
```

---

## 💡 The "Magic" of Last Broadcast with Dual Params

When a new member joins the room, the router re-evaluates the `lastBroadcast` using the **Dual Params**.

```typescript
// 10:00:00 -> User A (room: "lobby") sends: "Hello everyone!"
// The router stores: { message: "Hello...", permissionFn: (r, s) => r.room === s.room, senderParams: { room: "lobby" } }

// 10:00:05 -> User B connects on route /chat/lobby/userB
// The router re-evaluates: permissionFn({ room: "lobby" }, { room: "lobby" }, "Hello...") -> TRUE
// User B automatically receives the historical message!

// 10:00:10 -> User C connects on route /chat/vip/userC
// The router re-evaluates: permissionFn({ room: "vip" }, { room: "lobby" }, "Hello...") -> FALSE
// User C does NOT receive the message (Security guaranteed!).
```

## ⚠️ Best Practices

1. **Keep the `PermissionFn` Lightweight:** Avoid asynchronous operations (such as database queries) inside the `PermissionFn`.
2. **Use `senderParams` Correctly:** Always pass the third argument `params` in `group.broadcast(msg, fn, params)`. Without it, `senderParams` will be an empty object `{}` and the "Last Broadcast" feature will not work correctly.
