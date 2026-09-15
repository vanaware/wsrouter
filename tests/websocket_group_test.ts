// monorepo/router/tests/websocket_group_test.ts
import { assertEquals } from "@std/assert";
import { WebSocketGroup, type RouteParams } from "../src/mod.ts";

class MockWebSocket {
  readyState: number = 1;
  sent: string[] = [];
  send(data: string | ArrayBuffer | Blob) {
    if (typeof data === "string") this.sent.push(data);
  }
  close(code?: number, reason?: string) {
    this.readyState = 3;
  }
}

Deno.test("broadcast envia para todos os sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A" });
  group.addSocket(ws2 as unknown as WebSocket, { room: "A" });
  group.broadcast("hello");
  assertEquals(ws1.sent, ["hello"]);
  assertEquals(ws2.sent, ["hello"]);
});

Deno.test("broadcast com permissionFn filtra destinatários", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A" });
  group.addSocket(ws2 as unknown as WebSocket, { room: "B" });
  
  // 🚀 MUDANÇA: Assinatura Dual (receiver, sender, msg)
  group.broadcast("only-A", (receiver, _sender, _msg) => receiver.room === "A");
  
  assertEquals(ws1.sent, ["only-A"]);
  assertEquals(ws2.sent, []);
});

Deno.test("novo membro recebe último broadcast ao entrar", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A" });
  group.broadcast("first-msg", undefined, { room: "A" });

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "A" });
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "A" });

  // 🚀 MUDANÇA: Delay default agora é 0ms, 10ms é mais que suficiente
  await new Promise((resolve) => setTimeout(resolve, 10));
  assertEquals(ws2.sent, ["first-msg"]);
});

Deno.test("novo membro em sala diferente NÃO recebe último broadcast", async () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, { room: "A" });
  
  // 🚀 MUDANÇA: Assinatura Dual
  group.broadcast("first-msg", (receiver, sender, _msg) => receiver.room === sender.room, { room: "A" });

  const ws2 = new MockWebSocket();
  group.addSocket(ws2 as unknown as WebSocket, { room: "B" });
  group.sendLastBroadcastTo(ws2 as unknown as WebSocket, { room: "B" });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assertEquals(ws2.sent, []);
});

Deno.test("closeGroup fecha todos os sockets", () => {
  const group = new WebSocketGroup();
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  group.addSocket(ws1 as unknown as WebSocket, {});
  group.addSocket(ws2 as unknown as WebSocket, {});
  group.closeGroup();
  assertEquals(ws1.readyState, 3);
  assertEquals(ws2.readyState, 3);
  assertEquals(group.size, 0);
});