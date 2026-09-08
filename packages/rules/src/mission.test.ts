import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createMission,
  engineTier,
  missionSeats,
  playerView,
  previewAction,
  type MissionCommand,
  type MissionState,
  type Seat,
} from "./mission.js";

function act(
  state: MissionState,
  seat: Seat,
  command: MissionCommand,
): MissionState {
  const result = applyCommand(state, seat, command);
  expect(result.error, JSON.stringify(command)).toBeNull();
  return result.state;
}
function piece(state: MissionState, seat: Seat): string {
  const e = state.private[seat].engine;
  return e.dice[0]?.id ?? e.hand[0]?.id ?? e.pending[0]?.id ?? e.markers[0]!;
}
/** A Scout action commits the whole surge; other engines commit one piece. */
function committed(state: MissionState, seat: Seat): string[] {
  const e = state.private[seat].engine;
  return seat === "scout" ? e.pending.map((t) => t.id) : [piece(state, seat)];
}
/** Draws until the surge holds `count` tokens, absorbing any busts on the way. */
function push(state: MissionState, count: number): MissionState {
  let s = state;
  while (s.private.scout.engine.pending.length < count) {
    if (s.private.scout.engine.bagRemaining === 0)
      throw new Error("Bag exhausted before the surge was built.");
    s = act(s, "scout", { type: "draw" });
  }
  return s;
}
function action(
  state: MissionState,
  seat: Seat,
  name: Extract<MissionCommand, { type: "act" }>["action"],
  target: string,
  pieces = committed(state, seat),
): MissionState {
  return act(state, seat, { type: "act", action: name, target, pieces });
}
function round(state: MissionState): MissionState {
  for (const seat of missionSeats) state = act(state, seat, { type: "ready" });
  return state;
}

