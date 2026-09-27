// src/webrtc.ts
/**
 * @file webrtc.ts
 * @description WebRTC Signaling Engine and Peer Connection Coordination for WsRouter.
 * Facilitates peer-to-peer video/audio streaming, broadcaster announcements,
 * targeted SDP offer/answer exchanges, ICE candidate forwarding, and room management.
 */

import type { RouteParams } from "./types.ts";
import type { WebSocketGroup } from "./websocket-group.ts";

/**
 * Standard ICE candidate format compatible with browser RTCIceCandidateInit.
 */
export interface SerializedIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/**
 * Standard SDP format compatible with browser RTCSessionDescriptionInit.
 */
export interface SerializedSessionDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

/**
 * WebRTC signaling protocol message definitions.
 */
export type WebRTCSignalingMessage =
  | {
    type: "webrtc_offer";
    from: string;
    to: string;
    sdp: SerializedSessionDescription;
    fromName?: string;
  }
  | {
    type: "webrtc_answer";
    from: string;
    to: string;
    sdp: SerializedSessionDescription;
    fromName?: string;
  }
  | {
    type: "webrtc_candidate";
    from: string;
    to: string;
    candidate: SerializedIceCandidate;
  }
  | {
    type: "broadcaster_started";
    broadcasterId: string;
    broadcasterName: string;
    streamTitle?: string;
    room?: string;
  }
  | {
    type: "broadcaster_stopped";
    broadcasterId: string;
    room?: string;
  }
  | {
    type: "request_stream";
    viewerId: string;
    viewerName: string;
    broadcasterId?: string;
    room?: string;
  }
  | {
    type: "stream_reaction";
    from: string;
    fromName: string;
    emoji: string;
    timestamp: number;
    room?: string;
  };

/**
 * Broadcaster stream state tracked by the signaling hub.
 */
export interface ActiveStreamInfo {
  broadcasterId: string;
  broadcasterName: string;
  streamTitle?: string;
  room: string;
  startedAt: number;
}

/**
 * Event map for WebRTC signaling hub lifecycle events.
 */
export interface WebRTCSignalingEvents {
  "stream_start": (stream: ActiveStreamInfo) => void;
  "stream_stop": (broadcasterId: string, room: string) => void;
  "peer_register": (peerId: string, ws: WebSocket) => void;
  "peer_unregister": (peerId: string, ws: WebSocket) => void;
  "reaction": (reaction: { from: string; fromName: string; emoji: string; room: string }) => void;
}

/**
 * Options for configuring a WebRTCSignalingHub instance.
 */
export interface WebRTCSignalingHubOptions {
  /**
   * Serializer function for WebRTC messages.
   * @default JSON.stringify
   */
  serialize?: (msg: WebRTCSignalingMessage) => string;
}

/**
 * Coordinates WebRTC signaling, broadcaster discovery, and peer-to-peer message routing.
 */
export class WebRTCSignalingHub {
  private group?: WebSocketGroup;
  private socketToPeerId = new Map<WebSocket, string>();
  private peerIdToSocket = new Map<string, WebSocket>();
  private activeStreams = new Map<string, ActiveStreamInfo>(); // room -> ActiveStreamInfo
  private broadcasterRooms = new Map<string, string>(); // broadcasterId -> room
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private serialize: (msg: WebRTCSignalingMessage) => string;

  constructor(group?: WebSocketGroup, options?: WebRTCSignalingHubOptions) {
    this.group = group;
    this.serialize = options?.serialize ?? ((msg) => JSON.stringify(msg));
  }

  /**
   * Binds this signaling hub to a WebSocketGroup.
   */
  bindGroup(group: WebSocketGroup): this {
    this.group = group;
    return this;
  }

