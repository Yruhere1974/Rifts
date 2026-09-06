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

export const identities = {
  soldier: {
    title: "Vanguard",
    engine: "Dice allocation",
    icon: Dices,
    color: "#e5b65c",
    upgrade:
      "Gain a sixth die immediately and each round. More allocation choices for the rest of the mission.",
  },
  mage: {
    title: "Wayfinder",
    engine: "Card weaving",
    icon: Layers,
    color: "#b09be3",
    upgrade:
      "Channel + Resonance gains another +1 effect for the rest of the mission.",
  },
  scout: {
    title: "Pathfinder",
    engine: "Push your luck",
    icon: Compass,
    color: "#73c4a1",
    upgrade:
      "Replace one hazard with a double-output jackpot in this bag and each future bag.",
  },
  operator: {
    title: "Operator",
    engine: "Systems placement",
    icon: CircuitBoard,
    color: "#6ab7d8",
    upgrade:
      "Gain a fifth placement marker immediately and each round. Occupied modules still limit placements.",
  },
} satisfies Record<
  Seat,
  {
    title: string;
    engine: string;
    icon: typeof Dices;
    color: string;
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
export function EngineConsole({
  view,
  selected,
  onSelect,
  onDraw,
  onBank,
  onAction,
}: {
  view: MissionView;
  selected: string[];
  onSelect: (id: string) => void;
  onDraw: () => void;
  onBank: () => void;
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
  if (view.seat === "soldier")
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
  if (view.seat === "mage")
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
  if (view.seat === "scout")
    return (
      <div className="bag-engine">
        <button
          className="draw-bag"
          disabled={disabled || engine.bagRemaining === 0 || engine.banked}
          onClick={onDraw}
          aria-label="Draw from bag"
        >
          <Compass size={31} strokeWidth={1} />
          <strong>{engine.banked ? "Secured" : "Draw"}</strong>
          <small>{engine.bagRemaining} in bag</small>
        </button>
        <div className="bag-pulls">
          <div className="token-tray">
            {engine.drawn.map((token) => (
              <button
                key={token.id}
                {...componentProps(token.id)}
                disabled={disabled || token.kind === "hazard"}
                className={`bag-token ${token.kind === "hazard" ? "hazard" : ""} ${selected.includes(token.id) ? "selected" : ""}`}
                aria-label={`${token.kind} token`}
              >
                {token.kind === "hazard" ? (
                  <Triangle size={21} />
                ) : (
                  <Diamond size={21} />
                )}
                <span>{token.kind}</span>
              </button>
            ))}
            {!engine.drawn.length && (
              <span className="empty-engine">No tokens in your haul.</span>
            )}
          </div>
          <div className="risk-track">
            <span className={engine.hazards > 0 ? "risk-active" : ""}>
              <Triangle size={13} />
              {engine.hazards} / 2 hazards
            </span>
            <small>
              {engine.banked
                ? "Haul secured. Draw again next round."
                : `Next draw: ${engine.bagHazards} / ${engine.bagRemaining} ${engine.hazards ? "bust risk" : "hazard risk"}. Second hazard loses the haul.`}
            </small>
            {!engine.banked && (
              <button
                className="bank-button"
                data-tutorial="bank"
                onClick={onBank}
                disabled={
                  disabled || !engine.drawn.some((t) => t.kind !== "hazard")
                }
              >
                Bank haul / end expedition
              </button>
            )}
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
