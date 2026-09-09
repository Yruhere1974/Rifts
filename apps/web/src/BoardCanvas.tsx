import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type { MissionPlayer, MissionPublicState, Seat } from "@rifts/rules";
import { missionMap } from "@rifts/content";
import {
  footprint,
  hexDistance,
  hexKey,
  hexToPixel,
  hexesWithin,
  parseHex,
  type Hex,
} from "@rifts/shared";
import { MOTION } from "./motion.js";

/**
 * Exactly the fields the board draws. Both a seat view and the public table
 * view satisfy it, so a shared screen can render the same map without a seat.
 */
export type BoardView = Pick<
  MissionPublicState,
  "phase" | "shield" | "threat" | "players"
> & { seat?: Seat };

const colors: Record<Seat, number> = {
  dice: 0xe5b65c,
  cards: 0xb09be3,
  bag: 0x73c4a1,
  systems: 0x6ab7d8,
};
const siteColors: Record<string, number> = {
  gate: 0xb1745e,
  relay: 0xd8c37a,
  archive: 0x8fa8c6,
  rift: 0xc79ac4,
};

const HEX = 12;
const openKeys = new Set(missionMap.open);
const openHexes = missionMap.open
  .map((key) => parseHex(key))
  .filter((hex): hex is Hex => hex !== null);
/** Hexes belonging to each objective area, precomputed once. */
const siteAreas = Object.entries(missionMap.sites).map(([name, hex]) => ({
  name,
  cells: new Set(
    hexesWithin(hex, missionMap.siteRadius).map((cell) => hexKey(cell)),
  ),
}));

/**
 * Anchors a unit of a given size may stand on: its whole footprint has to be
 * open floor, which is why a large unit has fewer roads open to it than a
 * small one. Computed once per size, on first use.
 */
const standings = new Map<number, ReadonlySet<string>>();
function standing(size: number): ReadonlySet<string> {
  const known = standings.get(size);
  if (known) return known;
  const cells = new Set(
    openHexes
      .filter((hex) =>
        footprint(hex, size).every((cell) => openKeys.has(hexKey(cell))),
      )
      .map((hex) => hexKey(hex)),
  );
  standings.set(size, cells);
  return cells;
}

/**
 * Footprint cell centres relative to the anchor. `hexToPixel` is linear in q
 * and r, so offsetting one animated anchor point carries the whole unit, and
 * the footprint can never drift away from its own dot.
 */
const offsets = new Map<number, { x: number; y: number }[]>();
function footprintOffsets(size: number): { x: number; y: number }[] {
  const known = offsets.get(size);
  if (known) return known;
  const cells = footprint({ q: 0, r: 0 }, size).map((cell) =>
    hexToPixel(cell, HEX),
  );
  offsets.set(size, cells);
  return cells;
}

/**
 * The hexes a unit of this size walks through to get from `from` to `to`.
 * Breadth-first over standable anchors, so the unit rounds the rock instead of
 * sliding through it. The server has already chosen the destination; this only
 * recovers the road it must have taken. Null when there is no legal road.
 */
function road(from: Hex, to: Hex, size: number): Hex[] | null {
  const goal = hexKey(to);
  const allowed = standing(size);
  const previous = new Map<string, Hex | null>([[hexKey(from), null]]);
  let frontier = [from];
  while (frontier.length && !previous.has(goal)) {
    const next: Hex[] = [];
    for (const here of frontier)
      for (const step of hexesWithin(here, 1)) {
        const key = hexKey(step);
        if (previous.has(key) || !allowed.has(key)) continue;
        previous.set(key, here);
        next.push(step);
      }
    frontier = next;
  }
  if (!previous.has(goal)) return null;
  const path: Hex[] = [];
  for (
    let hex: Hex | null | undefined = to;
    hex;
    hex = previous.get(hexKey(hex))
  )
    path.unshift(hex);
  return path;
}

/**
 * The JS twin of --ease-settle in game.css, so a unit crossing the board
 * carries the same weight as a card settling into a console: it leaves with a
 * little inertia, comes to rest calmly, and never overshoots.
 */
function easeSettle(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  // cubic-bezier(0.2, 0.9, 0.25, 1): solve x(u) = progress, then read y(u).
  const axis = (first: number, second: number, u: number) =>
    3 * first * u * (1 - u) ** 2 + 3 * second * u ** 2 * (1 - u) + u ** 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 14; step++) {
    const mid = (low + high) / 2;
    if (axis(0.2, 0.25, mid) < progress) low = mid;
    else high = mid;
  }
  return axis(0.9, 1, (low + high) / 2);
}

/**
 * How long a route of this many hexes takes. The first hex costs a full
 * MOTION.travel; every hex after it costs far less, because a unit already
 * under way keeps its speed, and the total is capped so that crossing the
 * whole map stays a beat rather than a wait.
 */
