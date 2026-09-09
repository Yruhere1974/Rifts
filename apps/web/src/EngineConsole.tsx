import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  Dices,
  Layers,
  Compass,
  CircuitBoard,
  Sparkles,
  Triangle,
  Diamond,
  Plus,
  Hexagon,
} from "lucide-react";
import {
  coherence,
  surgeOutput,
  weaveOutput,
  weaves,
  wiring,
} from "@rifts/rules";
import type {
  DieSlot,
  MissionCard,
  MissionView,
  MissionAction,
  Seat,
} from "@rifts/rules";
import { specialists } from "@rifts/content";
import {
  MOTION,
  staggerDelay,
  useArrivals,
  usePulse,
  useReducedMotion,
} from "./motion.js";

/**
 * A view of the authored specialists. Class names, colours and upgrade text
 * come from content; this module only supplies the icon per engine family.
 */
const icons = {
  dice: Dices,
  cards: Layers,
  bag: Compass,
  systems: CircuitBoard,
} satisfies Record<Seat, typeof Dices>;

export const identities = Object.fromEntries(
  specialists.map((entry) => [
    entry.family,
    {
      title: entry.className,
      family: entry.familyName,
      engine: entry.engine,
      icon: icons[entry.family],
      color: entry.colour,
      flavour: entry.flavour,
      upgrade: entry.upgrade,
    },
  ]),
) as Record<
  Seat,
  {
    title: string;
    family: string;
    engine: string;
    icon: typeof Dices;
    color: string;
    flavour: string;
    upgrade: string;
  }
>;

const pipPositions: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
/** Bands the live bust odds so "one more?" is answerable at a glance. */
export function surgeBand(hazards: number, remaining: number): string {
  const odds = remaining > 0 ? hazards / remaining : 1;
  return odds >= 0.65
    ? "BURNOUT"
    : odds >= 0.45
      ? "REDLINE"
      : odds >= 0.3
        ? "AMPED"
        : "NOMINAL";
}

const classes = (...names: (string | false | undefined)[]): string =>
  names.filter((name) => !!name).join(" ");

const delayStyle = (ms: number): CSSProperties =>
  ({ "--motion-delay": `${ms}ms` }) as CSSProperties;

/**
 * Stagger by arrival order rather than tray position. A single bag token drawn
 * beside four that were already there must not wait behind them.
 */
function arrivalOrder(
  ids: readonly string[],
  fresh: ReadonlySet<string>,
): Map<string, number> {
  const order = new Map<string, number>();
  for (const id of ids) if (fresh.has(id)) order.set(id, order.size);
  return order;
}

/**
 * A token that ticks when `count` falls. A refill only ever deals more, so a
 * fall is always a player spending something.
 */
function useDeparture(count: number): number {
  const [tracked, setTracked] = useState({ count, token: 0 });
  if (tracked.count !== count)
    setTracked({
      count,
      token: tracked.token + (count < tracked.count ? 1 : 0),
    });
  return tracked.token;
}

/**
 * Pushes and burnouts on the bag, told apart from a round refill. A bust puts
 * the hazard straight back in the bag, so the bag count does not fall on the
 * push that loses the surge: stress is the only witness. `lost` remembers how
 * many tokens the surge held when it went, which is what has to be seen dying.
 */
function useBagEvents(
  remaining: number,
  stress: number,
  held: number,
): { push: number; burn: number; lost: number } {
  const [tracked, setTracked] = useState({
    remaining,
    stress,
    held,
    push: 0,
    burn: 0,
    lost: 0,
  });
  if (
    tracked.remaining !== remaining ||
    tracked.stress !== stress ||
    tracked.held !== held
  ) {
    const burnt = stress > tracked.stress;
    setTracked({
      remaining,
      stress,
      held,
      push: tracked.push + (burnt || remaining < tracked.remaining ? 1 : 0),
      burn: tracked.burn + (burnt ? 1 : 0),
      lost: burnt ? tracked.held : tracked.lost,
    });
  }
  return tracked;
}

