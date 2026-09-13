import { useState, type CSSProperties } from "react";
import { ExternalLink, Hexagon, Radio } from "lucide-react";
import { playableMission } from "@rifts/content";
import { missionSeats, type Seat } from "@rifts/rules";
import { MasterMap } from "./MasterMap.js";
import { identities } from "./EngineConsole.js";
import { useTableView } from "./useTableView.js";

/**
 * The master tab: the page a mission is opened from and the one that stays
 * open beside it. It holds no seat of its own, so it never counts toward the
 * four, never gates the round and is never forfeited when absent; the server
 * sends it public state only, exactly as it does a shared screen.
 *
 * Consoles are spawned from here, one browser tab per claimed specialist. A
 * spawned tab inherits this browser's client key, which is how the server
 * recognises the same person planning beside the unit they are running, and
 * why this tab may draw as a seat it owns while a shared screen may not.
 */
const consoleUrl = (room: string, seat: Seat): string =>
  `${window.location.origin}/?room=${encodeURIComponent(room)}&seat=${seat}`;

export function MasterScreen({ roomId }: { roomId: string | null }) {
  /** Which claimed seat this tab draws as. Naming one is not owning one. */
  const [planning, setPlanning] = useState<Seat>("dice");
  const table = useTableView(roomId, {
    create: !roomId,
    mode: "team",
    seat: planning,
    role: "master",
  });
  const { view } = table;

  /**
   * A browser claims one specialist for the mission and keeps it. The server
   * has always enforced that; the roster used to offer the other three anyway
   * and the tab it opened died with "Your seat is fixed for this mission."
   */
  const bound = table.ownedSeats[0] ?? null;

  const spawn = (seat: Seat) => {
    if (!table.roomId || (bound !== null && bound !== seat)) return;
    setPlanning(seat);
    table.claim(seat);
    window.open(consoleUrl(table.roomId, seat), `rifts-${seat}`);
  };

  const roster = (
    <section className="master-roster" aria-label="Crew">
      <h3>Crew</h3>
      {table.roomId && (
        <p className="master-room">
          Room code <strong className="room-code">{table.roomId}</strong>
        </p>
      )}
      <ul className="master-roster-list">
        {missionSeats.map((seat) => {
          const identity = identities[seat];
          const mine = table.ownedSeats.includes(seat);
          const online = table.onlineSeats.includes(seat);
          return (
            <li
              key={seat}
              className={`master-crew${mine ? " master-crew-mine" : ""}`}
            >
              <div className="master-crew-head">
                <strong style={{ color: identity.color }}>
                  {identity.title}
                </strong>
                <span>
                  {mine ? "Yours" : online ? "Taken" : "Open"}
                  {online && <Radio size={12} />}
                </span>
              </div>
              <p>{identity.family}</p>
              <button
                type="button"
                disabled={
                  !table.roomId ||
                  (online && !mine) ||
                  (bound !== null && !mine)
                }
                onClick={() => spawn(seat)}
              >
                <ExternalLink size={14} />
                {mine
                  ? "Reopen console"
                  : online
                    ? "Being run"
                    : bound !== null
                      ? "For another player"
                      : "Run this specialist"}
              </button>
            </li>
          );
        })}
      </ul>
      {bound !== null ? (
        <p className="master-map-hint">
          You are running {identities[bound].title} for this mission, and draw
          on the map as them. Their console is in its own tab; this one stays on
          the map. The others are for the rest of the crew — send them the room
          code.
        </p>
      ) : (
        <p className="master-map-hint">
          Claim a specialist to open their console. You keep them for the
          mission, so the other three stay open for everyone else. Until you
          claim one this tab can read the map but not draw on it.
        </p>
      )}
    </section>
  );

  return (
    <div
      className="game-shell master-screen"
      style={{ "--seat-color": identities[planning].color } as CSSProperties}
    >
      <header className="topbar">
        <div className="wordmark">
          <Hexagon size={27} strokeWidth={1.4} />
          <h1>RIFTS</h1>
          <span className="edition">FIELD OPERATIONS</span>
        </div>
        <div className="mission-heading">
          <span>OPERATION 01</span>
          <strong>{playableMission.name}</strong>
        </div>
        <div className="header-tools">
          <span className="connection-indicator">{table.status}</span>
        </div>
      </header>
      {table.error && (
        <p role="alert" className="error-text">
          {table.error}
        </p>
      )}
      {view ? (
        <MasterMap
          surface={view}
          // Read-only until this browser actually owns the seat it names, so
          // the surface is honest about what this tab may do.
          seat={table.ownedSeats.includes(planning) ? planning : null}
          size={view.players.find((p) => p.seat === planning)?.size ?? 1}
          pings={table.pings}
          onAnnotate={(label, hexes) =>
            table.send({ type: "annotate", label, hexes })
          }
          onErase={(mark) => table.send({ type: "erase", mark })}
          onPing={table.ping}
          roster={roster}
          kind="master"
        />
      ) : (
        <p className="master-map-hint" role="status">
          {table.error ? "Could not open the mission." : "Opening the mission…"}
        </p>
      )}
    </div>
  );
}
