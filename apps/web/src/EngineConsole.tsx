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
import type {
  GlitterFacet,
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
/** The platform's systems, in the order the panel reads them. */
const facetPanel: {
  facet: GlitterFacet;
  name: string;
  note: string;
}[] = [
  { facet: "mobility", name: "Drive", note: "Move" },
  { facet: "targeting", name: "Targeting", note: "Engage" },
  { facet: "boom", name: "Boom Gun", note: "Doubles, needs a brace" },
  { facet: "bracing", name: "Bracing", note: "Holds the shot steady" },
  { facet: "stabilizer", name: "Stabilizer", note: "Contribute" },
  { facet: "shield", name: "Shield", note: "Recover" },
];

function DiceEngine({
  view,
  selected,
  piece,
  onAllocate,
}: EngineProps & {
  onAllocate: (die: string, facet: GlitterFacet | null) => void;
}) {
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
          return (
            <button
              key={entry.facet}
              className={`facet${inside.length ? " loaded" : ""}${inert ? " inert" : ""}`}
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
                {inert
                  ? "UNBRACED"
                  : output
                    ? `${entry.facet === "boom" ? output * 2 : output} output`
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
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/** Where the thread ties into a card: across its art, not its text. */
const anchor = (card: HTMLElement): { x: number; y: number } => ({
  x: Math.round(card.offsetLeft + card.offsetWidth / 2),
  y: Math.round(card.offsetTop + card.offsetHeight * 0.36),
});

/**
 * Combination. One Channel plus one Resonance is the only legal two-card
 * weave, so that pairing — and only it — draws a live thread between the two
 * cards. Two Channels produce no thread at all: the silence is the feedback,
 * and the player has spent nothing to learn it.
 */
function CardsEngine({ view, selected, piece }: EngineProps) {
  const hand = view.engine.hand;
  const ids = hand.map((card) => card.id);
  const arrivals = useArrivals(ids);
  const order = arrivalOrder(ids, arrivals);
  const chosen = hand.filter((card) => selected.includes(card.id));
  const channel = chosen.find((card) => card.kind === "channel");
  const resonance = chosen.find((card) => card.kind === "spell");
  const woven = chosen.length === 2 && channel && resonance;
  const from = woven ? channel.id : "";
  const to = woven ? resonance.id : "";
  const handRef = useRef<HTMLDivElement>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  useEffect(() => {
    const row = handRef.current;
    if (!row || !from || !to) return;
    // The hand scrolls and reflows, so the thread is measured through an
    // observer rather than once. Writing from the frame callback also keeps
    // the state update out of the effect body.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const head = row.querySelector<HTMLElement>(`[data-card="${from}"]`);
        const tail = row.querySelector<HTMLElement>(`[data-card="${to}"]`);
        if (!head || !tail) return;
        setThread({
          key: `${from}|${to}`,
          width: row.scrollWidth,
          height: row.clientHeight,
          from: anchor(head),
          to: anchor(tail),
        });
      });
    });
    observer.observe(row);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to]);
  const live = thread && thread.key === `${from}|${to}` ? thread : null;
  const arc = live
    ? `M ${live.from.x} ${live.from.y} Q ${Math.round((live.from.x + live.to.x) / 2)} ${Math.max(6, Math.min(live.from.y, live.to.y) - 44)} ${live.to.x} ${live.to.y}`
    : "";
  return (
    <div className="card-hand" ref={handRef}>
      {hand.map((card) => (
        <button
          key={card.id}
          {...piece(card.id)}
          data-card={card.id}
          className={classes(
            "playing-card",
            selected.includes(card.id) && "selected",
            arrivals.has(card.id) && "motion-arrive",
          )}
          style={delayStyle(staggerDelay(order.get(card.id) ?? 0))}
          aria-label={`${card.name} card`}
        >
          <span className="card-type">{card.kind}</span>
          <Sparkles className="card-art" size={27} strokeWidth={1} />
          <strong>{card.name}</strong>
          <p>{card.description}</p>
          <span className="card-bottom">
            {selected.includes(card.id) ? "IN WEAVE" : "AVAILABLE"}
          </span>
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
          <circle
            className="weave-node"
            r={3.4}
            cx={live.from.x}
            cy={live.from.y}
          />
          <circle
            className="weave-node"
            r={3.4}
            cx={live.to.x}
            cy={live.to.y}
          />
        </svg>
      )}
    </div>
  );
}

/**
 * Push your luck. This is the one engine whose rules make agitation
 * meaningful, so the whole panel is tuned by the live bust band: a hum at
 * NOMINAL, a visible warning at REDLINE. A burnout kills the surge on screen
 * and walks the hazard back into the bag, which is the rule players forget.
 */
function BagEngine({ view, disabled, onDraw }: EngineProps) {
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
            <span
              key={token.id}
              className={classes(
                "bag-token",
                "selected",
                arrivals.has(token.id) && "motion-arrive",
              )}
              style={delayStyle(staggerDelay(order.get(token.id) ?? 0))}
              aria-label={`${token.kind} token in surge`}
            >
              <Diamond size={21} />
              <span>{token.kind}</span>
            </span>
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
              : `Next push: ${engine.bagHazards} / ${engine.bagRemaining} breaks the surge and adds ${engine.stress + 1} instability. A hazard goes back in the bag.`}
          </small>
          <small className="surge-note">
            {pending.length
              ? `Committing spends this whole ${pending.length}-token surge.`
              : "An action spends the entire surge, so push to the size you need."}
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
  disabled,
}: EngineProps) {
  const engine = view.engine;
  const markers = engine.markers;
  const arrivals = useArrivals(markers);
  const order = arrivalOrder(markers, arrivals);
  const seated = useArrivals(engine.slots);
  const primed = engine.slots.includes("primed");
  const prime = usePulse(primed);
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
              seated.has(slot) && "motion-seat",
            )}
            onClick={() => onAction(slot)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              if (engine.markers.includes(id)) {
                if (!selected.includes(id)) onSelect(id);
                onAction(slot);
              }
            }}
            aria-label={`${slot} module`}
            disabled={disabled || engine.slots.includes(slot)}
          >
            <span>
              {engine.slots.includes(slot) ? (
                <Hexagon size={19} fill="currentColor" />
              ) : (
                <Plus size={19} />
              )}
            </span>
            <strong>{moduleNames[slot]}</strong>
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
        One placement per module.
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
}: {
  view: MissionView;
  selected: string[];
  onSelect: (id: string) => void;
  onDraw: () => void;
  onAction: (action: MissionAction) => void;
  onAllocate: (die: string, facet: GlitterFacet | null) => void;
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
