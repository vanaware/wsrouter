// src/websocket-group.ts
/**
 * @file websocket-group.ts
 * @description Manages groups of connected WebSocket clients, event subscriptions, and broadcasts.
 */

import {
  DEFAULT_LAST_BROADCAST_DELAY,
  type PermissionFn,
  type RouteParams,
} from "./types.ts";
import {
  PresenceTracker,
  type PresenceTrackerOptions,
  type PresenceUser,
} from "./presence.ts";
import {
  type ActiveStreamInfo,
  WebRTCSignalingHub,
  type WebRTCSignalingHubOptions,
} from "./webrtc.ts";

/** Internal record of the most recent broadcast in this group for replay to new subscribers. */
interface LastBroadcast {
  message: string;
  permissionFn?: PermissionFn;
  senderParams: RouteParams;
}

/** Generic callback type for WebSocketGroup event listeners. */
// deno-lint-ignore no-explicit-any
export type WebSocketGroupListener = (...args: any[]) => void;

/**
 * WebSocketGroup manages a pool of active WebSocket connections, parameter mappings,
 * filtered broadcasting, connection lifecycles, and replay of cached last broadcasts.
 */
export class WebSocketGroup {
  private sockets = new Map<WebSocket, RouteParams>();
  private lastBroadcast: LastBroadcast | null = null;
  private lastBroadcastDelay: number;
  private listeners = new Map<string, Set<WebSocketGroupListener>>();
  // deno-lint-ignore no-explicit-any
  private _presence?: PresenceTracker<any>;
  private _signaling?: WebRTCSignalingHub;

  /**
   * Creates a new WebSocketGroup instance.
   * @param lastBroadcastDelay Optional delay in ms before sending the cached broadcast to a new connection.
   */
  constructor(lastBroadcastDelay: number = DEFAULT_LAST_BROADCAST_DELAY) {
    this.lastBroadcastDelay = lastBroadcastDelay;
  }

  /**
   * Accesses or initializes the WebRTCSignalingHub instance bound to this group.
   */
  get signaling(): WebRTCSignalingHub {
    if (!this._signaling) {
      this._signaling = new WebRTCSignalingHub(this);
    }
    return this._signaling;
  }

  /**
   * Configures or replaces the WebRTCSignalingHub instance with custom options.
   */
  configureSignaling(options?: WebRTCSignalingHubOptions): WebRTCSignalingHub {
    const hub = new WebRTCSignalingHub(this, options);
    this._signaling = hub;
    return hub;
  }

  /**
   * Routes a WebRTC signaling message through the group's signaling hub.
   */
  handleSignaling(
    ws: WebSocket,
    rawData: string | Record<string, unknown>,
    params?: RouteParams,
  ): boolean {
    const resolvedParams = params ?? this.sockets.get(ws);
    return this.signaling.handleMessage(ws, rawData, resolvedParams);
  }

  /**
   * Registers a peer connection socket with an identity peerId in the WebRTC signaling hub.
   */
  registerPeer(ws: WebSocket, peerId: string): void {
    this.signaling.registerPeer(ws, peerId);
  }

  /**
   * Unregisters a peer socket from the WebRTC signaling hub.
   */
  unregisterPeer(ws: WebSocket): void {
    if (this._signaling) {
      this._signaling.unregisterPeer(ws);
    }
  }

  /**
   * Starts a webcam/screen broadcast in a room and notifies connected peers.
   */
  startBroadcasting(
    broadcasterId: string,
    broadcasterName: string,
    room: string,
    streamTitle?: string,
    params?: RouteParams,
  ): ActiveStreamInfo {
    return this.signaling.startBroadcasting(
      broadcasterId,
      broadcasterName,
      room,
      streamTitle,
      params,
    );
  }

  /**
   * Stops an active broadcast in a room and notifies peers.
   */
  stopBroadcasting(
    broadcasterId: string,
    room: string,
    params?: RouteParams,
  ): boolean {
    if (!this._signaling) return false;
    return this._signaling.stopBroadcasting(broadcasterId, room, params);
  }

  /**
   * Retrieves active stream information for a specific room.
   */
  getActiveStream(room: string): ActiveStreamInfo | undefined {
    return this._signaling?.getActiveStream(room);
  }

