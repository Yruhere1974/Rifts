import { useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Diamond,
  Flag,
  HandHelping,
  Hexagon,
  LockKeyhole,
  MapPin,
  Pause,
  Radio,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  previewAction,
  worldPressure,
  type MissionCommand,
  type Seat,
} from "@rifts/rules";
import { playableMission } from "@rifts/content";
import { BoardCanvas } from "./BoardCanvas.js";
import { EngineConsole, identities } from "./EngineConsole.js";
import { useMission } from "./useMission.js";
import { useModalFocus } from "./useModalFocus.js";

const seats: Seat[] = ["soldier", "mage", "scout", "operator"];
const locations = [
  {
    id: "gate",
    name: "West gate",
    subtitle: "Approaching patrol",
    x: 20,
    y: 65,
    icon: Swords,
  },
  {
    id: "relay",
    name: "The relay",
    subtitle: "Restore the field",
    x: 42,
    y: 47,
    icon: Zap,
  },
  {
    id: "archive",
    name: "Silent archive",
    subtitle: "Fragmented records",
    x: 29,
    y: 23,
    icon: BookOpen,
  },
  {
    id: "rift",
    name: "The breach",
    subtitle: "Dimensional stabilizer",
    x: 75,
    y: 38,
    icon: Sparkles,
  },
];
type Action = Extract<MissionCommand, { type: "act" }>["action"];
const actions: { id: Action; label: string; icon: typeof Zap }[] = [
  { id: "move", label: "Move", icon: MapPin },
  { id: "engage", label: "Engage", icon: Swords },
  { id: "investigate", label: "Investigate", icon: BookOpen },
  { id: "contribute", label: "Contribute", icon: Zap },
  { id: "acquire", label: "Acquire", icon: Diamond },
  { id: "assist", label: "Assist", icon: HandHelping },
  { id: "recover", label: "Recover", icon: Activity },
];