const travelTime = (hexes: number): number =>
  Math.min(
    MOTION.travel * Math.min(hexes, 1) +
      Math.max(hexes - 1, 0) * MOTION.instant,
    MOTION.travel + MOTION.settle,
  );

/**
 * A unit under way. Waypoints are whole hexes, except possibly the first: a
 * retarget mid-flight leaves that one part-way along a leg, so the unit picks
 * up from exactly where it had got to rather than jumping to a hex centre.
 */
type Journey = {
  path: Hex[];
  /** Hexes covered by the time each waypoint is reached; as long as `path`. */
  marks: number[];
  total: number;
  destination: Hex;
  /** Destination key, so a position arriving from the server diffs cheaply. */
  target: string;
  startedAt: number;
  duration: number;
};

function begin(
  path: Hex[],
  destination: Hex,
  now: number,
  reduced: boolean,
): Journey {
  const marks: number[] = [];
  let total = 0;
  let previous: Hex | null = null;
  for (const hex of path) {
    if (previous) total += hexDistance(previous, hex);
    marks.push(total);
    previous = hex;
  }
  return {
    path,
    marks,
    total,
    destination,
    target: hexKey(destination),
    startedAt: now,
    duration: reduced ? 0 : travelTime(total),
  };
}

/**
 * Where a unit is right now, and the whole hex it is walking into. Sampling by
 * distance covered rather than by waypoint index keeps a part-leg from
 * stretching out to fill a whole leg's worth of time.
 */
function sample(journey: Journey, now: number): { at: Hex; into: Hex } {
  if (journey.total <= 0)
    return { at: journey.destination, into: journey.destination };
  const elapsed =
    journey.duration <= 0 ? 1 : (now - journey.startedAt) / journey.duration;
  const covered = easeSettle(elapsed) * journey.total;
  let leg = 0;
  while (
    leg + 2 < journey.path.length &&
    (journey.marks[leg + 1] ?? 0) <= covered
  )
    leg++;
  const from = journey.path[leg];
  const into = journey.path[leg + 1];
  if (!from || !into)
    return { at: journey.destination, into: journey.destination };
  const start = journey.marks[leg] ?? 0;
  const span = (journey.marks[leg + 1] ?? 0) - start;
  const along =
    span <= 0 ? 1 : Math.min(1, Math.max(0, (covered - start) / span));
  return {
    at: {
      q: from.q + (into.q - from.q) * along,
      r: from.r + (into.r - from.r) * along,
    },
    into,
  };
}

function hexCorners(centre: { x: number; y: number }, radius: number) {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(centre.x + radius * Math.cos(angle));
    points.push(centre.y + radius * Math.sin(angle));
  }
  return points;
}

/** Nearest open hex to a point, which is enough hit-testing for a click. */
function hexAtPixel(x: number, y: number): Hex | null {
  let best: { hex: Hex; distance: number } | null = null;
  for (const hex of openHexes) {
    const centre = hexToPixel(hex, HEX);
    const distance = (centre.x - x) ** 2 + (centre.y - y) ** 2;
    if (!best || distance < best.distance) best = { hex, distance };
  }
  return best && best.distance <= (HEX * 1.4) ** 2 ? best.hex : null;
}

