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

  /**
   * Creates a new WebSocketGroup instance.
   * @param lastBroadcastDelay Optional delay in ms before sending the cached broadcast to a new connection.
   */
  constructor(lastBroadcastDelay: number = DEFAULT_LAST_BROADCAST_DELAY) {
    this.lastBroadcastDelay = lastBroadcastDelay;
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
  }
}
