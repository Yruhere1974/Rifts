import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import {
  Activity,
  Flag,
  Hexagon,
  Map,
  Radio,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import {
  engineTier,
  missionSeats,
  worldPressure,
  type Seat,
} from "@rifts/rules";
import { playableMission } from "@rifts/content";
import { BoardCanvas } from "./BoardCanvas.js";
import { MasterMap } from "./MasterMap.js";
import { identities } from "./EngineConsole.js";
import { useTableView } from "./useTableView.js";

export const seatJoinUrl = (roomId: string, seat: Seat, origin: string) =>
  `${origin}/?room=${encodeURIComponent(roomId)}&seat=${seat}`;

/** True when the page was opened on a loopback host a phone cannot reach. */
export const isLoopback = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname === "::1";

function JoinCode({ roomId, seat }: { roomId: string; seat: Seat }) {
  const [src, setSrc] = useState("");
  const identity = identities[seat];
  const url = seatJoinUrl(roomId, seat, window.location.origin);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#14211c", light: "#e8e4d5" },
    })
      .then((data) => {
        if (live) setSrc(data);
      })
      .catch(() => {
        if (live) setSrc("");
      });
    return () => {
      live = false;
    };
  }, [url]);
  return (
    <div
      className="join-card"
      style={{ "--crew-color": identity.color } as CSSProperties}
    >
      <identity.icon size={20} />
      <strong>{identity.title}</strong>
      <small>{identity.engine}</small>
      {src ? (
        <img src={src} alt={`Join as ${identity.title}`} />
      ) : (
        <span className="join-fallback">QR unavailable</span>
      )}
    </div>
  );
}

