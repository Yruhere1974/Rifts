import { prototypeScenario } from "@rifts/content";
import { BoardCanvas } from "./BoardCanvas.js";

export function App() {
  return (
    <main className="app-shell">
      <section className="board-region" aria-label="Shared board">
        <BoardCanvas />
      </section>
      <aside className="control-region" aria-label="Prototype controls">
        <h1>Rifts Prototype</h1>
        <p>{prototypeScenario.name}</p>
        <dl>
          <div>
            <dt>Players</dt>
            <dd>{prototypeScenario.playerCount}</dd>
          </div>
          <div>
            <dt>Resources</dt>
            <dd>{prototypeScenario.sharedResources.join(", ")}</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}
