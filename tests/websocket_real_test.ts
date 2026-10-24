import { assertEquals, assertExists, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";
import type { Router, } from "../src/deno.ts";

function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20,
): Promise<boolean> {
  return new Promise((resolve,) => {
    const start = Date.now();
    const check = () => {
      if (condition()) return resolve(true,);
      if (Date.now() - start > timeoutMs) return resolve(false,);
      setTimeout(check, intervalMs,);
    };
    check();
  },);
}

async function startServer(
  app: Router,
): Promise<{ server: Deno.HttpServer; port: number }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {}, },
    app.handleRequest.bind(app,),
  );
  const addr = server.addr;
  return { server, port: addr.port, };
}

Deno.test("Real WebSocket: connection, broadcast and last broadcast for a new member", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  const receivedByUser1: string[] = [];
  const receivedByUser2: string[] = [];
  app.ws("/chat/:room/:user", (ws, _req, params,) => {
    const room = params.room as string;
    const user = params.user as string;
    const group = app.getWsGroupByPath("/chat/:room/:user",);
    if (!group) {
      ws.close(1011, "No group",);
      return;
    }
    ws.onmessage = (event,) => {
      // ✅ CORRECT: use dual params
      group.broadcast(
        `[${user}]: ${event.data}`,
        (receiver, sender, _msg,) => receiver.room === sender.room, // ← NEW
        params,
      );
    };
  },);
  const { server, port, } = await startServer(app,);
  try {
    const ws1 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user1`,);
    await waitFor(() => ws1.readyState === WebSocket.OPEN);
    assertEquals(ws1.readyState, WebSocket.OPEN, "user1 should connect",);
    ws1.onmessage = (e,) => receivedByUser1.push(e.data,);

    const ws2 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user2`,);
    await waitFor(() => ws2.readyState === WebSocket.OPEN);
    assertEquals(ws2.readyState, WebSocket.OPEN, "user2 should connect",);
    ws2.onmessage = (e,) => receivedByUser2.push(e.data,);

    await new Promise((r,) => setTimeout(r, 100,));
    ws1.send("hello from user1",);
    await waitFor(() => receivedByUser2.length >= 1);
    assertEquals(receivedByUser2[0], "[user1]: hello from user1",);
    assertEquals(receivedByUser1[0], "[user1]: hello from user1",);

    const receivedByUser3: string[] = [];
    const ws3 = new WebSocket(`ws://localhost:${port}/api/chat/roomA/user3`,);
    ws3.onmessage = (e,) => receivedByUser3.push(e.data,);
    await waitFor(() => ws3.readyState === WebSocket.OPEN);
    const got = await waitFor(() => receivedByUser3.length >= 1, 2000,);
    assertEquals(
      got,
      true,
      "user3 should receive the last broadcast when connecting",
    );
    assertEquals(receivedByUser3[0], "[user1]: hello from user1",);

    const receivedByUser4: string[] = [];
    const ws4 = new WebSocket(`ws://localhost:${port}/api/chat/roomB/user4`,);
    ws4.onmessage = (e,) => receivedByUser4.push(e.data,);
    await waitFor(() => ws4.readyState === WebSocket.OPEN);
    await new Promise((r,) => setTimeout(r, 200,));
    assertEquals(
      receivedByUser4.length,
      0,
      "user4 in roomB should not receive the broadcast from roomA",
    );

    ws1.close();
    ws2.close();
    ws3.close();
    ws4.close();
    await new Promise((r,) => setTimeout(r, 100,));
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});

Deno.test("Real WebSocket: nonexistent route returns 404", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.ws("/exists", () => {},);
  const { server, port, } = await startServer(app,);
  try {
    const ws = new WebSocket(`ws://localhost:${port}/api/nope`,);
    const errored = await waitFor(
      () => ws.readyState === WebSocket.CLOSED,
      2000,
    );
    assertEquals(
      errored,
      true,
      "WebSocket should close when trying a nonexistent route",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("Real WebSocket: closeGroup closes all sockets in the group", async () => {
  const app = createDenoRouter({ basePath: "/api", },);
  app.ws("/chat/:room/:user", () => {},);
  const { server, port, } = await startServer(app,);
  try {
    const ws1 = new WebSocket(`ws://localhost:${port}/api/chat/room1/user1`,);
    const ws2 = new WebSocket(`ws://localhost:${port}/api/chat/room1/user2`,);
    await waitFor(() =>
      ws1.readyState === WebSocket.OPEN && ws2.readyState === WebSocket.OPEN
    );
    const closed = app.closeGroupByPath("/chat/:room/:user",);
    assertEquals(closed, true,);
    await waitFor(() =>
      ws1.readyState === WebSocket.CLOSED && ws2.readyState === WebSocket.CLOSED
    );
    assertEquals(ws1.readyState, WebSocket.CLOSED,);
    assertEquals(ws2.readyState, WebSocket.CLOSED,);
  } finally {
    app.closeAllWebSockets();
    await server.shutdown();
  }
});
