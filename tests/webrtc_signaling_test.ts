// tests/webrtc_signaling_test.ts
import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  WebRTCSignalingHub,
  type WebRTCSignalingMessage,
  WebSocketGroup,
} from "../src/mod.ts";

function createMockWebSocket(readyState: number = WebSocket.OPEN): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    readyState,
    sent,
    send: (data: string) => {
      sent.push(data);
    },
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as WebSocket & { sent: string[] };
}

describe("WebRTCSignalingHub (Signaling & Peer Coordination)", () => {
  it("registers peers and routes targeted SDP offers and answers directly to the recipient", () => {
    const hub = new WebRTCSignalingHub();
    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();

    hub.registerPeer(aliceWs, "alice");
    hub.registerPeer(bobWs, "bob");

    // Alice sends SDP offer targeted to Bob
    const offerHandled = hub.handleMessage(aliceWs, {
      type: "webrtc_offer",
      from: "alice",
      to: "bob",
      sdp: { type: "offer", sdp: "v=0\r\no=alice 123456 ... m=video..." },
      fromName: "Alice",
    });

    assertEquals(offerHandled, true);
    assertEquals(bobWs.sent.length, 1);
    assertEquals(aliceWs.sent.length, 0); // Alice shouldn't receive her own offer

    const bobReceivedOffer = JSON.parse(bobWs.sent[0]!) as WebRTCSignalingMessage;
    assertEquals(bobReceivedOffer.type, "webrtc_offer");
    if (bobReceivedOffer.type === "webrtc_offer") {
      assertEquals(bobReceivedOffer.from, "alice");
      assertEquals(bobReceivedOffer.sdp.type, "offer");
      assertEquals(bobReceivedOffer.fromName, "Alice");
    }

    // Bob sends SDP answer targeted back to Alice
    const answerHandled = hub.handleMessage(bobWs, {
      type: "webrtc_answer",
      from: "bob",
      to: "alice",
      sdp: { type: "answer", sdp: "v=0\r\no=bob 789101 ... m=video..." },
      fromName: "Bob",
    });

    assertEquals(answerHandled, true);
    assertEquals(aliceWs.sent.length, 1);

    const aliceReceivedAnswer = JSON.parse(aliceWs.sent[0]!) as WebRTCSignalingMessage;
    assertEquals(aliceReceivedAnswer.type, "webrtc_answer");
    if (aliceReceivedAnswer.type === "webrtc_answer") {
      assertEquals(aliceReceivedAnswer.from, "bob");
      assertEquals(aliceReceivedAnswer.sdp.type, "answer");
    }
  });

  it("routes ICE candidates exclusively to the destination peer", () => {
    const hub = new WebRTCSignalingHub();
    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();

    hub.registerPeer(aliceWs, "alice");
    hub.registerPeer(bobWs, "bob");

    const candidateHandled = hub.handleMessage(aliceWs, {
      type: "webrtc_candidate",
      from: "alice",
      to: "bob",
      candidate: {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    });

    assertEquals(candidateHandled, true);
    assertEquals(bobWs.sent.length, 1);
    const receivedCandidate = JSON.parse(bobWs.sent[0]!) as WebRTCSignalingMessage;
    assertEquals(receivedCandidate.type, "webrtc_candidate");
    if (receivedCandidate.type === "webrtc_candidate") {
      assertEquals(receivedCandidate.from, "alice");
      assertEquals(receivedCandidate.candidate.sdpMid, "0");
    }
  });

  it("tracks active broadcasters, broadcasts start/stop events, and handles stream requests", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const broadcasterWs = createMockWebSocket();
    const viewerWs = createMockWebSocket();

    group.addSocket(broadcasterWs, { room: "stage1" });
    group.addSocket(viewerWs, { room: "stage1" });

    // Broadcaster starts streaming
    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_started",
      broadcasterId: "streamer_dan",
      broadcasterName: "Dan",
      streamTitle: "Live Coding Session",
    }, { room: "stage1" });

    const active = hub.getActiveStream("stage1");
    assertNotEquals(active, undefined);
    assertEquals(active?.broadcasterId, "streamer_dan");
    assertEquals(active?.broadcasterName, "Dan");
    assertEquals(active?.streamTitle, "Live Coding Session");

    // Viewer should have received the broadcaster_started notification
    const startNotice = viewerWs.sent.find((m) => m.includes("broadcaster_started"));
    assert(startNotice !== undefined);

    // Viewer sends request_stream to broadcaster
    hub.handleMessage(viewerWs, {
      type: "request_stream",
      viewerId: "viewer_claire",
      viewerName: "Claire",
      broadcasterId: "streamer_dan",
    }, { room: "stage1" });

    // Broadcaster should receive the request_stream message directly
    const requestNotice = broadcasterWs.sent.find((m) => m.includes("request_stream") && m.includes("viewer_claire"));
    assert(requestNotice !== undefined);

    // Broadcaster stops streaming
    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_stopped",
      broadcasterId: "streamer_dan",
    }, { room: "stage1" });

    assertEquals(hub.getActiveStream("stage1"), undefined);
    const stopNotice = viewerWs.sent.find((m) => m.includes("broadcaster_stopped"));
    assert(stopNotice !== undefined);
  });

  it("automatically terminates broadcast when broadcaster socket disconnects", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const broadcasterWs = createMockWebSocket();
    const viewerWs = createMockWebSocket();

    group.addSocket(broadcasterWs, { room: "main" });
    group.addSocket(viewerWs, { room: "main" });

    hub.handleMessage(broadcasterWs, {
      type: "broadcaster_started",
      broadcasterId: "host1",
      broadcasterName: "Host 1",
    }, { room: "main" });

    assertEquals(hub.getActiveStream("main")?.broadcasterId, "host1");

    // Broadcaster disconnects from WebSocketGroup
    group.removeSocket(broadcasterWs);

    // Stream should be automatically removed and stop message broadcasted
    assertEquals(hub.getActiveStream("main"), undefined);
    const stopNotice = viewerWs.sent.find((m) => m.includes("broadcaster_stopped"));
    assert(stopNotice !== undefined);
  });

  it("broadcasts live stream reactions to group members", () => {
    const group = new WebSocketGroup();
    const hub = group.signaling;

    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    group.addSocket(ws1, { room: "live" });
    group.addSocket(ws2, { room: "live" });

    hub.handleMessage(ws1, {
      type: "stream_reaction",
      from: "user1",
      fromName: "User 1",
      emoji: "🔥",
      timestamp: Date.now(),
    }, { room: "live" });

    const reactionReceived = ws2.sent.find((m) => m.includes("stream_reaction") && m.includes("🔥"));
    assert(reactionReceived !== undefined);
  });
});
