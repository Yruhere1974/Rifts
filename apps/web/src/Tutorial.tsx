import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  LocateFixed,
  Pause,
} from "lucide-react";
import type { MissionAction, MissionView, Seat } from "@rifts/rules";

type Lesson = {
  title: string;
  instruction: string;
  consequence: string;
  target: string;
  complete: (view: MissionView) => boolean;
};
const logged = (view: MissionView, text: string) =>
  view.log.some((entry) => entry.text.includes(text));

const lessons: Lesson[] = [
  {
    title: "One crisis, four perspectives",
    instruction:
      "Start as Vanguard. Read Your perception below your kit, then Share reading with team.",
    consequence:
      "Your reading becomes public, but one report alone cannot establish safe timing. The shared breach needs 24 stabilization before instability reaches 12.",
    target: ".private-section",
    complete: (v) =>
      v.reports.some((r) => r.seat === "soldier" && r.location === "rift"),
  },
  {
    title: "Commit a die to the relay",
    instruction:
      "As Vanguard, select The relay on the map. Select a low die, choose Contribute, read the preview, then Commit contribute.",
    consequence:
      "The die and 2 shared Power are spent. The relay adds 1 instability now, but doubles every later breach contribution. Keep your high dice for stronger effects.",
    target: ".engine-section",
    complete: (v) => !v.shield,
  },
  {
    title: "Keep power or give it away",
    instruction:
      "Open Unclaimed power core. Compare the permanent personal upgrade with donating 2 shared Power, then choose either.",
    consequence:
      "Donating funds two breach actions but forfeits your upgrade. Keeping the core means the team must acquire Power or donate another specialist's core later.",
    target: ".engine-footer button:nth-child(2)",
    complete: (v) =>
      logged(v, "kept the artifact") || logged(v, "donated their artifact"),
  },
  {
    title: "Corroborate the reading",
    instruction:
      "Switch to Wayfinder in the crew strip. Read their different perception and Share reading with team.",
    consequence:
      "Vanguard's pulse onset and Wayfinder's quiet interval reveal safe timing together. Other specialists cannot substitute for those readings. Blind work would add 5 instability per contribution; your shared information removes that risk.",
    target: ".crew-seat:nth-child(2)",
    complete: (v) => v.frequencyKnown,
  },
  {
    title: "Hold a response in reserve",
    instruction:
      "As Wayfinder, choose Hold capability. Keep Exploit Opening for an ally rather than spending it on yourself.",
    consequence:
      "Holding does not end your opportunities. You can react later in this same team round, even after another specialist acts.",
    target: ".engine-footer",
    complete: (v) => logged(v, "Mage holds capability"),
  },
  {
    title: "Place systems, then request support",
    instruction:
      "Switch to Operator. Select The breach, select a marker, Move and commit. Select another marker, Recover and commit. Then Request help.",
    consequence:
      "Move and Recover occupy different modules. Recover primes your next effect for +1; each module accepts only one placement per round. Your request appears in the team channel.",
    target: ".engine-section",
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Operator: recover") &&
          entry.text.includes("prime next effect placement"),
      ) && logged(v, "Operator requests help"),
  },
  {
    title: "Spend a card on someone else",
    instruction:
      "Switch to Wayfinder. Select Exploit Opening, choose Assist, set the recipient to Operator, then commit.",
    consequence:
      "Restoring the relay made this card worth +2 support. The card leaves your hand: helping costs an opportunity you could have spent yourself.",
    target: '.action-slots button[title="Assist"]',
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Mage: assist operator") &&
          entry.text.includes("Cost: 1 engine piece"),
      ),
  },
  {
    title: "Combine the team's work",
    instruction:
      "Switch to Operator. Keep The breach selected, select a marker and Contribute. Check the combined output before committing. If Power is empty, donate a core first.",
    consequence:
      "Your placement, priming and Wayfinder's support combine before the relay doubles the result. The shared objective advances and the stored support is consumed.",
    target: ".action-section",
    complete: (v) => logged(v, "Operator: contribute rift"),
  },
  {
    title: "Ask for one more",
    instruction:
      "Switch to Pathfinder and Push twice. Watch the band above the button move as safe tokens leave the bag. Stop when the odds stop being worth it.",
    consequence:
      "Each push makes the next one riskier, because safe tokens leave the bag and hazards always go back in. A hazard costs the whole surge and adds instability, and the second burnout costs more than the first. This is a real loss, not a tutorial reset.",
    target: ".engine-section",
    complete: (v) =>
      v.log.filter((e) => e.text.includes("pushed for another surge token"))
        .length >= 2,
  },
  {
    title: "Spend the surge whole",
    instruction:
      "As Pathfinder, select The breach, then Commit move. Push again, then Contribute. Acquire Power first if the reserve is empty.",
    consequence:
      "An action spends the entire surge, so you push to the size the action deserves: once for a move, harder for a contribution. Bag tokens reach the same reserves and objective as dice, cards and placements, and every breach contribution still costs 1 shared Power.",
    target: ".action-section",
    complete: (v) => logged(v, "Scout: contribute rift"),
  },
  {
    title: "Weave a stronger effect",
    instruction:
      "Switch to Wayfinder. Spend one Channel card to Move to The breach. Select the remaining Channel and one Resonance together, then Contribute. Donate a core or Acquire Power if needed.",
    consequence:
      "A two-card weave produces 3 effect (4 if upgraded), doubled by the relay. You are managing combinations, not rolling another specialist's dice.",
    target: ".engine-section",
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Mage: contribute rift") &&
          entry.text.includes("Cost: 2 engine pieces"),
      ),
  },
  {
    title: "Close Greyhaven's breach",
    instruction:
      "Use the remaining crew capability to reach 24. Vanguard can move with a low die and contribute with high dice. Operator can assist Vanguard if its Uplink is still free. Acquire Power or donate remaining cores when needed.",
    consequence:
      "Need fresh pieces? Finish round for each of the four specialists; only then does the world add instability and refill all engines. Rounds 3 and 5 also grow every engine, so a longer mission gives the team more capability as well as more pressure. Engage the patrol at West gate to reduce future pressure, or Recover to lower instability. The sixth round is the deadline.",
    target: ".objective-section",
    complete: (v) => v.phase === "won",
  },
];