  /**
   * Returns whether a stream is currently active in a specific room.
   */
  isBroadcasting(room: string): boolean {
    return this._signaling?.isBroadcasting(room) ?? false;
  }

  /**
   * Returns a snapshot array of all active streams in this group.
   */
  getAllActiveStreams(): ActiveStreamInfo[] {
    return this._signaling?.getAllActiveStreams() ?? [];
  }

  /**
   * Broadcasts a floating live reaction emoji to a room.
   */
  sendReaction(
    room: string,
    reaction: { from: string; fromName: string; emoji: string; timestamp?: number },
    params?: RouteParams,
  ): boolean {
    return this.signaling.sendReaction(room, reaction, params);
  }

  /**
   * Returns the count of registered WebRTC peers in this group.
   */
  get peerCount(): number {
    return this._signaling?.peerCount ?? 0;
  }

  /**
   * Returns a list of all registered peer IDs in this group.
   */
  getPeers(): string[] {
    return this._signaling?.getPeers() ?? [];
  }

  /**
   * Sends a signaling message directly to a registered peer in this group.
   */
  sendToPeer(peerId: string, message: any): boolean {
    return this._signaling?.sendToPeer(peerId, message) ?? false;
  }

  /**
   * Accesses or initializes the PresenceTracker instance bound to this group.
   */
  // deno-lint-ignore no-explicit-any
  get presence(): PresenceTracker<any> {
    if (!this._presence) {
      this._presence = new PresenceTracker(this);
    }
    return this._presence;
  }

  /**
   * Configures or replaces the PresenceTracker instance with custom options.
   */
  configurePresence<T = Record<string, unknown>>(
    options?: PresenceTrackerOptions<T>,
  ): PresenceTracker<T> {
    const tracker = new PresenceTracker<T>(this, options);
    this._presence = tracker;
    return tracker;
  }

  /**
   * Registers a WebSocket connection under an online user presence identity.
   *
   * @param ws The connected WebSocket instance.
   * @param user Identity object containing `userId` and user metadata.
   */
  track<T = Record<string, unknown>>(
    ws: WebSocket,
    user: { userId: string } & T,
  ): PresenceUser<T> {
    const params = this.sockets.get(ws);
    return (this.presence as PresenceTracker<T>).track(ws, user, params);
  }

  /**
   * Removes a WebSocket connection from presence tracking.
   *
   * @param ws The WebSocket to untrack.
   */
  untrack(ws: WebSocket): boolean {
    if (!this._presence) return false;
    const params = this.sockets.get(ws);
    return this._presence.untrack(ws, params);
  }

  /**
   * Updates metadata for an active presence user.
   *
   * @param wsOrUserId WebSocket instance or user ID string.
   * @param data Partial metadata to merge.
   */
  updatePresence<T = Record<string, unknown>>(
    wsOrUserId: WebSocket | string,
    data: Partial<T>,
    params?: RouteParams,
  ): PresenceUser<T> | undefined {
    return (this.presence as PresenceTracker<T>).update(wsOrUserId, data, params);
  }

  /**
   * Returns a snapshot array of all online users tracked in this group.
   */
  getPresenceList<T = Record<string, unknown>>(): PresenceUser<T>[] {
    return this._presence
      ? (this._presence as PresenceTracker<T>).getUsers()
      : [];
  }

  /**
   * Retrieves an online user record by userId.
   */
  getPresenceUser<T = Record<string, unknown>>(
    userId: string,
  ): PresenceUser<T> | undefined {
    return this._presence
      ? (this._presence as PresenceTracker<T>).getUser(userId)
      : undefined;
  }

  /**
   * Returns the count of unique online users tracked in this group.
   */
  get presenceSize(): number {
    return this._presence?.size ?? 0;
  }

  /**
   * Registers an active WebSocket connection and associates route parameters with it.
   * Emits the "connect" event.
   *
   * @param ws The connected WebSocket instance.
   * @param params Parameter dictionary associated with this client.
   */
  addSocket(ws: WebSocket, params: RouteParams): void {
    this.sockets.set(ws, params);
    this.emit("connect", ws, params);
  }