export function BoardCanvas({
  view,
  selected,
  onSelect,
  reachable,
}: {
  view: BoardView | null;
  /** Selected hex key, or "" for none. */
  selected: string;
  onSelect: (hexKey: string) => void;
  /** Hex keys the staged commitment could move to. */
  reachable?: ReadonlySet<string> | undefined;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ view, selected, onSelect, reachable });
  useEffect(() => {
    latest.current = { view, selected, onSelect, reachable };
  }, [view, selected, onSelect, reachable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let cancelled = false;
    let initialized = false;

    void app
      .init({ background: "#161d1c", resizeTo: host, antialias: true })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }
        initialized = true;
        host.appendChild(app.canvas);

        const world = new Container();
        app.stage.addChild(world);
        const terrain = new Graphics();
        const dynamic = new Graphics();
        world.addChild(terrain, dynamic);

        // Floor and objective areas never change, so draw them once.
        for (const hex of openHexes) {
          const centre = hexToPixel(hex, HEX);
          const key = hexKey(hex);
          const site = siteAreas.some((area) => area.cells.has(key));
          terrain
            .poly(hexCorners(centre, HEX * 0.92))
            .fill(site ? 0x22302c : 0x1e2725)
            .stroke({ color: site ? 0x33443d : 0x27332f, width: 1 });
        }
        for (const [name, hex] of Object.entries(missionMap.sites)) {
          const centre = hexToPixel(hex, HEX);
          terrain
            .poly(hexCorners(centre, HEX * 0.92))
            .fill({ color: siteColors[name] ?? 0xffffff, alpha: 0.5 })
            .stroke({ color: siteColors[name] ?? 0xffffff, width: 2 });
        }

        const bounds = terrain.getLocalBounds();
        const fit = () => {
          const pad = 12;
          const scale = Math.min(
            (app.screen.width - pad * 2) / Math.max(bounds.width, 1),
            (app.screen.height - pad * 2) / Math.max(bounds.height, 1),
          );
          world.scale.set(scale);
          world.position.set(
            (app.screen.width - bounds.width * scale) / 2 - bounds.x * scale,
            (app.screen.height - bounds.height * scale) / 2 - bounds.y * scale,
          );
        };

        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        app.stage.on("pointertap", (event) => {
          const point = world.toLocal(event.global);
          const hex = hexAtPixel(point.x, point.y);
          if (hex) latest.current.onSelect(hexKey(hex));
        });

        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        app.ticker.maxFPS = reducedMotion ? 10 : 30;
        let drawnView: BoardView | null | undefined;
        let drawnSelected = "";
        let drawnReach: ReadonlySet<string> | undefined;
        let drawnWidth = 0;
        let drawnTravel = false;

        const journeys = new Map<Seat, Journey>();
        /**
         * Keep a unit's journey aimed wherever the server last put it. Rounds
         * are simultaneous, so a position landing mid-flight retargets from the
         * hex the unit is already walking into, rather than queueing behind the
         * road it was on or snapping back to a hex centre.
         */
        const travel = (player: MissionPlayer, now: number): Journey => {
          const current = journeys.get(player.seat);
          if (current?.target === hexKey(player.position)) return current;
          // First sight of a unit is not a journey: it is simply there. Under a
          // reduced-motion preference no move is one either.
          let path = [player.position];
          if (current && !reducedMotion) {
            const { at, into } = sample(current, now);
            const found = road(into, player.position, player.size);
            const rest = found ?? [into, player.position];
            path = hexDistance(at, into) < 1e-6 ? rest : [at, ...rest];
          }
          const journey = begin(path, player.position, now, reducedMotion);
          journeys.set(player.seat, journey);
          return journey;
        };

        app.ticker.add(() => {
          if (drawnWidth !== app.screen.width) {
            drawnWidth = app.screen.width;
            fit();
          }
          const state = latest.current;
          const now = performance.now();
          // Journeys are retargeted ahead of the redraw guard, because a new
          // position can land on any frame. A unit under way keeps the board
          // redrawing, plus one frame past the end so it lands exactly.
          const anchors = new Map<Seat, Hex>();
          let travelling = false;
          for (const player of state.view?.players ?? []) {
            const journey = travel(player, now);
            anchors.set(player.seat, sample(journey, now).at);
            if (now < journey.startedAt + journey.duration) travelling = true;
          }
          if (
            !travelling &&
            !drawnTravel &&
            drawnView === state.view &&
            drawnSelected === state.selected &&
            drawnReach === state.reachable
          )
            return;
          drawnTravel = travelling;
          drawnView = state.view;
          drawnSelected = state.selected;
          drawnReach = state.reachable;
          dynamic.clear();

          // Where this commitment could carry the acting unit.
          for (const key of state.reachable ?? []) {
            const hex = parseHex(key);
            if (hex)
              dynamic
                .poly(hexCorners(hexToPixel(hex, HEX), HEX * 0.92))
                .fill({ color: 0xe3d797, alpha: 0.16 });
          }

          // Units are drawn as the hexes they actually occupy.
          for (const player of state.view?.players ?? []) {
            const colour = colors[player.seat];
            const anchor = hexToPixel(
              anchors.get(player.seat) ?? player.position,
              HEX,
            );
            for (const offset of footprintOffsets(player.size))
              dynamic
                .poly(
                  hexCorners(
                    { x: anchor.x + offset.x, y: anchor.y + offset.y },
                    HEX * 0.86,
                  ),
                )
                .fill({ color: colour, alpha: 0.34 });
            dynamic
              .circle(anchor.x, anchor.y, HEX * 0.55)
              .fill(colour)
              .stroke({ color: 0x101815, width: 2 });
            if (player.seat === state.view?.seat)
              dynamic
                .poly(hexCorners(anchor, HEX * (player.size + 1) * 0.95))
                .stroke({ color: 0xf2ead0, width: 2 });
          }

          const chosen = parseHex(state.selected);
          if (chosen)
            dynamic
              .poly(hexCorners(hexToPixel(chosen, HEX), HEX * 0.98))
              .stroke({ color: 0xf2ead0, width: 2 });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return <div className="board-canvas" ref={hostRef} />;
}
