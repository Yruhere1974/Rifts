import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createMission,
  engineTier,
  missionSeats,
  playerView,
  previewAction,
  tableView,
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
  return seat === "bag" ? e.pending.map((t) => t.id) : [piece(state, seat)];
}
/** Draws until the surge holds `count` tokens, absorbing any busts on the way. */
function push(state: MissionState, count: number): MissionState {
  let s = state;
  while (s.private.bag.engine.pending.length < count) {
    if (s.private.bag.engine.bagRemaining === 0)
      throw new Error("Bag exhausted before the surge was built.");
    s = act(s, "bag", { type: "draw" });
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
      expect(act(a, "bag", { type: "draw" })).toEqual(
        act(createMission(seed), "bag", { type: "draw" }),
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
  it("keeps the shared table screen free of every seat's private state", () => {
    let s = createMission();
    s = act(s, "bag", { type: "draw" });
    const wire = JSON.stringify(tableView(s));
    for (const seat of missionSeats) {
      const p = s.private[seat];
      expect(wire).not.toContain(p.objective);
      for (const intel of p.intel) expect(wire).not.toContain(intel.text);
      for (const reading of Object.values(playerView(s, seat).perceptions))
        expect(wire).not.toContain(reading.text);
      for (const die of p.engine.dice) expect(wire).not.toContain(die.id);
      for (const c of p.engine.hand) expect(wire).not.toContain(c.id);
      for (const t of [...p.bag, ...p.engine.pending])
        expect(wire).not.toContain(t.id);
      for (const m of p.engine.markers) expect(wire).not.toContain(m);
    }
    const view = tableView(s);
    expect(view).not.toHaveProperty("private");
    expect(view).not.toHaveProperty("random");
    expect(view).not.toHaveProperty("engine");
    expect(view).not.toHaveProperty("intel");
    expect(view).not.toHaveProperty("perceptions");
    // Counts and placements are table-visible; identities and values are not.
    const kit = (seat: Seat) => view.kits.find((k) => k.seat === seat)!;
    expect(kit("dice").dice).toBe(5);
    expect(kit("cards").hand).toBe(5);
    expect(kit("bag").bagHazards).toBe(2);
    expect(kit("systems").markers).toBe(4);
    expect(view.kits.find((k) => k.seat === "bag")?.surge).toBe(
      s.private.bag.engine.pending.length,
    );
    expect(view.progress).toBe(s.progress);
    view.resources.power = 99;
    expect(s.resources.power).toBe(2);
  });
  it("combines shared clues into safe timing without bypassing the shield", () => {
    let s = createMission();
    s = act(s, "dice", { type: "share" });
    expect(s.frequencyKnown).toBe(false);
    s = act(s, "cards", { type: "share" });
    expect(s.frequencyKnown).toBe(true);
    expect(s.shield).toBe(true);
    expect(
      playerView(s, "bag").intel.some((i) => i.status === "inferred"),
    ).toBe(true);
  });
  it("keeps invalid and duplicate engine costs atomic", () => {
    const s = createMission();
    const die = piece(s, "dice");
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
      const result = applyCommand(s, "dice", command);
      expect(result.error).not.toBeNull();
      expect(result.state).toBe(s);
    }
    const moved = action(s, "dice", "move", "rift", [die]);
    expect(
      applyCommand(moved, "dice", {
        type: "act",
        action: "move",
        target: "relay",
        pieces: [die],
      }).state,
    ).toBe(moved);
    const low = s.private.dice.engine.dice.find((d) => d.value < 4)!;
    expect(
      previewAction(playerView(s, "dice"), {
        type: "act",
        action: "assist",
        target: "cards",
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
    s = act(s, "bag", { type: "share" });
    s = act(s, "systems", { type: "share" });
    expect(s.frequencyKnown).toBe(false);
    s = act(s, "dice", { type: "share", target: "gate" });
    expect(s.frequencyKnown).toBe(false);
    expect(
      playerView(s, "cards").reports.some(
        (r) => r.location === "gate" && r.seat === "dice",
      ),
    ).toBe(true);
    s = act(s, "dice", { type: "share" });
    s = act(s, "cards", { type: "share" });
    expect(s.frequencyKnown).toBe(true);
    expect(
      applyCommand(s, "dice", { type: "share", target: "gate" }).error,
    ).not.toBeNull();
  });
  it("lets another engine exploit a shared weakness once, paying normal capability", () => {
    let s = createMission();
    s = act(s, "dice", { type: "share", target: "gate" });
    s = action(s, "systems", "move", "gate");
    const command: MissionCommand = {
      type: "act",
      action: "engage",
      target: "gate",
      pieces: [piece(s, "systems")],
    };
    expect(previewAction(playerView(s, "systems"), command).effect).toContain(
      "Remove 1",
    );
    s = act(s, "bag", { type: "share", target: "gate" });
    expect(previewAction(playerView(s, "systems"), command).effect).toContain(
      "Remove 2",
    );
    s = act(s, "systems", command);
    expect(s.threat).toBe(1);
    expect(s.discoveries.flankUsed).toBe(true);
    expect(s.private.systems.engine.markers).toHaveLength(2);
  });
  it("recovers a corroborated archive cache once, only with a paid engine investigation", () => {
    let s = createMission();
    s = act(s, "bag", { type: "share", target: "archive" });
    s = action(s, "cards", "move", "archive");
    const command: MissionCommand = {
      type: "act",
      action: "investigate",
      target: "archive",
      pieces: [piece(s, "cards")],
    };
    expect(previewAction(playerView(s, "cards"), command).effect).not.toContain(
      "cache",
    );
    s = act(s, "systems", { type: "share", target: "archive" });
    expect(previewAction(playerView(s, "cards"), command).effect).toContain(
      "+2 shared Power",
    );
    const fallback = action(s, "cards", "investigate", "archive", []);
    expect(fallback.discoveries.cacheUsed).toBe(false);
    s = act(s, "cards", command);
    expect(s.resources.power).toBe(4);
    expect(s.discoveries.cacheUsed).toBe(true);
    s = action(s, "cards", "investigate", "archive");
    expect(s.resources.power).toBe(4);
  });
  it("makes card combos more efficient than singles and upgrades change output", () => {
    let s = createMission();
    const hand = s.private.cards.engine.hand;
    const combo = [
      hand.find((c) => c.kind === "channel")!.id,
      hand.find((c) => c.kind === "spell")!.id,
    ];
    const normal = action(s, "cards", "acquire", "power", combo);
    expect(normal.resources.power).toBe(5);
    s = act(s, "cards", { type: "upgrade" });
    const upgraded = action(s, "cards", "acquire", "power", combo);
    expect(upgraded.resources.power).toBe(6);
    expect(upgraded.private.cards.engine.hand).toHaveLength(3);
  });
  it("spends a Scout surge whole and refuses to hold part of it back", () => {
    let s = push(createMission(), 2);
    const surge = committed(s, "bag");
    expect(surge.length).toBe(2);
    expect(
      previewAction(playerView(s, "bag"), {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [surge[0]!],
      }).reason,
    ).toContain("whole surge");
    const before = s.resources.power;
    s = action(s, "bag", "acquire", "power");
    expect(s.resources.power).toBe(before + 2);
    expect(s.private.bag.engine.pending).toHaveLength(0);
  });
  it("returns a busting hazard to the bag so pushing only raises the odds", () => {
    let s = createMission();
    while (s.private.bag.engine.stress === 0)
      s = act(s, "bag", { type: "draw" });
    expect(s.private.bag.engine.pending).toHaveLength(0);
    expect(s.instability).toBe(1);
    // The hazard is back in the bag: density rises rather than falling.
    expect(s.private.bag.engine.bagHazards).toBe(2);
    const before = s.private.bag.engine;
    expect(before.bagHazards / before.bagRemaining).toBeGreaterThan(2 / 8);
    // A second burnout costs more than the first.
    while (s.private.bag.engine.stress === 1)
      s = act(s, "bag", { type: "draw" });
    expect(s.private.bag.engine.stress).toBe(2);
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
        e.dice.engine.dice.length,
        e.cards.engine.hand.length,
        e.bag.engine.bagRemaining,
        e.systems.engine.markers.length,
      ]);
      // Hazards never thin out as the bag grows; only the payout does.
      expect(e.bag.engine.bagHazards).toBe(2);
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
    s = action(s, "systems", "recover", "systems");
    expect(s.private.systems.engine.slots).toContain("primed");
    s = action(s, "systems", "move", "rift");
    expect(s.private.systems.engine.slots).toContain("primed");
    s = action(s, "systems", "acquire", "power");
    expect(s.resources.power).toBe(4);
    expect(s.private.systems.engine.slots).not.toContain("primed");
    expect(
      applyCommand(s, "systems", {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [piece(s, "systems")],
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
      if (seat === "dice")
        expect(refreshed.private[seat].engine.dice).toHaveLength(6);
      if (seat === "systems")
        expect(refreshed.private[seat].engine.markers).toHaveLength(5);
      if (seat === "bag")
        expect(refreshed.private[seat].engine.bagHazards).toBe(1);
    }
  });
  it("holds without advancing the round; all ready triggers visible pressure and refresh", () => {
    let s = createMission();
    for (const seat of missionSeats) s = act(s, seat, { type: "hold" });
    expect(s.round).toBe(1);
    expect(s.instability).toBe(0);
    s = action(s, "dice", "move", "gate");
    expect(s.players[0]?.holding).toBe(false);
    const next = round(s);
    expect(next.round).toBe(2);
    expect(next.instability).toBe(2);
    expect(next.private.dice.engine.dice).toHaveLength(5);
  });
  it("allows information sharing after finishing, but not spending", () => {
    let s = act(createMission(), "cards", { type: "ready" });
    s = act(s, "cards", { type: "share" });
    expect(applyCommand(s, "cards", { type: "upgrade" }).error).not.toBeNull();
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
    s = act(s, "dice", { type: "share" });
    s = act(s, "cards", { type: "share" });
    s = act(s, "cards", { type: "hold" });
    s = action(s, "dice", "contribute", "relay");
    expect(s.shield).toBe(false);
    expect(s.instability).toBe(1);
    s = act(s, "dice", { type: "donate" });
    s = action(s, "systems", "move", "rift");
    s = action(s, "systems", "recover", "systems");
    s = act(s, "systems", { type: "request", target: "rift" });
    const reaction = s.private.cards.engine.hand.find(
      (c) => c.kind === "reaction",
    )!.id;
    s = action(s, "cards", "assist", "systems", [reaction]);
    expect(s.boosts.systems).toBe(2);
    expect(s.requests).toHaveLength(0);
    expect(s.private.cards.engine.hand.some((c) => c.id === reaction)).toBe(
      false,
    );
    const command: MissionCommand = {
      type: "act",
      action: "contribute",
      target: "rift",
      pieces: [piece(s, "systems")],
    };
    expect(previewAction(playerView(s, "systems"), command).effect).toContain(
      "8 rift progress",
    );
    s = act(s, "systems", command);
    expect(s.progress).toBe(8);
    expect(s.boosts.systems).toBe(0);
    s = push(s, 1);
    s = action(s, "bag", "move", "rift");
    s = push(s, 1);
    s = action(s, "bag", "contribute", "rift");
    expect(s.phase).toBe("action");
    expect(s.progress).toBe(10);
    expect(s.resources.power).toBe(0);
    expect(s.players.find((p) => p.seat === "bag")?.contribution).toBe(2);
    s = act(s, "cards", { type: "donate" });
    const moveCard = s.private.cards.engine.hand.find(
      (c) => c.kind === "channel",
    )!.id;
    s = action(s, "cards", "move", "rift", [moveCard]);
    const combo = [
      s.private.cards.engine.hand.find((c) => c.kind === "channel")!.id,
      s.private.cards.engine.hand.find((c) => c.kind === "spell")!.id,
    ];
    s = action(s, "cards", "contribute", "rift", combo);
    expect(s.phase).toBe("action");
    expect(s.progress).toBe(16);
    s = act(s, "bag", { type: "donate" });
    s = action(s, "systems", "assist", "dice");
    s = action(s, "dice", "move", "rift");
    s = action(s, "dice", "contribute", "rift");
    s = action(s, "dice", "contribute", "rift");
    expect(s.phase).toBe("won");
    expect(s.progress).toBe(24);
  });
  it("prevents indefinite recovery and the two-engine blind shortcut", () => {
    let s = createMission();
    s = action(s, "systems", "contribute", "relay");
    s = act(s, "cards", { type: "donate" });
    s = action(s, "cards", "move", "rift", [
      s.private.cards.engine.hand.find((c) => c.kind === "reaction")!.id,
    ]);
    for (let i = 0; i < 2; i++)
      s = action(s, "cards", "contribute", "rift", [
        s.private.cards.engine.hand.find((c) => c.kind === "channel")!.id,
        s.private.cards.engine.hand.find((c) => c.kind === "spell")!.id,
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
    s = action(s, "systems", "contribute", "relay");
    s = action(s, "systems", "recover", "systems");
    s = action(s, "systems", "assist", "cards");
    s = action(s, "systems", "acquire", "influence");
    s = act(s, "systems", { type: "donate" });
    s = act(s, "cards", { type: "upgrade" });
    s = action(s, "cards", "move", "rift", [
      s.private.cards.engine.hand.find((c) => c.kind === "reaction")!.id,
    ]);
    for (let i = 0; i < 2; i++) {
      if (i === 1) s = action(s, "systems", "assist", "cards", []);
      s = action(s, "cards", "contribute", "rift", [
        s.private.cards.engine.hand.find((c) => c.kind === "channel")!.id,
        s.private.cards.engine.hand.find((c) => c.kind === "spell")!.id,
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
    s = action(s, "dice", "recover", "dice", []);
    expect(s.resources.materiel).toBe(1);
    expect(s.instability).toBe(2);
    s = action(s, "dice", "assist", "cards", []);
    expect(s.resources.influence).toBe(0);
    expect(s.boosts.cards).toBe(1);
    s = action(s, "dice", "move", "archive");
    s = action(s, "dice", "investigate", "archive", []);
    expect(s.frequencyKnown).toBe(true);
    expect(s.resources.knowledge).toBe(1);
  });
});
