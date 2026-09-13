import { missionObjectives, playableMission } from "@rifts/content";
import {
  missionRoundLimit,
  objectiveState,
  type MissionBriefing,
} from "@rifts/rules";

/**
 * What the team was sent in to do, and how each objective currently stands.
 *
 * It reads live off public mission state, so the same component serves the
 * lobby and the master map: in the lobby it says what you are choosing a
 * specialist for, and on the map it is the thing the drawing is measured
 * against. Nothing here is private to a seat.
 */
export type BriefSurface = {
  briefing: MissionBriefing[];
  round: number;
  instability: number;
  progress: number;
  requiredProgress: number;
  shield: boolean;
  frequencyKnown: boolean;
  threat: number;
};

export function MissionBrief({
  surface,
  onLight,
  onTakeSeat,
  clock = true,
}: {
  surface: BriefSurface;
  /**
   * Light the briefing mark an objective names. Only the master map can do
   * anything with it; the lobby has no drawing to light.
   */
  onLight?: ((marker: string | null) => void) | undefined;
  onTakeSeat?: (() => void) | undefined;
  /** The round and instability line, which means nothing before a mission runs. */
  clock?: boolean;
}) {
  const objectives = objectiveState(surface);
  return (
    <section className="master-map-brief" aria-label="Mission brief">
      <h3>{playableMission.name}</h3>
      <p className="master-map-objective">{playableMission.objective}</p>
      <p className="master-map-stake">{playableMission.stake}</p>
      <ul className="master-map-objectives">
        {missionObjectives.map((objective) => {
          const live = objectives.find((entry) => entry.id === objective.id);
          const mark = surface.briefing.find(
            (entry) => entry.id === objective.marker,
          );
          return (
            <li
              key={objective.id}
              className={`mm-objective${objective.scored ? " mm-objective-scored" : ""}${
                live?.done ? " mm-objective-done" : ""
              }`}
              // Pointing at an objective lights the mark that claims to
              // locate it, which is the whole tie between brief and map.
              onPointerEnter={() => onLight?.(objective.marker)}
              onPointerLeave={() => onLight?.(null)}
              onFocus={() => onLight?.(objective.marker)}
              onBlur={() => onLight?.(null)}
              tabIndex={0}
            >
              <div className="mm-objective-head">
                <strong>{objective.title}</strong>
                <span>{live?.readout}</span>
              </div>
              <p>{objective.detail}</p>
              {mark && (
                <p className="mm-objective-mark">
                  {mark.state === "struck"
                    ? `The briefing was wrong about ${mark.label.toLowerCase()}.`
                    : mark.state === "confirmed"
                      ? `Confirmed on the map: ${mark.label.toLowerCase()}.`
                      : `Briefing places this ${mark.precision === "known" ? "exactly" : mark.precision === "inferred" ? "roughly" : "somewhere"}: ${mark.label.toLowerCase()}.`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {clock && (
        <p className="master-map-clock">
          Round {surface.round} of {missionRoundLimit} · instability{" "}
          {surface.instability} of {playableMission.instabilityLimit}
        </p>
      )}
      {onTakeSeat && (
        <button
          type="button"
          className="master-map-deploy"
          onClick={onTakeSeat}
        >
          Take your seat
        </button>
      )}
    </section>
  );
}
