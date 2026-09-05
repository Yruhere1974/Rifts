import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";

export function BoardCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);

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
        background: "#151515",
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

        const board = new Graphics()
          .roundRect(48, 48, 480, 320, 8)
          .fill("#24352f")
          .stroke({ color: "#88b08b", width: 2 });

        const objective = new Graphics().circle(288, 208, 22).fill("#d8c36a");

        app.stage.addChild(board);
        app.stage.addChild(objective);
      });

    return () => {
      cancelled = true;

      if (initialized) {
        app.destroy(true);
      }
    };
  }, []);

  return (
    <div ref={hostRef} className="board-canvas" data-testid="board-canvas" />
  );
}
