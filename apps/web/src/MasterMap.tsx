import { useMemo, useState, type PointerEvent } from "react";
import { Crosshair, Eraser, MapPin, Route, Spline } from "lucide-react";
import { briefingRadius, mapBounds, missionMap } from "@rifts/content";
import {
  hexCorners,
  hexKey,
  hexOutline,
  hexRegionPath,
  hexToPixel,
  parseHex,
  pixelToHex,
  type Hex,
} from "@rifts/shared";
import {
  routeCost,
  type MapMark,
  type MissionBriefing,
  type MissionEnemy,
  type MissionLocation,
  type Seat,
} from "@rifts/rules";
import { identities } from "./EngineConsole.js";
import type { MissionPing } from "./useMission.js";

/**
 * The master map is drawn as SVG rather than through the Pixi board. It is
 * not a second view of the board: it carries no terrain detail, no apparatus,
 * no patrols and no units, and it changes only when somebody annotates it.
 * Real elements also give the marks accessible names and keyboard focus,
 * which a canvas would have to reinvent.
 */
const HEX = 9;
const PAD = 26;

const locationNames: Record<MissionLocation, string> = {
  gate: "West gate",
  relay: "Relay",
  archive: "Silent archive",
  rift: "Breach",
};

/** The public fields the surface needs; a seat view and a table view both fit. */
export type MasterMapSurface = {
  planning: boolean;
  marks: MapMark[];
  briefing: MissionBriefing[];
  reports: { seat: Seat; location: MissionLocation; text: string }[];
  enemies: MissionEnemy[];
};

type Mode = "point" | "mark" | "route";

const openHexes = (): Hex[] =>
  missionMap.open.flatMap((key) => {
    const hex = parseHex(key);
    return hex ? [hex] : [];
  });

const centreOf = (key: string): { x: number; y: number } | null => {
  const hex = parseHex(key);
  return hex ? hexToPixel(hex, HEX) : null;
};