type PieceProps = {
  draggable: boolean;
  onDragStart: (event: DragEvent) => void;
  onClick: () => void;
  "aria-pressed": boolean;
  disabled: boolean;
};

type EngineProps = {
  /** Hold a piece back so it survives the refill. */
  onKeep: (piece: string) => void;
  view: MissionView;
  selected: string[];
  piece: (id: string) => PieceProps;
  onSelect: (id: string) => void;
  onDraw: () => void;
  onAction: (action: MissionAction) => void;
  disabled: boolean;
};

/** How long the reveal rests on each face before moving to the next. */
const TUMBLE = Math.round(MOTION.instant / 2);

function Die({
  value,
  index,
  arriving,
  reduced,
  selected,
  piece,
}: {
  value: number;
  index: number;
  arriving: boolean;
  reduced: boolean;
  selected: boolean;
  piece: PieceProps;
}) {
  const [tumbling, setTumbling] = useState(arriving && !reduced);
  const [face, setFace] = useState((value % 6) + 1);
  useEffect(() => {
    if (!tumbling) return;
    const start = staggerDelay(index);
    let spin: ReturnType<typeof setInterval> | undefined;
    const begin = setTimeout(() => {
      spin = setInterval(() => setFace((shown) => (shown % 6) + 1), TUMBLE);
    }, start);
    // Stops a beat before the die comes to rest, so the value is the last
    // thing to move. The reveal never decides: it lands on the rolled value.
    const land = setTimeout(
      () => {
        clearInterval(spin);
        setTumbling(false);
      },
      start + MOTION.settle - MOTION.instant,
    );
    return () => {
      clearTimeout(begin);
      clearTimeout(land);
      clearInterval(spin);
    };
  }, [tumbling, index]);
  const shown = tumbling ? face : value;
  return (
    <button
      {...piece}
      aria-label={`Die ${value}`}
      className={classes(
        "die",
        selected && "selected",
        // Steady, never pulsing: the tray should read at a glance, not blink.
        shown >= 4 && "can-engage",
        arriving && "motion-arrive",
      )}
      style={delayStyle(staggerDelay(index))}
    >
      <span className="die-face">
        {Array.from({ length: 9 }, (_, i) => (
          <i
            key={i}
            className={pipPositions[shown]?.includes(i) ? "pip" : ""}
          />
        ))}
      </span>
      <span className="die-value">{shown}</span>
    </button>
  );
}

/**
 * Allocation. A fresh set cascades in and tumbles to rest, so the round's dice
 * are read rather than snapped into place. Committed dice unmount, so the
 * spend gets one brief flash across the tray and nothing more.
 */
/** The platform's systems, plus the hold that carries a die into next round. */
const facetPanel: {
  facet: DieSlot;
  name: string;
  note: string;
}[] = [
  { facet: "mobility", name: "Drive", note: "Move" },
  { facet: "targeting", name: "Targeting", note: "Engage" },
  { facet: "boom", name: "Boom Gun", note: "Doubles, needs a brace" },
  { facet: "bracing", name: "Bracing", note: "Holds the shot steady" },
  { facet: "stabilizer", name: "Stabilizer", note: "Contribute" },
  { facet: "shield", name: "Shield", note: "Recover" },
  { facet: "locked", name: "Hold over", note: "Keeps its face next round" },
];

