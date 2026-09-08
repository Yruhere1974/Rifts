import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type { MissionView } from "@rifts/rules";

const sites = {
  gate: [200, 390],
  relay: [420, 282],
  archive: [290, 138],
  rift: [750, 228],
} as const;
const colors = {
  soldier: 0xe5b65c,
  mage: 0xb09be3,
  scout: 0x73c4a1,
  operator: 0x6ab7d8,
};
export function BoardCanvas({
  view,
  selected,
  onSelect,
}: {
  view: MissionView | null;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{ app: Application; dynamic: Container } | null>(
    null,
  );
  const latest = useRef({ view, selected, onSelect });
  useEffect(() => {
    latest.current = { view, selected, onSelect };
  }, [view, selected, onSelect]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const app = new Application();
    let cancelled = false;
    let initialized = false;

    void app
      .init({
        background: "#182322",
        resizeTo: host,
        antialias: true,
      })
      .then(() => {
        initialized = true;

        if (cancelled) {
          app.destroy(true);
          return;
        }

        host.appendChild(app.canvas);

        const terrain = new Container();
        const dynamic = new Container();
        app.stage.addChild(terrain, dynamic);
        sceneRef.current = { app, dynamic };
        const grid = new Graphics();
        for (let y = 0; y < 650; y += 35)
          for (let x = 0; x < 1050; x += 40) {
            grid
              .circle(x + (y % 70 ? 20 : 0), y, 1)
              .fill({ color: 0x8da49a, alpha: 0.14 });
          }
        terrain.addChild(grid);
        const contours = new Graphics();
        for (let line = 0; line < 12; line++) {
          const points: number[] = [];
          for (let step = 0; step <= 90; step++) {
            const angle = (step / 90) * Math.PI * 2;
            const radius =
              150 + line * 23 + Math.sin(angle * 5 + line * 0.21) * 22;
            points.push(
              820 + Math.cos(angle) * radius * 1.35,
              470 + Math.sin(angle) * radius * 0.7,
            );
          }
          contours
            .poly(points)
            .stroke({ color: 0x557067, width: 1, alpha: 0.19 });
        }
        terrain.addChild(contours);
        const road = new Graphics();
        for (const [a, b] of [
          ["gate", "relay"],
          ["relay", "archive"],
          ["relay", "rift"],
          ["archive", "rift"],
        ] as const) {
          const start = sites[a];
          const end = sites[b];
          road
            .moveTo(start[0], start[1])
            .lineTo(end[0], end[1])
            .stroke({ color: 0x101a19, width: 24 });
          road
            .moveTo(start[0], start[1])
            .lineTo(end[0], end[1])
            .stroke({ color: 0x495750, width: 14, alpha: 0.5 });
          const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
          for (let i = 0; i < distance; i += 16) {
            const t = i / distance;
            road
              .circle(
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                1.5,
              )
              .fill(0x819284);
          }
        }
        terrain.addChild(road);
        // Small deterministic building footprints and rubble form the shared tabletop terrain.
        const ruins = new Graphics();
        for (let i = 0; i < 60; i++) {
          const x = 50 + ((i * 127) % 650);
          const y = 45 + ((i * 83) % 500);
          if (
            Object.values(sites).some(
              ([sx, sy]) => Math.hypot(x - sx, y - sy) < 75,
            )
          )
            continue;
          const w = 10 + (i % 5) * 7;
          const h = 13 + (i % 4) * 9;
          ruins.rect(x + 5, y + 7, w, h).fill({ color: 0x070f0e, alpha: 0.45 });
          ruins
            .rect(x, y, w, h)
            .fill(0x2c3933)
            .stroke({ color: 0x516055, width: 2 });
          ruins
            .moveTo(x + 5, y + h - 4)
            .lineTo(x + w - 5, y + h - 4)
            .stroke({ color: 0x82917a, width: 2, alpha: 0.4 });
        }
        terrain.addChild(ruins);
        const structures = new Graphics();
        structures
          .roundRect(227, 84, 126, 82, 3)
          .fill(0x101a18)
          .stroke({ color: 0x829985, width: 2 });
        for (let i = 0; i < 5; i++)
          structures
            .rect(238 + i * 23, 92, 10, 62)
            .fill(0x4b6050)
            .stroke({ color: 0xa3ad87, width: 1 });
        structures
          .circle(420, 282, 62)
          .fill(0x102a2d)
          .stroke({ color: 0x68a6ac, width: 2 });
        structures
          .circle(420, 282, 43)
          .fill(0x273c3e)
          .stroke({ color: 0x547b7d, width: 8 });
        structures
          .poly([420, 250, 448, 266, 448, 298, 420, 314, 392, 298, 392, 266])
          .fill(0x42666a)
          .stroke({ color: 0x92c8c8, width: 2 });
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = 420 + Math.cos(a) * 53;
          const y = 282 + Math.sin(a) * 53;
          structures.circle(x, y, 4).fill(0x97d4cf);
        }
        structures
          .poly([145, 355, 165, 344, 205, 419, 185, 430])
          .fill(0x46534c)
          .stroke({ color: 0x809080, width: 2 });
        structures
          .poly([200, 323, 220, 312, 260, 387, 240, 398])
          .fill(0x46534c)
          .stroke({ color: 0x809080, width: 2 });
        structures
          .ellipse(750, 228, 79, 52)
          .fill(0x272331)
          .stroke({ color: 0x9b7299, width: 1 });
        for (let i = 0; i < 9; i++) {
          const a = (i * Math.PI * 2) / 9;
          const x = 750 + Math.cos(a) * 65;
          const y = 228 + Math.sin(a) * 42;
          structures
            .poly([x - 7, y + 12, x + 3, y - 15, x + 11, y + 9])
            .fill(0x6c6379)
            .stroke({ color: 0xc1a5bf, width: 1 });
        }
        terrain.addChild(structures);
        const marks = new Graphics();
        dynamic.addChild(marks);
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const glow = new Graphics()
          .ellipse(750, 228, 45, 29)
          .stroke({ color: 0xd8aed1, width: 3 });
        dynamic.addChild(glow);
        let drawnView: MissionView | null | undefined;
        let drawnSelected = "";
        app.ticker.maxFPS = reducedMotion ? 10 : 30;
        app.ticker.add(() => {
          terrain.scale.set(app.screen.width / 1000, app.screen.height / 600);
          dynamic.scale.copyFrom(terrain.scale);
          const state = latest.current;
          const t = performance.now() / 1000;
          const pulse = reducedMotion ? 0.5 : (Math.sin(t * 1.4) + 1) / 2;
          glow.alpha = pulse * 0.35;
          if (drawnView === state.view && drawnSelected === state.selected)
            return;
          drawnView = state.view;
          drawnSelected = state.selected;
          marks.clear();
          marks.ellipse(750, 228, 40 + pulse * 4, 25 + pulse * 2).fill({
            color: state.view?.phase === "won" ? 0x6ac9ac : 0xd2a2ca,
            alpha: 0.2 + pulse * 0.1,
          });
          marks
            .poly([
              747, 185, 731, 223, 747, 220, 738, 268, 770, 220, 753, 226, 766,
              192,
            ])
            .fill(state.view?.phase === "won" ? 0x9ae8c4 : 0xe5b6e2);
          if (state.view?.shield ?? true)
            marks
              .ellipse(750, 228, 90, 61)
              .stroke({ color: 0xbe8ebf, width: 2, alpha: 0.4 + pulse * 0.2 });
          const position = sites[state.selected as keyof typeof sites];
          if (position)
            marks
              .circle(position[0], position[1], 75)
              .stroke({ color: 0xc2d1b0, alpha: 0.5, width: 1 });
          for (let i = 0; i < (state.view?.threat ?? 3); i++)
            marks
              .poly([179 + i * 17, 455, 185 + i * 17, 444, 191 + i * 17, 455])
              .fill(0xe88478);
          state.view?.players.forEach((player, i) => {
            const pos = sites[player.location];
            const x = pos[0] - 27 + i * 18;
            const y = pos[1] + 108;
            marks.circle(x + 2, y + 3, 8).fill(0x09110f);
            marks
              .circle(x, y, 8)
              .fill(colors[player.seat])
              .stroke({
                color: 0xe3ece1,
                width: player.seat === state.view?.seat ? 2 : 0.6,
              });
            if (player.holding)
              marks
                .circle(x, y, 11)
                .stroke({ color: colors[player.seat], width: 1 });
          });
        });
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;

      if (initialized) {
        app.destroy(true);
      }
    };
  }, []);

  return (
    <div ref={hostRef} className="board-canvas" data-testid="board-canvas" />
  );
}
