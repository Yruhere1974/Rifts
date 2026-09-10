import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  LocateFixed,
  Pause,
} from "lucide-react";
import { facetForAction } from "@rifts/rules";
import type { MissionAction, MissionView, Seat } from "@rifts/rules";

type Lesson = {
  title: string;
  instruction: string;
  consequence: string;
  /** Fallback highlight when the lesson has no step-by-step guidance. */
  target: string;
  /** The seat this lesson is taught from, if it matters. */
  seat?: Seat;
  complete: (view: MissionView) => boolean;
  /** Which control to highlight next, given live selection and state. */
  guide?: (view: MissionView, ui: Guidance) => string;
};
const logged = (view: MissionView, text: string) =>
  view.log.some((entry) => entry.text.includes(text));

type Guidance = {
  /** The objective the player has selected, or "" for open ground. */
  selected: string;
  pieces: string[];
  /** Raw selection, before it becomes a commitment. The dice platform stages a
   * die here first and only then allocates it to a system. */
  staged: string[];
  action: MissionAction;
  recipient: Seat;
  artifactOpen: boolean;
};

const coreTarget = (ui: Guidance) =>
  ui.artifactOpen
    ? ".core-choices button:not(:disabled)"
    : '[data-tutorial="core"]';

/** The control to touch next when staging an action against a site. */
function stage(
  view: MissionView,
  ui: Guidance,
  want: { action: MissionAction; site?: string; pieces?: number },
): string {
  const needed = want.pieces ?? 1;
  if (want.site && want.action !== "assist" && want.action !== "recover") {
    if (ui.selected !== want.site) return `.location-pin.${want.site}`;
  }
  if (ui.pieces.length < needed) {
    if (view.seat === "dice") {
      // A loose die first, then the one system it powers: pointing at every
      // system would let a follower load the wrong one and stall.
      const facet = facetForAction[want.action];
      if (!facet) return '.die[aria-pressed="false"]';
      return ui.staged.length
        ? `.facet[data-facet="${facet}"]`
        : '.die[aria-pressed="false"]';
    }
    if (view.seat === "cards") return `.playing-card[aria-pressed="false"]`;
    if (view.seat === "systems")
      return '.placement-marker[aria-pressed="false"]';
    if (view.seat === "bag") return '[data-tutorial="push"]';
    return '.die[aria-pressed="false"]';
  }
  if (ui.action !== want.action)
    return `.action-slots button[title="${
      want.action[0]!.toUpperCase() + want.action.slice(1)
    }"]`;
  return '[data-tutorial="commit"]';
}

/** Crossing the map takes several commitments, so keep pointing at Move. */
const journey = (view: MissionView, ui: Guidance, site: string) =>
  stage(view, ui, { action: "move", site });

const at = (view: MissionView, site: string) =>
  view.players.find((p) => p.seat === view.seat)?.location === site;

/** Contribute needs Power; fall back to a core or to Acquire when short. */
function fund(view: MissionView, ui: Guidance, site: string): string | null {
  if (view.resources.power >= (site === "relay" ? 2 : 1)) return null;
  if (view.artifact) return coreTarget(ui);
  return stage(view, ui, { action: "acquire" });
}

