import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  LocateFixed,
  Pause,
} from "lucide-react";
import type { MissionView } from "@rifts/rules";

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
    complete: (v) => v.reports.some((r) => r.seat === "soldier"),
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
      "Two independent reports reveal safe timing. Blind work would add 5 instability per contribution; your shared information removes that risk.",
    target: ".crew-seat:nth-child(2)",
    complete: (v) => v.reports.length >= 2,
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
    title: "Push your luck, then bank",
    instruction:
      "Switch to Pathfinder. Draw from the bag until you have two safe tokens, then Bank haul. Stop sooner if the risk feels too high.",
    consequence:
      "A second hazard destroys the pending haul and adds instability. Banking ends drawing for this round, but secured tokens can fund separate actions. A lost haul is a real consequence, not a tutorial reset.",
    target: ".engine-section",
    complete: (v) => logged(v, "Scout secured their haul"),
  },
  {
    title: "Bring your finds into the world",
    instruction:
      "As Pathfinder, select The breach. Spend one banked safe token on Move, then another on Contribute. If you banked only one, use it to Acquire Power instead and skip this lesson.",
    consequence:
      "Bag tokens affect the same reserves and objective as dice, cards and placements. Every breach contribution still costs 1 shared Power.",
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
      "Need fresh pieces? Finish round for each of the four specialists; only then does the world add instability and refill all engines. Engage the patrol at West gate to reduce future pressure, or Recover to lower instability. The sixth round is the deadline.",
    target: ".objective-section",
    complete: (v) => v.phase === "won",
  },
];

export function Tutorial({
  view,
  active,
  onPause,
}: {
  view: MissionView;
  active: boolean;
  onPause: () => void;
}) {
  const [index, setIndex] = useState(0);
  const lesson = lessons[index]!;
  const complete = lesson.complete(view);
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
            const target = document.querySelector<HTMLElement>(lesson.target);
            target?.scrollIntoView({ block: "center", behavior: "instant" });
            const control = target?.matches("button:not(:disabled)")
              ? target
              : target?.querySelector<HTMLElement>("button:not(:disabled)");
            control?.focus({ preventScroll: true });
          }}
        >
          <LocateFixed size={16} /> Show me where
        </button>
        <button
          className="primary-button"
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
