// src/presence.ts
/**
 * @file presence.ts
 * @description Real-time online presence tracker for WebSocket clients in WsRouter.
 * Tracks user identity, metadata, active tab/device connections, and broadcasts diffs.
 */

import type { RouteParams } from "./types.ts";
import type { WebSocketGroup } from "./websocket-group.ts";

/**
 * Representation of an online user tracked by PresenceTracker.
 */
export interface PresenceUser<T = Record<string, unknown>> {
  /** Unique identifier for the user (e.g., user ID, email, account key). */
  userId: string;
  /** Custom user-defined metadata (e.g. name, avatar, role, custom status). */
  data: T;
  /** Number of concurrent active WebSocket connections (tabs/devices) for this user. */
  connections: number;
  /** Epoch timestamp (ms) when the user first connected. */
  firstSeenAt: number;
  /** Epoch timestamp (ms) of the most recent activity or connection. */
  lastSeenAt: number;
}

/**
 * Protocol events dispatched to WebSocket clients regarding presence state and transitions.
 */
export type PresenceEvent<T = Record<string, unknown>> =
  | {
    type: "presence_state";
    users: PresenceUser<T>[];
  }
  | {
    type: "presence_join";
    user: PresenceUser<T>;
  }
  | {
    type: "presence_leave";
    userId: string;
    lastSeenAt: number;
  }
  | {
    type: "presence_update";
    user: PresenceUser<T>;
  };

/**
 * Configuration options for PresenceTracker.
 */
export interface PresenceTrackerOptions<T = Record<string, unknown>> {
  /**
   * Whether to automatically send the complete `presence_state` snapshot to
   * newly connected sockets when `track()` is invoked.
   * @default true
   */
  sendStateOnTrack?: boolean;
  /**
   * Whether to automatically broadcast `presence_join`, `presence_leave`, and
   * `presence_update` events to sockets in the associated WebSocketGroup.
   * @default true
   */
  autoBroadcast?: boolean;
  /**
   * Optional custom filter to restrict which sockets receive presence diffs.
   * Receives receiver parameters, sender parameters, and the event payload.
   */
  filter?: (
    receiverParams: RouteParams,
    senderParams: RouteParams,
    event: PresenceEvent<T>,
  ) => boolean;
  /**
   * Custom serializer converting PresenceEvent to string format.
   * @default JSON.stringify
   */
  serialize?: (event: PresenceEvent<T>) => string;
}

/** Generic callback for presence events. */
// deno-lint-ignore no-explicit-any
export type PresenceListener = (...args: any[]) => void;

/**
 * Manages online presence for WebSocket clients.
 * Tracks user identity, handles multi-device/multi-tab connections per user ID,
 * and coordinates initial state snapshots and delta diffs (join, leave, update).
 */
export class PresenceTracker<T = Record<string, unknown>> {
  private group?: WebSocketGroup;
  private options: Required<PresenceTrackerOptions<T>>;
  private users = new Map<string, PresenceUser<T>>();
  private userSockets = new Map<string, Set<WebSocket>>();
  private socketToUserId = new Map<WebSocket, string>();
  private listeners = new Map<string, Set<PresenceListener>>();

  /**
   * Creates a new PresenceTracker instance.
   *
   * @param group Optional WebSocketGroup to bind presence broadcasts with.
   * @param options Configuration options.
   */
  constructor(group?: WebSocketGroup, options?: PresenceTrackerOptions<T>) {
    this.group = group;
    this.options = {
      sendStateOnTrack: options?.sendStateOnTrack ?? true,
      autoBroadcast: options?.autoBroadcast ?? true,
      filter: options?.filter ?? (() => true),
      serialize: options?.serialize ?? ((event) => JSON.stringify(event)),
    };
  }

  /**
   * Associates the tracker with a WebSocketGroup if not provided in the constructor.
   */
  bindGroup(group: WebSocketGroup): this {
    this.group = group;
    return this;
  }

