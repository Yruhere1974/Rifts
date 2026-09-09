import { missionMap, playableMission, specialistFor } from "@rifts/content";
import {
  footprint,
  hexDistance,
  hexKey,
  hexesWithin,
  parseHex,
  type EngineFamily,
  type Hex,
} from "@rifts/shared";
/**
 * A seat is an engine family, not a class. Classes are authored content and
 * never appear in this module; see docs/product/class-lineup.md.
 */
export type Seat = EngineFamily;
export const missionSeats: readonly Seat[] = [
  "dice",
  "cards",
  "bag",
  "systems",
];
export const missionRoundLimit = playableMission.roundLimit;
export const worldPressure = (round: number, threat: number): number =>
  1 + (threat > 0 ? 1 : 0) + Math.floor((round - 1) / 2);
/**
 * Every engine grows on the same clock the world escalates on, so a long
 * mission means stronger specialists rather than only a heavier world.
 */
export const engineTier = (round: number): number =>
  Math.floor((round - 1) / 2);
export type MissionLocation = "gate" | "relay" | "archive" | "rift";
export type MissionAction =
  | "move"
  | "engage"
  | "investigate"
  | "contribute"
  | "acquire"
  | "assist"
  | "recover";
/**
 * The Glitter Boy's platform systems. Six of them and five dice, so the pilot
 * is always choosing what the machine is not doing this round.
 */
export const glitterFacets = [
  "mobility",
  "bracing",
  "targeting",
  "boom",
  "stabilizer",
  "shield",
] as const;
export type GlitterFacet = (typeof glitterFacets)[number];
/**
 * Where a die sits: loose in the tray, committed to a system, or locked. A
 * locked die does nothing this round and survives the refill with its face,
 * which is how a partial combination is carried forward. The cost is built in:
 * a die you lock is a die you did not spend.
 */
export type DieSlot = GlitterFacet | "locked" | null;
/** Which facet each verb draws on. The rest are pilot work, not platform work. */
export const facetForAction: Partial<Record<MissionAction, GlitterFacet>> = {
  move: "mobility",
  engage: "targeting",
  contribute: "stabilizer",
  recover: "shield",
};
export type MissionCommand =
  | { type: "share"; target?: MissionLocation | undefined }
  | { type: "allocate"; die: string; facet: DieSlot }
  /**
   * Hold one piece back from this round so it survives the refill. Every
   * engine pays the same way: what is kept is what was not spent, and it
   * counts against next round's supply rather than adding to it.
   */
  | { type: "keep"; piece: string }
  | { type: "act"; action: MissionAction; target: string; pieces: string[] }
  | { type: "request"; target: string }
  | {
      type: "draw" | "hold" | "ready" | "upgrade" | "donate";
    };
export type MissionResources = {
  materiel: number;
  power: number;
  knowledge: number;
  influence: number;
};
export type MissionPlayer = {
  seat: Seat;
  name: string;
  /** Anchor hex. The unit covers every hex within `size` of it. */
  position: Hex;
  /** Footprint radius: 0 small, 1 standard, 2 large. */
  size: number;
  /** Derived from position: the site this unit is standing in, if any. */
  location: MissionLocation | null;
  holding: boolean;
  ready: boolean;
  upgraded: boolean;
  contribution: number;
};
export type MissionIntel = {
  status: "character-specific" | "known" | "uncertain" | "inferred";
  text: string;
};
export type MissionCard = {
  id: string;
  name: string;
  description: string;
  kind: string;
  /** Held back from this round to survive the refill. */
  kept?: boolean;
};
export type MissionToken = { id: string; kind: string; kept?: boolean };
export type MissionEngine = {
  /** `facet` is null while a die is still loose in the tray. */
  dice: { id: string; value: number; facet: DieSlot }[];
  hand: MissionCard[];
  /** Safe tokens from the current push. A hazard clears them; it never joins. */
  pending: MissionToken[];
  bagRemaining: number;
  bagHazards: number;
  /** Hazards drawn this round. Never falls until the round refill. */
  stress: number;
  markers: string[];
  /** Occupied modules; "primed" indicates enhanced next placement. */
  slots: string[];
  /** Modules left standing into the next round, at the cost of a marker. */
  keptSlots: string[];
};
/** A placed enemy. Everyone can see it: it is standing on the board. */
export type MissionEnemy = {
  id: string;
  name: string;
  position: Hex;
  strength: number;
  speed: number;
};
export type MissionPublicState = {
  round: number;
  phase: "action" | "won" | "lost";
  instability: number;
  resources: MissionResources;
  progress: number;
  requiredProgress: number;
  shield: boolean;
  frequencyKnown: boolean;
  /** Total strength still standing. Derived from `enemies`, kept for displays. */
  threat: number;
  enemies: MissionEnemy[];
  boosts: Record<Seat, number>;
  log: { id: number; text: string }[];
  players: MissionPlayer[];
  requests: { seat: Seat; target: string }[];
  reports: { seat: Seat; location: MissionLocation; text: string }[];
  discoveries: { flankUsed: boolean; cacheUsed: boolean };
};
export type MissionView = MissionPublicState & {
  seat: Seat;
  engine: MissionEngine;
  intel: MissionIntel[];
  objective: string;
  artifact: boolean;
  perceptions: {
    location: MissionLocation;
    status: MissionIntel["status"];
    text: string;
  }[];
};
/**
 * What a shared screen may show. Counts and occupied modules are things
 * everyone could see across a physical table; identities and values are not.
 */
export type MissionKitSummary = {
  seat: Seat;
  dice: number;
  hand: number;
  surge: number;
  stress: number;
  bagRemaining: number;
  bagHazards: number;
  markers: number;
  slots: string[];
};
/** Public projection for a spectating table screen. Carries no private state. */
export type MissionTableView = MissionPublicState & {
  kits: MissionKitSummary[];
};
export type MissionPrivateState = {
  engine: MissionEngine;
  bag: MissionToken[];
  intel: MissionIntel[];
  objective: string;
  artifact: boolean;
};
/** Authoritative state only. Send playerView(), never this object, to clients. */
export type MissionState = MissionPublicState & {
  random: number;
  private: Record<Seat, MissionPrivateState>;
};
export type MissionPreview = {
  allowed: boolean;
  cost: string;
  effect: string;
  reason: string;
  /** Hexes this commitment could move, for a Move preview. Zero otherwise. */
  range: number;
};
/** Normalized output of any engine; contains no private piece identities. */
export type MissionActionEvent = {
  discovery: "flank" | "cache" | null;
  type: MissionAction;
  seat: Seat;
  target: string;
  amount: number;
  knowledgeCost: number;
  reserveCost: "materiel" | "influence" | null;
};
type ActionPlan = MissionPreview & { event: MissionActionEvent | null };
const locations: readonly string[] = ["gate", "relay", "archive", "rift"];
const locationNames: Record<MissionLocation, string> = {
  gate: "the West gate",
  relay: "the relay",
  archive: "the archive",
  rift: "the breach",
};
const resourceNames: readonly string[] = [
  "materiel",
  "power",
  "knowledge",
  "influence",
];
const actions: readonly string[] = [
  "move",
  "engage",
  "investigate",
  "contribute",
  "acquire",
  "assist",
  "recover",
];
const perceptions: Record<
  Seat,
  Record<MissionLocation, { status: MissionIntel["status"]; text: string }>
