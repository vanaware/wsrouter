# 🎥 WebRTC Live Streaming & Signaling Guide

`@vanaware/wsrouter` includes native, high-performance WebRTC signaling and stream coordination utilities via `WebRTCSignalingHub` and `WebSocketGroup`. This enables zero-dependency peer-to-peer webcam, audio, and screen sharing with real-time viewer tracking and interactive reactions.

---

## 🏗️ Architecture & Signaling Flow

WebRTC establishes direct peer-to-peer media streaming between browsers. The server acts as a low-latency signaling mediator exchanging SDP offers, SDP answers, and ICE candidates.

```text
[ Broadcaster ]                    [ WsRouter Hub ]                    [ Viewer(s) ]
       │                                  │                                  │
       ├─── broadcaster_started ─────────►│─── broadcaster_started ─────────►│
       │                                  │◄── request_stream ───────────────┤
       │◄── request_stream ───────────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_offer (SDP) ──────────►│─── webrtc_offer (SDP) ──────────►│
       │                                  │◄── webrtc_answer (SDP) ──────────┤
       │◄── webrtc_answer (SDP) ──────────┤                                  │
       │                                  │                                  │
       ├─── webrtc_candidate (ICE) ──────►│─── webrtc_candidate (ICE) ──────►│
       │◄── webrtc_candidate (ICE) ───────│◄── webrtc_candidate (ICE) ───────┤
       │                                  │                                  │
       ══════════════════════ Direct P2P Media Stream ════════════════════════►
```

---

## 🚀 Server-Side Setup

### 1. Minimal WebRTC Signaling Endpoint

```typescript
import { createDenoRouter } from "@vanaware/wsrouter/deno";

const app = createDenoRouter({ basePath: "/api" });

app.ws("/webrtc/:room", (ws, _req, params) => {
  const room = (params.room as string) || "general";
  const group = app.getWsGroupByPath("/webrtc/:room");
  if (!group) return;

  ws.onmessage = (event) => {
    // Automatically routes SDP offers, answers, candidates, and stream events
    group.handleSignaling(ws, event.data, params);
  };
});

Deno.serve({ port: 3000 }, app.handleRequest.bind(app));
```

---

## 📡 WebRTC Signaling Protocol Messages

The `WebRTCSignalingHub` handles standard JSON message formats:

### 1. Broadcaster Announcements
- **Start Broadcast**:
  ```json
  {
    "type": "broadcaster_started",
    "broadcasterId": "user-123",
    "broadcasterName": "Alice",
    "streamTitle": "Live Demo"
  }
  ```
- **Stop Broadcast**:
  ```json
  {
    "type": "broadcaster_stopped",
    "broadcasterId": "user-123"
  }
  ```

### 2. Stream Request (Viewer -> Broadcaster)
```json
{
  "type": "request_stream",
  "viewerId": "viewer-456",
  "viewerName": "Bob",
  "broadcasterId": "user-123"
}
```

### 3. SDP Offer & Answer
- **Offer**:
  ```json
  {
    "type": "webrtc_offer",
    "from": "user-123",
    "to": "viewer-456",
    "sdp": { "type": "offer", "sdp": "..." },
    "fromName": "Alice"
  }
  ```
- **Answer**:
  ```json
  {
    "type": "webrtc_answer",
    "from": "viewer-456",
    "to": "user-123",
    "sdp": { "type": "answer", "sdp": "..." },
    "fromName": "Bob"
  }
  ```

