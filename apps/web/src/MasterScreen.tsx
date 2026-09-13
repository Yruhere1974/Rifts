import { useState, type CSSProperties } from "react";
import { ExternalLink, Hexagon, Play, Radio } from "lucide-react";
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
 *
 * Before the host starts, this is the table's lobby: the code to share, who
 * has landed, and the control that begins the mission.
 */
const consoleUrl = (room: string, seat: Seat): string =>
  `${window.location.origin}/?room=${encodeURIComponent(room)}&seat=${seat}`;

/**
 * Four digits, short enough to read down a phone. Minted once for the life of
 * the page rather than per render, because re-minting would change the code
 * the host is already reading out.
 */
let minted: string | null = null;
function newCode(): string {
  minted ??= String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return minted;
}

export function MasterScreen({
  roomId,
  code,
  players,
}: {
  roomId: string | null;
  /** Present when joining somebody else's table. Absent when opening one. */
  code: string | null;
  players: 1 | 2 | 4;
}) {
  /** Which claimed seat this tab draws as. Naming one is not owning one. */
  const [planning, setPlanning] = useState<Seat>("dice");
  const table = useTableView(roomId, {
    create: !roomId && !code,
    mode: "team",
    seat: planning,
    role: "master",
    code: code ?? newCode(),
    players,
  });
  const { view } = table;

  const owned = table.ownedSeats;
  // A browser runs as many specialists as the table's player count gives it.
  const full = owned.length >= table.seatsPerPlayer;

  const spawn = (seat: Seat) => {
    if (!table.roomId) return;
    setPlanning(seat);
    table.claim(seat);
    window.open(consoleUrl(table.roomId, seat), `rifts-${seat}`);
  };

  const crew = (
    <ul className="master-roster-list">
      {missionSeats.map((seat) => {
        const identity = identities[seat];
        const mine = owned.includes(seat);
        const taken = table.claimedSeats.includes(seat);
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
                {mine ? "Yours" : taken ? "Taken" : "Open"}
                {online && <Radio size={12} />}
              </span>
            </div>
            <p>{identity.family}</p>
            <button
              type="button"
              disabled={!table.roomId || (taken && !mine) || (full && !mine)}
              onClick={() => spawn(seat)}
            >
              <ExternalLink size={14} />
              {mine
                ? "Reopen console"
                : taken
                  ? "Being run"
                  : full
                    ? "For another player"
                    : "Run this specialist"}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const roster = (
    <section className="master-roster" aria-label="Crew">
      <h3>Crew</h3>
      {crew}
      <p className="master-map-hint">
        {owned.length === 0
          ? "Claim a specialist to open their console. Until you claim one this tab can read the map but not draw on it."
          : `You are running ${owned
              .map((seat) => identities[seat].title)
              .join(" and ")} for this mission, and draw on the map as ${
              identities[planning].title
            }.`}
      </p>
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

      {view && !table.started ? (
        <section className="table-lobby" aria-label="Table lobby">
          <h2>Assembling the team</h2>
          <p className="lobby-code-label">Share this code to bring people in</p>
          <strong className="lobby-code room-code">{table.code}</strong>
          <p className="master-map-hint">
            {table.seatsPerPlayer === 1
              ? "Four players, one specialist each."
              : `${4 / table.seatsPerPlayer} players, ${table.seatsPerPlayer} specialists each. The mission is always four specialists, however many people are running them.`}
          </p>
          {crew}
          <p className="master-map-hint" role="status">
            {table.claimedSeats.length} of 4 specialists claimed.
          </p>
          {table.roomId && (
            <a
              className="table-link"
              data-room={table.roomId}
              href={`/?table=1&room=${encodeURIComponent(table.roomId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open a shared screen for this table
            </a>
          )}
          {table.host ? (
            <button
              type="button"
              className="primary-button"
              disabled={table.claimedSeats.length < 4}
              onClick={table.start}
            >
              <Play size={16} />
              {table.claimedSeats.length < 4
                ? "Waiting for the rest of the crew"
                : "Start the mission"}
            </button>
          ) : (
            <p className="master-map-hint">
              Waiting for the table that opened this mission to start it.
            </p>
          )}
        </section>
      ) : view ? (
        <MasterMap
          surface={view}
          // Read-only until this browser actually owns the seat it names, so
          // the surface is honest about what this tab may do.
          seat={owned.includes(planning) ? planning : null}
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