export function App() {
  const game = useMission();
  const { view, seat } = game;
  const [selected, setSelected] = useState("relay");
  const [pieces, setPieces] = useState<string[]>([]);
  const [action, setAction] = useState<Action>("contribute");
  const [ally, setAlly] = useState<Seat>("operator");
  const [resource, setResource] = useState("power");
  const [lobbyMode, setLobbyMode] = useState<"practice" | "team">("practice");
  const [lobbySeat, setLobbySeat] = useState<Seat>("soldier");
  const [invite, setInvite] = useState("");
  const [help, setHelp] = useState(false);
  const [artifact, setArtifact] = useState(false);
  const [history, setHistory] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  useModalFocus(
    !view
      ? "briefing"
      : view.phase !== "action"
        ? "resolution"
        : artifact
          ? "artifact"
          : finishing
            ? "finishing"
            : help
              ? "help"
              : "",
    () => {
      setArtifact(false);
      setFinishing(false);
      setHelp(false);
    },
  );
  const identity = identities[seat];
  const recipient = ally === seat ? seats.find((s) => s !== seat)! : ally;
  const pressure = worldPressure(view?.round ?? 1, view?.threat ?? 3);
  const location =
    locations.find((item) => item.id === selected) ?? locations[1]!;
  const player = view?.players.find((item) => item.seat === seat);
  const command: MissionCommand = {
    type: "act",
    action,
    target:
      action === "assist"
        ? recipient
        : action === "acquire"
          ? resource
          : action === "recover"
            ? seat
            : selected,
    pieces,
  };
  const preview = view ? previewAction(view, command) : null;
  const send = (input: MissionCommand) => {
    game.send(input);
    setPieces([]);
  };
  const changeSeat = (next: Seat) => {
    game.switchSeat(next);
    setPieces([]);
    setArtifact(false);
    if (next === ally) setAlly(seats.find((s) => s !== next)!);
  };
  const selectPiece = (id: string) =>
    setPieces((current) =>
      current.includes(id)
        ? current.filter((p) => p !== id)
        : seat === "soldier" || seat === "operator"
          ? [id]
          : [...current, id],
    );

  return (
    <main
      className="game-shell"
      style={{ "--seat-color": identity.color } as CSSProperties}
    >
      <header className="topbar">
        <div className="wordmark">
          <Hexagon size={27} strokeWidth={1.4} />
          <h1>RIFTS</h1>
          <span className="edition">FIELD OPERATIONS</span>
        </div>
        <div className="mission-heading">
          <span>OPERATION 01</span>
          <strong>Dimensional Stabilizer</strong>
        </div>
        <div className="header-tools">
          {game.roomId && (
            <button
              className="room-code"
              title="Copy room code"
              onClick={() => {
                if (!navigator.clipboard) return;
                void navigator.clipboard
                  .writeText(game.roomId ?? "")
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? <Check size={14} /> : <Users size={14} />}
              {game.mode === "practice" ? "Solo table" : game.roomId}
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Mission briefing"
            title="Mission briefing"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
          {view && (
            <button
              className="icon-button"
              aria-label="Leave table"
              title="Leave table"
              onClick={game.leave}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>
      {view &&
        game.mode === "team" &&
        (!game.started || game.onlineSeats.length < 4) && (
          <div className="presence-notice" role="status">
            <Users size={16} />
            {game.started
              ? "A specialist is offline. Their seat stays reserved; remaining opportunities are forfeited until they rejoin."
              : `${game.onlineSeats.length} / 4 specialists connected. Share this room code to assemble the team: ${game.roomId}`}
          </div>
        )}
      <div className="world-layout">
        <section className="world" aria-label="Shared world">
          <div className="world-topline">
            <span className="live-dot" />
            <span>GREYHAVEN OUTSKIRTS</span>
            <span className="world-coordinate">SECTOR 07 / 34.8 N</span>
          </div>
          <div className="round-strip">
            <div>
              <span className="eyebrow">TEAM ROUND</span>
              <strong>{String(view?.round ?? 1).padStart(2, "0")}</strong>
            </div>
            <span className="phase-tag">
              {view?.phase === "action" || !view
                ? "OPEN OPPORTUNITIES"
                : "OPERATION COMPLETE"}
            </span>
          </div>
          <div className="map-surface">
            <BoardCanvas
              view={view}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="map-labels">
              {locations.map((item) => (
                <button
                  key={item.id}
                  className={`location-pin ${selected === item.id ? "selected" : ""} ${item.id}`}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  onClick={() => setSelected(item.id)}
                  aria-pressed={selected === item.id}
                  aria-label={item.name}
                >
                  <span className="pin-icon">
                    <item.icon size={18} />
                  </span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.id === "gate"
                      ? `${view?.threat ?? 3} patrol strength`
                      : item.id === "rift"
                        ? `${view?.progress ?? 0} / ${view?.requiredProgress ?? playableMission.requiredProgress} stabilization`
                        : item.subtitle}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="map-legend">
            <span>
              <i className="legend-dot teal" />
              Crew position
            </span>
            <span>
              <i className="legend-dot red" />
              Active threat
            </span>
            <span>
              <LockKeyhole size={12} />
              Private perception
            </span>
          </div>
          <div className="location-inspector">
            <div className="location-title">
              <location.icon size={22} />
              <div>
                <span className="eyebrow">SELECTED LOCATION</span>
                <h2>{location.name}</h2>
              </div>
              <span className="location-presence">
                {player?.location === selected ? "You are here" : "Remote"}
              </span>
            </div>
            <p>
              {selected === "rift"
                ? view?.frequencyKnown
                  ? "Frequency triangulated. Stabilization is safe. Each contribution consumes 1 shared Power."
                  : "Uncertain timing: blind stabilization adds 5 instability. Combine independent readings or investigate before committing."
                : selected === "gate"
                  ? "The patrol adds +1 instability at each world response. Engage at the gate to remove its strength."
                  : selected === "archive"
                    ? "Investigate the records for Knowledge and safe breach timing. A known route through the noise."
                    : "An engine commitment and 2 shared Power restore the relay. Removing the shield doubles stabilization output."}
            </p>
            <div className="location-facts">
              <span>
                {view?.shield ? <Shield size={14} /> : <Check size={14} />}
                {view?.shield ? "Breach shield active" : "Shield suppressed"}
              </span>
              <span>
                <Radio size={14} />
                {view?.frequencyKnown
                  ? "Safe frequency known"
                  : "Frequency uncertain"}
              </span>
            </div>
          </div>
        </section>
        <aside className="team-sidebar" aria-label="Shared mission state">
          <section className="objective-section">
            <div className="section-label">
              <Flag size={14} />
              TEAM OBJECTIVE
            </div>
            <h2>Close the breach.</h2>
            <p>Keep Greyhaven standing.</p>
            <div className="objective-counter">
              <strong>
                {view?.progress ?? 0}
                <small>
                  {" "}
                  / {view?.requiredProgress ?? playableMission.requiredProgress}
                </small>
              </strong>
              <span>STABILIZATION</span>
            </div>
            <div className="segmented-track">
              {Array.from(
                {
                  length:
                    view?.requiredProgress ?? playableMission.requiredProgress,
                },
                (_, i) => (
                  <i
                    key={i}
                    className={i < (view?.progress ?? 0) ? "filled" : ""}
                  />
                ),
              )}
            </div>
          </section>
          <section className="pressure-section">
            <div className="section-label">
              <Activity size={14} />
              INSTABILITY<strong>{view?.instability ?? 0} / 12</strong>
            </div>
            <div className="segmented-track danger">
              {Array.from({ length: 12 }, (_, i) => (
                <i
                  key={i}
                  className={i < (view?.instability ?? 0) ? "filled" : ""}
                />
              ))}
            </div>
            <p>At 12, Greyhaven falls. Six rounds remain at deployment.</p>
            <div className="world-response">
              <span>NEXT WORLD RESPONSE</span>
              <strong>
                +{pressure} instability
                {view?.round === 6 ? " / final surge" : ""}
              </strong>
              <small>
                Breach surge
                {(view?.threat ?? 3) > 0 ? " + active patrol" : " only"}. All
                four must finish.
              </small>
            </div>
          </section>
          <section className="resources-section">
            <div className="section-label">SHARED RESERVES</div>
            <div className="resource-pool">
              {(
                [
                  ["materiel", Diamond],
                  ["power", Zap],
                  ["knowledge", BookOpen],
                  ["influence", Flag],
                ] as const
              ).map(([key, Icon]) => (
                <div key={key} title={key}>
                  <Icon size={17} />
                  <strong>{view?.resources[key] ?? 0}</strong>
                  <span>{key}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="comms-section">
            <div className="section-label">
              <Radio size={14} />
              TEAM CHANNEL
            </div>
            <div className="comms-feed" aria-live="polite">
              {view?.requests.map((request) => (
                <button
                  className="assist-request"
                  key={request.seat}
                  onClick={() => {
                    setAlly(request.seat);
                    setAction("assist");
                  }}
                >
                  <HandHelping size={17} />
                  <span>
                    <strong>
                      {identities[request.seat].title} needs support
                    </strong>
                    <small>{request.target} / spend capability to help</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {view?.reports.map((report) => (
                <div className="report" key={report.seat}>
                  <span style={{ color: identities[report.seat].color }}>
                    {identities[report.seat].title} / SHARED
                  </span>
                  <p>{report.text}</p>
                </div>
              ))}
              {!view?.reports.length && (
                <p className="muted">No readings shared yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      <section className="player-area" aria-label="Character console">
        <nav className="crew-bar" aria-label="Crew seats">
          {seats.map((role) => {
            const member = view?.players.find((p) => p.seat === role);
            const id = identities[role];
            return (
              <button
                key={role}
                style={{ "--crew-color": id.color } as CSSProperties}
                className={`crew-seat ${seat === role ? "active" : ""}`}
                onClick={() => game.mode === "practice" && changeSeat(role)}
                aria-pressed={seat === role}
                disabled={game.mode === "team" && seat !== role}
              >
                <id.icon size={22} />
                <span>
                  <strong>{id.title}</strong>
                  <small>{id.engine}</small>
                </span>
                <span className="crew-state">
                  {game.mode === "team" && !game.onlineSeats.includes(role)
                    ? "OFFLINE"
                    : member?.ready
                      ? "FINISHED"
                      : member?.holding
                        ? "HOLDING"
                        : (view?.boosts[role] ?? 0) > 0
                          ? `+${view?.boosts[role]} SUPPORT`
                          : "AVAILABLE"}
                </span>
              </button>
            );
          })}
        </nav>
        {view && (
          <div className="console-layout">
            <div className="engine-section">
              <div className="engine-heading">
                <div>
                  <span className="eyebrow">
                    {identity.title} /{" "}
                    {locations.find((l) => l.id === player?.location)?.name}
                  </span>
                  <h2>{identity.engine}</h2>
                </div>
                <span className="component-count">
                  {player?.upgraded ? "ENHANCED" : "STANDARD KIT"}
                </span>
              </div>
              <EngineConsole
                view={view}
                selected={pieces}
                onSelect={selectPiece}
                onDraw={() => send({ type: "draw" })}
                onBank={() => send({ type: "bank" })}
                onAction={setAction}
              />
              <div className="engine-footer">
                <button
                  className={`text-button ${player?.holding ? "highlight" : ""}`}
                  onClick={() => send({ type: "hold" })}
                  disabled={player?.ready || view.phase !== "action"}
                >
                  <Pause size={14} />
                  {player?.holding ? "Capability held" : "Hold capability"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setArtifact(true)}
                >
                  <Diamond size={14} />
                  {view.artifact
                    ? "Unclaimed power core"
                    : player?.upgraded
                      ? "Upgrade installed"
                      : "Core donated"}
                </button>
              </div>
            </div>
            <div className="action-section">
              <div className="section-label">COMMIT TO THE SHARED WORLD</div>
              <div className="action-slots">
                {actions.map((item) => (
                  <button
                    key={item.id}
                    className={action === item.id ? "selected" : ""}
                    onClick={() => setAction(item.id)}
                    aria-pressed={action === item.id}
                    title={item.label}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const piece = event.dataTransfer.getData("text/plain");
                      if (piece) setPieces([piece]);
                      setAction(item.id);
                    }}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="target-line">
                <span>TARGET</span>
                {action === "assist" ? (
                  <select
                    aria-label="Assistance recipient"
                    value={recipient}
                    onChange={(event) => setAlly(event.target.value as Seat)}
                  >
                    {seats
                      .filter((s) => s !== seat)
                      .map((s) => (
                        <option key={s} value={s}>
                          {identities[s].title}
                        </option>
                      ))}
                  </select>
                ) : action === "acquire" ? (
                  <select
                    aria-label="Resource to acquire"
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                  >
                    {["power", "materiel", "knowledge", "influence"].map(
                      (r) => (
                        <option key={r}>{r}</option>
                      ),
                    )}
                  </select>
                ) : (
                  <strong>
                    {action === "recover" ? identity.title : location.name}
                  </strong>
                )}
                <button
                  className="text-button"
                  onClick={() => send({ type: "request", target: selected })}
                >
                  <Radio size={13} />
                  Request help
                </button>
              </div>
              <div className="action-preview" aria-live="polite">
                <span>{preview?.cost || "No components committed"}</span>
                <p>{preview?.allowed ? preview.effect : preview?.reason}</p>
              </div>
              <div className="commit-row">
                <button
                  className="primary-button"
                  disabled={
                    !preview?.allowed ||
                    view.phase !== "action" ||
                    !game.started
                  }
                  onClick={() => send(command)}
                >
                  Commit {action}
                  <ArrowRight size={17} />
                </button>
                <button
                  className="finish-button"
                  disabled={
                    player?.ready || view.phase !== "action" || !game.started
                  }
                  onClick={() => setFinishing(true)}
                >
                  <Check size={16} />
                  {player?.ready ? "Round finished" : "Finish round"}
                </button>
              </div>
            </div>
            <aside className="private-section">
              <div className="section-label">
                <LockKeyhole size={13} />
                YOUR PERCEPTION
              </div>
              {view.intel.map((intel, index) => (
                <div className={`intel ${intel.status}`} key={index}>
                  <span>{intel.status}</span>
                  <p>{intel.text}</p>
                </div>
              ))}
              <button
                className="text-button share-button"
                onClick={() => send({ type: "share" })}
                disabled={
                  view.phase !== "action" ||
                  view.reports.some((r) => r.seat === seat)
                }
              >
                <Send size={13} />
                {view.reports.some((r) => r.seat === seat)
                  ? "Reading shared"
                  : "Share reading with team"}
              </button>
              <div className="private-objective">
                <span>PRIVATE AMBITION</span>
                <p>{view.objective}</p>
              </div>
            </aside>
          </div>
        )}
      </section>
      <footer className="event-ribbon">
        <button className="event-tag" onClick={() => setHistory(!history)}>
          FIELD LOG
          <ChevronRight size={13} />
        </button>
        <p role="status">
          {game.error ||
            view?.log.at(-1)?.text ||
            "Awaiting deployment to Greyhaven."}
        </p>
        {view && <span className="connection-indicator">{game.status}</span>}
      </footer>
      {view && (
        <nav className="mobile-commandbar" aria-label="Field navigation">
          <button
            onClick={() =>
              document
                .querySelector(".world")
                ?.scrollIntoView({ block: "start" })
            }
          >
            <MapPin size={18} />
            Field
          </button>
          <button
            onClick={() =>
              document
                .querySelector(".player-area")
                ?.scrollIntoView({ block: "start" })
            }
          >
            <Hexagon size={18} />
            Your kit
          </button>
          <button
            onClick={() =>
              document
                .querySelector(".private-section")
                ?.scrollIntoView({ block: "start" })
            }
          >
            <Radio size={18} />
            Readings
          </button>
        </nav>
      )}
      {history && (
        <section className="log-drawer" aria-label="Field log">
          <button
            className="icon-button"
            aria-label="Close field log"
            onClick={() => setHistory(false)}
          >
            <X />
          </button>
          {view?.log
            .slice()
            .reverse()
            .map((entry) => (
              <p key={entry.id}>
                <span>{String(entry.id).padStart(2, "0")}</span>
                {entry.text}
              </p>
            ))}
        </section>
      )}
      {(!view || help) && (
        <div className="modal-backdrop">
          <section
            className="briefing modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="briefing-title"
          >
            {view && (
              <button
                className="icon-button modal-close"
                aria-label="Close briefing"
                onClick={() => setHelp(false)}
              >
                <X />
              </button>
            )}
            <span className="eyebrow">MISSION DOSSIER / 01</span>
            <h2 id="briefing-title">Greyhaven is running out of time.</h2>
            <p>
              A dimensional breach is tearing through the settlement. Restore
              the relay, compare your readings, and channel enough power to
              close it.
            </p>
            <div className="briefing-objectives">
              <span>
                <Zap />
                Reach {playableMission.requiredProgress} stabilization
              </span>
              <span>
                <Activity />
                Keep instability below 12 / six rounds
              </span>
              <span>
                <Users />
                Four specialists. One crisis.
              </span>
            </div>
            {view ? (
              <button className="primary-button" onClick={() => setHelp(false)}>
                Return to the field
                <ArrowRight size={17} />
              </button>
            ) : (
              <>
                <div className="mode-toggle">
                  <button
                    className={lobbyMode === "practice" ? "selected" : ""}
                    onClick={() => setLobbyMode("practice")}
                  >
                    Solo table / all four seats
                  </button>
                  <button
                    className={lobbyMode === "team" ? "selected" : ""}
                    onClick={() => setLobbyMode("team")}
                  >
                    Cooperative table
                  </button>
                </div>
                {lobbyMode === "team" && (
                  <div className="join-controls">
                    <label>
                      Your specialist
                      <select
                        value={lobbySeat}
                        onChange={(e) => setLobbySeat(e.target.value as Seat)}
                      >
                        {seats.map((s) => (
                          <option value={s} key={s}>
                            {identities[s].title} / {identities[s].engine}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Room code
                      <input
                        aria-label="Room code"
                        placeholder="Leave blank to create a table"
                        value={invite}
                        onChange={(e) => setInvite(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <button
                  className="primary-button"
                  disabled={game.status === "connecting"}
                  onClick={() => {
                    setSelected("relay");
                    setPieces([]);
                    setAction("contribute");
                    setArtifact(false);
                    setFinishing(false);
                    setHelp(false);
                    setHistory(false);
                    void game.connect(
                      lobbyMode,
                      lobbySeat,
                      lobbyMode === "team"
                        ? invite.trim() || undefined
                        : undefined,
                    );
                  }}
                >
                  Deploy to Greyhaven
                  <ArrowRight size={17} />
                </button>
                {game.error && (
                  <p role="alert" className="error-text">
                    {game.error}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {finishing && view && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
          >
            <button
              className="icon-button modal-close"
              aria-label="Keep playing"
              onClick={() => setFinishing(false)}
            >
              <X />
            </button>
            <span className="eyebrow">TEAM ROUND {view.round} / 6</span>
            <h2 id="finish-title">Finish your opportunities?</h2>
            <p>
              Your unused pieces refresh next round. You cannot commit further
              actions this round, but you can still share your reading and
              request help. Holding keeps your remaining capability available
              instead.
            </p>
            <div className="finish-consequence">
              <strong>
                {view.round === 6
                  ? "Final surge: the mission ends if the breach remains open."
                  : `World response: +${pressure} instability`}
              </strong>
              <span>
                {view.players.filter((p) => p.ready).length} of 4 already
                finished. The world responds when all four finish.
              </span>
            </div>
            <div className="commit-row">
              <button
                className="primary-button"
                onClick={() => {
                  send({ type: "ready" });
                  setFinishing(false);
                }}
              >
                Confirm finish
                <Check size={16} />
              </button>
              <button
                className="finish-button"
                onClick={() => {
                  send({ type: "hold" });
                  setFinishing(false);
                }}
              >
                <Pause size={15} />
                Hold instead
              </button>
            </div>
          </section>
        </div>
      )}
      {artifact && view && (
        <div className="modal-backdrop">
          <section
            className="modal core-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="core-title"
          >
            <button
              className="icon-button modal-close"
              aria-label="Close power core"
              onClick={() => setArtifact(false)}
            >
              <X />
            </button>
            <Diamond className="core-symbol" size={48} />
            <span className="eyebrow">ONE CORE. TWO FUTURES.</span>
            <h2 id="core-title">Power worth keeping.</h2>
            <p>{view.objective}</p>
            <div className="core-choices">
              <div>
                <h3>Make it yours</h3>
                <p>{identity.upgrade}</p>
                <button
                  disabled={!view.artifact || view.phase !== "action"}
                  onClick={() => {
                    send({ type: "upgrade" });
                    setArtifact(false);
                  }}
                >
                  <Sparkles size={16} />
                  Install personal upgrade
                </button>
              </div>
              <div>
                <h3>Give Greyhaven a chance</h3>
                <p>
                  +2 shared Power. Fuel two stabilization actions or restore the
                  relay. Your personal upgrade is forfeited.
                </p>
                <button
                  disabled={!view.artifact || view.phase !== "action"}
                  onClick={() => {
                    send({ type: "donate" });
                    setArtifact(false);
                  }}
                >
                  <Zap size={16} />
                  Donate core to team
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {view && view.phase !== "action" && (
        <div className="modal-backdrop">
          <section
            className="modal resolution"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolution-title"
          >
            <Flag size={40} />
            <span className="eyebrow">OPERATION COMPLETE</span>
            <h2 id="resolution-title">
              {view.phase === "won"
                ? "Greyhaven holds."
                : "The breach takes Greyhaven."}
            </h2>
            <p>
              {view.phase === "won"
                ? "Four different ways of playing. One shared victory."
                : "The team's remaining capability could not contain the instability."}
            </p>
            <div className="result-crew">
              {view.players.map((p) => (
                <div key={p.seat}>
                  <strong>{identities[p.seat].title}</strong>
                  <span>{p.contribution} contribution</span>
                  <small>
                    {p.upgraded
                      ? "Personal capability enhanced"
                      : "Standard capability"}
                  </small>
                </div>
              ))}
            </div>
            <button className="primary-button" onClick={game.leave}>
              <RotateCcw size={17} />
              Return to deployment
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