> = {
  dice: {
    gate: {
      status: "known",
      text: "The patrol's armored leader has an exposed rear coupling. I need a sighting of its approach route before anyone can exploit it.",
    },
    relay: {
      status: "inferred",
      text: "The relay's field appears to protect the breach, not the settlement. Technical confirmation could explain why.",
    },
    archive: {
      status: "uncertain",
      text: "A reinforced storage hatch survived the collapse. I cannot tell whether its contents are useful or dangerous.",
    },
    rift: {
      status: "character-specific",
      text: "My targeting recorder identifies the pulse onset. Ley Line Walker's resonance reading can supply the missing safe interval.",
    },
  },
  cards: {
    gate: {
      status: "uncertain",
      text: "The patrol carries no strong dimensional signature. My senses cannot distinguish its armor from its weapons.",
    },
    relay: {
      status: "known",
      text: "The shield is being sustained through this relay. Disrupting its field will make stabilization twice as effective.",
    },
    archive: {
      status: "inferred",
      text: "The archive's stored energy feels electrical, not dimensional. An intact source may remain beneath the rubble.",
    },
    rift: {
      status: "character-specific",
      text: "I can identify the quiet part of the resonance cycle, but not its starting point. Glitter Boy's targeting recorder can anchor it.",
    },
  },
  bag: {
    gate: {
      status: "known",
      text: "Tracks show the patrol turning through the west culvert with its rear exposed. A combat assessment could identify what to hit.",
    },
    relay: {
      status: "inferred",
      text: "All four approach paths reach the relay. Restoring it here may spare the team wasted work at the breach.",
    },
    archive: {
      status: "known",
      text: "I found an intact conduit leading to a buried storage hatch. Techno-Wizard's diagnostics could tell us whether it is safe to recover.",
    },
    rift: {
      status: "uncertain",
      text: "Dust settles briefly between pulses. I can see a lull, but cannot establish safe timing from tracks alone.",
    },
  },
  systems: {
    gate: {
      status: "inferred",
      text: "Patrol telemetry suggests vulnerable hardware, but I lack its orientation. Combat and route observations could expose a weakness.",
    },
    relay: {
      status: "known",
      text: "Restoring the relay consumes 2 Power and causes a 1-instability surge. Its shield cancellation remains active for the rest of the mission.",
    },
    archive: {
      status: "known",
      text: "Diagnostics detect two usable Power cells in an isolated circuit. Juicer must identify the surviving access conduit before recovery is safe.",
    },
    rift: {
      status: "known",
      text: "Each stabilization commitment consumes 1 shared Power. Shield suppression amplifies output but does not establish safe pulse timing.",
    },
  },
};
const openHexes = new Set(missionMap.open);
const unitSize = (seat: Seat): number => specialistFor(seat).size;

/** A unit may stand here only if its whole footprint is open rock-free floor. */
const footprintClear = (anchor: Hex, size: number): boolean =>
  footprint(anchor, size).every((cell) => openHexes.has(hexKey(cell)));

/** Units are solid: two footprints may never overlap. */
const overlaps = (
  anchor: Hex,
  size: number,
  others: readonly MissionPlayer[],
): boolean =>
  others.some(
    (other) => hexDistance(anchor, other.position) <= size + other.size,
  );

/** The site a unit of this size standing here counts as being at. */
/** Apparatus this unit is close enough to put its hands on. */
export function objectsBeside(
  anchor: Hex,
  size: number,
): (typeof missionMap.objects)[number][] {
  return missionMap.objects.filter(
    (object) => hexDistance(anchor, object.hex) <= size + 1,
  );
}

/**
 * The site a unit counts as working at. Being in the room is no longer enough:
 * you have to be beside something. Nearest wins, because a large unit can
 * reach apparatus belonging to two sites at once.
 */
export function siteAt(anchor: Hex, size: number): MissionLocation | null {
  let best: { site: MissionLocation; distance: number } | null = null;
  for (const object of objectsBeside(anchor, size)) {
    const distance = hexDistance(anchor, object.hex);
    if (!best || distance < best.distance)
      best = { site: object.site, distance };
  }
  return best?.site ?? null;
}

/**
 * Anchors reachable within `steps`, walking one hex at a time.
 *
 * Allies squeeze past one another; rock and the opposition do not give way. A
 * unit may not walk onto a patrol, and stepping into the reach of one ends the
 * move there: you can close with something, but you cannot stroll past it.
 * That is what lets a body hold a corridor.
 */
