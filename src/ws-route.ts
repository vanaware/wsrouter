// src/ws-route.ts
/**
 * @file ws-route.ts
 * @description Encapsulates a WebSocket route with path matching, dedicated WebSocketGroup, and metadata.
 */

import { DEFAULT_LAST_BROADCAST_DELAY, type PermissionFn, type RouteParams, type WsHandler } from "./types.ts";
import { WebSocketGroup } from "./websocket-group.ts";

/**
 * Options for configuring a WsRoute.
 */
export interface WsRouteOptions {
  /** Arbitrary static metadata associated with this WebSocket endpoint. */
  meta?: Record<string, unknown>;
  /** Debounce or replay delay in milliseconds for the last broadcast. */
  lastBroadcastDelay?: number;
  /** Custom or shared WebSocketGroup instance. */
  group?: WebSocketGroup;
}

/**
 * WsRoute represents a registered WebSocket route pattern paired with its
 * handler, dedicated connection group, broadcast utilities, and metadata.
 */
export class WsRoute {
  /** Normalized path pattern string (e.g. "/chat/:room"). */
  readonly path: string;
  /** Compiled URLPattern for matching incoming upgrade requests. */
  readonly pattern: URLPattern;
  /** The connection handler callback. */
  readonly handler: WsHandler;
  /** The WebSocketGroup managing active connections for this route. */
  readonly group: WebSocketGroup;
  /** Static metadata attached to this WebSocket route. */
  readonly meta: Record<string, unknown>;

  /**
   * Creates a new WsRoute instance.
   *
   * @param path The URL path pattern (e.g. "/ws/:topic").
   * @param handler The WebSocket handler invoked upon successful connection upgrade.
   * @param lastBroadcastDelayOrOptions Delay in ms or full WsRouteOptions configuration object.
   */
  constructor(
    path: string,
    handler: WsHandler,
    lastBroadcastDelayOrOptions?: number | WsRouteOptions,
  ) {
    this.path = path.startsWith("/") ? path : "/" + path;
    this.pattern = new URLPattern({ pathname: this.path });
    this.handler = handler;
    const opts: WsRouteOptions = typeof lastBroadcastDelayOrOptions === "number"
      ? { lastBroadcastDelay: lastBroadcastDelayOrOptions }
      : (lastBroadcastDelayOrOptions ?? {});
    this.meta = opts.meta ?? {};
    this.group = opts.group ??
      new WebSocketGroup(opts.lastBroadcastDelay ?? DEFAULT_LAST_BROADCAST_DELAY);
  }

  /**
   * Tests whether an incoming URL matches this route's URLPattern.
   *
   * @param url The target URL to test.
   * @returns URLPatternResult containing matched parameter groups, or `null` if no match.
   */
  match(url: URL | string): URLPatternResult | null {
    return this.pattern.exec(url);
  }

  /**
   * Broadcasts a message to all active sockets connected to this route's group.
   *
   * @param message The serialized payload to deliver.
   * @param permissionFn Optional filter callback evaluating delivery permission per socket.
   * @param senderParams Optional metadata identifying the sender socket.
   */
  broadcast(
    message: string,
    permissionFn?: PermissionFn,
    senderParams?: RouteParams,
  ): void {
    this.group.broadcast(message, permissionFn, senderParams);
  }

  /**
   * Closes all active WebSocket connections in this route's group.
   */
  close(): void {
    this.group.closeGroup();
  }

  /**
   * Returns the count of active WebSocket connections currently open in this route's group.
   */
  get activeConnections(): number {
    return this.group.size;
  }
}