  /**
   * Deregisters a WebSocket connection from the group.
   * Emits the "disconnect" event if the socket was previously tracked.
   *
   * @param ws The WebSocket instance to remove.
   */
  removeSocket(ws: WebSocket): void {
    const params = this.sockets.get(ws) ?? {};
    const existed = this.sockets.delete(ws);
    if (existed) {
      if (this._signaling) {
        this._signaling.unregisterPeer(ws);
      }
      if (this._presence) {
        this._presence.untrack(ws, params);
      }
      this.emit("disconnect", ws, params);
    }
  }

  /**
   * Returns the count of active WebSocket connections in this group.
   */
  get size(): number {
    return this.sockets.size;
  }

  /**
   * Attaches an event listener for group events ('connect', 'disconnect', 'message', 'broadcast').
   */
  on(
    event: "connect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  on(
    event: "disconnect",
    listener: (ws: WebSocket, params: RouteParams) => void,
  ): this;
  on(
    event: "message",
    listener: (ws: WebSocket, data: unknown, params: RouteParams) => void,
  ): this;
  on(
    event: "broadcast",
    listener: (message: string, senderParams?: RouteParams) => void,
  ): this;
  on(event: string, listener: WebSocketGroupListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /**
   * Removes an event listener from this group.
   */
  off(event: string, listener: WebSocketGroupListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /**
   * Triggers an event and notifies all registered subscribers.
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[WebSocketGroup] Error in "${event}" listener:`, err);
      }
    }
  }

  /**
   * Convenience hook for subscribing to new socket connections.
   */
  onConnect(listener: (ws: WebSocket, params: RouteParams) => void): this {
    return this.on("connect", listener);
  }

  /**
   * Convenience hook for subscribing to socket disconnections.
   */
  onDisconnect(listener: (ws: WebSocket, params: RouteParams) => void): this {
    return this.on("disconnect", listener);
  }

  /**
   * Sends the cached last broadcast payload to a specific socket if permissions pass.
   *
   * @param ws The recipient WebSocket.
   * @param receiverParams Parameters associated with the receiving connection.
   */
  sendLastBroadcastTo(ws: WebSocket, receiverParams: RouteParams): void {
    const broadcast = this.lastBroadcast;
    if (!broadcast) return;
    setTimeout(() => {
      try {
        if (this.sockets.has(ws) && ws.readyState === WebSocket.OPEN) {
          const { message, permissionFn, senderParams } = broadcast;
          if (
            !permissionFn || permissionFn(receiverParams, senderParams, message)
          ) {
            ws.send(message);
          }
        }
      } catch (err) {
        console.error("Last broadcast error:", err);
      }
    }, this.lastBroadcastDelay);
  }

  /**
   * Broadcasts a message to all active sockets in this group.
   * Updates the cached last broadcast and triggers "broadcast" listeners.
   *
   * @param message The payload to send.
   * @param permissionFn Optional filter callback to evaluate per socket.
   * @param senderParams Optional parameters of the broadcast initiator.
   */
  broadcast(
    message: string,
    permissionFn?: PermissionFn,
    senderParams?: RouteParams,
  ): void {
    this.lastBroadcast = {
      message,
      permissionFn,
      senderParams: senderParams ?? {},
    };
    this.emit("broadcast", message, senderParams);
    for (const [socket, receiverParams] of this.sockets.entries()) {
      if (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      ) {
        this.removeSocket(socket);
        continue;
      }
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        if (
          !permissionFn ||
          permissionFn(receiverParams, senderParams ?? {}, message)
        ) {
          socket.send(message);
        }
      } catch (err) {
        console.error("Broadcast error:", err);
      }
    }
  }

  /**
   * Gracefully closes all active WebSocket connections and clears internal pools.
   */
  closeGroup(): void {
    for (const [socket, params] of this.sockets.entries()) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "Group is being closed");
      }
      this.emit("disconnect", socket, params);
    }
    this.sockets.clear();
    this.lastBroadcast = null;
    if (this._presence) {
      this._presence.clear();
    }
    if (this._signaling) {
      this._signaling.clear();
    }
  }
}
