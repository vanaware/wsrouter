// tests/presence_test.ts
import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  PresenceTracker,
  type PresenceUser,
  WebSocketGroup,
} from "../src/mod.ts";
import { createDenoRouter } from "../src/deno.ts";

// Helper to construct a mock WebSocket instance for unit testing
function createMockWebSocket(
  readyState: number = WebSocket.OPEN,
): WebSocket & { sent: string[] } {
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

describe("PresenceTracker (Standalone)", () => {
  it("tracks a new user, records metadata, and sends initial state snapshot", () => {
    const tracker = new PresenceTracker();
    const ws1 = createMockWebSocket();

    const user = tracker.track(ws1, {
      userId: "alice",
      name: "Alice",
      avatar: "alice.png",
    });

    assertEquals(user.userId, "alice");
    assertEquals(user.data.name, "Alice");
    assertEquals(user.connections, 1);
    assertEquals(tracker.size, 1);
    assertEquals(tracker.connectionCount, 1);
    assertEquals(tracker.has("alice"), true);
    assertEquals(tracker.has("bob"), false);

    // Verify initial snapshot sent directly to ws1
    assertEquals(ws1.sent.length, 1);
    const snapshot = JSON.parse(ws1.sent[0]!);
    assertEquals(snapshot.type, "presence_state");
    assertEquals(snapshot.users.length, 1);
    assertEquals(snapshot.users[0].userId, "alice");
  });

  it("handles multi-tab connections without duplicate join broadcasts", () => {
    const group = new WebSocketGroup();
    const tracker = new PresenceTracker(group);

    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    group.addSocket(ws1, {});
    group.addSocket(ws2, {});

    let joinCount = 0;
    tracker.on("join", () => {
      joinCount++;
    });

    // Tab 1 connects
    tracker.track(ws1, { userId: "alice", name: "Alice" });
    assertEquals(joinCount, 1);
    assertEquals(tracker.getUser("alice")?.connections, 1);

    // Tab 2 connects for the same user
    tracker.track(ws2, { userId: "alice", name: "Alice" });
    assertEquals(joinCount, 1); // No second join event
    assertEquals(tracker.getUser("alice")?.connections, 2);
    assertEquals(tracker.size, 1);
    assertEquals(tracker.connectionCount, 2);

    // Tab 1 closes -> user remains online
    tracker.untrack(ws1);
    assertEquals(tracker.has("alice"), true);
    assertEquals(tracker.getUser("alice")?.connections, 1);

    // Tab 2 closes -> user goes offline
    let leaveCount = 0;
    tracker.on("leave", () => {
      leaveCount++;
    });
    tracker.untrack(ws2);
    assertEquals(leaveCount, 1);
    assertEquals(tracker.has("alice"), false);
    assertEquals(tracker.size, 0);
    assertEquals(tracker.connectionCount, 0);
  });

  it("broadcasts join, leave, and update diffs to group members", () => {
    const group = new WebSocketGroup();
    const tracker = new PresenceTracker(group);

    const aliceWs = createMockWebSocket();
    const bobWs = createMockWebSocket();
    group.addSocket(aliceWs, {});
    group.addSocket(bobWs, {});

    // Alice joins
    tracker.track(aliceWs, { userId: "alice", role: "admin" });

    // Bob joins -> Alice should receive Bob's join diff
    tracker.track(bobWs, { userId: "bob", role: "member" });

    // Inspect Alice's received messages (should contain Bob's join event)
    const bobJoinMsg = aliceWs.sent.find((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === "presence_join" && parsed.user.userId === "bob";
      } catch {
        return false;
      }
    });
    assertNotEquals(bobJoinMsg, undefined);

    // Bob updates status
    tracker.update(bobWs, { role: "moderator", status: "away" });
    const bobUpdateMsg = aliceWs.sent.find((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === "presence_update" && parsed.user.data.status === "away";
      } catch {
        return false;
      }
    });
    assertNotEquals(bobUpdateMsg, undefined);

    // Bob disconnects
    tracker.untrack(bobWs);
    const bobLeaveMsg = aliceWs.sent.find((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === "presence_leave" && parsed.userId === "bob";
      } catch {
        return false;
      }
    });
    assertNotEquals(bobLeaveMsg, undefined);
  });

  it("prunes closed sockets automatically during presence inspection", () => {
    const tracker = new PresenceTracker();
    const ws = createMockWebSocket(WebSocket.OPEN);
    tracker.track(ws, { userId: "carol" });
    assertEquals(tracker.has("carol"), true);

    // Simulate socket closing in the background
    Object.defineProperty(ws, "readyState", { value: WebSocket.CLOSED });

    // Inspection should automatically prune carol
    assertEquals(tracker.has("carol"), false);
    assertEquals(tracker.getUsers().length, 0);
    assertEquals(tracker.size, 0);
  });
});