### 4. ICE Candidates
```json
{
  "type": "webrtc_candidate",
  "from": "user-123",
  "to": "viewer-456",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### 5. Floating Reactions
```json
{
  "type": "stream_reaction",
  "from": "viewer-456",
  "fromName": "Bob",
  "emoji": "🔥",
  "timestamp": 1726500000000
}
```

---

## 🛠️ Server-Side API Reference

### `WebRTCSignalingHub`
- `hub.registerPeer(ws: WebSocket, peerId: string): void`: Binds a socket to a unique peer ID.
- `hub.unregisterPeer(ws: WebSocket): void`: Removes socket and closes any active broadcast by this peer.
- `hub.handleMessage(ws: WebSocket, rawData: string | object, params?: RouteParams): boolean`: Dispatches signaling messages.
- `hub.startBroadcasting(broadcasterId, name, room, title?, params?): ActiveStreamInfo`: Marks stream active and notifies group.
- `hub.stopBroadcasting(broadcasterId, room, params?): boolean`: Ends stream and notifies group.
- `hub.getActiveStream(room: string): ActiveStreamInfo | undefined`: Gets current broadcaster info.
- `hub.isBroadcasting(room: string): boolean`: Checks if a stream is live in a room.
- `hub.getAllActiveStreams(): ActiveStreamInfo[]`: Returns all active streams across rooms.
- `hub.sendToPeer(peerId: string, message: WebRTCSignalingMessage | string): boolean`: Delivers a message directly to a peer.
- `hub.sendReaction(room, reaction, params?): boolean`: Broadcasts a live reaction emoji.
- `hub.getPeers(): string[]` & `hub.peerCount: number`: Peer roster and total count.
- `hub.on(event, listener)` & `hub.off(event, listener)`: Lifecycle events (`stream_start`, `stream_stop`, `peer_register`, `peer_unregister`, `reaction`).

### `WebSocketGroup` WebRTC Methods
- `group.signaling`: The `WebRTCSignalingHub` bound to this group.
- `group.handleSignaling(ws, rawData, params)`
- `group.registerPeer(ws, peerId)`
- `group.unregisterPeer(ws)`
- `group.startBroadcasting(broadcasterId, name, room, title?, params?)`
- `group.stopBroadcasting(broadcasterId, room, params?)`
- `group.getActiveStream(room)`
- `group.isBroadcasting(room)`
- `group.getAllActiveStreams()`
- `group.sendReaction(room, reaction, params?)`
- `group.sendToPeer(peerId, message)`
- `group.peerCount` & `group.getPeers()`

### `Router` WebRTC Methods
- `router.getSignaling(pathOrPattern)`
- `router.getActiveStream(pathOrPattern, room)`
- `router.getAllActiveStreams(pathOrPattern)`
- `router.isBroadcasting(pathOrPattern, room)`
- `router.startBroadcasting(pathOrPattern, broadcasterId, name, room, title?, params?)`
- `router.stopBroadcasting(pathOrPattern, broadcasterId, room, params?)`

---

## 💻 Client-Side Implementation Example

### Broadcaster Setup (Webcam / Microphone)

```javascript
const peerConnections = new Map(); // viewerId -> RTCPeerConnection
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
document.getElementById("local-video").srcObject = localStream;

// Connect to WebSocket signaling route
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onopen = () => {
  // Announce live broadcast
  ws.send(JSON.stringify({
    type: "broadcaster_started",
    broadcasterId: myPeerId,
    broadcasterName: "Alice",
    streamTitle: "Deno WebRTC Live Stream",
    room: currentRoom
  }));
};

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "request_stream") {
    // Create new RTCPeerConnection for incoming viewer
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.set(msg.viewerId, pc);

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Send ICE candidates to viewer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.viewerId,
          candidate: e.candidate
        }));
      }
    };

    // Create & send SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({
      type: "webrtc_offer",
      from: myPeerId,
      to: msg.viewerId,
      sdp: offer,
      fromName: "Alice"
    }));
  }

  if (msg.type === "webrtc_answer") {
    const pc = peerConnections.get(msg.from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
  }

  if (msg.type === "webrtc_candidate") {
    const pc = peerConnections.get(msg.from);
    if (pc && msg.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  }
};
```

### Viewer Setup

```javascript
let pc = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const ws = new WebSocket(`wss://${location.host}/api/webrtc/${currentRoom}`);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "broadcaster_started") {
    // Request stream from active broadcaster
    ws.send(JSON.stringify({
      type: "request_stream",
      viewerId: myPeerId,
      viewerName: "Bob",
      broadcasterId: msg.broadcasterId,
      room: currentRoom
    }));
  }

  if (msg.type === "webrtc_offer") {
    pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (e) => {
      document.getElementById("remote-video").srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({
          type: "webrtc_candidate",
          from: myPeerId,
          to: msg.from,
          candidate: e.candidate
        }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({
      type: "webrtc_answer",
      from: myPeerId,
      to: msg.from,
      sdp: answer,
      fromName: "Bob"
    }));
  }

  if (msg.type === "webrtc_candidate" && pc) {
    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
  }
};
```