export function MasterMap({
  surface,
  seat,
  size,
  pings,
  onAnnotate,
  onErase,
  onPing,
}: {
  surface: MasterMapSurface;
  seat: Seat | null;
  size: number;
  pings: MissionPing[];
  onAnnotate: (label: string, hexes: string[]) => void;
  onErase: (mark: string) => void;
  onPing: (hex: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("point");
  const [draft, setDraft] = useState<string[]>([]);
  const [label, setLabel] = useState("");

  const geometry = useMemo(() => {
    const hexes = openHexes();
    const open = new Set(missionMap.open);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const hex of hexes)
      for (const corner of hexCorners(hex, HEX)) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    return {
      open,
      region: hexRegionPath(hexes, HEX),
      outline: hexOutline(hexes, HEX),
      viewBox: `${minX - PAD} ${minY - PAD} ${maxX - minX + PAD * 2} ${maxY - minY + PAD * 2}`,
    };
  }, []);

  /**
   * One layout pass over every label on the drawing. Marks cluster, so text
   * anchored to a pin will overlap its neighbour unless something moves it;
   * a label pushed off its pin keeps a leader line back to it.
   */
  const labels = useMemo(() => {
    const placed: { x1: number; x2: number; y: number }[] = [];
    const LINE = 9.5;
    const settle = (x: number, y: number, text: string) => {
      const width = text.length * 3.7;
      let at = y;
      let guard = 0;
      while (
        guard++ < 40 &&
        placed.some(
          (box) =>
            Math.abs(box.y - at) < LINE && box.x1 < x + width && x < box.x2,
        )
      )
        at += LINE;
      placed.push({ x1: x, x2: x + width, y: at });
      return at;
    };
    const out = new Map<string, number>();
    for (const marker of surface.briefing) {
      const centre = centreOf(marker.hex);
      if (centre)
        out.set(marker.id, settle(centre.x + 8, centre.y + 3, marker.label));
    }
    for (const mark of surface.marks) {
      const tail = centreOf(mark.hexes.at(-1) ?? "");
      if (tail) out.set(mark.id, settle(tail.x + 7, tail.y - 5, mark.label));
    }
    return out;
  }, [surface.briefing, surface.marks]);

  /** Costed once per route, because each leg walks the map to price itself. */
  const costs = useMemo(() => {
    const out = new Map<string, ReturnType<typeof routeCost>>();
    for (const mark of surface.marks) {
      if (mark.hexes.length < 2) continue;
      const waypoints = mark.hexes.flatMap((key) => {
        const hex = parseHex(key);
        return hex ? [hex] : [];
      });
      out.set(mark.id, routeCost(waypoints, size, surface.enemies));
    }
    return out;
  }, [surface.marks, surface.enemies, size]);

  const editable = seat !== null && surface.planning;

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!seat) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = svg
      .getAttribute("viewBox")!
      .split(" ")
      .map(Number) as [number, number, number, number];
    // Preserve-aspect letterboxing: the drawing is centred inside the box.
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const x =
      (event.clientX - rect.left - (rect.width - vw * scale) / 2) / scale + vx;
    const y =
      (event.clientY - rect.top - (rect.height - vh * scale) / 2) / scale + vy;
    const key = hexKey(pixelToHex({ x, y }, HEX));
    if (!geometry.open.has(key)) return;
    if (mode === "point") {
      onPing(key);
      return;
    }
    if (!surface.planning) return;
    if (mode === "mark") setDraft([key]);
    else
      setDraft((current) =>
        current.at(-1) === key ? current : [...current, key],
      );
  };

  const commit = () => {
    if (!label.trim() || draft.length === 0) return;
    onAnnotate(label.trim(), draft);
    setDraft([]);
    setLabel("");
  };

  const draftCost =
    draft.length > 1
      ? routeCost(
          draft.flatMap((key) => {
            const hex = parseHex(key);
            return hex ? [hex] : [];
          }),
          size,
          surface.enemies,
        )
      : null;

  const reported = [...new Set(surface.reports.map((entry) => entry.location))];

  return (
    <section className="master-map" aria-label="Master map">
      <header className="master-map-bar">
        <div>
          <h2>Master map</h2>
          <p className="master-map-state">
            {seat === null
              ? "Shared screen. The map is read-only here."
              : surface.planning
                ? "Planning window open. Draw, erase and point."
                : "The round is being spent. You can still point."}
          </p>
        </div>
        {seat !== null && (
          <div className="master-map-tools" role="group" aria-label="Map tools">
            <button
              type="button"
              aria-pressed={mode === "point"}
              onClick={() => setMode("point")}
            >
              <Crosshair size={15} /> Point
            </button>
            <button
              type="button"
              aria-pressed={mode === "mark"}
              disabled={!surface.planning}
              onClick={() => {
                setMode("mark");
                setDraft([]);
              }}
            >
              <MapPin size={15} /> Mark
            </button>
            <button
              type="button"
              aria-pressed={mode === "route"}
              disabled={!surface.planning}
              onClick={() => {
                setMode("route");
                setDraft([]);
              }}
            >
              <Spline size={15} /> Route
            </button>
          </div>
        )}
      </header>

      <div className="master-map-body">
        <svg
          className="master-map-canvas"
          viewBox={geometry.viewBox}
          role="img"
          aria-label={`The undercroft outline with ${surface.briefing.length} briefing marks and ${surface.marks.length} team marks.`}
          onPointerDown={pick}
        >
          <path className="mm-ground" d={geometry.region} />
          <g className="mm-outline">
            {geometry.outline.map((edge, index) => (
              <line
                key={index}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
              />
            ))}
          </g>

          <g className="mm-briefing">
            {surface.briefing.map((marker) => {
              const centre = centreOf(marker.hex);
              if (!centre) return null;
              const spread =
                (briefingRadius[marker.precision] + 0.5) * HEX * Math.sqrt(3);
              return (
                <g
                  key={marker.id}
                  className={`mm-brief mm-brief-${marker.state}`}
                >
                  {marker.state === "standing" && (
                    <circle cx={centre.x} cy={centre.y} r={spread} />
                  )}
                  <path
                    className="mm-brief-pin"
                    d={`M${centre.x} ${centre.y - 7}l4 7-4 7-4-7Z`}
                  />
                  {(labels.get(marker.id) ?? centre.y + 3) > centre.y + 6 && (
                    <line
                      className="mm-leader"
                      x1={centre.x + 5}
                      y1={centre.y}
                      x2={centre.x + 7}
                      y2={(labels.get(marker.id) ?? 0) - 3}
                    />
                  )}
                  <text
                    x={centre.x + 8}
                    y={labels.get(marker.id) ?? centre.y + 3}
                  >
                    {marker.label}
                  </text>
                </g>
              );
            })}
          </g>

          <g className="mm-reports">
            {reported.map((location) => {
              const centre = centreOf(hexKey(missionMap.sites[location]));
              if (!centre) return null;
              return (
                <g key={location} className="mm-report">
                  <rect
                    x={centre.x - 4}
                    y={centre.y - 4}
                    width={8}
                    height={8}
                    transform={`rotate(45 ${centre.x} ${centre.y})`}
                  />
                  <text x={centre.x + 8} y={centre.y + 14}>
                    {locationNames[location]} reported
                  </text>
                </g>
              );
            })}
          </g>

          <g className="mm-marks">
            {surface.marks.map((mark) => {
              const points = mark.hexes.flatMap((key) => {
                const centre = centreOf(key);
                return centre ? [centre] : [];
              });
              const head = points[0];
              const tail = points.at(-1);
              if (!head || !tail) return null;
              const cost = costs.get(mark.id);
              const colour = identities[mark.seat].color;
              return (
                <g
                  key={mark.id}
                  className={`mm-mark${cost?.blocked ? " mm-mark-blocked" : ""}`}
                  style={{ color: colour }}
                >
                  {points.length > 1 && (
                    <polyline
                      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                    />
                  )}
                  <circle cx={head.x} cy={head.y} r={3.5} />
                  <text x={tail.x + 7} y={labels.get(mark.id) ?? tail.y - 5}>
                    {mark.label}
                    {cost
                      ? cost.blocked
                        ? " — blocked"
                        : ` — ${cost.hexes} hexes, ${cost.commitments} commitment${cost.commitments === 1 ? "" : "s"}`
                      : ""}
                  </text>
                </g>
              );
            })}
          </g>

          <g className="mm-draft">
            {draft.length > 1 && (
              <polyline
                points={draft
                  .flatMap((key) => {
                    const centre = centreOf(key);
                    return centre ? [`${centre.x},${centre.y}`] : [];
                  })
                  .join(" ")}
              />
            )}
            {draft.map((key) => {
              const centre = centreOf(key);
              return centre ? (
                <circle key={key} cx={centre.x} cy={centre.y} r={3} />
              ) : null;
            })}
          </g>

          <g className="mm-pings">
            {pings.map((entry) => {
              const centre = centreOf(entry.hex);
              if (!centre) return null;
              return (
                <circle
                  key={entry.id}
                  className="mm-ping"
                  cx={centre.x}
                  cy={centre.y}
                  r={HEX}
                  style={{ color: identities[entry.seat].color }}
                />
              );
            })}
          </g>
        </svg>

        <aside className="master-map-side">
          {seat !== null && surface.planning && (
            <form
              className="master-map-compose"
              onSubmit={(event) => {
                event.preventDefault();
                commit();
              }}
            >
              <label htmlFor="mm-label">
                {mode === "route" ? "Route label" : "Mark label"}
              </label>
              <input
                id="mm-label"
                value={label}
                maxLength={60}
                placeholder={
                  mode === "route"
                    ? "Approach from the north"
                    : "Watch this hall"
                }
                onChange={(event) => setLabel(event.target.value)}
              />
              <p className="master-map-hint">
                {draft.length === 0
                  ? mode === "point"
                    ? "Choose Mark or Route, then select ground."
                    : "Select ground on the map."
                  : draft.length === 1
                    ? "One hex selected."
                    : `${draft.length} waypoints${
                        draftCost
                          ? draftCost.blocked
                            ? ", blocked"
                            : `, ${draftCost.hexes} hexes, ${draftCost.commitments} commitment${draftCost.commitments === 1 ? "" : "s"}`
                          : ""
                      }.`}
              </p>
              <div className="master-map-compose-actions">
                <button
                  type="submit"
                  disabled={!label.trim() || draft.length === 0}
                >
                  <Route size={15} />
                  {draft.length > 1 ? "Draw route" : "Place mark"}
                </button>
                <button
                  type="button"
                  disabled={draft.length === 0}
                  onClick={() => setDraft([])}
                >
                  Clear selection
                </button>
              </div>
            </form>
          )}

          <h3>Briefing</h3>
          <ul className="master-map-list">
            {surface.briefing.map((marker) => (
              <li key={marker.id} className={`mm-row mm-row-${marker.state}`}>
                <strong>{marker.label}</strong>
                <span>
                  {marker.state === "struck"
                    ? "wrong"
                    : marker.state === "confirmed"
                      ? "confirmed"
                      : `${marker.precision}, unchecked`}
                </span>
              </li>
            ))}
          </ul>

          <h3>Team marks</h3>
          {surface.marks.length === 0 ? (
            <p className="master-map-hint">Nothing drawn yet.</p>
          ) : (
            <ul className="master-map-list">
              {surface.marks.map((mark) => {
                const cost = costs.get(mark.id);
                return (
                  <li key={mark.id} className="mm-row">
                    <strong style={{ color: identities[mark.seat].color }}>
                      {mark.label}
                    </strong>
                    <span>
                      {cost
                        ? cost.blocked
                          ? "route blocked"
                          : `${cost.hexes} hexes, ${cost.commitments} commitment${cost.commitments === 1 ? "" : "s"}`
                        : `round ${mark.round}`}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Erase ${mark.label}`}
                        onClick={() => onErase(mark.id)}
                      >
                        <Eraser size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

export const masterMapBounds = mapBounds;