export function reachable(
  from: Hex,
  size: number,
  steps: number,
  enemies: readonly MissionEnemy[] = [],
): Map<string, number> {
  const blocked = (hex: Hex) =>
    enemies.some((enemy) => hexDistance(hex, enemy.position) <= size);
  const held = (hex: Hex) =>
    enemies.some((enemy) => hexDistance(hex, enemy.position) <= size + 1);
  const seen = new Map<string, number>([[hexKey(from), 0]]);
  let frontier: Hex[] = [from];
  for (let step = 1; step <= steps; step++) {
    const next: Hex[] = [];
    for (const here of frontier) {
      for (const candidate of hexesWithin(here, 1)) {
        const key = hexKey(candidate);
        if (seen.has(key)) continue;
        if (!footprintClear(candidate, size)) continue;
        if (blocked(candidate)) continue;
        seen.set(key, step);
        // Reached, but not walked through: a patrol's reach stops you.
        if (!held(candidate)) next.push(candidate);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return seen;
}

/**
 * A weave alternates Channel and Resonance; Exploit Opening can stand in for
 * either, which is its second use and a real decision against holding it back
 * as a reaction. Any single card is a weave of one.
 */
export function weaves(cards: readonly { kind: string }[]): boolean {
  if (!cards.length) return false;
  if (cards.length === 1) return true;
  const link = (kind: string) => (kind === "reaction" ? null : kind);
  // A wildcard takes whichever side keeps the chain alternating, so the chain
  // is valid if some assignment of the fixed cards alternates.
  const fixed = cards.map((card) => link(card.kind));
  for (const start of ["channel", "spell"]) {
    let want = start;
    if (
      fixed.every((kind) => {
        const ok = kind === null || kind === want;
        want = want === "channel" ? "spell" : "channel";
        return ok;
      })
    )
      return true;
  }
  return false;
}

/**
 * Chains pay superlinearly, so length is the skill: one card is 1, two are 3
 * as they always were, three are 6 and four are 10. The old hardcoded pair
 * falls out of the same formula rather than sitting beside it.
 */
export const weaveOutput = (length: number): number =>
  (length * (length + 1)) / 2;

/**
 * What a surge is worth. Size still counts, but composition is the read: a
 * pull of one kind is clean and pays its own size again, and a pull holding
 * all three safe kinds is a full spread and doubles. So a Juicer sometimes
 * pushes for the missing kind rather than for another token.
 */
export function surgeOutput(tokens: readonly { kind: string }[]): number {
  const base = tokens.reduce(
    (sum, token) => sum + (token.kind === "jackpot" ? 2 : 1),
    0,
  );
  if (tokens.length < 2) return base;
  const kinds = new Set(tokens.map((token) => token.kind));
  if (kinds.size === 1) return base + tokens.length;
  return ["find", "cache", "signal"].every((kind) => kinds.has(kind))
    ? base * 2
    : base;
}

/**
 * Modules sit in a fixed row, and a placement is worth more when it is wired
 * to what is already built beside it. Building a contiguous machine therefore
 * beats scattering markers across the board.
 */
export function wiring(
  slots: readonly string[],
  action: MissionAction,
): number {
  const index = moduleRow.indexOf(action);
  if (index < 0) return 0;
  return [moduleRow[index - 1], moduleRow[index + 1]].filter(
    (neighbour) => neighbour && slots.includes(neighbour),
  ).length;
}

/** The order modules are wired in, which is the order the console draws them. */
export const moduleRow: readonly MissionAction[] = [
  "move",
  "engage",
  "investigate",
  "contribute",
  "acquire",
  "assist",
  "recover",
];

/**
 * How well a system is calibrated. Matched faces lock it on and double its
 * output; consecutive faces spin it up and add the length of the run. Junk
 * still fires, just for what the dice are individually worth, so reading a
 * roll well pays without a bad roll shutting the platform down.
 */
export function coherence(dice: readonly { value: number }[]): {
  label: string | null;
  apply: (base: number) => number;
} {
  if (dice.length < 2) return { label: null, apply: (base) => base };
  const faces = dice.map((die) => die.value).sort((a, b) => a - b);
  if (faces.every((face) => face === faces[0]))
    return { label: "locked on", apply: (base) => base * 2 };
  const run =
    new Set(faces).size === faces.length &&
    faces.every((face, index) => index === 0 || face === faces[index - 1]! + 1);
  if (run && faces.length >= 3)
    return { label: "spun up", apply: (base) => base + faces.length };
  return { label: null, apply: (base) => base };
}

/**
 * How the committed pieces fit together, phrased in the engine's own terms.
 * Every seat is paid for combination now, so the preview names the fit it
 * found rather than leaving the player to infer it from a larger number. The
 * console shows the same phrase live while pieces are still being chosen.
 */
export function combination(
  seat: Seat,
  engine: MissionEngine,
  action: MissionAction,
  pieces: readonly string[],
): string | null {
  if (seat === "dice") {
    const facet = facetForAction[action];
    if (!facet) return null;
    const label = coherence(facetDice(engine, facet)).label;
    return label ? `System ${label}.` : null;
  }
  if (seat === "cards") {
    const chain = engine.hand.filter((card) => pieces.includes(card.id));
    if (chain.length < 2 || !weaves(chain)) return null;
    return `Weave of ${chain.length}.`;
  }
  if (seat === "bag") {
    const tokens = engine.pending;
    if (tokens.length < 2) return null;
    const kinds = new Set(tokens.map((token) => token.kind));
    if (kinds.size === 1) return `Clean surge: all ${[...kinds][0]}.`;
    return ["find", "cache", "signal"].every((kind) => kinds.has(kind))
      ? "Full spread."
      : null;
  }
  const wired = wiring(engine.slots, action);
  return wired ? `Wired to ${wired} module${wired === 1 ? "" : "s"}.` : null;
}

/** A system's total: what its dice are worth, then how well they fit together. */
export const systemOutput = (dice: readonly { value: number }[]): number =>
  coherence(dice).apply(diceOutput(dice));

/** What a group of dice is worth: a 4+ die counts double, as it always has. */
export const diceOutput = (dice: readonly { value: number }[]): number =>
  dice.reduce((sum, die) => sum + (die.value >= 4 ? 2 : 1), 0);

/** The dice committed to one platform system. */
export const facetDice = (
  engine: MissionEngine,
  facet: DieSlot,
): MissionEngine["dice"] => engine.dice.filter((die) => die.facet === facet);

export function hasReports(
  view: Pick<MissionPublicState, "reports">,
  location: MissionLocation,
  seats: readonly Seat[],
): boolean {
  return seats.every((seat) =>
    view.reports.some(
      (report) => report.seat === seat && report.location === location,
    ),
  );
}
const objectives: Record<Seat, string> = {
  dice: "Keep your core to install a sixth die. Donating it funds two team stabilization actions instead.",
  cards:
    "Keep your core to amplify every Channel combo. Donating it funds two team stabilization actions instead.",
  bag: "Keep your core to replace a hazard with a jackpot. Donating it funds two team stabilization actions instead.",
  systems:
    "Keep your core for a fifth placement marker. Donating it funds two team stabilization actions instead.",
};
function random(state: MissionState): number {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 4294967296;
}
function shuffle<T>(state: MissionState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    const a = items[i];
    const b = items[j];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[j] = a;
    }
  }
  return items;
}
function card(id: string, kind: string): MissionCard {
  return {
    id,
    kind,
    name:
      kind === "channel"
        ? "Channel"
        : kind === "reaction"
          ? "Exploit Opening"
          : "Resonance",
    description:
      kind === "channel"
        ? "Links to a Resonance on either side. Chains pay 1, 3, 6, 10."
        : kind === "reaction"
          ? "Wildcard: takes either side of a chain. Alone, assists for +2 once the relay is restored."
          : "Links to a Channel on either side. Chains pay 1, 3, 6, 10.",
  };
}
function refill(state: MissionState, seat: Seat): void {
  const p = state.private[seat];
  const upgraded =
    state.players.find((player) => player.seat === seat)?.upgraded ?? false;
  const prefix = `${seat}-${state.round}`;
  // Locked dice are the ones the pilot chose not to spend. They keep their
  // faces through the refill, and the tray is topped back up around them.
  // Every engine keeps the same way: what was held back survives the refill
  // and counts against the new supply rather than adding to it.
  const kept = p.engine.dice.filter((die) => die.facet === "locked");
  const keptCards = p.engine.hand.filter((card) => card.kept);
  const keptTokens = p.engine.pending.filter((token) => token.kept);
  const keptSlots = p.engine.keptSlots.filter((slot) =>
    p.engine.slots.includes(slot),
  );
  p.engine = {
    dice: [],
    hand: [],
    pending: [],
    bagRemaining: 0,
    bagHazards: 0,
    stress: 0,
    markers: [],
    slots: [],
    keptSlots: [],
  };
  const tier = engineTier(state.round);
  const bonus = tier + (upgraded ? 1 : 0);
  if (seat === "dice")
    p.engine.dice = [
      ...kept,
      ...Array.from(
        { length: Math.max(0, 5 + bonus - kept.length) },
        (_, i) => ({
          id: `${prefix}-die-${i}`,
          value: 1 + Math.floor(random(state) * 6),
          facet: null as DieSlot,
        }),
      ),
    ];
  if (seat === "cards") {
    const fresh = [
      "channel",
      "channel",
      "spell",
      "spell",
      "reaction",
      // Growth alternates Channel and Resonance so each tier adds a weave.
      ...(tier >= 1 ? ["channel"] : []),
      ...(tier >= 2 ? ["spell"] : []),
    ];
    p.engine.hand = [
      ...keptCards,
      ...shuffle(
        state,
        fresh
          .slice(0, Math.max(0, fresh.length - keptCards.length))
          .map((kind, i) => card(`${prefix}-card-${i}`, kind)),
      ),
    ];
  }
  if (seat === "bag") {
    p.bag = shuffle(
      state,
      [
        "find",
        "find",
        "cache",
        "cache",
        "signal",
        "signal",
        "hazard",
        ...(upgraded ? ["jackpot"] : ["hazard"]),
        // Later bags pay more without losing either hazard.
        ...Array.from({ length: tier }, () => "jackpot"),
      ].map((kind, i) => ({ id: `${prefix}-token-${i}`, kind })),
    );
    p.engine.bagRemaining = p.bag.length;
    p.engine.bagHazards = p.bag.filter((t) => t.kind === "hazard").length;
    // Holding the surge over means staying amped: the round starts closer to
    // burnout by one step for every token carried.
    p.engine.pending = keptTokens.map((token) => ({ ...token, kept: false }));
    p.engine.stress = keptTokens.length;
  }
  if (seat === "systems") {
    p.engine.slots = [...keptSlots];
    p.engine.keptSlots = [...keptSlots];
    p.engine.markers = Array.from(
      { length: Math.max(0, 4 + bonus - keptSlots.length) },
      (_, i) => `${prefix}-marker-${i}`,
    );
  }
}
export function createMission(seed = 1): MissionState {
  const empty = (seat: Seat): MissionPrivateState => ({
    engine: {
      dice: [],
      hand: [],
      pending: [],
      bagRemaining: 0,
      bagHazards: 0,
      stress: 0,
      markers: [],
      slots: [],
      keptSlots: [],
    },
    bag: [],
    intel: [
      {
        status: perceptions[seat].rift.status,
        text: perceptions[seat].rift.text,
      },
      {
        status: "uncertain",
        text: "The rift's safe timing requires corroboration.",
      },
    ],
    objective: objectives[seat],
    artifact: true,
  });
  const state: MissionState = {
    random: Number.isFinite(seed) ? seed >>> 0 : 1,
    round: 1,
    phase: "action",
    instability: 0,
    resources: { materiel: 2, power: 2, knowledge: 2, influence: 0 },
    progress: 0,
    requiredProgress: playableMission.requiredProgress,
    shield: true,
    frequencyKnown: false,
    threat: missionMap.enemies.reduce((sum, e) => sum + e.strength, 0),
    enemies: missionMap.enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      position: { ...enemy.hex },
      strength: enemy.strength,
      speed: enemy.speed,
    })),
    boosts: { dice: 0, cards: 0, bag: 0, systems: 0 },
    log: [
      {
        id: 1,
        text: "Team deployed at relay. Seal the rift before instability reaches 12.",
      },
    ],
    players: missionSeats.map((seat) => ({
      seat,
      name: specialistFor(seat).className,
      position: { ...missionMap.deploy[seat] },
      size: unitSize(seat),
      location: siteAt(missionMap.deploy[seat], unitSize(seat)),
      holding: false,
      ready: false,
      upgraded: false,
      contribution: 0,
    })),
    requests: [],
    reports: [],
    discoveries: { flankUsed: false, cacheUsed: false },
    private: {
      dice: empty("dice"),
      cards: empty("cards"),
      bag: empty("bag"),
      systems: empty("systems"),
    },
  };
  for (const seat of missionSeats) refill(state, seat);
  return state;
}
export function tableView(state: MissionState): MissionTableView {
  // Same allowlist discipline as playerView. Never spread state here: a shared
  // screen has no seat, so anything private that leaks in is visible to all.
  return structuredClone({
    round: state.round,
    phase: state.phase,
    instability: state.instability,
    resources: state.resources,
    progress: state.progress,
    requiredProgress: state.requiredProgress,
    shield: state.shield,
    frequencyKnown: state.frequencyKnown,
    threat: state.threat,
    enemies: state.enemies,
    boosts: state.boosts,
    log: state.log,
    players: state.players,
    requests: state.requests,
    reports: state.reports,
    discoveries: state.discoveries,
    kits: missionSeats.map((seat) => {
      const e = state.private[seat].engine;
      return {
        seat,
        dice: e.dice.length,
        hand: e.hand.length,
        surge: e.pending.length,
        stress: e.stress,
        bagRemaining: e.bagRemaining,
        bagHazards: e.bagHazards,
        markers: e.markers.length,
        slots: e.slots,
      };
    }),
  });
}
export function playerView(state: MissionState, seat: Seat): MissionView {
  if (!missionSeats.includes(seat)) throw new Error("Unknown seat.");
  // Explicit allowlist prevents new authoritative fields leaking into a view.
  const p = state.private[seat];
  return structuredClone({
    round: state.round,
    phase: state.phase,
    instability: state.instability,
    resources: state.resources,
    progress: state.progress,
    requiredProgress: state.requiredProgress,
    shield: state.shield,
    frequencyKnown: state.frequencyKnown,
    threat: state.threat,
    enemies: state.enemies,
    boosts: state.boosts,
    log: state.log,
    players: state.players,
    requests: state.requests,
    reports: state.reports,
    discoveries: state.discoveries,
    seat,
    engine: p.engine,
    intel: [
      ...p.intel.filter(
        (intel) => !state.frequencyKnown || intel.status !== "uncertain",
      ),
      ...(state.frequencyKnown
        ? [
            {
              status: "inferred" as const,
              text: "Safe rift timing confirmed. Stabilization no longer adds instability.",
            },
          ]
        : []),
    ],
    objective: p.objective,
    artifact: p.artifact,
    perceptions: Object.entries(perceptions[seat]).map(
      ([location, reading]) => ({
        location: location as MissionLocation,
        ...reading,
      }),
    ),
  });
}
function commandValid(value: unknown): value is MissionCommand {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  if (c.type === "act")
    return (
      Object.keys(c).length === 4 &&
      typeof c.action === "string" &&
      actions.includes(c.action) &&
      typeof c.target === "string" &&
      Array.isArray(c.pieces) &&
      c.pieces.every((p: unknown) => typeof p === "string")
    );
  if (c.type === "keep")
    return Object.keys(c).length === 2 && typeof c.piece === "string";
  if (c.type === "allocate")
    return (
      Object.keys(c).length === 3 &&
      typeof c.die === "string" &&
      (c.facet === null ||
        c.facet === "locked" ||
        (typeof c.facet === "string" &&
          (glitterFacets as readonly string[]).includes(c.facet)))
    );
  if (c.type === "request")
    return Object.keys(c).length === 2 && typeof c.target === "string";
  if (c.type === "share")
    return (
      Object.keys(c).every((key) => key === "type" || key === "target") &&
      (c.target === undefined ||
        (typeof c.target === "string" && locations.includes(c.target)))
    );
  return (
    Object.keys(c).length === 1 &&
    typeof c.type === "string" &&
    ["draw", "share", "hold", "ready", "upgrade", "donate"].includes(c.type)
  );
}
function plan(view: MissionView, command: MissionCommand): ActionPlan {
  let range = 0;
  const deny = (reason: string): ActionPlan => ({
    allowed: false,
    cost: "None",
    effect: "None",
    reason,
    range,
    event: null,
  });
  const allow = (
    cost: string,
    effect: string,
    event: MissionActionEvent | null = null,
  ): ActionPlan => ({ allowed: true, cost, effect, reason: "", range, event });
  if (!commandValid(command)) return deny("Malformed command.");
  if (view.phase !== "action") return deny("Mission has ended.");
  const player = view.players.find((p) => p.seat === view.seat);
  if (!player) return deny("Unknown seat.");
  if (player.ready && command.type !== "share" && command.type !== "request")
    return deny("Round finished. Your engine refreshes when all four finish.");
  const e = view.engine;
  if (command.type !== "act") {
    switch (command.type) {
      case "draw":
        return view.seat !== "bag"
          ? deny("Only the push-your-luck engine draws from a bag.")
          : e.bagRemaining === 0
            ? deny("Nothing left to push for until next round.")
            : allow(
                `One more token; ${e.bagHazards} of ${e.bagRemaining} would break the surge`,
                e.pending.length === 0
                  ? "Add a hidden token to this surge. Nothing is at stake yet, so a hazard costs no instability, but it returns to the bag and makes every later push worse."
                  : `Add a hidden token to this surge. A hazard loses all ${e.pending.length}, adds ${e.pending.length + e.stress} instability, and returns to the bag.`,
              );
      case "keep": {
        const holdable =
          view.seat === "cards"
            ? e.hand.some((card) => card.id === command.piece)
            : view.seat === "bag"
              ? e.pending.some((token) => token.id === command.piece)
              : view.seat === "systems"
                ? e.slots.includes(command.piece)
                : false;
        return !holdable
          ? deny("That is not something you can hold over.")
          : allow(
              "None",
              "Hold it back from this round so it survives the refill. What you keep counts against next round's supply rather than adding to it.",
            );
      }
      case "allocate":
        return view.seat !== "dice"
          ? deny("Only the dice platform allocates.")
          : !e.dice.some((die) => die.id === command.die)
            ? deny("That die is not in your tray.")
            : allow(
                "None",
                command.facet === "locked"
                  ? "Lock that die: it does nothing this round and keeps its face through the refill. You are buying a future combination with this round's capability."
                  : command.facet
                    ? `Commit that die to ${command.facet}. Allocation is free; the dice are spent when the system fires.`
                    : "Return that die to the tray.",
              );
      case "share":
        return view.reports.some(
          (r) =>
            r.seat === view.seat && r.location === (command.target ?? "rift"),
        )
          ? deny("Your report is already shared.")
          : allow(
              "None",
              "Publish this location's private assessment. Complementary reports can reveal a team opportunity.",
            );
      case "request":
        return !locations.includes(command.target) &&
          !resourceNames.includes(command.target) &&
          !missionSeats.some((s) => s === command.target)
          ? deny("Unknown request target.")
          : allow("None", "Replace your current assistance request.");
      case "hold":
        return player.holding
          ? deny("Already holding.")
          : allow(
              "None",
              "Preserve all remaining pieces and stay available to act.",
            );
      case "ready":
        return allow(
          "Forfeit unused pieces when all four are ready",
          "Finish this round; all four ready triggers world response and refill.",
        );
      case "upgrade":
        return !view.artifact || player.upgraded
          ? deny("No artifact available for an upgrade.")
          : allow(
              "Your artifact",
              {
                dice: "Gain a sixth die now and each round.",
                cards: "Channel combos now produce 4 effect instead of 3.",
                bag: "Replace a hazard with a jackpot now and in future bags.",
                systems: "Gain a fifth placement marker now and each round.",
              }[view.seat],
            );
      case "donate":
        return !view.artifact
          ? deny("No artifact available to donate.")
          : allow("Your artifact", "Add 2 shared power.");
    }
  }
  const { action, target, pieces } = command;
  if (new Set(pieces).size !== pieces.length)
    return deny("A piece cannot be spent twice.");
  if (action === "move") {
    if (!parseHex(target)) return deny("Choose a hex to move to.");
  } else if (action === "assist") {
    if (!missionSeats.some((s) => s === target) || target === view.seat)
      return deny("Choose another seat to assist.");
  } else if (action === "acquire") {
    if (!resourceNames.includes(target))
      return deny("Choose a shared resource.");
  } else if (action === "recover") {
    if (target !== view.seat && target !== player.location)
      return deny("Recover targets yourself or your current location.");
  } else {
    if (action === "engage") {
      const quarry = view.enemies.find((enemy) => enemy.id === target);
      if (!quarry) return deny("Choose something to engage.");
      if (hexDistance(player.position, quarry.position) > player.size + 1)
        return deny(`Too far from ${quarry.name}. Close with it first.`);
    } else if (target !== player.location)
      return deny("Move to the target first.");
    if (action === "investigate" && target !== "archive" && target !== "rift")
      return deny("Investigate the archive or rift.");
    if (action === "contribute" && target !== "relay" && target !== "rift")
      return deny("Contribute at relay or rift.");
    if (
      action === "contribute" &&
      target === "relay" &&
      (!view.shield || view.resources.power < 2)
    )
      return deny("Relay requires an active shield and 2 shared power.");
  }
  const reserveCost =
    pieces.length === 0 && action === "recover"
      ? "materiel"
      : pieces.length === 0 && action === "assist"
        ? "influence"
        : null;
  const fallback =
    (action === "investigate" || reserveCost !== null) && pieces.length === 0;
  let amount = 1;
  let cost = `${pieces.length} engine piece${pieces.length === 1 ? "" : "s"}`;
  if (fallback) {
    const resource = reserveCost ?? "knowledge";
    if (view.resources[resource] < 1)
      return deny(`Select engine components or spend 1 shared ${resource}.`);
    if (action === "investigate" && view.frequencyKnown)
      return deny(
        "The frequency is already known. Select components to gather Knowledge.",
      );
    cost = `1 shared ${resource}`;
  } else if (view.seat === "dice") {
    const facet = facetForAction[action];
    if (facet) {
      // A platform system fires with everything committed to it. Engaging also
      // fires the Boom Gun, which is only braced if a die is holding it steady.
      const committed = facetDice(e, facet);
      const boom = action === "engage" ? facetDice(e, "boom") : [];
      const brace = action === "engage" ? facetDice(e, "bracing") : [];
      const spent = [...committed, ...boom, ...brace];
      if (!spent.length)
        return deny(`Allocate dice to ${facet} before firing it.`);
      if (
        pieces.length !== spent.length ||
        !spent.every((die) => pieces.includes(die.id))
      )
        return deny(`Commit everything allocated to ${facet}.`);
      amount = systemOutput(committed);
      if (boom.length && !brace.length)
        return deny(
          "The Boom Gun cannot fire unbraced. Allocate a die to bracing, or take the Boom Gun dice off.",
        );
      amount += systemOutput(boom) * 2;
    } else {
      // Pilot work rather than platform work: one loose die, as before.
      const die = e.dice.find((d) => d.id === pieces[0] && d.facet === null);
      if (pieces.length !== 1 || !die)
        return deny("Select one die that is still loose in the tray.");
      const threshold = action === "assist" ? 3 : 1;
      if (die.value < threshold)
        return deny(`This action requires a die of ${threshold}+.`);
      amount = die.value >= 4 ? 2 : 1;
    }
  } else if (view.seat === "cards") {
    const selected = e.hand.filter((c) => pieces.includes(c.id));
    if (pieces.length < 1 || selected.length !== pieces.length)
      return deny("Select cards from your hand.");
    if (!weaves(selected))
      return deny(
        "A weave alternates Channel and Resonance. Exploit Opening can stand in for either.",
      );
    amount = weaveOutput(selected.length) + (player.upgraded ? 1 : 0);
    if (
      selected.length === 1 &&
      selected[0]?.kind === "reaction" &&
      action === "assist" &&
      !view.shield
    )
      amount = 2;
  } else if (view.seat === "bag") {
    // A surge is spent whole: the push sized itself when it was taken.
    if (e.pending.length === 0)
      return deny("Push for capability before committing an action.");
    if (
      pieces.length !== e.pending.length ||
      !e.pending.every((t) => pieces.includes(t.id))
    )
      return deny(
        "Commit the whole surge. Part of a push cannot be held back.",
      );
    amount = surgeOutput(e.pending);
  } else {
    if (pieces.length !== 1 || !e.markers.includes(pieces[0] ?? ""))
      return deny("Select one available placement marker.");
    if (action !== "move" && e.slots.includes(action))
      return deny("That action module is occupied until next round.");
    amount = (e.slots.includes("primed") ? 2 : 1) + wiring(e.slots, action);
  }
  const enhanced = action !== "move" && action !== "assist";
  let discovery: MissionActionEvent["discovery"] = null;
  if (
    action === "engage" &&
    !view.discoveries.flankUsed &&
    hasReports(view, "gate", ["dice", "bag"])
  ) {
    discovery = "flank";
    amount += 1;
  }
  if (
    action === "investigate" &&
    pieces.length > 0 &&
    !view.discoveries.cacheUsed &&
    hasReports(view, "archive", ["bag", "systems"]) &&
    target === "archive"
  )
    discovery = "cache";
  if (enhanced) amount += view.boosts[view.seat];
  let moveSteps = 0;
  let moveTarget = target;
  if (action === "move") {
    // Engine output buys distance: the map's scale converts effect to hexes.
    range = amount * missionMap.hexesPerEffect;
    const destination = parseHex(target)!;
    if (hexKey(destination) === hexKey(player.position))
      return deny("Choose a different hex.");
    if (!footprintClear(destination, player.size))
      return deny(
        player.size > 1
          ? "Too tight for a unit this size. A narrower unit could pass."
          : "That hex is solid rock.",
      );
    const others = view.players.filter((entry) => entry.seat !== view.seat);
    const routes = reachable(player.position, player.size, range, view.enemies);
    const free = (hex: Hex) => !overlaps(hex, player.size, others);
    const direct = routes.get(hexKey(destination));
    if (direct !== undefined && free(destination)) {
      moveSteps = direct;
      moveTarget = hexKey(destination);
    } else {
      // Heading for a distant objective moves as far as the commitment allows
      // rather than refusing, so the map is navigable without pixel-hunting.
      let best: { key: string; distance: number; steps: number } | null = null;
      for (const [key, steps] of routes) {
        const hex = parseHex(key);
        if (!hex || !free(hex)) continue;
        const distance = hexDistance(hex, destination);
        if (!best || distance < best.distance) best = { key, distance, steps };
      }
      const current = hexDistance(player.position, destination);
      if (!best || best.distance >= current)
        return deny(
          direct !== undefined
            ? "Another specialist is standing there."
            : `No route closer. This commitment moves ${range} hexes.`,
        );
      moveSteps = best.steps;
      moveTarget = best.key;
    }
  }
  const event: MissionActionEvent = {
    discovery,
    type: action,
    seat: view.seat,
    target: action === "move" ? moveTarget : target,
    amount,
    knowledgeCost: fallback && !reserveCost ? 1 : 0,
    reserveCost,
  };
  const fit = combination(view.seat, e, action, pieces);
  let effect: string;
  switch (action) {
    case "move": {
      const landing = parseHex(moveTarget)!;
      const site = siteAt(landing, player.size);
      const goal = siteAt(parseHex(target)!, player.size);
      effect = `Move ${moveSteps} hex${moveSteps === 1 ? "" : "es"} to ${
        site ? locationNames[site] : "open ground"
      }${!site && goal ? `, heading for ${locationNames[goal]}` : ""}.`;
      break;
    }
    case "engage": {
      const quarry = view.enemies.find((enemy) => enemy.id === target);
      const dealt = Math.min(quarry?.strength ?? 0, amount);
      effect = `Hit ${quarry?.name ?? "the enemy"} for ${dealt}${
        dealt >= (quarry?.strength ?? 0) ? ", destroying it" : ""
      }.${discovery === "flank" ? " Includes +1 from the shared patrol weakness; this opening is spent." : ""}`;
      break;
    }
    case "assist":
      effect = `Give ${target} +${amount} on their next effect action. Your committed capability is spent.`;
      break;
    case "acquire":
      effect = `Gain ${amount} shared ${target}.`;
      break;
    case "recover":
      effect = `Reduce instability by ${Math.min(view.instability, amount)}${view.seat === "systems" && pieces.length ? "; prime next effect placement for +1 output" : ""}.`;
      break;
    case "investigate":
      effect = fallback
        ? "Decode the safe rift frequency."
        : `Gain ${amount} knowledge and decode the safe rift frequency.`;
      if (discovery === "cache")
        effect += " Recover the located cache: +2 shared Power, once only.";
      break;
    case "contribute":
      if (target === "relay") {
        cost += " + 2 shared power";
        effect =
          "Disable the shield: future stabilization doubles. World response: relay surge adds 1 instability.";
      } else {
        if (view.resources.power < 1)
          return deny(
            "Stabilization needs 1 shared Power. Acquire Power or donate a core first.",
          );
        cost += " + 1 shared Power";
        const gain = view.shield ? amount : amount * 2;
        effect = `Gain ${Math.min(view.requiredProgress - view.progress, gain)} rift progress${view.frequencyKnown ? " safely" : "; blind work adds 5 instability"}.${view.shield ? " Shield halves potential output." : " Relay doubles output."}`;
      }
      break;
  }
  return allow(cost, fit ? `${effect} ${fit}` : effect, event);
}
export function previewAction(
  view: MissionView,
  command: MissionCommand,
): MissionPreview {
  const { allowed, cost, effect, reason, range } = plan(view, command);
  return { allowed, cost, effect, reason, range };
}
function append(state: MissionPublicState, text: string): void {
  state.log.push({ id: (state.log.at(-1)?.id ?? 0) + 1, text });
}
/** Mutates only a freshly cloned public world, never an engine or caller state. */
function reduceWorld(
  state: MissionPublicState,
  event: MissionActionEvent,
): void {
  const player = state.players.find((p) => p.seat === event.seat);
  if (!player) return;
  if (event.discovery === "flank") state.discoveries.flankUsed = true;
  if (event.discovery === "cache") {
    state.discoveries.cacheUsed = true;
    state.resources.power += 2;
  }
  state.resources.knowledge -= event.knowledgeCost;
  if (event.reserveCost) state.resources[event.reserveCost] -= 1;
  if (event.type !== "move" && event.type !== "assist")
    state.boosts[event.seat] = 0;
  switch (event.type) {
    case "move": {
      const destination = parseHex(event.target);
      if (destination) {
        player.position = destination;
        player.location = siteAt(destination, player.size);
      }
      break;
    }
    case "engage": {
      const quarry = state.enemies.find((enemy) => enemy.id === event.target);
      if (quarry) {
        quarry.strength = Math.max(0, quarry.strength - event.amount);
        state.enemies = state.enemies.filter((enemy) => enemy.strength > 0);
      }
      state.threat = state.enemies.reduce(
        (sum, enemy) => sum + enemy.strength,
        0,
      );
      break;
    }
    case "assist":
      state.boosts[event.target as Seat] += event.amount;
      state.requests = state.requests.filter((r) => r.seat !== event.target);
      break;
    case "acquire":
      state.resources[event.target as keyof MissionResources] += event.amount;
      break;
    case "recover":
      state.instability = Math.max(0, state.instability - event.amount);
      break;
    case "investigate":
      state.frequencyKnown = true;
      if (!event.knowledgeCost) state.resources.knowledge += event.amount;
      break;
    case "contribute":
      if (event.target === "relay") {
        state.resources.power -= 2;
        state.shield = false;
        state.instability += 1;
      } else {
        const gain = Math.min(
          state.requiredProgress - state.progress,
          state.shield ? event.amount : event.amount * 2,
        );
        state.resources.power -= 1;
        state.progress += gain;
        player.contribution += gain;
        if (!state.frequencyKnown) state.instability += 5;
      }
      break;
  }
}
/**
 * The opposition acts once, at the world response, so players act freely and
 * simultaneously all round and still know exactly when the answer comes. A
 * patrol that can reach someone hurts them; otherwise it walks toward the
 * nearest specialist, as far as its speed allows and only over open floor.
 */
