import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type { MissionPublicState, Seat } from "@rifts/rules";
import { missionMap } from "@rifts/content";
import {
  footprint,
  hexKey,
  hexToPixel,
  hexesWithin,
  parseHex,
  type Hex,
} from "@rifts/shared";

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

        app.ticker.add(() => {
          if (drawnWidth !== app.screen.width) {
            drawnWidth = app.screen.width;
            fit();
          }
          const state = latest.current;
          if (
            drawnView === state.view &&
            drawnSelected === state.selected &&
            drawnReach === state.reachable
          )
            return;
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
            for (const cell of footprint(player.position, player.size))
              dynamic
                .poly(hexCorners(hexToPixel(cell, HEX), HEX * 0.86))
                .fill({ color: colour, alpha: 0.34 });
            const anchor = hexToPixel(player.position, HEX);
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