type Guidance = {
  selected: string;
  pieces: string[];
  action: MissionAction;
  recipient: Seat;
  artifactOpen: boolean;
};

// These hints follow client selection and the filtered view; they never commit actions.
function nextTarget(index: number, view: MissionView, ui: Guidance): string {
  const requiredSeat: (Seat | null)[] = [
    "soldier",
    "soldier",
    null,
    "mage",
    "mage",
    "operator",
    "mage",
    "operator",
    "scout",
    "scout",
    "mage",
    null,
  ];
  const seat = requiredSeat[index];
  if (seat && seat !== view.seat) return `[data-tutorial-seat="${seat}"]`;
  const core = ui.artifactOpen
    ? ".core-choices button:not(:disabled)"
    : '[data-tutorial="core"]';
  if (ui.artifactOpen || index === 2) return core;
  if (index === 0 || index === 3) return ".share-button";
  if (index === 4) return '[data-tutorial="hold"]';
  if (index === 8) return '[data-tutorial="push"]';

  const player = view.players.find((p) => p.seat === view.seat)!;
  let action: MissionAction = "contribute";
  const location = index === 1 ? "relay" : "rift";
  if (index === 5) {
    if (player.location !== "rift") action = "move";
    else if (!view.engine.slots.includes("recover")) action = "recover";
    else return '[data-tutorial="request"]';
  } else if (index === 6) action = "assist";
  else if (
    (index === 9 || index === 10 || index === 7) &&
    player.location !== "rift"
  )
    action = "move";
  if (index === 11) return ".objective-section";
  if (
    action === "contribute" &&
    view.resources.power < (location === "relay" ? 2 : 1)
  ) {
    if (view.artifact) return core;
    action = "acquire";
  }
  if (
    action !== "assist" &&
    action !== "recover" &&
    action !== "acquire" &&
    ui.selected !== location
  )
    return `.location-pin.${location}`;
  const requiredPieces = index === 10 && action === "contribute" ? 2 : 1;
  if (ui.pieces.length < requiredPieces) {
    if (view.seat === "mage") {
      const name =
        index === 6
          ? "Exploit Opening"
          : ui.pieces.length === 0
            ? "Channel"
            : "Resonance";
      return `.playing-card[aria-label="${name} card"][aria-pressed="false"]`;
    }
    if (view.seat === "operator")
      return '.placement-marker[aria-pressed="false"]';
    if (view.seat === "scout") return '[data-tutorial="push"]';
    return '.die[aria-pressed="false"]';
  }
  if (ui.action !== action)
    return `.action-slots button[title="${action[0]!.toUpperCase() + action.slice(1)}"]`;
  if (action === "assist" && ui.recipient !== "operator")
    return '[aria-label="Assistance recipient"]';
  if (action === "acquire")
    return '[aria-label="Resource to acquire"], [data-tutorial="commit"]';
  return '[data-tutorial="commit"]';
}