export function TableScreen({ roomId }: { roomId: string | null }) {
  const table = useTableView(roomId);
  const [surface, setSurface] = useState<"board" | "map">("board");
  const view = table.view;
  const pressure = worldPressure(view?.round ?? 1, view?.threat ?? 3);
  const tier = engineTier(view?.round ?? 1);
  const taken = new Set(table.onlineSeats);
  const open = missionSeats.filter((seat) => !taken.has(seat));

  if (!roomId)
    return (
      <main className="table-shell">
        <section className="table-empty">
          <Hexagon size={40} strokeWidth={1.4} />
          <h1>Table screen</h1>
          <p>
            Open this page with a room code to mirror a mission, for example{" "}
            <code>?table=1&amp;room=ABCDEF</code>. Create the room from a
            player&apos;s cooperative table first.
          </p>
        </section>
      </main>
    );

  return (
    <main className="table-shell">
      <header className="table-topbar">
        <div className="wordmark">
          <Hexagon size={24} strokeWidth={1.4} />
          <h1>RIFTS</h1>
          <span className="edition">TABLE SCREEN</span>
        </div>
        <div className="table-room">
          <span>ROOM</span>
          <strong>{roomId}</strong>
        </div>
        <div className="table-round">
          <span>ROUND</span>
          <strong>
            {String(view?.round ?? 1).padStart(2, "0")} /{" "}
            {playableMission.roundLimit}
          </strong>
          {tier > 0 && <span className="table-tier">TIER {tier}</span>}
        </div>
        <button
          className="table-link"
          aria-pressed={surface === "map"}
          onClick={() => setSurface(surface === "map" ? "board" : "map")}
        >
          <Map size={14} />
          {surface === "map" ? "Board" : "Master map"}
        </button>
      </header>

      {(!view || !table.started) && (
        <div className="presence-notice" role="status">
          <Users size={16} />
          {table.error
            ? table.error
            : view
              ? `${table.onlineSeats.length} / 4 specialists connected. Scan a code below to take a seat.`
              : `Connecting the table screen to room ${roomId}...`}
        </div>
      )}

      {view && surface === "map" && (
        <MasterMap
          surface={view}
          seat={null}
          size={1}
          pings={table.pings}
          onAnnotate={() => undefined}
          onErase={() => undefined}
          onPing={() => undefined}
        />
      )}
      <div className="table-layout" hidden={view !== null && surface === "map"}>
        <section className="table-world" aria-label="Shared world">
          <div className="map-surface">
            <BoardCanvas
              view={view}
              selected="rift"
              onSelect={() => undefined}
            />
          </div>
          <div className="table-stats">
            <div className="table-stat">
              <span className="eyebrow">
                <Flag size={13} /> STABILIZATION
              </span>
              <strong>
                {view?.progress ?? 0}
                <small>
                  {" "}
                  / {view?.requiredProgress ?? playableMission.requiredProgress}
                </small>
              </strong>
            </div>
            <div className="table-stat danger">
              <span className="eyebrow">
                <Activity size={13} /> INSTABILITY
              </span>
              <strong>
                {view?.instability ?? 0}
                <small> / {playableMission.instabilityLimit}</small>
              </strong>
            </div>
            <div className="table-stat">
              <span className="eyebrow">
                <Zap size={13} /> NEXT RESPONSE
              </span>
              <strong>+{pressure}</strong>
            </div>
            <div className="table-stat">
              <span className="eyebrow">
                <Shield size={13} /> BREACH
              </span>
              <strong className="table-flags">
                {view?.shield ? "SHIELDED" : "SUPPRESSED"}
                <small>
                  {view?.frequencyKnown ? "TIMING KNOWN" : "TIMING UNKNOWN"}
                </small>
              </strong>
            </div>
          </div>
          <div className="table-resources">
            {(["materiel", "power", "knowledge", "influence"] as const).map(
              (key) => (
                <div key={key}>
                  <strong>{view?.resources[key] ?? 0}</strong>
                  <span>{key}</span>
                </div>
              ),
            )}
          </div>
        </section>

        <aside className="table-side">
          <section className="table-crew" aria-label="Crew">
            {missionSeats.map((seat) => {
              const kit = view?.kits.find((entry) => entry.seat === seat);
              const player = view?.players.find((entry) => entry.seat === seat);
              const identity = identities[seat];
              const pieces =
                seat === "dice"
                  ? `${kit?.dice ?? 0} dice`
                  : seat === "cards"
                    ? `${kit?.hand ?? 0} cards`
                    : seat === "bag"
                      ? `${kit?.surge ?? 0} surge / ${kit?.bagRemaining ?? 0} bag`
                      : `${kit?.markers ?? 0} markers`;
              return (
                <div
                  key={seat}
                  className={`table-crew-row ${taken.has(seat) ? "" : "absent"}`}
                  style={{ "--crew-color": identity.color } as CSSProperties}
                >
                  <identity.icon size={20} />
                  <span>
                    <strong>{identity.title}</strong>
                    <small>{pieces}</small>
                  </span>
                  <span className="table-crew-state">
                    {!taken.has(seat)
                      ? "OPEN"
                      : player?.ready
                        ? "FINISHED"
                        : player?.holding
                          ? "HOLDING"
                          : (view?.boosts[seat] ?? 0) > 0
                            ? `+${view?.boosts[seat]} SUPPORT`
                            : "ACTIVE"}
                  </span>
                </div>
              );
            })}
          </section>

          <section className="table-log" aria-label="Field log">
            <div className="section-label">
              <Radio size={13} /> FIELD LOG
            </div>
            {(view?.log ?? [])
              .slice(-7)
              .reverse()
              .map((entry) => (
                <p key={entry.id}>{entry.text}</p>
              ))}
          </section>
        </aside>
      </div>

      {open.length > 0 && (
        <section className="table-join" aria-label="Join the mission">
          <div className="section-label">
            <Users size={13} /> SCAN TO TAKE A SEAT
          </div>
          <div className="join-grid">
            {open.map((seat) => (
              <JoinCode key={seat} roomId={roomId} seat={seat} />
            ))}
          </div>
          {isLoopback(window.location.hostname) && (
            <p className="join-warning" role="status">
              This screen is open on <code>{window.location.hostname}</code>, so
              these codes only work on this machine. Reopen the table screen
              using this computer&apos;s network address for phones to reach it.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