describe("Greyhaven mission", () => {
  it("is deterministic across seeds and leaves caller state untouched", () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(createMission(seed)).toEqual(createMission(seed));
      const a = createMission(seed);
      const original = structuredClone(a);
      expect(act(a, "scout", { type: "draw" })).toEqual(
        act(createMission(seed), "scout", { type: "draw" }),
      );
      expect(a).toEqual(original);
    }
  });
  it("redacts every other seat and RNG/bag order from independent views", () => {
    const state = createMission();
    for (const seat of missionSeats) {
      const view = playerView(state, seat);
      const wire = JSON.stringify(view);
      expect(view).not.toHaveProperty("private");
      expect(view).not.toHaveProperty("random");
      expect(view.engine).not.toHaveProperty("bag");
      for (const other of missionSeats.filter((s) => s !== seat)) {
        expect(wire).not.toContain(state.private[other].intel[0]!.text);
        expect(wire).not.toContain(state.private[other].objective);
        for (const id of state.private[other].engine.dice.map((d) => d.id))
          expect(wire).not.toContain(id);
      }
      view.resources.power = 100;
      expect(state.resources.power).toBe(2);
    }
  });
  it("combines shared clues into safe timing without bypassing the shield", () => {
    let s = createMission();
    s = act(s, "soldier", { type: "share" });
    expect(s.frequencyKnown).toBe(false);
    s = act(s, "mage", { type: "share" });
    expect(s.frequencyKnown).toBe(true);
    expect(s.shield).toBe(true);
    expect(
      playerView(s, "scout").intel.some((i) => i.status === "inferred"),
    ).toBe(true);
  });
  it("keeps invalid and duplicate engine costs atomic", () => {
    const s = createMission();
    const die = piece(s, "soldier");
    for (const command of [
      { type: "act", action: "move", target: "rift", pieces: [die, die] },
      { type: "act", action: "contribute", target: "rift", pieces: [die] },
      {
        type: "act",
        action: "move",
        target: "rift",
        pieces: ["other-seat-piece"],
      },
    ] satisfies MissionCommand[]) {
      const result = applyCommand(s, "soldier", command);
      expect(result.error).not.toBeNull();
      expect(result.state).toBe(s);
    }
    const moved = action(s, "soldier", "move", "rift", [die]);
    expect(
      applyCommand(moved, "soldier", {
        type: "act",
        action: "move",
        target: "relay",
        pieces: [die],
      }).state,
    ).toBe(moved);
    const low = s.private.soldier.engine.dice.find((d) => d.value < 4)!;
    expect(
      previewAction(playerView(s, "soldier"), {
        type: "act",
        action: "assist",
        target: "mage",
        pieces: [low.id],
      }).allowed,
    ).toBe(low.value >= 3);
  });
  it("requires complementary location reports and never leaks unshared perceptions", () => {
    let s = createMission();
    const views = missionSeats.map((seat) => playerView(s, seat));
    for (const v of views) {
      for (const other of views.filter((o) => o.seat !== v.seat)) {
        for (const reading of other.perceptions)
          expect(JSON.stringify(v)).not.toContain(reading.text);
      }
    }
    s = act(s, "scout", { type: "share" });
    s = act(s, "operator", { type: "share" });
    expect(s.frequencyKnown).toBe(false);
    s = act(s, "soldier", { type: "share", target: "gate" });
    expect(s.frequencyKnown).toBe(false);
    expect(
      playerView(s, "mage").reports.some(
        (r) => r.location === "gate" && r.seat === "soldier",
      ),
    ).toBe(true);
    s = act(s, "soldier", { type: "share" });
    s = act(s, "mage", { type: "share" });
    expect(s.frequencyKnown).toBe(true);
    expect(
      applyCommand(s, "soldier", { type: "share", target: "gate" }).error,
    ).not.toBeNull();
  });
  it("lets another engine exploit a shared weakness once, paying normal capability", () => {
    let s = createMission();
    s = act(s, "soldier", { type: "share", target: "gate" });
    s = action(s, "operator", "move", "gate");
    const command: MissionCommand = {
      type: "act",
      action: "engage",
      target: "gate",
      pieces: [piece(s, "operator")],
    };
    expect(previewAction(playerView(s, "operator"), command).effect).toContain(
      "Remove 1",
    );
    s = act(s, "scout", { type: "share", target: "gate" });
    expect(previewAction(playerView(s, "operator"), command).effect).toContain(
      "Remove 2",
    );
    s = act(s, "operator", command);
    expect(s.threat).toBe(1);
    expect(s.discoveries.flankUsed).toBe(true);
    expect(s.private.operator.engine.markers).toHaveLength(2);
  });
  it("recovers a corroborated archive cache once, only with a paid engine investigation", () => {
    let s = createMission();
    s = act(s, "scout", { type: "share", target: "archive" });
    s = action(s, "mage", "move", "archive");
    const command: MissionCommand = {
      type: "act",
      action: "investigate",
      target: "archive",
      pieces: [piece(s, "mage")],
    };
    expect(previewAction(playerView(s, "mage"), command).effect).not.toContain(
      "cache",
    );
    s = act(s, "operator", { type: "share", target: "archive" });
    expect(previewAction(playerView(s, "mage"), command).effect).toContain(
      "+2 shared Power",
    );
    const fallback = action(s, "mage", "investigate", "archive", []);
    expect(fallback.discoveries.cacheUsed).toBe(false);
    s = act(s, "mage", command);
    expect(s.resources.power).toBe(4);
    expect(s.discoveries.cacheUsed).toBe(true);
    s = action(s, "mage", "investigate", "archive");
    expect(s.resources.power).toBe(4);
  });
  it("makes card combos more efficient than singles and upgrades change output", () => {
    let s = createMission();
    const hand = s.private.mage.engine.hand;
    const combo = [
      hand.find((c) => c.kind === "channel")!.id,
      hand.find((c) => c.kind === "spell")!.id,
    ];
    const normal = action(s, "mage", "acquire", "power", combo);
    expect(normal.resources.power).toBe(5);
    s = act(s, "mage", { type: "upgrade" });
    const upgraded = action(s, "mage", "acquire", "power", combo);
    expect(upgraded.resources.power).toBe(6);
    expect(upgraded.private.mage.engine.hand).toHaveLength(3);
  });
  it("spends a Scout surge whole and refuses to hold part of it back", () => {
    let s = push(createMission(), 2);
    const surge = committed(s, "scout");
    expect(surge.length).toBe(2);
    expect(
      previewAction(playerView(s, "scout"), {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [surge[0]!],
      }).reason,
    ).toContain("whole surge");
    const before = s.resources.power;
    s = action(s, "scout", "acquire", "power");
    expect(s.resources.power).toBe(before + 2);
    expect(s.private.scout.engine.pending).toHaveLength(0);
  });
  it("returns a busting hazard to the bag so pushing only raises the odds", () => {
    let s = createMission();
    while (s.private.scout.engine.stress === 0)
      s = act(s, "scout", { type: "draw" });
    expect(s.private.scout.engine.pending).toHaveLength(0);
    expect(s.instability).toBe(1);
    // The hazard is back in the bag: density rises rather than falling.
    expect(s.private.scout.engine.bagHazards).toBe(2);
    const before = s.private.scout.engine;
    expect(before.bagHazards / before.bagRemaining).toBeGreaterThan(2 / 8);
    // A second burnout costs more than the first.
    while (s.private.scout.engine.stress === 1)
      s = act(s, "scout", { type: "draw" });
    expect(s.private.scout.engine.stress).toBe(2);
    expect(s.instability).toBe(3);
    expect(s.log.some((e) => e.text.includes("pushed past the limit"))).toBe(
      true,
    );
  });
  it("grows every engine on the same clock the world escalates on", () => {
    let s = createMission();
    const seen: number[][] = [];
    // Passive rounds lose to accumulated pressure in round 5, so read tiers 0-2.
    for (let r = 1; r <= 5; r++) {
      expect(s.round).toBe(r);
      const e = s.private;
      seen.push([
        e.soldier.engine.dice.length,
        e.mage.engine.hand.length,
        e.scout.engine.bagRemaining,
        e.operator.engine.markers.length,
      ]);
      // Hazards never thin out as the bag grows; only the payout does.
      expect(e.scout.engine.bagHazards).toBe(2);
      if (r < 5) s = round(s);
    }
    expect(seen).toEqual([
      [5, 5, 8, 4],
      [5, 5, 8, 4],
      [6, 6, 9, 5],
      [6, 6, 9, 5],
      [7, 7, 10, 6],
    ]);
    expect([1, 2, 3, 4, 5, 6].map(engineTier)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(
      s.log.some((entry) =>
        entry.text.includes("Field experience reaches tier 2"),
      ),
    ).toBe(true);
  });
  it("enforces occupied modules and preserves priming through movement", () => {
    let s = createMission();
    s = action(s, "operator", "recover", "operator");
    expect(s.private.operator.engine.slots).toContain("primed");
    s = action(s, "operator", "move", "rift");
    expect(s.private.operator.engine.slots).toContain("primed");
    s = action(s, "operator", "acquire", "power");
    expect(s.resources.power).toBe(4);
    expect(s.private.operator.engine.slots).not.toContain("primed");
    expect(
      applyCommand(s, "operator", {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [piece(s, "operator")],
      }).error,
    ).toContain("occupied");
  });
  it("gives each engine a permanent, exclusive personal-versus-team choice", () => {
    for (const seat of missionSeats) {
      const s = createMission();
      const kept = act(s, seat, { type: "upgrade" });
      const donated = act(s, seat, { type: "donate" });
      expect(kept.players.find((p) => p.seat === seat)?.upgraded).toBe(true);
      expect(donated.resources.power).toBe(s.resources.power + 2);
      expect(kept.resources.power).toBe(s.resources.power);
      expect(applyCommand(kept, seat, { type: "donate" }).error).not.toBeNull();
      expect(
        applyCommand(donated, seat, { type: "upgrade" }).error,
      ).not.toBeNull();
      const refreshed = round(kept);
      expect(refreshed.players.find((p) => p.seat === seat)?.upgraded).toBe(
        true,
      );
      if (seat === "soldier")
        expect(refreshed.private[seat].engine.dice).toHaveLength(6);
      if (seat === "operator")
        expect(refreshed.private[seat].engine.markers).toHaveLength(5);
      if (seat === "scout")
        expect(refreshed.private[seat].engine.bagHazards).toBe(1);
    }
  });
  it("holds without advancing the round; all ready triggers visible pressure and refresh", () => {
    let s = createMission();
    for (const seat of missionSeats) s = act(s, seat, { type: "hold" });
    expect(s.round).toBe(1);
    expect(s.instability).toBe(0);
    s = action(s, "soldier", "move", "gate");
    expect(s.players[0]?.holding).toBe(false);
    const next = round(s);
    expect(next.round).toBe(2);
    expect(next.instability).toBe(2);
    expect(next.private.soldier.engine.dice).toHaveLength(5);
  });
  it("allows information sharing after finishing, but not spending", () => {
    let s = act(createMission(), "mage", { type: "ready" });
    s = act(s, "mage", { type: "share" });
    expect(applyCommand(s, "mage", { type: "upgrade" }).error).not.toBeNull();
  });
  it("resolves defeat and rejects every post-resolution action", () => {
    let s = createMission();
    while (s.phase === "action") s = round(s);
    expect(s.phase).toBe("lost");
    expect(s.instability).toBeGreaterThanOrEqual(12);
    for (const seat of missionSeats)
      expect(applyCommand(s, seat, { type: "donate" }).state).toBe(s);
  });
  it("keeps preview and effect consistent for a four-engine cooperative victory", () => {
    let s = createMission();
    s = act(s, "soldier", { type: "share" });
    s = act(s, "mage", { type: "share" });
    s = act(s, "mage", { type: "hold" });
    s = action(s, "soldier", "contribute", "relay");
    expect(s.shield).toBe(false);
    expect(s.instability).toBe(1);
    s = act(s, "soldier", { type: "donate" });
    s = action(s, "operator", "move", "rift");
    s = action(s, "operator", "recover", "operator");
    s = act(s, "operator", { type: "request", target: "rift" });
    const reaction = s.private.mage.engine.hand.find(
      (c) => c.kind === "reaction",
    )!.id;
    s = action(s, "mage", "assist", "operator", [reaction]);
    expect(s.boosts.operator).toBe(2);
    expect(s.requests).toHaveLength(0);
    expect(s.private.mage.engine.hand.some((c) => c.id === reaction)).toBe(
      false,
    );
    const command: MissionCommand = {
      type: "act",
      action: "contribute",
      target: "rift",
      pieces: [piece(s, "operator")],
    };
    expect(previewAction(playerView(s, "operator"), command).effect).toContain(
      "8 rift progress",
    );
    s = act(s, "operator", command);
    expect(s.progress).toBe(8);
    expect(s.boosts.operator).toBe(0);
    s = push(s, 1);
    s = action(s, "scout", "move", "rift");
    s = push(s, 1);
    s = action(s, "scout", "contribute", "rift");
    expect(s.phase).toBe("action");
    expect(s.progress).toBe(10);
    expect(s.resources.power).toBe(0);
    expect(s.players.find((p) => p.seat === "scout")?.contribution).toBe(2);
    s = act(s, "mage", { type: "donate" });
    const moveCard = s.private.mage.engine.hand.find(
      (c) => c.kind === "channel",
    )!.id;
    s = action(s, "mage", "move", "rift", [moveCard]);
    const combo = [
      s.private.mage.engine.hand.find((c) => c.kind === "channel")!.id,
      s.private.mage.engine.hand.find((c) => c.kind === "spell")!.id,
    ];
    s = action(s, "mage", "contribute", "rift", combo);
    expect(s.phase).toBe("action");
    expect(s.progress).toBe(16);
    s = act(s, "scout", { type: "donate" });
    s = action(s, "operator", "assist", "soldier");
    s = action(s, "soldier", "move", "rift");
    s = action(s, "soldier", "contribute", "rift");
    s = action(s, "soldier", "contribute", "rift");
    expect(s.phase).toBe("won");
    expect(s.progress).toBe(24);
  });
  it("prevents indefinite recovery and the two-engine blind shortcut", () => {
    let s = createMission();
    s = action(s, "operator", "contribute", "relay");
    s = act(s, "mage", { type: "donate" });
    s = action(s, "mage", "move", "rift", [
      s.private.mage.engine.hand.find((c) => c.kind === "reaction")!.id,
    ]);
    for (let i = 0; i < 2; i++)
      s = action(s, "mage", "contribute", "rift", [
        s.private.mage.engine.hand.find((c) => c.kind === "channel")!.id,
        s.private.mage.engine.hand.find((c) => c.kind === "spell")!.id,
      ]);
    expect(s.phase).toBe("action");
    expect(s.progress).toBe(12);
    expect(s.instability).toBe(11);
    s = createMission();
    s.threat = 0;
    for (let i = 0; i < 6; i++) {
      s.instability = 0;
      s = round(s);
    }
    expect(s.phase).toBe("lost");
    expect(s.round).toBe(6);
  });
  it("requires more than two specialists' first-round burst for the full objective", () => {
    let s = createMission();
    s = action(s, "operator", "contribute", "relay");
    s = action(s, "operator", "recover", "operator");
    s = action(s, "operator", "assist", "mage");
    s = action(s, "operator", "acquire", "influence");
    s = act(s, "operator", { type: "donate" });
    s = act(s, "mage", { type: "upgrade" });
    s = action(s, "mage", "move", "rift", [
      s.private.mage.engine.hand.find((c) => c.kind === "reaction")!.id,
    ]);
    for (let i = 0; i < 2; i++) {
      if (i === 1) s = action(s, "operator", "assist", "mage", []);
      s = action(s, "mage", "contribute", "rift", [
        s.private.mage.engine.hand.find((c) => c.kind === "channel")!.id,
        s.private.mage.engine.hand.find((c) => c.kind === "spell")!.id,
      ]);
    }
    expect(s.progress).toBe(22);
    expect(s.phase).toBe("action");
    expect(s.instability).toBe(10);
  });
  it("gives all shared resources a universal use without mandatory classes", () => {
    let s = createMission();
    s.instability = 3;
    s.resources.influence = 1;
    s = action(s, "soldier", "recover", "soldier", []);
    expect(s.resources.materiel).toBe(1);
    expect(s.instability).toBe(2);
    s = action(s, "soldier", "assist", "mage", []);
    expect(s.resources.influence).toBe(0);
    expect(s.boosts.mage).toBe(1);
    s = action(s, "soldier", "move", "archive");
    s = action(s, "soldier", "investigate", "archive", []);
    expect(s.frequencyKnown).toBe(true);
    expect(s.resources.knowledge).toBe(1);
  });
});