/**
 * What a specialist can take off an incoming hit. Only the platform can stand
 * in front of something: dice left in Shield are dice that spent the whole
 * round doing nothing else, which is exactly what holding a line costs.
 */
function guardOf(state: MissionState, seat: Seat): number {
  if (seat !== "dice") return 0;
  return diceOutput(facetDice(state.private.dice.engine, "shield"));
}

function activateEnemies(state: MissionState): void {
  for (const enemy of state.enemies) {
    const targets = state.players;
    if (!targets.length) continue;
    const reach = (player: MissionPlayer) =>
      hexDistance(enemy.position, player.position) - player.size;
    const nearest = targets.reduce((closest, player) =>
      reach(player) < reach(closest) ? player : closest,
    );
    if (reach(nearest) <= 1) {
      const guard = guardOf(state, nearest.seat);
      const damage = Math.max(0, enemy.strength - guard);
      state.instability += damage;
      append(
        state,
        damage === 0
          ? `${nearest.name} holds the line: ${enemy.name} hits nothing.`
          : `${enemy.name} is on ${nearest.name}: +${damage} instability${
              guard > 0 ? ` (${guard} absorbed)` : ""
            }.`,
      );
      continue;
    }
    // Walk in, one hex at a time, over floor it can actually cross.
    let at = enemy.position;
    for (let step = 0; step < enemy.speed; step++) {
      const options = hexesWithin(at, 1)
        .filter((cell) => footprintClear(cell, 0))
        .filter((cell) => hexKey(cell) !== hexKey(at));
      if (!options.length) break;
      const best = options.reduce((closest, cell) =>
        hexDistance(cell, nearest.position) <
        hexDistance(closest, nearest.position)
          ? cell
          : closest,
      );
      if (
        hexDistance(best, nearest.position) >= hexDistance(at, nearest.position)
      )
        break;
      at = best;
    }
    if (hexKey(at) !== hexKey(enemy.position)) {
      enemy.position = at;
      append(state, `${enemy.name} advances on ${nearest.name}.`);
    }
  }
}