function DiceEngine({
  view,
  selected,
  piece,
  onAllocate,
}: EngineProps & { onAllocate: (die: string, facet: DieSlot) => void }) {
  const dice = view.engine.dice;
  const reduced = useReducedMotion();
  const ids = dice.map((die) => die.id);
  const arrivals = useArrivals(ids);
  const order = arrivalOrder(ids, arrivals);
  const spend = useDeparture(dice.length);
  const loose = dice.filter((die) => die.facet === null);
  const held = selected.find((id) => loose.some((die) => die.id === id));
  const braced = dice.some((die) => die.facet === "bracing");
  return (
    <div className="dice-engine">
      <div className="dice-tray" aria-label="Unallocated dice">
        {loose.map((die) => (
          <Die
            key={die.id}
            value={die.value}
            index={order.get(die.id) ?? 0}
            arriving={arrivals.has(die.id)}
            reduced={reduced}
            selected={selected.includes(die.id)}
            piece={piece(die.id)}
          />
        ))}
        {!loose.length && (
          <p className="empty-engine">
            {dice.length
              ? "Every die is committed to a system."
              : "All dice spent."}
          </p>
        )}
        {spend > 0 && !reduced && (
          <span key={spend} className="tray-spend" aria-hidden="true" />
        )}
      </div>
      <p className="allocate-hint">
        {held
          ? "Choose a system for that die."
          : "Select a die, then a system. Firing a system spends everything in it."}
      </p>
      <div className="facet-board">
        {facetPanel.map((entry) => {
          const inside = dice.filter((die) => die.facet === entry.facet);
          const output = inside.reduce(
            (sum, die) => sum + (die.value >= 4 ? 2 : 1),
            0,
          );
          const inert = entry.facet === "boom" && inside.length > 0 && !braced;
          const fit = entry.facet === "locked" ? null : coherence(inside).label;
          const tuned = fit ? coherence(inside).apply(output) : output;
          return (
            <button
              key={entry.facet}
              className={`facet${inside.length ? " loaded" : ""}${inert ? " inert" : ""}${fit ? " tuned" : ""}${entry.facet === "locked" ? " keep" : ""}`}
              data-facet={entry.facet}
              aria-label={`${entry.name} system`}
              disabled={!held}
              onClick={() => held && onAllocate(held, entry.facet)}
            >
              <span className="facet-head">
                <strong>{entry.name}</strong>
                <small>{entry.note}</small>
              </span>
              <span className="facet-dice">
                {inside.map((die) => (
                  <i
                    key={die.id}
                    className="facet-die"
                    role="button"
                    tabIndex={0}
                    aria-label={`Return die ${die.value} to the tray`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAllocate(die.id, null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.stopPropagation();
                      onAllocate(die.id, null);
                    }}
                  >
                    {die.value}
                  </i>
                ))}
              </span>
              <span className="facet-output">
                {entry.facet === "locked"
                  ? inside.length
                    ? `${inside.length} held for next round`
                    : "nothing held"
                  : inert
                    ? "UNBRACED"
                    : output
                      ? `${entry.facet === "boom" ? tuned * 2 : tuned} output${fit ? ` — ${fit}` : ""}`
                      : "empty"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Thread = {
  key: string;
  width: number;
  height: number;
  points: { x: number; y: number }[];
};

/** Where the thread ties into a card: across its art, not its text. */
const anchor = (card: HTMLElement): { x: number; y: number } => ({
  x: Math.round(card.offsetLeft + card.offsetWidth / 2),
  y: Math.round(card.offsetTop + card.offsetHeight * 0.36),
});

/**
 * The chip on a card says what it does in a chain, not what the rules call
 * the kind internally: a Resonance is stored as "spell", and Exploit Opening
 * is the wildcard that keeps a chain alternating.
 */
const kindLabel = (kind: string): string =>
  kind === "channel" ? "CHANNEL" : kind === "spell" ? "RESONANCE" : "WILDCARD";

/** What a legal chain of this length wants next, in the hand's own words. */
const wants = (chain: readonly MissionCard[]): string => {
  const last = chain.at(-1);
  if (!last || last.kind === "reaction") return "a Channel or a Resonance";
  return last.kind === "channel" ? "a Resonance" : "a Channel";
};

/**
 * Combination. A weave alternates Channel and Resonance for as long as the
 * hand can sustain it, and pays superlinearly for length, so the thread is
 * drawn along the whole chain in the order the player built it. A broken
 * chain draws nothing at all: the silence is the feedback, and the player has
 * spent nothing to learn it.
 */
function CardsEngine({ view, selected, piece, onKeep }: EngineProps) {
  const hand = view.engine.hand;
  const ids = hand.map((card) => card.id);
  const arrivals = useArrivals(ids);
  const order = arrivalOrder(ids, arrivals);
  // Selection order is chain order, so a player builds the weave in the
  // sequence they intend rather than in the order the hand happens to sit.
  const chain = selected
    .map((id) => hand.find((card) => card.id === id))
    .filter((card): card is MissionCard => Boolean(card));
  const woven = chain.length >= 2 && weaves(chain);
  const link = woven ? chain.map((card) => card.id).join("|") : "";
  const bonus = view.players.find((p) => p.seat === view.seat)?.upgraded
    ? 1
    : 0;
  const held = hand.filter((card) => card.kept).length;
  const handRef = useRef<HTMLDivElement>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  useEffect(() => {
    const row = handRef.current;
    if (!row || !link) return;
    // The hand scrolls and reflows, so the thread is measured through an
    // observer rather than once. Writing from the frame callback also keeps
    // the state update out of the effect body.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nodes = link
          .split("|")
          .map((id) => row.querySelector<HTMLElement>(`[data-card="${id}"]`));
        if (nodes.some((node) => !node)) return;
        setThread({
          key: link,
          width: row.scrollWidth,
          height: row.clientHeight,
          points: nodes.map((node) => anchor(node!)),
        });
      });
    });
    observer.observe(row);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [link]);
  const live = thread && thread.key === link ? thread : null;
  // One path across every link, so the spark travels the length of the chain
  // rather than restarting between each pair.
  const arc = live
    ? live.points
        .slice(1)
        .map((point, i) => {
          const from = live.points[i]!;
          const lift = Math.max(6, Math.min(from.y, point.y) - 44);
          const mid = Math.round((from.x + point.x) / 2);
          return `M ${from.x} ${from.y} Q ${mid} ${lift} ${point.x} ${point.y}`;
        })
        .join(" ")
    : "";
  return (
    <div className="cards-engine">
      <div className="card-hand" ref={handRef}>
        {hand.map((card) => (
          <button
            key={card.id}
            {...piece(card.id)}
            data-card={card.id}
            className={classes(
              "playing-card",
              selected.includes(card.id) && "selected",
              card.kept && "held",
              arrivals.has(card.id) && "motion-arrive",
            )}
            style={delayStyle(staggerDelay(order.get(card.id) ?? 0))}
            aria-label={`${card.name} card`}
          >
            <span className="card-type">{kindLabel(card.kind)}</span>
            <Sparkles className="card-art" size={27} strokeWidth={1} />
            <strong>{card.name}</strong>
            <p>{card.description}</p>
            <span className="card-bottom">
              {card.kept
                ? "HELD OVER"
                : selected.includes(card.id)
                  ? `LINK ${selected.indexOf(card.id) + 1}`
                  : "AVAILABLE"}
            </span>
            <i
              className="hold-pip"
              role="button"
              tabIndex={0}
              aria-label={`${card.kept ? "Release" : "Hold"} ${card.name} for next round`}
              onClick={(event) => {
                event.stopPropagation();
                onKeep(card.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.stopPropagation();
                onKeep(card.id);
              }}
            />
          </button>
        ))}
        {!hand.length && <p className="empty-engine">Your hand is spent.</p>}
        {live && (
          <svg
            className="card-weave"
            width={live.width}
            height={live.height}
            viewBox={`0 0 ${live.width} ${live.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <path className="weave-thread" pathLength={1} d={arc} />
            <path className="weave-spark" pathLength={1} d={arc} />
            {live.points.map((point, i) => (
              <circle
                key={i}
                className="weave-node"
                r={3.4}
                cx={point.x}
                cy={point.y}
              />
            ))}
          </svg>
        )}
      </div>
      <small className={classes("weave-read", woven && "tuned")}>
        {chain.length === 0
          ? "A weave alternates Channel and Resonance. Longer chains pay more than the cards are worth apart."
          : woven
            ? `Weave of ${chain.length} — ${weaveOutput(chain.length) + bonus} output. Extend it with ${wants(chain)} for ${weaveOutput(chain.length + 1) + bonus}.`
            : chain.length === 1
              ? `Weave of 1 — ${weaveOutput(1) + bonus} output. Add ${wants(chain)} for ${weaveOutput(2) + bonus}.`
              : "Broken chain. A weave must alternate; Exploit Opening can stand in for either side."}
        {held > 0
          ? ` ${held} card${held === 1 ? "" : "s"} held for next round, and counted against the deal.`
          : " Use the pip on a card to hold it through the deal."}
      </small>
    </div>
  );
}

/**
 * Push your luck. This is the one engine whose rules make agitation
 * meaningful, so the whole panel is tuned by the live bust band: a hum at
 * NOMINAL, a visible warning at REDLINE. A burnout kills the surge on screen
 * and walks the hazard back into the bag, which is the rule players forget.
 */
function BagEngine({ view, disabled, onDraw, onKeep }: EngineProps) {
  const engine = view.engine;
  const reduced = useReducedMotion();
  const pending = engine.pending;
  const ids = pending.map((token) => token.id);
  const arrivals = useArrivals(ids);
  const order = arrivalOrder(ids, arrivals);
  const events = useBagEvents(
    engine.bagRemaining,
    engine.stress,
    pending.length,
  );
  const band = surgeBand(engine.bagHazards, engine.bagRemaining);
  // Composition is the Juicer's read: one kind pays its own size again, and
  // all three safe kinds double. So the panel says which pull is one token
  // away from either, and pushing becomes a choice about what comes out.
  const kinds = new Set(pending.map((token) => token.kind));
  const safe = ["find", "cache", "signal"].filter((kind) => kinds.has(kind));
  const clean = pending.length >= 2 && kinds.size === 1;
  const spread = safe.length === 3;
  const kept = pending.filter((token) => token.kept).length;
  const bagRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = bagRef.current;
    if (!events.push || reduced || !node) return;
    // Driven from JS rather than a replayed CSS animation so the button keeps
    // its DOM node: a player pushing from the keyboard must not lose focus.
    const jolt = node.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(5px)" },
        { transform: "translateY(0)" },
      ],
      {
        duration: MOTION.quick * 1.5,
        easing: "cubic-bezier(0.2, 0.9, 0.25, 1)",
      },
    );
    return () => jolt.cancel();
  }, [events.push, reduced]);
  return (
    // The band is the panel's escalation state, and the stylesheet tunes the
    // shared tremor's amplitude and tempo from it: a hum at NOMINAL, a visible
    // warning at REDLINE.
    <div className="bag-engine" data-band={band}>
      <button
        ref={bagRef}
        className="draw-bag"
        data-tutorial="push"
        disabled={disabled || engine.bagRemaining === 0}
        onClick={onDraw}
        aria-label="Push for another surge token"
      >
        <Compass size={31} strokeWidth={1} />
        <strong>Push</strong>
        <small>{engine.bagRemaining} in bag</small>
      </button>
      <div className="bag-pulls">
        <div className="token-tray">
          {pending.map((token) => (
            <button
              key={token.id}
              type="button"
              className={classes(
                "bag-token",
                "selected",
                token.kept && "held",
                arrivals.has(token.id) && "motion-arrive",
              )}
              style={delayStyle(staggerDelay(order.get(token.id) ?? 0))}
              disabled={disabled}
              onClick={() => onKeep(token.id)}
              aria-label={`${token.kind} token in surge, ${
                token.kept ? "held for next round" : "spent on commit"
              }`}
            >
              <Diamond size={21} />
              <span>{token.kind}</span>
            </button>
          ))}
          {!pending.length && (
            <span className="empty-engine">
              No surge. Push before committing an action.
            </span>
          )}
          {events.burn > 0 && !reduced && (
            <span key={events.burn} className="surge-loss" aria-hidden="true">
              {Array.from({ length: events.lost }, (_, i) => (
                <span
                  key={i}
                  className="lost-token"
                  style={delayStyle(staggerDelay(i))}
                />
              ))}
            </span>
          )}
        </div>
        <div className="risk-track motion-tremor">
          <span
            key={events.burn}
            className={classes(
              engine.stress > 0 && "risk-active",
              events.burn > 0 && "motion-surge",
            )}
          >
            <Triangle size={13} />
            {band}
            {engine.stress > 0 ? ` / ${engine.stress} burnt` : ""}
          </span>
          <small>
            {engine.bagRemaining === 0
              ? "Body spent. Your bag refreshes next round."
              : engine.pending.length === 0
                ? `Next push: ${engine.bagHazards} / ${engine.bagRemaining} breaks it. Nothing is at stake yet, so that costs no instability, but the hazard goes back in the bag.`
                : `Next push: ${engine.bagHazards} / ${engine.bagRemaining} loses all ${engine.pending.length} and adds ${engine.pending.length + engine.stress} instability. A hazard goes back in the bag.`}
          </small>
          <small
            className={classes("surge-note", (clean || spread) && "tuned")}
          >
            {!pending.length
              ? "An action spends the entire surge, so push for the size and the mix you need."
              : clean
                ? `Clean surge: all ${[...kinds][0]}. Worth ${surgeOutput(pending)} — its own size again.`
                : spread
                  ? `Full spread. Worth ${surgeOutput(pending)} — doubled.`
                  : `Worth ${surgeOutput(pending)}. ${safe.length} of the 3 safe kinds; all three doubles it, one kind alone pays its size again.`}
            {pending.length > 0 &&
              ` Committing spends the whole ${pending.length}-token surge.`}
          </small>
          <small className={classes("surge-note", kept > 0 && "keep")}>
            {kept > 0
              ? `Holding ${kept}. They survive the refill, but you stay amped and start next round at ${kept} burn.`
              : "Click a token to hold it past the refill. Staying amped costs burn."}
          </small>
        </div>
      </div>
      {events.burn > 0 && !reduced && (
        <span key={events.burn} className="burnout" aria-hidden="true">
          <span className="burnout-flash" />
          <span className="hazard-return">
            <Triangle size={14} />
          </span>
        </span>
      )}
    </div>
  );
}

const moduleOrder = [
  "move",
  "engage",
  "investigate",
  "contribute",
  "acquire",
  "assist",
  "recover",
] as const;

const moduleNames = {
  move: "Drive",
  engage: "Strike",
  investigate: "Scan",
  contribute: "Fabricate",
  acquire: "Salvage",
  assist: "Uplink",
  recover: "Prime",
} as const;

/**
 * Construction. Deterministic, and deliberately the quietest of the four: a
 * marker seats into its module with a snap and stays there. The one thing
 * worth animating is priming, this engine's only piece of sequencing, which
 * runs a current along the row toward the placement it will enhance.
 */
function SystemsEngine({
  view,
  selected,
  piece,
  onSelect,
  onAction,
  onKeep,
  disabled,
}: EngineProps) {
  const engine = view.engine;
  const markers = engine.markers;
  const arrivals = useArrivals(markers);
  const order = arrivalOrder(markers, arrivals);
  const seated = useArrivals(engine.slots);
  const primed = engine.slots.includes("primed");
  const prime = usePulse(primed);
  // A placement is worth more wired to what is already built beside it, so
  // the row shows what each empty module would pay before a marker is spent.
  const best = Math.max(
    0,
    ...moduleOrder
      .filter((slot) => !engine.slots.includes(slot))
      .map((slot) => wiring(engine.slots, slot)),
  );
  const kept = engine.keptSlots.length;
  return (
    <div className="systems-engine">
      <div className="marker-supply">
        {markers.map((id, i) => (
          <button
            key={id}
            {...piece(id)}
            aria-label={`Marker ${i + 1}`}
            className={classes(
              "placement-marker",
              selected.includes(id) && "selected",
              arrivals.has(id) && "motion-arrive",
            )}
            style={delayStyle(staggerDelay(order.get(id) ?? 0))}
          >
            <Hexagon size={29} />
            <span>{i + 1}</span>
          </button>
        ))}
        {!markers.length && (
          <span className="empty-engine">All markers placed.</span>
        )}
      </div>
      <div className={classes("system-modules", primed && "motion-current")}>
        {moduleOrder.map((slot) => (
          <button
            key={slot}
            className={classes(
              "system-module",
              engine.slots.includes(slot) && "occupied",
              engine.keptSlots.includes(slot) && "held",
              seated.has(slot) && "motion-seat",
            )}
            onClick={() =>
              engine.slots.includes(slot) ? onKeep(slot) : onAction(slot)
            }
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (engine.slots.includes(slot)) return;
              const id = event.dataTransfer.getData("text/plain");
              if (engine.markers.includes(id)) {
                if (!selected.includes(id)) onSelect(id);
                onAction(slot);
              }
            }}
            aria-label={
              engine.slots.includes(slot)
                ? `${engine.keptSlots.includes(slot) ? "Release" : "Hold"} the ${slot} module`
                : `${slot} module`
            }
            disabled={disabled}
          >
            <span>
              {engine.slots.includes(slot) ? (
                <Hexagon size={19} fill="currentColor" />
              ) : (
                <Plus size={19} />
              )}
            </span>
            <strong>{moduleNames[slot]}</strong>
            <em className="module-wire">
              {engine.slots.includes(slot)
                ? engine.keptSlots.includes(slot)
                  ? "HELD"
                  : "BUILT"
                : wiring(engine.slots, slot)
                  ? `+${wiring(engine.slots, slot)}`
                  : ""}
            </em>
          </button>
        ))}
      </div>
      <small
        key={prime}
        className={classes("system-note", primed && "motion-flash")}
      >
        {primed
          ? "PRIMED: next effect placement +1."
          : "Prime via Recover: next effect placement +1."}{" "}
        One placement per module.{" "}
        {best > 0
          ? `Building beside what stands is worth up to +${best}: a contiguous machine beats scattered markers.`
          : "A placement is worth +1 for each built module beside it."}{" "}
        {kept > 0
          ? `${kept} module${kept === 1 ? "" : "s"} held past the rebuild, and counted against next round's markers.`
          : "Click a built module to hold it past the rebuild."}
      </small>
    </div>
  );
}

export function EngineConsole({
  view,
  selected,
  onSelect,
  onDraw,
  onAction,
  onAllocate,
  onKeep,
}: {
  view: MissionView;
  selected: string[];
  onSelect: (id: string) => void;
  onDraw: () => void;
  onAction: (action: MissionAction) => void;
  onAllocate: (die: string, facet: DieSlot) => void;
  onKeep: (piece: string) => void;
}) {
  const disabled =
    view.phase !== "action" ||
    (view.players.find((p) => p.seat === view.seat)?.ready ?? false);
  const piece = (id: string): PieceProps => ({
    draggable: !disabled,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData("text/plain", id);
    },
    onClick: () => onSelect(id),
    "aria-pressed": selected.includes(id),
    disabled,
  });
  const props: EngineProps = {
    view,
    selected,
    piece,
    onSelect,
    onDraw,
    onAction,
    disabled,
    onKeep,
  };
  // One component per seat rather than one component with four branches: each
  // console holds motion state, and changing seat has to reset it rather than
  // carry a dice tray's arrivals into a card hand.
  if (view.seat === "dice")
    return <DiceEngine {...props} onAllocate={onAllocate} />;
  if (view.seat === "cards") return <CardsEngine {...props} />;
  if (view.seat === "bag") return <BagEngine {...props} />;
  return <SystemsEngine {...props} />;
}