describe("WebSocketGroup & Router Presence Integration", () => {
  it("allows tracking presence directly through WebSocketGroup", () => {
    const group = new WebSocketGroup();
    const ws = createMockWebSocket();
    group.addSocket(ws, { room: "lobby" });

    const user = group.track(ws, {
      userId: "dave",
      username: "Dave",
      status: "online",
    });

    assertEquals(user.userId, "dave");
    assertEquals(group.presenceSize, 1);
    assertEquals(group.getPresenceList().length, 1);
    assertEquals(group.getPresenceUser("dave")?.data.username, "Dave");

    // Updating presence through group helper
    group.updatePresence(ws, { status: "busy" });
    assertEquals(group.getPresenceUser("dave")?.data.status, "busy");

    // Automatically untracks when removeSocket is called
    group.removeSocket(ws);
    assertEquals(group.presenceSize, 0);
    assertEquals(group.getPresenceList().length, 0);
  });

  it("clears presence state when group is closed", () => {
    const group = new WebSocketGroup();
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    group.addSocket(ws1, {});
    group.addSocket(ws2, {});

    group.track(ws1, { userId: "user1" });
    group.track(ws2, { userId: "user2" });
    assertEquals(group.presenceSize, 2);

    group.closeGroup();
    assertEquals(group.presenceSize, 0);
    assertEquals(group.getPresenceList().length, 0);
  });

  it("allows querying presence via Router convenience methods", () => {
    const router = createDenoRouter();
    router.ws("/rooms/:id", () => {});

    const group = router.getWsGroupByPath("/rooms/:id")!;
    assert(group !== undefined);

    const ws = createMockWebSocket();
    group.addSocket(ws, { id: "gaming" });
    group.track(ws, { userId: "gamer1", game: "chess" });

    const presenceList = router.getPresence("/rooms/:id");
    assertEquals(presenceList.length, 1);
    assertEquals(presenceList[0]!.userId, "gamer1");
    assertEquals(presenceList[0]!.data.game, "chess");

    const singleUser = router.getPresenceUser("/rooms/:id", "gamer1");
    assertEquals(singleUser?.userId, "gamer1");
  });

  it("supports custom presence filtering across rooms", () => {
    const group = new WebSocketGroup();
    const tracker = group.configurePresence({
      filter: (receiverParams, senderParams) => {
        // Only deliver presence updates if both sockets are in the same room
        return receiverParams.room === senderParams.room;
      },
    });

    const wsRoom1A = createMockWebSocket();
    const wsRoom1B = createMockWebSocket();
    const wsRoom2 = createMockWebSocket();

    group.addSocket(wsRoom1A, { room: "room1" });
    group.addSocket(wsRoom1B, { room: "room1" });
    group.addSocket(wsRoom2, { room: "room2" });

    // Initial tracking for listeners
    tracker.track(wsRoom1A, { userId: "u1" }, { room: "room1" });
    tracker.track(wsRoom2, { userId: "u3" }, { room: "room2" });

    // User 2 joins room1
    tracker.track(wsRoom1B, { userId: "u2" }, { room: "room1" });

    // wsRoom1A (room1) should have received u2's join event
    const room1ReceivedJoin = wsRoom1A.sent.some((m) => m.includes("presence_join") && m.includes("u2"));
    assertEquals(room1ReceivedJoin, true);

    // wsRoom2 (room2) should NOT have received u2's join event
    const room2ReceivedJoin = wsRoom2.sent.some((m) => m.includes("presence_join") && m.includes("u2"));
    assertEquals(room2ReceivedJoin, false);
  });
});
