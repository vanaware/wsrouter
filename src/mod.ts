// src/mod.ts
/**
 * @file mod.ts
 * @description Root module re-exporting all components, classes, and types of WsRouter.
 */

export * from "./types.ts";
export {
  /** High-performance engine for tracking online users and broadcasting presence diffs. */
  PresenceTracker,
  type PresenceEvent,
  type PresenceListener,
  type PresenceTrackerOptions,
  type PresenceUser,
} from "./presence.ts";
export {
  type ActiveStreamInfo,
  type SerializedIceCandidate,
  type SerializedSessionDescription,
  /** Signaling hub for managing WebRTC peer-to-peer connection coordination. */
  WebRTCSignalingHub,
  type WebRTCSignalingEvents,
  type WebRTCSignalingHubOptions,
  type WebRTCSignalingMessage,
} from "./webrtc.ts";
/** Logic for managing groups of connected WebSocket clients and filtered broadcasts. */
export { WebSocketGroup, type WebSocketGroupListener } from "./websocket-group.ts";
/** Representation of a middleware associated with an optional path pattern. */
export { MiddlewareRoute } from "./middleware-route.ts";
/** Pipeline executor for middleware execution using the onion architecture. */
export { MiddlewareChain } from "./middleware-chain.ts";
/** Handler route for worker fallback execution tiers. */
export { WorkerRoute } from "./worker-route.ts";
/** Encapsulation of an HTTP route with method, path matching, and handlers. */
export { HttpRoute, type HttpRouteOptions } from "./http-route.ts";
/** Encapsulation of a WebSocket route with path matching and its associated group. */
export { WsRoute, type WsRouteOptions } from "./ws-route.ts";
/** Core Router class for registering and dispatching HTTP and WebSocket requests. */
export { Router } from "./router.ts";
export { APP_VERSION as version } from "./version.ts"
