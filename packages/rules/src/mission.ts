import { playableMission } from "@rifts/content";
export type Seat = "soldier" | "mage" | "scout" | "operator";
export const missionSeats: readonly Seat[] = [
  "soldier",
  "mage",
  "scout",
  "operator",
];
export const missionRoundLimit = playableMission.roundLimit;
export const worldPressure = (round: number, threat: number): number =>
  1 + (threat > 0 ? 1 : 0) + Math.floor((round - 1) / 2);
export type MissionLocation = "gate" | "relay" | "archive" | "rift";
export type MissionAction =
  | "move"
  | "engage"
  | "investigate"
  | "contribute"
  | "acquire"
  | "assist"
  | "recover";
export type MissionCommand =
  | { type: "act"; action: MissionAction; target: string; pieces: string[] }
  | { type: "request"; target: string }
  | {
      type: "draw" | "bank" | "share" | "hold" | "ready" | "upgrade" | "donate";
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
  location: MissionLocation;
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
};
export type MissionToken = { id: string; kind: string };
export type MissionEngine = {
  dice: { id: string; value: number }[];
  hand: MissionCard[];
  drawn: MissionToken[];
  bagRemaining: number;
  hazards: number;
  banked: boolean;
  bagHazards: number;
  markers: string[];
  /** Occupied modules; "primed" indicates enhanced next placement. */
  slots: string[];
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
  threat: number;
  boosts: Record<Seat, number>;
  log: { id: number; text: string }[];
  players: MissionPlayer[];
  requests: { seat: Seat; target: string }[];
  reports: { seat: Seat; text: string }[];
};
export type MissionView = MissionPublicState & {
  seat: Seat;
  engine: MissionEngine;
  intel: MissionIntel[];
  objective: string;
  artifact: boolean;
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
};
/** Normalized output of any engine; contains no private piece identities. */
export type MissionActionEvent = {
  type: MissionAction;
  seat: Seat;
  target: string;
  amount: number;
  knowledgeCost: number;
  reserveCost: "materiel" | "influence" | null;
};
type ActionPlan = MissionPreview & { event: MissionActionEvent | null };
const locations: readonly string[] = ["gate", "relay", "archive", "rift"];
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
const clues: Record<Seat, string> = {
  soldier: "Rift pulses track the gate patrol's targeting cycle.",
  mage: "The rift resonates on a repeating three-beat frequency.",
  scout: "A quiet interval follows each third rift pulse.",
  operator:
    "Relay telemetry can cancel the rift shield during its quiet interval.",
};
const objectives: Record<Seat, string> = {
  soldier:
    "Keep your core to install a sixth die. Donating it funds two team stabilization actions instead.",
  mage: "Keep your core to amplify every Channel combo. Donating it funds two team stabilization actions instead.",
  scout:
    "Keep your core to replace a hazard with a jackpot. Donating it funds two team stabilization actions instead.",
  operator:
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
        ? "Alone: 1 effect. With Resonance: 3 (upgraded: 4)."
        : kind === "reaction"
          ? "Alone: 1 effect. After relay restored: Assist gives +2."
          : "Alone: 1 effect. Combine with Channel for 3.",
  };
}
function refill(state: MissionState, seat: Seat): void {
  const p = state.private[seat];
  const upgraded =
    state.players.find((player) => player.seat === seat)?.upgraded ?? false;
  const prefix = `${seat}-${state.round}`;
  p.engine = {
    dice: [],
    hand: [],
    drawn: [],
    bagRemaining: 0,
    hazards: 0,
    banked: false,
    bagHazards: 0,
    markers: [],
    slots: [],
  };
  if (seat === "soldier")
    p.engine.dice = Array.from({ length: upgraded ? 6 : 5 }, (_, i) => ({
      id: `${prefix}-die-${i}`,
      value: 1 + Math.floor(random(state) * 6),
    }));
  if (seat === "mage")
    p.engine.hand = shuffle(
      state,
      ["channel", "channel", "spell", "spell", "reaction"].map((kind, i) =>
        card(`${prefix}-card-${i}`, kind),
      ),
    );
  if (seat === "scout") {
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
      ].map((kind, i) => ({ id: `${prefix}-token-${i}`, kind })),
    );
    p.engine.bagRemaining = p.bag.length;
    p.engine.bagHazards = p.bag.filter((t) => t.kind === "hazard").length;
  }
  if (seat === "operator")
    p.engine.markers = Array.from(
      { length: upgraded ? 5 : 4 },
      (_, i) => `${prefix}-marker-${i}`,
    );
}
export function createMission(seed = 1): MissionState {
  const empty = (seat: Seat): MissionPrivateState => ({
    engine: {
      dice: [],
      hand: [],
      drawn: [],
      bagRemaining: 0,
      hazards: 0,
      banked: false,
      bagHazards: 0,
      markers: [],
      slots: [],
    },
    bag: [],
    intel: [
      { status: "character-specific", text: clues[seat] },
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
    threat: 3,
    boosts: { soldier: 0, mage: 0, scout: 0, operator: 0 },
    log: [
      {
        id: 1,
        text: "Team deployed at relay. Seal the rift before instability reaches 12.",
      },
    ],
    players: missionSeats.map((seat) => ({
      seat,
      name: seat[0]?.toUpperCase() + seat.slice(1),
      location: "relay",
      holding: false,
      ready: false,
      upgraded: false,
      contribution: 0,
    })),
    requests: [],
    reports: [],
    private: {
      soldier: empty("soldier"),
      mage: empty("mage"),
      scout: empty("scout"),
      operator: empty("operator"),
    },
  };
  for (const seat of missionSeats) refill(state, seat);
  return state;
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
    boosts: state.boosts,
    log: state.log,
    players: state.players,
    requests: state.requests,
    reports: state.reports,
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
  if (c.type === "request")
    return Object.keys(c).length === 2 && typeof c.target === "string";
  return (
    Object.keys(c).length === 1 &&
    typeof c.type === "string" &&
    ["draw", "bank", "share", "hold", "ready", "upgrade", "donate"].includes(
      c.type,
    )
  );
}
function plan(view: MissionView, command: MissionCommand): ActionPlan {
  const deny = (reason: string): ActionPlan => ({
    allowed: false,
    cost: "None",
    effect: "None",
    reason,
    event: null,
  });
  const allow = (
    cost: string,
    effect: string,
    event: MissionActionEvent | null = null,
  ): ActionPlan => ({ allowed: true, cost, effect, reason: "", event });
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
        return view.seat !== "scout"
          ? deny("Only the scout draws bag tokens.")
          : e.banked
            ? deny("Expedition banked. Draw again next round.")
            : e.bagRemaining === 0
              ? deny("Bag is empty until next round.")
              : allow(
                  "One bag token; two hazards bust the pending haul",
                  "Draw a hidden token; a bust loses the haul and adds 1 instability.",
                );
      case "bank":
        return view.seat !== "scout" ||
          e.banked ||
          !e.drawn.some((t) => t.kind !== "hazard")
          ? deny("Draw a safe token before banking.")
          : allow(
              "End this round's expedition; no more draws",
              "Secure the haul. Spend its tokens across your actions.",
            );
      case "share":
        return view.reports.some((r) => r.seat === view.seat)
          ? deny("Your report is already shared.")
          : allow(
              "None",
              view.reports.length >= 1
                ? "Publish your clue; combined reports reveal the safe frequency."
                : "Publish your private rift clue.",
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
                soldier: "Gain a sixth die now and each round.",
                mage: "Channel combos now produce 4 effect instead of 3.",
                scout:
                  "Replace a hazard with a jackpot now and in future bags.",
                operator: "Gain a fifth placement marker now and each round.",
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
    if (!locations.includes(target) || target === player.location)
      return deny("Choose a different map location.");
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
    if (target !== player.location) return deny("Move to the target first.");
    if (action === "engage" && (target !== "gate" || view.threat === 0))
      return deny("No gate patrol to engage here.");
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
  } else if (view.seat === "soldier") {
    const die = e.dice.find((d) => d.id === pieces[0]);
    if (pieces.length !== 1 || !die) return deny("Select one available die.");
    const threshold = action === "engage" ? 4 : action === "assist" ? 3 : 1;
    if (die.value < threshold)
      return deny(`This action requires a die of ${threshold}+.`);
    amount = die.value >= 4 ? 2 : 1;
  } else if (view.seat === "mage") {
    const selected = e.hand.filter((c) => pieces.includes(c.id));
    if (
      pieces.length < 1 ||
      selected.length !== pieces.length ||
      pieces.length > 2
    )
      return deny("Select one card or a Channel and Resonance combo.");
    if (
      pieces.length === 2 &&
      !(
        selected.some((c) => c.kind === "channel") &&
        selected.some((c) => c.kind === "spell")
      )
    )
      return deny("A combo needs one Channel and one Resonance.");
    amount = pieces.length === 2 ? (player.upgraded ? 4 : 3) : 1;
    if (selected[0]?.kind === "reaction" && action === "assist" && !view.shield)
      amount = 2;
  } else if (view.seat === "scout") {
    if (!e.banked)
      return deny(
        "Bank your haul before spending tokens. Banking ends this round's draws.",
      );
    const selected = e.drawn.filter((t) => pieces.includes(t.id));
    if (
      pieces.length < 1 ||
      selected.length !== pieces.length ||
      selected.some((t) => t.kind === "hazard")
    )
      return deny("Bank one or more available non-hazard tokens.");
    amount = selected.reduce(
      (sum, t) => sum + (t.kind === "jackpot" ? 2 : 1),
      0,
    );
  } else {
    if (pieces.length !== 1 || !e.markers.includes(pieces[0] ?? ""))
      return deny("Select one available placement marker.");
    if (e.slots.includes(action))
      return deny("That action module is occupied until next round.");
    amount = e.slots.includes("primed") ? 2 : 1;
  }
  const enhanced = action !== "move" && action !== "assist";
  if (enhanced) amount += view.boosts[view.seat];
  const event: MissionActionEvent = {
    type: action,
    seat: view.seat,
    target,
    amount,
    knowledgeCost: fallback && !reserveCost ? 1 : 0,
    reserveCost,
  };
  let effect: string;
  switch (action) {
    case "move":
      effect = `Move to ${target}.`;
      break;
    case "engage":
      effect = `Remove ${Math.min(view.threat, amount)} gate threat.`;
      break;
    case "assist":
      effect = `Give ${target} +${amount} on their next effect action. Your committed capability is spent.`;
      break;
    case "acquire":
      effect = `Gain ${amount} shared ${target}.`;
      break;
    case "recover":
      effect = `Reduce instability by ${Math.min(view.instability, amount)}${view.seat === "operator" && pieces.length ? "; prime next effect placement for +1 output" : ""}.`;
      break;
    case "investigate":
      effect = fallback
        ? "Decode the safe rift frequency."
        : `Gain ${amount} knowledge and decode the safe rift frequency.`;
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
  return allow(cost, effect, event);
}
export function previewAction(
  view: MissionView,
  command: MissionCommand,
): MissionPreview {
  const { allowed, cost, effect, reason } = plan(view, command);
  return { allowed, cost, effect, reason };
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
  state.resources.knowledge -= event.knowledgeCost;
  if (event.reserveCost) state.resources[event.reserveCost] -= 1;
  if (event.type !== "move" && event.type !== "assist")
    state.boosts[event.seat] = 0;
  switch (event.type) {
    case "move":
      player.location = event.target as MissionLocation;
      break;
    case "engage":
      state.threat = Math.max(0, state.threat - event.amount);
      break;
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
    e.drawn = e.drawn.filter((t) => !used.has(t.id));
    e.markers = e.markers.filter((m) => !used.has(m));
    if (seat === "operator" && used.size > 0) {
      if (command.action !== "move")
        e.slots = e.slots.filter((slot) => slot !== "primed");
      e.slots.push(command.action);
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
        if (token) {
          e.drawn.push(token);
          if (token.kind === "hazard") e.hazards++;
        }
        e.bagRemaining = p.bag.length;
        e.bagHazards = p.bag.filter((t) => t.kind === "hazard").length;
        if (e.hazards >= 2) {
          e.drawn = [];
          e.hazards = 0;
          next.instability++;
          append(
            next,
            "Scout's second hazard lost the pending haul: +1 instability.",
          );
        } else append(next, "Scout drew a private bag token.");
        player.holding = false;
        break;
      }
      case "bank":
        e.banked = true;
        e.drawn = e.drawn.filter((t) => t.kind !== "hazard");
        append(
          next,
          "Scout secured their haul. No further draws this round; banked tokens remain available for actions.",
        );
        break;
      case "share":
        next.reports.push({ seat, text: clues[seat] });
        if (next.reports.length >= 2) next.frequencyKnown = true;
        append(next, `${player.name}: ${validation.effect}`);
        break;
      case "request":
        next.requests = [
          ...next.requests.filter((r) => r.seat !== seat),
          { seat, target: command.target },
        ];
        append(next, `${player.name} requests help with ${command.target}.`);
        break;
      case "hold":
        player.holding = true;
        append(next, `${player.name} holds capability and remains available.`);
        break;
      case "ready":
        player.ready = true;
        player.holding = false;
        append(next, `${player.name} is ready.`);
        if (next.players.every((entry) => entry.ready)) {
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
            append(next, `Round ${next.round}: all engines refilled.`);
          }
        }
        break;
      case "upgrade":
        p.artifact = false;
        player.upgraded = true;
        if (seat === "soldier")
          e.dice.push({
            id: `soldier-${next.round}-upgrade`,
            value: 1 + Math.floor(random(next) * 6),
          });
        if (seat === "operator")
          e.markers.push(`operator-${next.round}-upgrade`);
        if (seat === "scout") {
          const hazard =
            p.bag.find((t) => t.kind === "hazard") ??
            e.drawn.find((t) => t.kind === "hazard");
          if (hazard) {
            if (e.drawn.includes(hazard)) e.hazards--;
            hazard.kind = "jackpot";
          } else
            p.bag.push({ id: `scout-${next.round}-upgrade`, kind: "jackpot" });
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
