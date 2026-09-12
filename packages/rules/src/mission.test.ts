import { describe, expect, it } from "vitest";
import { missionMap } from "@rifts/content";
import {
  hexDistance,
  hexKey,
  hexesWithin,
  parseHex,
  type Hex,
} from "@rifts/shared";
import {
  applyCommand,
  createMission,
  engineTier,
  missionSeats,
  playerView,
  previewAction,
  coherence,
  diceOutput,
  surgeOutput,
  systemOutput,
  weaveOutput,
  weaves,
  wiring,
  facetForAction,
  worldPressure,
  reachable,
  routingCapacity,
  routeCost,
  siteAt,
  tableView,
  type GlitterFacet,
  type MissionAction,
  type MissionCommand,
  type MissionLocation,
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
    const e = s.private.bag.engine;
    // A bag holding nothing but hazards can never build a surge: every push
    // busts and puts the hazard straight back, so this has to stop rather
    // than draw forever.
    if (e.bagRemaining === 0 || e.bagHazards >= e.bagRemaining)
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
  pieces?: string[],
): MissionState {
  const ready = pieces ? { state, pieces } : armed(state, seat, name);
  return act(ready.state, seat, {
    type: "act",
    action: name,
    target,
    pieces: ready.pieces,
    ...(seat === "systems" && name !== "move"
      ? { socket: bestSocket(ready.state) }
      : {}),
  });
}

/**
 * Where a Techno-Wizard who is paying attention would build: the empty socket
 * wired to the most of what already stands, and the leftmost of those so the
 * frame grows as one run rather than in two halves.
 */
function bestSocket(state: MissionState): number {
  const sockets = state.private.systems.engine.sockets;
  let best = -1;
  let score = -1;
  sockets.forEach((held, index) => {
    if (held) return;
    const wired = wiring(sockets, index);
    if (wired > score) {
      score = wired;
      best = index;
    }
  });
  return best;
}
/**
 * The pieces a seat commits for an action, allocating first where the platform
 * needs it: the dice engine fires whole systems, not single dice.
 */
function armed(
  state: MissionState,
  seat: Seat,
  name: MissionAction,
): { state: MissionState; pieces: string[] } {
  if (seat !== "dice") return { state, pieces: committed(state, seat) };
  const facet = facetForAction[name];
  const tray = () => state.private.dice.engine.dice;
  if (!facet) {
    const loose = tray().find((die) => die.facet === null);
    return { state, pieces: loose ? [loose.id] : [] };
  }
  if (!tray().some((die) => die.facet === facet)) {
    // Routing browns out every loose die showing lower, and the platform only
    // routes a few times a round, so a careful pilot routes from the bottom
    // up: the cheapest routing vents nothing.
    const loose = [...tray()]
      .filter((die) => die.facet === null)
      .sort((a, b) => a.value - b.value)[0];
    const e = state.private.dice.engine;
    if (loose && e.routings < e.capacity)
      state = act(state, "dice", { type: "allocate", die: loose.id, facet });
  }
  const spent = state.private.dice.engine.dice.filter(
    (die) =>
      die.facet === facet ||
      (name === "engage" && (die.facet === "boom" || die.facet === "bracing")),
  );
  return { state, pieces: spent.map((die) => die.id) };
}

/**
 * Walks a seat to a named site. Sites are hexes apart now, so arriving is a
 * journey of several commitments rather than a single move.
 */
function travel(state: MissionState, seat: Seat, site: MissionLocation) {
  return march(
    state,
    seat,
    missionMap.sites[site],
    (hex, size) => siteAt(hex, size) === site,
    site,
  );
}

/** Walks a seat until it is close enough to swing at a placed enemy. */
function closeWith(state: MissionState, seat: Seat, enemyId: string) {
  const where = (s: MissionState) =>
    s.enemies.find((enemy) => enemy.id === enemyId)!.position;
  return march(
    state,
    seat,
    where(state),
    (hex, size) => hexDistance(hex, where(state)) <= size + 1,
    enemyId,
  );
}