function settle(state: MissionState): void {
  // A catastrophic blind final contribution loses even if it reaches the goal.
  if (state.instability >= playableMission.instabilityLimit)
    state.phase = "lost";
  else if (state.progress >= state.requiredProgress) state.phase = "won";
  if (state.phase !== "action")
    append(
      state,
      state.phase === "won"
        ? "Rift sealed. The team wins."
        : "Instability reached 12. The rift overwhelms the team.",
    );
}
export function applyCommand(
  state: MissionState,
  seat: Seat,
  command: MissionCommand,
): { state: MissionState; error: string | null } {
  if (!missionSeats.includes(seat)) return { state, error: "Unknown seat." };
  const validation = plan(playerView(state, seat), command);
  if (!validation.allowed) return { state, error: validation.reason };
  const next = structuredClone(state);
  const p = next.private[seat];
  const e = p.engine;
  const player = next.players.find((entry) => entry.seat === seat);
  if (!player) return { state, error: "Unknown seat." };
  if (command.type === "act" && validation.event) {
    const used = new Set(command.pieces);
    e.dice = e.dice.filter((d) => !used.has(d.id));
    e.hand = e.hand.filter((c) => !used.has(c.id));
    e.pending = e.pending.filter((t) => !used.has(t.id));
    e.markers = e.markers.filter((m) => !used.has(m));
    if (seat === "systems" && used.size > 0) {
      if (command.action !== "move") {
        e.slots = e.slots.filter((slot) => slot !== "primed");
        e.slots.push(command.action);
      }
      if (command.action === "recover") e.slots.push("primed");
    }
    reduceWorld(next, validation.event);
    player.holding = false;
    append(
      next,
      `${player.name}: ${command.action} ${command.target}. ${validation.effect} Cost: ${validation.cost}.`,
    );
  } else {
    switch (command.type) {
      case "draw": {
        const token = p.bag.pop();
        if (token?.kind === "hazard") {
          // Burnout costs what was actually at stake: a token for every token
          // lost, and one more for every burnout already taken this round.
          // Busting with nothing in hand is a gamble with nothing on it, so it
          // costs the team nothing; the hazard returning and the stress rising
          // are punishment enough, because both make the next push worse.
          const lost = e.pending.length;
          e.stress++;
          e.pending = [];
          p.bag.push(token);
          shuffle(next, p.bag);
          const damage = lost === 0 ? 0 : lost + (e.stress - 1);
          next.instability += damage;
          append(
            next,
            damage === 0
              ? `${player.name} pushed with nothing in hand and burnt out. The hazard goes back in the bag.`
              : `${player.name} pushed past the limit: ${lost} lost, +${damage} instability.`,
          );
        } else {
          if (token) e.pending.push(token);
          append(next, `${player.name} pushed for another surge token.`);
        }
        e.bagRemaining = p.bag.length;
        e.bagHazards = p.bag.filter((t) => t.kind === "hazard").length;
        player.holding = false;
        break;
      }
      case "share":
        next.reports.push({
          seat,
          location: command.target ?? "rift",
          text: perceptions[seat][command.target ?? "rift"].text,
        });
        if (hasReports(next, "rift", ["dice", "cards"]))
          next.frequencyKnown = true;
        append(next, `${player.name}: ${validation.effect}`);
        break;
      case "request":
        next.requests = [
          ...next.requests.filter((r) => r.seat !== seat),
          { seat, target: command.target },
        ];
        append(next, `${player.name} requests help with ${command.target}.`);
        break;
      case "keep": {
        const card = e.hand.find((entry) => entry.id === command.piece);
        if (card) card.kept = !card.kept;
        const token = e.pending.find((entry) => entry.id === command.piece);
        if (token) token.kept = !token.kept;
        if (e.slots.includes(command.piece))
          e.keptSlots = e.keptSlots.includes(command.piece)
            ? e.keptSlots.filter((slot) => slot !== command.piece)
            : [...e.keptSlots, command.piece];
        break;
      }
      case "allocate": {
        const die = e.dice.find((entry) => entry.id === command.die);
        if (die) die.facet = command.facet;
        break;
      }
      case "hold":
        player.holding = true;
        append(next, `${player.name} holds capability and remains available.`);
        break;
      case "ready":
        player.ready = true;
        player.holding = false;
        append(next, `${player.name} is ready.`);
        if (next.players.every((entry) => entry.ready)) {
          activateEnemies(next);
          const pressure = worldPressure(next.round, next.threat);
          next.instability += pressure;
          append(
            next,
            `Round ${next.round} world response: +${pressure} instability${next.threat > 0 ? " from the rift and active patrol" : " from the rift"}.`,
          );
          settle(next);
          if (next.phase === "action" && next.round >= missionRoundLimit) {
            next.phase = "lost";
            append(
              next,
              "The sixth surge collapses the dimensional window. Greyhaven is lost.",
            );
          }
          if (next.phase === "action") {
            next.round++;
            next.requests = [];
            for (const entry of next.players) {
              entry.ready = false;
              entry.holding = false;
              refill(next, entry.seat);
            }
            const grew = engineTier(next.round) > engineTier(next.round - 1);
            append(
              next,
              `Round ${next.round}: all engines refilled.${
                grew
                  ? ` Field experience reaches tier ${engineTier(next.round)}: every specialist gains capability this round.`
                  : ""
              }`,
            );
          }
        }
        break;
      case "upgrade":
        p.artifact = false;
        player.upgraded = true;
        if (seat === "dice")
          e.dice.push({
            id: `dice-${next.round}-upgrade`,
            value: 1 + Math.floor(random(next) * 6),
            facet: null,
          });
        if (seat === "systems") e.markers.push(`systems-${next.round}-upgrade`);
        if (seat === "bag") {
          // Hazards never leave the bag, so removing one is a permanent gain.
          const hazard = p.bag.find((t) => t.kind === "hazard");
          if (hazard) hazard.kind = "jackpot";
          else p.bag.push({ id: `bag-${next.round}-upgrade`, kind: "jackpot" });
          e.bagRemaining = p.bag.length;
          e.bagHazards = p.bag.filter((t) => t.kind === "hazard").length;
        }
        append(next, `${player.name} kept the artifact. ${validation.effect}`);
        break;
      case "donate":
        p.artifact = false;
        next.resources.power += 2;
        append(next, `${player.name} donated their artifact: +2 shared power.`);
        break;
      case "act":
        break;
    }
  }
  if (next.phase === "action") settle(next);
  return { state: next, error: null };
}