const lessons: Lesson[] = [
  {
    title: "One crisis, four perspectives",
    seat: "dice",
    instruction:
      "Start as Glitter Boy. Read Your perception below your kit, then Share reading with team.",
    consequence:
      "Your reading becomes public, but one report alone cannot establish safe timing. The shared breach needs 24 stabilization before instability reaches 12.",
    target: ".share-button",
    complete: (v) =>
      v.reports.some((r) => r.seat === "dice" && r.location === "rift"),
  },
  {
    title: "Commit a die to the relay",
    seat: "dice",
    instruction:
      "You are already standing in the relay chamber. Select a low die, put it in the Stabilizer system, choose Contribute, then commit.",
    consequence:
      "The platform has six systems, five dice and three routings, so it can never run them all. Worse, routing surge to a system browns out every die still loose below it, so the order you route in decides how much of the roll survives. Route from the bottom when you want everything to fit; take the top first when one big shot is worth the rest. A low die is enough for the relay, which adds 1 instability now but doubles every later breach contribution.",
    target: ".engine-section",
    complete: (v) => !v.shield,
    guide: (v, ui) =>
      fund(v, ui, "relay") ??
      stage(v, ui, { action: "contribute", site: "relay" }),
  },
  {
    title: "Keep power or give it away",
    instruction:
      "Open Unclaimed power core. Compare the permanent personal upgrade with donating 2 shared Power, then choose either.",
    consequence:
      "Donating funds two breach actions but forfeits your upgrade. Keeping the core means the team must acquire Power or donate another specialist's core later.",
    target: '[data-tutorial="core"]',
    complete: (v) =>
      logged(v, "kept the artifact") || logged(v, "donated their artifact"),
    guide: (_v, ui) => coreTarget(ui),
  },
  {
    title: "Corroborate the reading",
    seat: "cards",
    instruction:
      "Switch to Ley Line Walker in the crew strip. Read their different perception and Share reading with team.",
    consequence:
      "Glitter Boy's pulse onset and Ley Line Walker's quiet interval reveal safe timing together. Other specialists cannot substitute for those readings. Blind work would add 5 instability per contribution; your shared information removes that risk.",
    target: ".share-button",
    complete: (v) => v.frequencyKnown,
  },
  {
    title: "Hold a response in reserve",
    seat: "cards",
    instruction:
      "As Ley Line Walker, choose Hold capability. Keep Exploit Opening for an ally rather than spending it on yourself.",
    consequence:
      "Holding does not end your opportunities. You can react later in this same team round, even after another specialist acts.",
    target: '[data-tutorial="hold"]',
    complete: (v) => logged(v, "Ley Line Walker holds capability"),
  },
  {
    title: "Ground has to be crossed",
    seat: "systems",
    instruction:
      "Switch to Techno-Wizard. Select The breach, place a marker on Move and commit. You will not arrive in one go: repeat until the inspector says You are here.",
    consequence:
      "The board is a hex map and your engine's output buys distance, so a stronger commitment carries you further. Highlighted hexes show this move's reach, and heading for a distant objective takes you as far as it can. Move is the one placement that never occupies a module, so you can keep driving; every other module still accepts one placement per round.",
    target: ".map-surface",
    complete: (v) =>
      v.players.find((p) => p.seat === "systems")?.location === "rift",
    guide: (v, ui) => journey(v, ui, "rift"),
  },
  {
    title: "Room to stand",
    instruction:
      "Look at the board. Each specialist covers several hexes, and Glitter Boy covers far more than the rest. Select West gate and Silent archive to see where the passages narrow.",
    consequence:
      "A standard specialist fits through every passage. Glitter Boy is a walking weapons platform and cannot use the narrow routes to the gate or the archive at all, so it holds the main hall to the breach while others take the side ways. Size is a real constraint, not decoration.",
    target: ".map-labels",
    complete: (v) =>
      v.reports.length > 0 &&
      v.players.find((p) => p.seat === "systems")?.location === "rift",
  },
  {
    title: "Prime the machine, then ask for help",
    seat: "systems",
    instruction:
      "Still as Techno-Wizard at the breach, place a marker on Recover and commit. Then Request help.",
    consequence:
      "Recover primes your next effect for +1. Each module other than Move accepts a single placement per round, and a placement is worth +1 more for each built module beside it in the row, so where you build matters as much as what you build. Your request appears in the team channel.",
    target: ".engine-section",
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Techno-Wizard: recover") &&
          entry.text.includes("prime next effect placement"),
      ) && logged(v, "Techno-Wizard requests help"),
    guide: (v, ui) =>
      !v.engine.slots.includes("recover")
        ? stage(v, ui, { action: "recover" })
        : '[data-tutorial="request"]',
  },
  {
    title: "Spend a card on someone else",
    seat: "cards",
    instruction:
      "Switch to Ley Line Walker. Select Exploit Opening, choose Assist, set the recipient to Techno-Wizard, then commit.",
    consequence:
      "Restoring the relay made this card worth +2 support. The card leaves your hand: helping costs an opportunity you could have spent yourself.",
    target: '.action-slots button[title="Assist"]',
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Ley Line Walker: assist systems") &&
          entry.text.includes("Cost: 1 engine piece"),
      ),
    guide: (v, ui) =>
      ui.pieces.length < 1
        ? '.playing-card[aria-label="Exploit Opening card"][aria-pressed="false"]'
        : ui.action !== "assist"
          ? '.action-slots button[title="Assist"]'
          : ui.recipient !== "systems"
            ? '[aria-label="Assistance recipient"]'
            : '[data-tutorial="commit"]',
  },
  {
    title: "Combine the team's work",
    seat: "systems",
    instruction:
      "Switch to Techno-Wizard. Keep The breach selected, place a marker on Contribute and check the combined output before committing.",
    consequence:
      "Your placement, priming and Ley Line Walker's support combine before the relay doubles the result. The shared objective advances and the stored support is consumed.",
    target: ".action-section",
    complete: (v) => logged(v, "Techno-Wizard: contribute rift"),
    guide: (v, ui) =>
      fund(v, ui, "rift") ??
      stage(v, ui, { action: "contribute", site: "rift" }),
  },
  {
    title: "Ask for one more",
    seat: "bag",
    instruction:
      "Switch to Juicer and Push twice. Watch the band above the button move as safe tokens leave the bag. Stop when the odds stop being worth it.",
    consequence:
      "Each push makes the next one riskier, because safe tokens leave the bag and hazards always go back in. What comes out matters too: a surge of one kind pays its own size again, and one holding find, cache and signal together doubles. A hazard costs the whole surge and adds instability, and the second burnout costs more than the first. This is a real loss, not a tutorial reset.",
    target: ".engine-section",
    complete: (v) =>
      v.log.filter((e) => e.text.includes("pushed for another surge token"))
        .length >= 2,
    guide: () => '[data-tutorial="push"]',
  },
  {
    title: "Spend the surge whole",
    seat: "bag",
    instruction:
      "As Juicer, select The breach and Commit move until you arrive, pushing again whenever the surge is empty. Then push once more and Contribute.",
    consequence:
      "An action spends the entire surge, so you push to the size the action deserves: a long push crosses more ground, and a long push also contributes more. Bag tokens reach the same reserves and objective as dice, cards and placements, and every breach contribution still costs 1 shared Power.",
    target: ".action-section",
    complete: (v) => logged(v, "Juicer: contribute rift"),
    guide: (v, ui) =>
      v.engine.pending.length === 0
        ? '[data-tutorial="push"]'
        : !at(v, "rift")
          ? journey(v, ui, "rift")
          : (fund(v, ui, "rift") ??
            stage(v, ui, { action: "contribute", site: "rift" })),
  },
  {
    title: "Weave a stronger effect",
    seat: "cards",
    instruction:
      "Switch to Ley Line Walker. Spend cards to Move to The breach, then select a Channel and a Resonance together and Contribute.",
    consequence:
      "A weave alternates Channel and Resonance, and length pays more than the cards are worth apart: 1, 3, 6, 10. This pair produces 3 (4 if upgraded), doubled by the relay. Nothing you hold back is lost, but the network only re-forms three cards a round, so emptying your hand for one huge chain leaves the next round thin. A single card moves you further than it contributes, so the hand is spent between travelling and arriving.",
    target: ".engine-section",
    complete: (v) =>
      v.log.some(
        (entry) =>
          entry.text.includes("Ley Line Walker: contribute rift") &&
          entry.text.includes("Cost: 2 engine pieces"),
      ),
    guide: (v, ui) =>
      !at(v, "rift")
        ? journey(v, ui, "rift")
        : (fund(v, ui, "rift") ??
          stage(v, ui, { action: "contribute", site: "rift", pieces: 2 })),
  },
  {
    title: "Close Greyhaven's breach",
    instruction:
      "Use the remaining crew capability to reach 24. Glitter Boy allocates dice to Drive to reach the breach and to Stabilizer to close it. Acquire Power or donate remaining cores when needed.",
    consequence:
      "Need fresh pieces? Finish round for each of the four specialists; only then does the world add instability and refill all engines. Rounds 3 and 5 also grow every engine, so a longer mission gives the team more capability as well as more pressure. Crossing the map costs capability too, so plan who travels and who stays. The sixth round is the deadline.",
    target: ".objective-section",
    complete: (v) => v.phase === "won",
  },
];

// These hints follow client selection and the filtered view; they never commit actions.
function nextTarget(index: number, view: MissionView, ui: Guidance): string {
  const lesson = lessons[index];
  if (!lesson) return ".objective-section";
  if (lesson.seat && lesson.seat !== view.seat)
    return `[data-tutorial-seat="${lesson.seat}"]`;
  if (ui.artifactOpen) return coreTarget(ui);
  return lesson.guide?.(view, ui) ?? lesson.target;
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
