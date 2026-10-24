// monorepo/router/tests/websocket_group_test.ts
import { assertEquals, } from "@std/assert";
import { type RouteParams, WebSocketGroup, } from "../src/mod.ts";

class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob,) {
    if (typeof data === "string") this.sent.push(data,);
  }
  close(code?: number, reason?: string,) {
    this.readyState = 3;
  }
}

Deno.test("broadcast sends to all sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.broadcast("hello",);
  assertEquals(ws1.sent, ["hello",],);
  assertEquals(ws2.sent, ["hello",],);
});

Deno.test("broadcast with permissionFn filters recipients", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", },);

  // 🚀 CHANGE: Dual signature (receiver, sender, msg)
  group.broadcast(
    "only-A",
    (receiver, _sender, _msg,) => receiver.room === "A",
  );

  assertEquals(ws1.sent, ["only-A",],);
  assertEquals(ws2.sent, [],);
});

Deno.test("new member receives the last broadcast when joining", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);
  group.broadcast("first-msg", undefined, { room: "A", },);

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A", },);

  // 🚀 CHANGE: The default delay is now 0ms, 10ms is more than enough
  await new Promise((resolve,) => setTimeout(resolve, 10,));
  assertEquals(ws2.sent, ["first-msg",],);
});

Deno.test("new member in a different room does NOT receive the last broadcast", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A", },);

  // 🚀 CHANGE: Dual signature
  group.broadcast(
    "first-msg",
    (receiver, sender, _msg,) => receiver.room === sender.room,
    { room: "A", },
  );

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B", },);
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "B", },);

  await new Promise((resolve,) => setTimeout(resolve, 10,));
  assertEquals(ws2.sent, [],);
});

Deno.test("closeGroup closes all sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, {},);
  group.addSocket(ws2 as unknown as WebSocket, {},);
  group.closeGroup();
  assertEquals(ws1.readyState, 3,);
  assertEquals(ws2.readyState, 3,);
  assertEquals(group.size, 0,);
});