  /**
   * Registers a WebSocket connection under a specific user identity.
   * Automatically increments active connection count and broadcasts a join diff if new.
   *
   * @param ws The connected WebSocket instance.
   * @param user Identity object containing `userId` and user metadata.
   * @param params Optional route parameters to associate with this connection.
   */
  track(
    ws: WebSocket,
    user: { userId: string } & T,
    params?: RouteParams,
  ): PresenceUser<T> {
    const { userId, ...metadata } = user;
    const now = Date.now();
    let isNewUser = false;

    // Disassociate previous user if this socket was already tracked under another ID
    const existingUserId = this.socketToUserId.get(ws);
    if (existingUserId && existingUserId !== userId) {
      this.untrack(ws);
    }

    this.socketToUserId.set(ws, userId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    const sockets = this.userSockets.get(userId)!;
    sockets.add(ws);

    let presenceUser = this.users.get(userId);
    if (!presenceUser) {
      isNewUser = true;
      presenceUser = {
        userId,
        data: metadata as unknown as T,
        connections: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      this.users.set(userId, presenceUser);
    } else {
      presenceUser.connections = sockets.size;
      presenceUser.lastSeenAt = now;
      // Merge updated metadata
      presenceUser.data = {
        ...presenceUser.data,
        ...metadata,
      };
    }

    // 1. Send full presence state snapshot to this new socket
    if (this.options.sendStateOnTrack && ws.readyState === WebSocket.OPEN) {
      try {
        const statePayload = this.options.serialize({
          type: "presence_state",
          users: this.getUsers(),
        });
        ws.send(statePayload);
      } catch (err) {
        console.error("[PresenceTracker] Error sending presence snapshot:", err);
      }
    }

    // 2. Broadcast join event to other clients if this is a newly online user
    if (isNewUser) {
      this.emit("join", presenceUser, ws);
      if (this.options.autoBroadcast && this.group) {
        const joinPayload = this.options.serialize({
          type: "presence_join",
          user: presenceUser,
        });
        this.group.broadcast(
          joinPayload,
          (recvParams, sendParams, _msg) => {
            return this.options.filter(recvParams, sendParams, {
              type: "presence_join",
              user: presenceUser!,
            });
          },
          params,
        );
      }
    } else {
      // If user already existed (multi-tab/device), notify listeners of connection count update
      this.emit("connection", presenceUser, ws);
    }

    return presenceUser;
  }

  /**
   * Deregisters a WebSocket from presence tracking.
   * If this was the user's last open connection, removes the user and broadcasts a leave diff.
   *
   * @param ws The WebSocket to remove.
   * @param params Optional route parameters of the departing client.
   * @returns `true` if the socket was tracked, `false` otherwise.
   */
  untrack(ws: WebSocket, params?: RouteParams): boolean {
    const userId = this.socketToUserId.get(ws);
    if (!userId) return false;

    this.socketToUserId.delete(ws);
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(ws);
    }

    const presenceUser = this.users.get(userId);
    if (!presenceUser) {
      if (sockets && sockets.size === 0) {
        this.userSockets.delete(userId);
      }
      return true;
    }

    const remainingSockets = sockets ? sockets.size : 0;
    presenceUser.connections = remainingSockets;
    presenceUser.lastSeenAt = Date.now();

    if (remainingSockets <= 0) {
      this.users.delete(userId);
      this.userSockets.delete(userId);

      this.emit("leave", presenceUser, ws);

      if (this.options.autoBroadcast && this.group) {
        const leavePayload = this.options.serialize({
          type: "presence_leave",
          userId,
          lastSeenAt: presenceUser.lastSeenAt,
        });
        this.group.broadcast(
          leavePayload,
          (recvParams, sendParams, _msg) => {
            return this.options.filter(recvParams, sendParams, {
              type: "presence_leave",
              userId,
              lastSeenAt: presenceUser.lastSeenAt,
            });
          },
          params,
        );
      }
    } else {
      this.emit("disconnection", presenceUser, ws);
    }

    return true;
  }

  /**
   * Updates metadata for an active user and broadcasts the change.
   *
   * @param wsOrUserId WebSocket instance or user ID string.
   * @param partialData Metadata updates to merge.
   * @param params Optional route parameters of the updating client.
   */
  update(
    wsOrUserId: WebSocket | string,
    partialData: Partial<T>,
    params?: RouteParams,
  ): PresenceUser<T> | undefined {
    const userId = typeof wsOrUserId === "string"
      ? wsOrUserId
      : this.socketToUserId.get(wsOrUserId);

    if (!userId) return undefined;
    const presenceUser = this.users.get(userId);
    if (!presenceUser) return undefined;

    const oldData = { ...presenceUser.data };
    presenceUser.data = {
      ...presenceUser.data,
      ...partialData,
    };
    presenceUser.lastSeenAt = Date.now();

    this.emit("update", presenceUser, oldData);

    if (this.options.autoBroadcast && this.group) {
      const updatePayload = this.options.serialize({
        type: "presence_update",
        user: presenceUser,
      });
      this.group.broadcast(
        updatePayload,
        (recvParams, sendParams, _msg) => {
          return this.options.filter(recvParams, sendParams, {
            type: "presence_update",
            user: presenceUser,
          });
        },
        params,
      );
    }

    return presenceUser;
  }

  /**
   * Returns a snapshot array of all currently online users.
   */
  getUsers(): PresenceUser<T>[] {
    this.pruneClosedSockets();
    return Array.from(this.users.values());
  }

  /**
   * Alias for `getUsers()`.
   */
  getPresenceList(): PresenceUser<T>[] {
    return this.getUsers();
  }

  /**
   * Retrieves an online user record by their unique userId.
   */
  getUser(userId: string): PresenceUser<T> | undefined {
    this.pruneClosedSockets();
    return this.users.get(userId);
  }

  /**
   * Retrieves the user record associated with a given WebSocket connection.
   */
  getUserBySocket(ws: WebSocket): PresenceUser<T> | undefined {
    const userId = this.socketToUserId.get(ws);
    return userId ? this.getUser(userId) : undefined;
  }

  /**
   * Returns all active WebSocket instances associated with a given user ID.
   */
  getSockets(userId: string): Set<WebSocket> {
    return this.userSockets.get(userId) ?? new Set();
  }

  /**
   * Checks whether a specific user is currently online.
   */
  has(userId: string): boolean {
    this.pruneClosedSockets();
    return this.users.has(userId);
  }

  /**
   * Returns the count of distinct users currently online.
   */
  get size(): number {
    this.pruneClosedSockets();
    return this.users.size;
  }

  /**
   * Returns the total count of active WebSocket connections across all online users.
   */
  get connectionCount(): number {
    this.pruneClosedSockets();
    return this.socketToUserId.size;
  }

  /**
   * Cleans up closed or broken sockets to ensure no ghost connections linger.
   */
  pruneClosedSockets(): void {
    for (const [ws, userId] of this.socketToUserId.entries()) {
      if (
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING
      ) {
        this.untrack(ws);
      }
    }
  }

  /**
   * Clears all tracked presence data.
   */
  clear(): void {
    this.users.clear();
    this.userSockets.clear();
    this.socketToUserId.clear();
  }

  /**
   * Attaches an event listener for presence events.
   */
  on(
    event: "join",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(
    event: "leave",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(
    event: "update",
    listener: (user: PresenceUser<T>, oldData: T) => void,
  ): this;
  on(
    event: "connection" | "disconnection",
    listener: (user: PresenceUser<T>, ws: WebSocket) => void,
  ): this;
  on(event: string, listener: PresenceListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /**
   * Removes an event listener.
   */
  off(event: string, listener: PresenceListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /**
   * Emits an internal event.
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[PresenceTracker] Error in "${event}" listener:`, err);
      }
    }
  }
}