  /**
   * Attaches an event listener for WebRTC signaling lifecycle events.
   */
  on<K extends keyof WebRTCSignalingEvents>(event: K, listener: WebRTCSignalingEvents[K]): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: any[]) => void);
    return this;
  }

  /**
   * Removes an event listener.
   */
  off<K extends keyof WebRTCSignalingEvents>(event: K, listener: WebRTCSignalingEvents[K]): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as (...args: any[]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  /**
   * Emits an event to registered listeners.
   */
  emit<K extends keyof WebRTCSignalingEvents>(event: K, ...args: Parameters<WebRTCSignalingEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`Error in WebRTCSignalingHub ${event} listener:`, err);
        }
      }
    }
  }

  /**
   * Registers a peer connection socket with an identity peerId.
   */
  registerPeer(ws: WebSocket, peerId: string): void {
    const prevPeerId = this.socketToPeerId.get(ws);
    if (prevPeerId && prevPeerId !== peerId) {
      this.unregisterPeer(ws);
    }
    this.socketToPeerId.set(ws, peerId);
    this.peerIdToSocket.set(peerId, ws);
    this.emit("peer_register", peerId, ws);
  }

  /**
   * Unregisters a peer socket. If the peer was an active broadcaster, ends their stream.
   */
  unregisterPeer(ws: WebSocket): void {
    const peerId = this.socketToPeerId.get(ws);
    if (!peerId) return;

    this.socketToPeerId.delete(ws);
    this.peerIdToSocket.delete(peerId);
    this.emit("peer_unregister", peerId, ws);

    const room = this.broadcasterRooms.get(peerId);
    if (room) {
      this.stopBroadcasting(peerId, room);
    }
  }

  /**
   * Retrieves the peer ID associated with a WebSocket.
   */
  getPeerId(ws: WebSocket): string | undefined {
    return this.socketToPeerId.get(ws);
  }

  /**
   * Retrieves the WebSocket instance for a registered peer ID.
   */
  getPeerSocket(peerId: string): WebSocket | undefined {
    return this.peerIdToSocket.get(peerId);
  }

  /**
   * Returns a list of all currently registered peer IDs.
   */
  getPeers(): string[] {
    return Array.from(this.peerIdToSocket.keys());
  }

  /**
   * Returns the count of registered peers.
   */
  get peerCount(): number {
    return this.peerIdToSocket.size;
  }

  /**
   * Sends a signaling message directly to a specific registered peer.
   */
  sendToPeer(peerId: string, message: WebRTCSignalingMessage | string): boolean {
    const ws = this.peerIdToSocket.get(peerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = typeof message === "string" ? message : this.serialize(message);
      ws.send(payload);
      return true;
    }
    return false;
  }

  /**
   * Registers a user as the active webcam broadcaster for a room and broadcasts the start event.
   */
  startBroadcasting(
    broadcasterId: string,
    broadcasterName: string,
    room: string,
    streamTitle?: string,
    params?: RouteParams,
  ): ActiveStreamInfo {
    const streamInfo: ActiveStreamInfo = {
      broadcasterId,
      broadcasterName,
      streamTitle,
      room,
      startedAt: Date.now(),
    };

    this.activeStreams.set(room, streamInfo);
    this.broadcasterRooms.set(broadcasterId, room);
    this.emit("stream_start", streamInfo);

    const msg: WebRTCSignalingMessage = {
      type: "broadcaster_started",
      broadcasterId,
      broadcasterName,
      streamTitle,
      room,
    };

    if (this.group) {
      this.group.broadcast(
        this.serialize(msg),
        (recvParams, sendParams) => {
          return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
        },
        params,
      );
    }

    return streamInfo;
  }

  /**
   * Terminates a broadcast in a room and notifies peers.
   */
  stopBroadcasting(broadcasterId: string, room: string, params?: RouteParams): boolean {
    const current = this.activeStreams.get(room);
    if (current && current.broadcasterId === broadcasterId) {
      this.activeStreams.delete(room);
      this.broadcasterRooms.delete(broadcasterId);
      this.emit("stream_stop", broadcasterId, room);

      const msg: WebRTCSignalingMessage = {
        type: "broadcaster_stopped",
        broadcasterId,
        room,
      };

      if (this.group) {
        this.group.broadcast(
          this.serialize(msg),
          (recvParams, sendParams) => {
            return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
          },
          params,
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Returns active stream information for a specific room.
   */
  getActiveStream(room: string): ActiveStreamInfo | undefined {
    return this.activeStreams.get(room);
  }

  /**
   * Alias for getActiveStream.
   */
  getBroadcaster(room: string): ActiveStreamInfo | undefined {
    return this.getActiveStream(room);
  }

  /**
   * Returns whether a stream is currently active in a specific room.
   */
  isBroadcasting(room: string): boolean {
    return this.activeStreams.has(room);
  }

  /**
   * Returns a snapshot array of all currently active streams across all rooms.
   */
  getAllActiveStreams(): ActiveStreamInfo[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Broadcasts a floating reaction to a room.
   */
  sendReaction(
    room: string,
    reaction: { from: string; fromName: string; emoji: string; timestamp?: number },
    params?: RouteParams,
  ): boolean {
    const payload: WebRTCSignalingMessage = {
      type: "stream_reaction",
      from: reaction.from,
      fromName: reaction.fromName,
      emoji: reaction.emoji,
      timestamp: reaction.timestamp ?? Date.now(),
      room,
    };

    this.emit("reaction", {
      from: reaction.from,
      fromName: reaction.fromName,
      emoji: reaction.emoji,
      room,
    });

    if (this.group) {
      this.group.broadcast(
        this.serialize(payload),
        (recvParams, sendParams) => {
          return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
        },
        params,
      );
      return true;
    }
    return false;
  }

  /**
   * Handles an incoming signaling message string from a WebSocket client.
   *
   * @param ws The sending WebSocket client.
   * @param rawData The raw message string or object.
   * @param params Route parameters associated with the connection.
   */
  handleMessage(ws: WebSocket, rawData: string | Record<string, unknown>, params?: RouteParams): boolean {
    let msg: WebRTCSignalingMessage;
    try {
      msg = typeof rawData === "string" ? JSON.parse(rawData) : rawData as WebRTCSignalingMessage;
    } catch {
      return false;
    }

    const msgRoom = "room" in msg && typeof msg.room === "string" ? msg.room : undefined;
    const room = (params?.room as string) || msgRoom || "general";

    switch (msg.type) {
      case "webrtc_offer":
      case "webrtc_answer":
      case "webrtc_candidate": {
        // Direct peer-to-peer routed message
        const targetSocket = this.peerIdToSocket.get(msg.to);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(this.serialize(msg));
          return true;
        }
        return false;
      }

      case "broadcaster_started": {
        this.registerPeer(ws, msg.broadcasterId);
        this.startBroadcasting(msg.broadcasterId, msg.broadcasterName, room, msg.streamTitle, params);
        return true;
      }

      case "broadcaster_stopped": {
        this.stopBroadcasting(msg.broadcasterId, room, params);
        return true;
      }

      case "request_stream": {
        this.registerPeer(ws, msg.viewerId);
        const activeStream = this.activeStreams.get(room);
        const targetBroadcasterId = msg.broadcasterId || activeStream?.broadcasterId;

        if (targetBroadcasterId) {
          const broadcasterSocket = this.peerIdToSocket.get(targetBroadcasterId);
          if (broadcasterSocket && broadcasterSocket.readyState === WebSocket.OPEN) {
            broadcasterSocket.send(this.serialize({
              type: "request_stream",
              viewerId: msg.viewerId,
              viewerName: msg.viewerName,
              broadcasterId: targetBroadcasterId,
              room,
            }));
            return true;
          }
        }
        return false;
      }

      case "stream_reaction": {
        if (this.group) {
          this.group.broadcast(
            this.serialize({ ...msg, room }),
            (recvParams, sendParams) => {
              return !recvParams.room || recvParams.room === room || recvParams.room === sendParams.room;
            },
            params,
          );
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Resets all signaling and stream state.
   */
  clear(): void {
    this.socketToPeerId.clear();
    this.peerIdToSocket.clear();
    this.activeStreams.clear();
    this.broadcasterRooms.clear();
  }
}