export function Tutorial({
  view,
  active,
  onPause,
  guidance,
}: {
  view: MissionView;
  active: boolean;
  onPause: () => void;
  guidance: Guidance;
}) {
  const [index, setIndex] = useState(0);
  const lesson = lessons[index]!;
  const complete = lesson.complete(view);
  const targetSelector = complete
    ? '[data-tutorial="next"]'
    : nextTarget(index, view, guidance);
  useEffect(() => {
    if (!active || view.phase !== "action") return;
    const targets = document.querySelectorAll<HTMLElement>(targetSelector);
    targets.forEach((target) => target.classList.add("tutorial-beacon"));
    return () =>
      targets.forEach((target) => target.classList.remove("tutorial-beacon"));
  }, [active, view, targetSelector]);
  if (!active || view.phase !== "action") return null;
  return (
    <section className="tutorial-band" aria-label="Guided tutorial">
      <div className="tutorial-copy" aria-live="polite" aria-atomic="true">
        <span className="eyebrow">
          <Compass size={14} /> FIELD TRAINING / {index + 1} OF {lessons.length}
        </span>
        <h2>{lesson.title}</h2>
        <p>{lesson.instruction}</p>
        <p className="tutorial-consequence">{lesson.consequence}</p>
        <strong className="tutorial-status">
          {complete
            ? "Lesson complete. Continue when ready."
            : "Complete this on the live table, or skip to keep exploring."}
        </strong>
      </div>
      <div className="tutorial-controls">
        <button
          className="text-button"
          onClick={() => {
            const target = document.querySelector<HTMLElement>(targetSelector);
            target?.scrollIntoView({ block: "center", behavior: "instant" });
            const control = target?.matches("button:not(:disabled), select")
              ? target
              : target?.querySelector<HTMLElement>("button:not(:disabled)");
            control?.focus({ preventScroll: true });
          }}
        >
          <LocateFixed size={16} /> Show me where
        </button>
        <button
          className="primary-button"
          data-tutorial="next"
          disabled={!complete || index === lessons.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          <Check size={16} /> Next lesson
        </button>
        <div className="tutorial-navigation">
          <button
            className="icon-button"
            title="Previous lesson"
            aria-label="Previous lesson"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="text-button"
            disabled={index === lessons.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Skip lesson <ArrowRight size={16} />
          </button>
          <button
            className="icon-button"
            title="Pause tutorial"
            aria-label="Pause tutorial"
            onClick={onPause}
          >
            <Pause size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
