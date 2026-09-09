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
import type { DragEvent } from "react";
import type { MissionView, MissionAction, Seat } from "@rifts/rules";
import { specialists } from "@rifts/content";

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
export function EngineConsole({
  view,
  selected,
  onSelect,
  onDraw,
  onAction,
}: {
  view: MissionView;
  selected: string[];
  onSelect: (id: string) => void;
  onDraw: () => void;
  onAction: (action: MissionAction) => void;
}) {
  const engine = view.engine;
  const disabled =
    view.phase !== "action" ||
    view.players.find((p) => p.seat === view.seat)?.ready;
  const componentProps = (id: string) => ({
    draggable: !disabled,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData("text/plain", id);
    },
    onClick: () => onSelect(id),
    "aria-pressed": selected.includes(id),
    disabled,
  });
  if (view.seat === "dice")
    return (
      <div className="dice-engine">
        <div className="dice-tray">
          {engine.dice.map((die) => (
            <button
              key={die.id}
              {...componentProps(die.id)}
              aria-label={`Die ${die.value}`}
              className={`die ${selected.includes(die.id) ? "selected" : ""}`}
            >
              <span className="die-face">
                {Array.from({ length: 9 }, (_, i) => (
                  <i
                    key={i}
                    className={
                      pipPositions[die.value]?.includes(i) ? "pip" : ""
                    }
                  />
                ))}
              </span>
              <span className="die-value">{die.value}</span>
            </button>
          ))}
          {!engine.dice.length && (
            <p className="empty-engine">All dice committed.</p>
          )}
        </div>
        <div className="engine-rules">
          <span>
            ENGAGE <b>4+</b>
          </span>
          <span>
            ASSIST <b>3+</b>
          </span>
          <span>
            MOVE <b>ANY</b>
          </span>
        </div>
      </div>
    );
  if (view.seat === "cards")
    return (
      <div className="card-hand">
        {engine.hand.map((card) => (
          <button
            key={card.id}
            {...componentProps(card.id)}
            className={`playing-card ${selected.includes(card.id) ? "selected" : ""}`}
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
        {!engine.hand.length && (
          <p className="empty-engine">Your hand is spent.</p>
        )}
      </div>
    );
  if (view.seat === "bag")
    return (
      <div className="bag-engine">
        <button
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
            {engine.pending.map((token) => (
              <span
                key={token.id}
                className="bag-token selected"
                aria-label={`${token.kind} token in surge`}
              >
                <Diamond size={21} />
                <span>{token.kind}</span>
              </span>
            ))}
            {!engine.pending.length && (
              <span className="empty-engine">
                No surge. Push before committing an action.
              </span>
            )}
          </div>
          <div className="risk-track">
            <span className={engine.stress > 0 ? "risk-active" : ""}>
              <Triangle size={13} />
              {surgeBand(engine.bagHazards, engine.bagRemaining)}
              {engine.stress > 0 ? ` / ${engine.stress} burnt` : ""}
            </span>
            <small>
              {engine.bagRemaining === 0
                ? "Body spent. Your bag refreshes next round."
                : `Next push: ${engine.bagHazards} / ${engine.bagRemaining} breaks the surge and adds ${engine.stress + 1} instability. A hazard goes back in the bag.`}
            </small>
            <small className="surge-note">
              {engine.pending.length
                ? `Committing spends this whole ${engine.pending.length}-token surge.`
                : "An action spends the entire surge, so push to the size you need."}
            </small>
          </div>
        </div>
      </div>
    );
  return (
    <div className="systems-engine">
      <div className="marker-supply">
        {engine.markers.map((id, i) => (
          <button
            key={id}
            {...componentProps(id)}
            aria-label={`Marker ${i + 1}`}
            className={`placement-marker ${selected.includes(id) ? "selected" : ""}`}
          >
            <Hexagon size={29} />
            <span>{i + 1}</span>
          </button>
        ))}
        {!engine.markers.length && (
          <span className="empty-engine">All markers placed.</span>
        )}
      </div>
      <div className="system-modules">
        {(
          [
            "move",
            "engage",
            "investigate",
            "contribute",
            "acquire",
            "assist",
            "recover",
          ] as const
        ).map((slot) => (
          <button
            key={slot}
            className={`system-module ${engine.slots.includes(slot) ? "occupied" : ""}`}
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
            <strong>
              {slot === "recover"
                ? "Prime"
                : slot === "investigate"
                  ? "Scan"
                  : slot === "contribute"
                    ? "Fabricate"
                    : slot === "assist"
                      ? "Uplink"
                      : slot === "move"
                        ? "Drive"
                        : slot === "engage"
                          ? "Strike"
                          : "Salvage"}
            </strong>
          </button>
        ))}
      </div>
      <small className="system-note">
        {engine.slots.includes("primed")
          ? "PRIMED: next effect placement +1."
          : "Prime via Recover: next effect placement +1."}{" "}
        One placement per module.
      </small>
    </div>
  );
}