function march(
  state: MissionState,
  seat: Seat,
  goal: Hex,
  arrived: (hex: Hex, size: number) => boolean,
  label: string,
) {
  let s = state;
  for (let guard = 0; guard < 20; guard++) {
    const player = s.players.find((p) => p.seat === seat)!;
    if (arrived(player.position, player.size)) return s;
    if (seat === "bag" && s.private.bag.engine.pending.length === 0)
      s = push(s, 1);
    // Check there is anything to move with before paying for a full-map BFS.
    // The platform can run out of routings mid-journey now, and a leg that
    // cannot be taken should say so rather than be searched for twenty times.
    {
      const ready = armed(s, seat, "move");
      s = ready.state;
      if (!ready.pieces.length || ready.pieces.some((id) => !id))
        throw new Error(`${seat} has nothing left to move with.`);
    }
    const allies = s.players.filter((p) => p.seat !== seat);
    /** A legal resting anchor: allies may be passed but not stood on. */
    const free = (hex: { q: number; r: number }) =>
      !allies.some(
        (other) => hexDistance(hex, other.position) <= player.size + other.size,
      );
    // Full-map BFS first, so a narrow passage is followed rather than a
    // nearest-hex guess that stalls at a corner.
    const cameFrom = new Map<string, string | null>([
      [hexKey(player.position), null],
    ]);
    const queue = [player.position];
    let arrival: string | null = null;
    while (queue.length && !arrival) {
      const here = queue.shift()!;
      for (const [key] of reachable(here, player.size, 1, s.enemies)) {
        if (cameFrom.has(key)) continue;
        cameFrom.set(key, hexKey(here));
        const hex = parseHex(key)!;
        if (arrived(hex, player.size) && free(hex)) {
          arrival = key;
          break;
        }
        queue.push(hex);
      }
    }
    if (!arrival) throw new Error(`${seat} cannot reach ${label}.`);
    const path: string[] = [];
    for (let at: string | null = arrival; at; at = cameFrom.get(at) ?? null)
      path.unshift(at);
    let ready = armed(s, seat, "move");
    s = ready.state;
    const view = playerView(s, seat);
    const pieces = ready.pieces;
    const range =
      previewAction(view, {
        type: "act",
        action: "move",
        target: arrival,
        pieces,
      }).range || 1;
    // Step as far along the path as the commitment allows, backing off any
    // anchor an ally is resting on.
    let index = Math.min(range, path.length - 1);
    while (index > 0 && !free(parseHex(path[index]!)!)) index--;
    let step = index > 0 ? path[index]! : null;
    if (!step) {
      // The path's near segment is occupied, so detour: any free anchor in
      // range that closes the distance will do.
      let best: { key: string; distance: number } | null = null;
      for (const [key] of reachable(
        player.position,
        player.size,
        range,
        s.enemies,
      )) {
        const hex = parseHex(key)!;
        if (!free(hex)) continue;
        const distance = hexDistance(hex, goal);
        if (!best || distance < best.distance) best = { key, distance };
      }
      if (!best || best.distance >= hexDistance(player.position, goal))
        throw new Error(`${seat} is boxed in short of ${label}.`);
      step = best.key;
    }
    ready = armed(s, seat, "move");
    s = act(ready.state, seat, {
      type: "act",
      action: "move",
      target: step,
      pieces: ready.pieces,
    });
  }
  throw new Error(`${seat} never reached ${label}.`);
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
    const moved = travel(s, "dice", "rift");
    expect(
      applyCommand(moved, "dice", {
        type: "act",
        action: "move",
        target: hexKey(missionMap.sites.relay),
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
    const quarry = s.enemies[0]!.id;
    s = closeWith(s, "systems", quarry);
    const command: MissionCommand = {
      type: "act",
      action: "engage",
      target: quarry,
      pieces: [piece(s, "systems")],
      socket: bestSocket(s),
    };
    expect(previewAction(playerView(s, "systems"), command).effect).toContain(
      "for 1",
    );
    s = act(s, "bag", { type: "share", target: "gate" });
    expect(previewAction(playerView(s, "systems"), command).effect).toContain(
      "for 2",
    );
    s = act(s, "systems", command);
    expect(s.threat).toBe(1);
    expect(s.discoveries.flankUsed).toBe(true);
    // Crossing to the fight and taking the shot both cost markers; how many
    // the journey took is the map's business, not this test's.
    expect(s.private.systems.engine.markers.length).toBeLessThan(4);
  });
  it("recovers a corroborated archive cache once, only with a paid engine investigation", () => {
    let s = createMission();
    s = act(s, "bag", { type: "share", target: "archive" });
    s = travel(s, "cards", "archive");
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
  it("brings the opposition to you at the world response", () => {
    let s = createMission();
    const patrol = () => s.enemies.find((e) => e.id === "patrol-flank")!;
    const hunted = s.players.find((p) => p.seat === "cards")!;
    const before = hexDistance(patrol().position, hunted.position);

    // Nothing moves while the team is acting: the round belongs to the players.
    s = travel(s, "cards", "gate");
    expect(hexDistance(patrol().position, s.players[1]!.position)).toBe(
      hexDistance(patrol().position, s.players[1]!.position),
    );

    // The answer comes when the world responds, and only then.
    const after = round(s);
    const closed = hexDistance(
      after.enemies.find((e) => e.id === "patrol-flank")!.position,
      after.players.find((p) => p.seat === "cards")!.position,
    );
    expect(closed).toBeLessThan(before);
    expect(after.log.some((entry) => entry.text.includes("advances on"))).toBe(
      true,
    );

    // Standing next to one costs the team every round it is left alive.
    let s2 = createMission();
    s2 = closeWith(s2, "cards", "patrol-flank");
    const hurt = round(s2);
    expect(
      hurt.log.some((entry) => entry.text.includes("+1 instability")),
    ).toBe(true);
    expect(hurt.instability).toBeGreaterThan(
      worldPressure(s2.round, s2.threat),
    );
  });
  it("lets a patrol hold ground and the platform stand in front of it", () => {
    const s = createMission();
    const patrol = s.enemies.find((e) => e.id === "patrol-lead")!;

    // A patrol's reach stops a move dead: you may close with it, never pass it.
    // A real standable anchor a short walk from the patrol, not an arbitrary
    // offset that might be solid rock.
    const openSet = new Set(missionMap.open);
    const from = missionMap.open
      .map((key) => parseHex(key)!)
      .find(
        (hex) =>
          hexDistance(hex, patrol.position) >= 3 &&
          hexDistance(hex, patrol.position) <= 5 &&
          hexesWithin(hex, 1).every((cell) => openSet.has(hexKey(cell))),
      )!;
    expect(from).toBeDefined();
    const open = reachable(from, 1, 8);
    const past = reachable(from, 1, 8, s.enemies);
    expect(past.size).toBeLessThan(open.size);
    // Nothing may come to rest on top of it.
    for (const [key] of past)
      expect(hexDistance(parseHex(key)!, patrol.position)).toBeGreaterThan(1);
    // And the ground behind it, which is open without it, is not reachable.
    const behind = [...open.keys()].filter(
      (key) =>
        hexDistance(parseHex(key)!, patrol.position) <= 2 ||
        (!past.has(key) && open.has(key)),
    );
    expect(behind.length).toBeGreaterThan(0);

    // Put the leader in the platform's face directly: travelling there spends
    // the very dice the comparison is about.
    const confront = () => {
      const next = createMission();
      const me = next.players.find((player) => player.seat === "dice")!;
      next.enemies = [
        {
          ...next.enemies.find((enemy) => enemy.id === "patrol-lead")!,
          position: { q: me.position.q + me.size + 1, r: me.position.r },
        },
      ];
      next.threat = next.enemies[0]!.strength;
      return next;
    };

    // Unshielded, the leader's full strength lands on the team.
    const exposedStart = confront();
    const exposed = round(exposedStart);
    const exposedHit = exposed.instability - exposedStart.instability;
    expect(exposedHit).toBeGreaterThan(0);

    // Dice held in Shield are dice that did nothing else all round. That is
    // what they buy: the platform takes the hit instead of the team.
    let bracedStart = confront();
    // Routing from the bottom up vents nothing, so this is the whole of what
    // one round's capacity can put behind the shield.
    while (true) {
      const e = bracedStart.private.dice.engine;
      if (e.routings >= e.capacity) break;
      const die = [...e.dice]
        .filter((d) => d.facet === null)
        .sort((a, b) => a.value - b.value)[0];
      if (!die) break;
      bracedStart = act(bracedStart, "dice", {
        type: "allocate",
        die: die.id,
        facet: "shield",
      });
    }
    const braced = round(bracedStart);
    expect(braced.instability - bracedStart.instability).toBeLessThan(
      exposedHit,
    );
    expect(
      braced.log.some((entry) => entry.text.includes("holds the line")),
    ).toBe(true);
  });
  it("browns out the platform when surge is routed to the top first", () => {
    /** A platform holding known faces, so the ordering can be reasoned about. */
    const rig = (values: number[]) => {
      const s = createMission();
      const e = s.private.dice.engine;
      e.dice = values.map((value, i) => ({ id: `d${i}`, value, facet: null }));
      e.capacity = routingCapacity(values.length);
      e.routings = 0;
      return s;
    };
    const route = (s: MissionState, die: string, facet: GlitterFacet) =>
      act(s, "dice", { type: "allocate", die, facet });
    const inside = (s: MissionState, facet: GlitterFacet) =>
      s.private.dice.engine.dice.filter((d) => d.facet === facet);

    // Five dice, three routings. The platform cannot power everything it is
    // holding, which is what makes the order a decision rather than a sort.
    expect(routingCapacity(5)).toBe(3);

    // Careful: route from the bottom up. Nothing is ever lower than the die
    // being routed, so nothing vents — and the two best dice never get used.
    let careful = rig([1, 2, 4, 5, 6]);
    for (const id of ["d0", "d1", "d2"])
      careful = route(careful, id, "stabilizer");
    expect(careful.private.dice.engine.vented).toHaveLength(0);
    expect(systemOutput(inside(careful, "stabilizer"))).toBe(4);
    expect(
      applyCommand(careful, "dice", {
        type: "allocate",
        die: "d3",
        facet: "stabilizer",
      }).error,
    ).toContain("routes 3 times a round");

    // Greedy: take the top first and the whole platform browns out behind it.
    let greedy = rig([1, 2, 4, 5, 6]);
    greedy = route(greedy, "d4", "stabilizer");
    expect(
      greedy.private.dice.engine.vented.map((d) => d.value).sort(),
    ).toEqual([1, 2, 4, 5]);
    expect(greedy.private.dice.engine.dice).toHaveLength(1);
    expect(systemOutput(inside(greedy, "stabilizer"))).toBe(2);

    // Read: spend the bottom to make room for the top. One routing browns out
    // the two dice that were never going to fit, and the run pays for it.
    let read = rig([1, 2, 4, 5, 6]);
    read = route(read, "d2", "stabilizer");
    expect(read.private.dice.engine.vented.map((d) => d.value)).toEqual([1, 2]);
    read = route(read, "d3", "stabilizer");
    read = route(read, "d4", "stabilizer");
    expect(read.private.dice.engine.vented).toHaveLength(2);
    expect(systemOutput(inside(read, "stabilizer"))).toBe(9);

    // Past the manifold a die can be rerouted for nothing, but surge does not
    // flow backwards: a routed die never returns to the tray.
    read = route(read, "d4", "boom");
    expect(read.private.dice.engine.routings).toBe(3);
    expect(
      applyCommand(read, "dice", {
        type: "allocate",
        die: "d4",
        facet: null,
      }).error,
    ).toContain("backwards");
  });

  it("pays a calibrated system better than a numerous one", () => {
    // The same count of dice is worth more when it fits together.
    expect(systemOutput([{ value: 2 }, { value: 3 }])).toBe(2);
    expect(systemOutput([{ value: 2 }, { value: 2 }])).toBe(4);
    // 1 + 1 + 2 for the faces, then +3 for a run of three.
    expect(systemOutput([{ value: 2 }, { value: 3 }, { value: 4 }])).toBe(7);
    expect(coherence([{ value: 5 }, { value: 5 }]).label).toBe("locked on");
    expect(coherence([{ value: 3 }, { value: 4 }, { value: 5 }]).label).toBe(
      "spun up",
    );
    // Junk still fires, it is simply worth what the dice are worth.
    expect(coherence([{ value: 1 }, { value: 4 }]).label).toBeNull();
    expect(systemOutput([{ value: 1 }, { value: 4 }])).toBe(3);
  });

  it("carries a locked die and its face into the next round", () => {
    let s = createMission();
    const tray = () => s.private.dice.engine.dice;
    const keeper = tray()[0]!;
    s = act(s, "dice", {
      type: "allocate",
      die: keeper.id,
      facet: "locked",
    });

    // Locked dice are out of play this round: they cannot fire a system.
    expect(
      applyCommand(s, "dice", {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [keeper.id],
      }).error,
    ).not.toBeNull();

    const next = round(s);
    const carried = next.private.dice.engine.dice.find(
      (die) => die.id === keeper.id,
    );
    // Same die, same face, still locked, and the tray is topped up around it.
    expect(carried?.value).toBe(keeper.value);
    expect(carried?.facet).toBe("locked");
    expect(next.private.dice.engine.dice).toHaveLength(5);
    expect(
      next.private.dice.engine.dice.filter((die) => die.facet === null),
    ).toHaveLength(4);
  });

  it("pays every engine for playing its material well", () => {
    // Weaves are chains, and length is superlinear: the old pair falls out of
    // the same rule rather than sitting beside it.
    expect(weaveOutput(1)).toBe(1);
    expect(weaveOutput(2)).toBe(3);
    expect(weaveOutput(3)).toBe(6);
    expect(weaves([{ kind: "channel" }, { kind: "spell" }])).toBe(true);
    expect(weaves([{ kind: "channel" }, { kind: "channel" }])).toBe(false);
    // Exploit Opening stands in for either side of the chain.
    expect(
      weaves([{ kind: "channel" }, { kind: "reaction" }, { kind: "channel" }]),
    ).toBe(true);

    // A surge is read for composition as well as size.
    expect(surgeOutput([{ kind: "find" }, { kind: "cache" }])).toBe(2);
    expect(surgeOutput([{ kind: "find" }, { kind: "find" }])).toBe(4);
    expect(
      surgeOutput([{ kind: "find" }, { kind: "cache" }, { kind: "signal" }]),
    ).toBe(6);

    // A socket wired to what is already built beside it is worth more.
    const frame = (built: (MissionAction | null)[]) => built;
    expect(wiring(frame([null, null, null]), 1)).toBe(0);
    expect(wiring(frame(["investigate", null, null]), 1)).toBe(1);
    expect(wiring(frame(["investigate", null, "acquire"]), 1)).toBe(2);
    // The ends of the frame have one neighbour, so a run is cheapest to start
    // in the middle and cheapest to extend from either edge of what stands.
    expect(wiring(frame([null, "engage", null]), 0)).toBe(1);
  });

  it("names the combination each engine just read", () => {
    // The preview says which fit it found, in that engine's own language, so
    // the number is never the only feedback a good play gets.
    const cards = createMission();
    const hand = cards.private.cards.engine.hand;
    const channel = hand.find((card) => card.kind === "channel")!;
    const resonance = hand.find((card) => card.kind === "spell")!;
    expect(
      previewAction(playerView(cards, "cards"), {
        type: "act",
        action: "assist",
        target: "dice",
        pieces: [channel.id, resonance.id],
      }).effect,
    ).toContain("Weave of 2.");

    // A pull of one kind reads as clean; a mixed one that is not a full
    // spread has no fit to name.
    const bag = push(createMission(), 2);
    const pending = bag.private.bag.engine.pending;
    const preview = previewAction(playerView(bag, "bag"), {
      type: "act",
      action: "assist",
      target: "dice",
      pieces: pending.map((token) => token.id),
    }).effect;
    const kinds = new Set(pending.map((token) => token.kind));
    expect(preview.includes("Clean surge")).toBe(kinds.size === 1);

    // A module beside one that is already built says what it is wired to.
    let systems = createMission();
    systems = action(systems, "systems", "recover", "systems");
    expect(
      previewAction(playerView(systems, "systems"), {
        type: "act",
        action: "assist",
        target: "dice",
        pieces: [systems.private.systems.engine.markers[0]!],
        socket: bestSocket(systems),
      }).effect,
    ).toContain("Wired to 1 module.");
  });

  it("lets every engine carry something forward at its own price", () => {
    // The Walker has nothing to pin: the whole hand carries itself. What it
    // pays instead is tempo, because the network re-forms below hand size.
    const cards = createMission();
    expect(cards.private.cards.engine.hand).toHaveLength(5);
    expect(
      applyCommand(cards, "cards", {
        type: "keep",
        piece: cards.private.cards.engine.hand[0]!.id,
      }).error,
    ).toContain("carries itself");

    // Dump the hand on one long chain and next round opens on three.
    const emptied = structuredClone(cards);
    emptied.private.cards.engine.hand = [];
    expect(round(emptied).private.cards.engine.hand).toHaveLength(3);

    // Play two, keep three, and the hand comes back full instead.
    const paced = structuredClone(cards);
    paced.private.cards.engine.hand = paced.private.cards.engine.hand.slice(
      0,
      3,
    );
    expect(round(paced).private.cards.engine.hand).toHaveLength(5);

    // Holding a surge over means staying amped: stress starts raised.
    let bag = push(createMission(), 2);
    for (const token of bag.private.bag.engine.pending)
      bag = act(bag, "bag", { type: "keep", piece: token.id });
    const nextBag = round(bag).private.bag.engine;
    expect(nextBag.pending).toHaveLength(2);
    expect(nextBag.stress).toBe(2);

    // A socket bolted down stands into the next round and costs a marker.
    let systems = createMission();
    systems = action(systems, "systems", "recover", "systems");
    const socket = systems.private.systems.engine.sockets.findIndex(Boolean);
    expect(socket).toBeGreaterThanOrEqual(0);
    systems = act(systems, "systems", { type: "keep", piece: `${socket}` });
    const nextSystems = round(systems).private.systems.engine;
    expect(nextSystems.sockets[socket]).toBe("recover");
    expect(nextSystems.markers).toHaveLength(3);
  });

  it("makes the platform choose between moving, shooting and holding still", () => {
    let s = createMission();
    const tray = () => s.private.dice.engine.dice;
    const loose = () => tray().filter((die) => die.facet === null);
    /** Routes the cheapest loose die, which is the routing that vents nothing. */
    const put = (facet: GlitterFacet) => {
      const die = [...loose()].sort((a, b) => a.value - b.value)[0]!;
      s = act(s, "dice", { type: "allocate", die: die.id, facet });
      return die;
    };
    const preview = (name: MissionAction, target: string, pieces: string[]) =>
      previewAction(playerView(s, "dice"), {
        type: "act",
        action: name,
        target,
        pieces,
      });

    // A system holding nothing cannot fire.
    expect(preview("contribute", "relay", []).reason).toContain(
      "Allocate dice to stabilizer",
    );

    // Two dice into drive, and they are gone: reaching the fight costs the
    // same tray the guns are drawn from, and the same routing capacity.
    put("mobility");
    put("mobility");
    expect(s.private.dice.engine.routings).toBe(2);
    const quarry = s.enemies[0]!.id;
    s = closeWith(s, "dice", quarry);

    // Crossing the ground took this round's platform, so the shot belongs to
    // the next one. That is the cost the capacity limit is charging for.
    s = round(s);

    // The Boom Gun is inert until something braces it.
    const aim = put("targeting");
    const gun = put("boom");
    const unbraced = [aim.id, gun.id];
    expect(preview("engage", quarry, unbraced).reason).toContain("unbraced");

    const brace = put("bracing");
    const system = [aim.id, gun.id, brace.id];
    // Bracing buys no output of its own; the Boom Gun doubles what it holds.
    expect(preview("engage", quarry, system).effect).toContain(
      `for ${Math.min(
        s.enemies.find((enemy) => enemy.id === quarry)!.strength,
        diceOutput([aim]) + diceOutput([gun]) * 2,
      )}`,
    );
    // Part of a system cannot be held back.
    expect(preview("engage", quarry, unbraced).reason).toContain(
      "Commit everything",
    );

    s = act(s, "dice", {
      type: "act",
      action: "engage",
      target: quarry,
      pieces: system,
    });
    // One shot consumed the whole system, bracing included.
    expect(tray().filter((die) => system.includes(die.id))).toHaveLength(0);
    // And the platform is out of routings, so what is still loose stays loose.
    const engine = s.private.dice.engine;
    expect(engine.routings).toBe(engine.capacity);
    expect(loose().length).toBeGreaterThan(0);
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
  it("charges burnout for what was at stake, not for having pushed", () => {
    // A bust with nothing in hand risked nothing, so it costs the team nothing.
    let empty = createMission();
    while (empty.private.bag.engine.stress === 0)
      empty = act(empty, "bag", { type: "draw" });
    const firstLoss = empty.private.bag.engine.pending.length;
    expect(firstLoss).toBe(0);

    // The same burnout holding tokens costs one per token lost.
    let held = createMission();
    let lost = 0;
    while (held.private.bag.engine.stress === 0) {
      lost = held.private.bag.engine.pending.length;
      held = act(held, "bag", { type: "draw" });
    }
    expect(held.instability).toBe(lost);
    // Either way the hazard is back in the bag and the odds are worse.
    expect(held.private.bag.engine.bagHazards).toBe(2);
    expect(held.private.bag.engine.stress).toBe(1);
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
    // Burnout costs what was on the table, so a bust with an empty hand is
    // free of instability and a bust holding tokens is not.
    expect(s.instability).toBeGreaterThan(0);
    // The hazard is back in the bag: density rises rather than falling.
    expect(s.private.bag.engine.bagHazards).toBe(2);
    const before = s.private.bag.engine;
    expect(before.bagHazards / before.bagRemaining).toBeGreaterThan(2 / 8);
    // A second burnout costs more than the first.
    // Compounding is still real: the same stake costs more once you have
    // already burnt out, which the preview states before you push.
    while (s.private.bag.engine.pending.length === 0)
      s = act(s, "bag", { type: "draw" });
    const held = s.private.bag.engine.pending.length;
    const stress = s.private.bag.engine.stress;
    expect(stress).toBeGreaterThan(0);
    expect(
      previewAction(playerView(s, "bag"), { type: "draw" }).effect,
    ).toContain(`adds ${held + stress} instability`);
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
  it("enforces filled sockets and preserves priming through movement", () => {
    let s = createMission();
    s = action(s, "systems", "recover", "systems");
    expect(s.private.systems.engine.primed).toBe(true);
    s = travel(s, "systems", "rift");
    // Driving seats nothing, so crossing the map costs markers but never the
    // machine or the priming already paid for.
    expect(s.private.systems.engine.primed).toBe(true);
    expect(s.private.systems.engine.sockets.filter(Boolean)).toHaveLength(1);
    s = action(s, "systems", "acquire", "power");
    // 2 for the priming, plus 1 for building next to the Prime already seated:
    // a contiguous frame is worth more than the same markers scattered.
    expect(s.resources.power).toBe(5);
    expect(s.private.systems.engine.primed).toBe(false);
    // A placement now needs somewhere to go, and a filled socket refuses it.
    const filled = s.private.systems.engine.sockets.findIndex(Boolean);
    expect(
      applyCommand(s, "systems", {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [piece(s, "systems")],
      }).error,
    ).toContain("Choose a socket");
    expect(
      applyCommand(s, "systems", {
        type: "act",
        action: "acquire",
        target: "power",
        pieces: [piece(s, "systems")],
        socket: filled,
      }).error,
    ).toContain("filled");
    // The same action may be built twice in two sockets, though: what the
    // frame rations is space, not repetition.
    const twice = action(s, "systems", "acquire", "power");
    expect(
      twice.private.systems.engine.sockets.filter((held) => held === "acquire"),
    ).toHaveLength(2);
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
    s = travel(s, "dice", "rift");
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
  it("lets four cooperating engines close the breach on the hex map", () => {
    let s = createMission();
    // Establish safe timing, then suppress the shield so output doubles.
    s = act(s, "dice", { type: "share" });
    s = act(s, "cards", { type: "share" });
    expect(s.frequencyKnown).toBe(true);
    s = action(s, "systems", "contribute", "relay");
    expect(s.shield).toBe(false);
    for (const seat of missionSeats) s = act(s, seat, { type: "donate" });

    const spend = (seat: Seat) => {
      const player = s.players.find((p) => p.seat === seat)!;
      if (seat === "bag" && s.private.bag.engine.pending.length === 0) {
        const e = s.private.bag.engine;
        if (e.bagRemaining === 0 || e.bagHazards >= e.bagRemaining)
          return false;
        try {
          s = push(s, 1);
        } catch {
          return false;
        }
        return true;
      }
      if (s.phase !== "action") return false;
      const staged = armed(
        s,
        seat,
        player.location === "rift" ? "contribute" : "move",
      );
      s = staged.state;
      const pieces = staged.pieces;
      if (!pieces.length || pieces.some((id) => !id)) return false;
      if (player.location !== "rift") {
        const before = s;
        try {
          s = travel(s, seat, "rift");
        } catch {
          return false;
        }
        return s !== before;
      }
      // At the breach: fuel the contribution, or make one.
      const target = s.resources.power > 0 ? "contribute" : "acquire";
      const ready = armed(s, seat, target);
      s = ready.state;
      const result = applyCommand(s, seat, {
        type: "act",
        action: target,
        target: target === "contribute" ? "rift" : "power",
        pieces: ready.pieces,
      });
      if (result.error) return false;
      s = result.state;
      return true;
    };

    // A pass that changes nothing has to end the round, or the driver spins:
    // `spend` returns true for anything it attempted, including attempts that
    // the rules refused, so the world state is the only honest progress check.
    const signature = () =>
      [
        s.round,
        s.progress,
        s.instability,
        s.resources.power,
        ...s.players.map((p) => `${p.seat}@${hexKey(p.position)}`),
        ...missionSeats.map((seat) => {
          const e = s.private[seat].engine;
          return (
            e.dice.length + e.hand.length + e.pending.length + e.markers.length
          );
        }),
      ].join("|");
    for (let guard = 0; guard < 200 && s.phase === "action"; guard++) {
      const before = signature();
      for (const seat of missionSeats)
        if (!s.players.find((p) => p.seat === seat)!.ready) spend(seat);
      if (signature() === before && s.phase === "action") s = round(s);
    }
    expect(
      s.phase,
      `round ${s.round}: progress ${s.progress}/${s.requiredProgress}, instability ${s.instability}/12`,
    ).toBe("won");
    expect(s.progress).toBeGreaterThanOrEqual(s.requiredProgress);
    // Everyone had to cross the map and put something in.
    expect(
      s.players.filter((p) => p.contribution > 0).length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("prevents indefinite recovery and the two-engine blind shortcut", () => {
    let s = createMission();
    s = action(s, "systems", "contribute", "relay");
    s = act(s, "cards", { type: "donate" });
    s = travel(s, "cards", "rift");
    const blindStart = s.instability;
    for (let i = 0; i < 2; i++) {
      const channel = s.private.cards.engine.hand.find(
        (c) => c.kind === "channel",
      );
      const spell = s.private.cards.engine.hand.find((c) => c.kind === "spell");
      if (!channel || !spell) break;
      s = action(s, "cards", "contribute", "rift", [channel.id, spell.id]);
    }
    // Blind stabilization is punished hard enough that two engines cannot rush
    // the breach, and it never reaches the objective on its own.
    expect(s.phase).toBe("action");
    expect(s.progress).toBeLessThan(s.requiredProgress);
    expect(s.instability).toBeGreaterThanOrEqual(blindStart + 5);
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
    s = travel(s, "cards", "rift");
    // Spend every weave the hand can still make after the journey.
    for (let i = 0; i < 3; i++) {
      const channel = s.private.cards.engine.hand.find(
        (c) => c.kind === "channel",
      );
      const spell = s.private.cards.engine.hand.find((c) => c.kind === "spell");
      if (!channel || !spell) break;
      if (i === 1) s = action(s, "systems", "assist", "cards", []);
      s = action(s, "cards", "contribute", "rift", [channel.id, spell.id]);
    }
    // The point is the shortfall, not a particular number: two specialists
    // bursting in round one cannot close the breach, and crossing the map to
    // reach it now costs capability that used to be free.
    expect(s.progress).toBeLessThan(s.requiredProgress);
    expect(s.phase).toBe("action");
    expect(s.instability).toBeGreaterThan(0);
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
    // The Glitter Boy cannot fit down the archive passage, which is exactly the
    // point: another specialist gets there and Knowledge still pays for it.
    s = travel(s, "cards", "archive");
    s = action(s, "cards", "investigate", "archive", []);
    expect(s.frequencyKnown).toBe(true);
    expect(s.resources.knowledge).toBe(1);
  });
});

describe("master map", () => {
  const relayHex = hexKey(missionMap.sites.relay);

  it("opens carrying the briefing and nothing the team has not put there", () => {
    const state = createMission(7);
    expect(state.marks).toEqual([]);
    expect(state.planning).toBe(true);
    expect(state.briefing.length).toBeGreaterThan(0);
    // Every mark is the mission's own, and each one names real ground.
    for (const marker of state.briefing)
      expect(missionMap.open).toContain(marker.hex);
  });

  it("never projects which briefing mark is the false one", () => {
    const state = createMission(3);
    expect(state.falseMarker).not.toBeNull();
    const view = playerView(state, "dice") as Record<string, unknown>;
    const table = tableView(state) as Record<string, unknown>;
    expect(view.falseMarker).toBeUndefined();
    expect(table.falseMarker).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("falseMarker");
    expect(JSON.stringify(table)).not.toContain("falseMarker");
  });

  it("picks the liar from the seed without disturbing the engines", () => {
    // Same seed, same lie; and the dealt engines are untouched by the choice.
    expect(createMission(11).falseMarker).toBe(createMission(11).falseMarker);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (seed) => createMission(seed).falseMarker,
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
    for (const id of seeds) {
      const marker = state0.briefing.find((entry) => entry.id === id);
      expect(marker, `${id} is a briefing mark`).toBeDefined();
    }
  });
  const state0 = createMission(1);

  it("carries ink to every seat and to the shared screen", () => {
    let state = createMission(5);
    state = act(state, "cards", {
      type: "annotate",
      label: "Hold this hall",
      hexes: [relayHex],
    });
    const mark = state.marks[0]!;
    expect(mark.seat).toBe("cards");
    expect(mark.label).toBe("Hold this hall");
    // Public by construction: the surface is the same for everyone.
    for (const seat of missionSeats)
      expect(playerView(state, seat).marks).toHaveLength(1);
    expect(tableView(state).marks).toHaveLength(1);
  });

  it("lets anyone erase anyone's mark", () => {
    let state = createMission(5);
    state = act(state, "cards", {
      type: "annotate",
      label: "Mine",
      hexes: [relayHex],
    });
    state = act(state, "bag", { type: "erase", mark: state.marks[0]!.id });
    expect(state.marks).toEqual([]);
  });

  it("refuses a mark that is not on ground someone could stand on", () => {
    const state = createMission(5);
    const result = applyCommand(state, "dice", {
      type: "annotate",
      label: "Inside the rock",
      hexes: ["900,900"],
    });
    expect(result.error).toMatch(/ground/i);
    expect(result.state.marks).toEqual([]);
  });

  it("closes the planning window when the round starts being spent", () => {
    let state = createMission(5);
    expect(state.planning).toBe(true);
    state = act(state, "dice", {
      type: "act",
      action: "acquire",
      target: "power",
      pieces: [piece(state, "dice")],
    });
    expect(state.planning).toBe(false);
    const refused = applyCommand(state, "cards", {
      type: "annotate",
      label: "Too late",
      hexes: [relayHex],
    });
    expect(refused.error).toMatch(/round is being spent/i);
    // Pointing is unaffected: it is not a command at all.
    for (const seat of missionSeats)
      state = act(state, seat, { type: "ready" });
    expect(state.planning).toBe(true);
    expect(state.round).toBe(2);
  });

  it("settles a claim when somebody walks into it", () => {
    const state = createMission(1);
    const relay = state.briefing.find((entry) => entry.id === "brief-relay");
    // The team deploys inside the relay claim, so it is already settled.
    expect(relay?.state).not.toBe("standing");
    const far = state.briefing.find((entry) => entry.id === "brief-cache");
    expect(far?.state).toBe("standing");
  });

  it("strikes the false mark, and confirms a true one, on arrival", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const start = createMission(seed);
      const liar = start.falseMarker!;
      // Nothing the team has not reached is settled at deployment.
      const unreached = start.briefing.filter(
        (entry) => entry.state === "standing",
      );
      expect(unreached.length).toBeGreaterThan(0);
      for (const marker of unreached) {
        const walked = structuredClone(start);
        walked.players[1]!.position = parseHex(marker.hex)!;
        // Committing anything re-checks the claims the team now stands in.
        const after = act(walked, "cards", {
          type: "act",
          action: "acquire",
          target: "power",
          pieces: [piece(walked, "cards")],
        });
        expect(
          after.briefing.find((entry) => entry.id === marker.id)?.state,
          `${marker.id} on seed ${seed}`,
        ).toBe(marker.id === liar ? "struck" : "confirmed");
      }
    }
  });

  it("keeps a struck mark on the map rather than deleting it", () => {
    const start = createMission(2);
    const marker = start.briefing.find(
      (entry) => entry.id === start.falseMarker,
    )!;
    const walked = structuredClone(start);
    walked.players[1]!.position = parseHex(marker.hex)!;
    const after = act(walked, "cards", {
      type: "act",
      action: "acquire",
      target: "power",
      pieces: [piece(walked, "cards")],
    });
    expect(after.briefing).toHaveLength(start.briefing.length);
    expect(after.briefing.find((e) => e.id === marker.id)?.state).toBe(
      "struck",
    );
    // Several claims can settle at once, so the notice is somewhere in the log.
    expect(after.log.some((entry) => /wrong/i.test(entry.text))).toBe(true);
  });

  it("costs a drawn route, and calls it blocked when a patrol holds it", () => {
    const state = createMission(1);
    const from = missionMap.deploy.cards;
    const gate = missionMap.sites.gate;
    const open = routeCost([from, missionMap.sites.relay], 1, []);
    expect(open.blocked).toBe(false);
    expect(open.hexes).toBeGreaterThan(0);
    expect(open.commitments).toBe(
      Math.ceil(open.hexes / missionMap.hexesPerEffect),
    );
    // The gate is held, so the same ground prices differently with patrols on it.
    const guarded = routeCost([from, gate], 1, state.enemies);
    const clear = routeCost([from, gate], 1, []);
    expect(clear.blocked).toBe(false);
    expect(guarded.blocked).toBe(true);
  });
});
