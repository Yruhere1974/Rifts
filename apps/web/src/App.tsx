import { useEffect, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
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
  Tv,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  previewAction,
  engineTier,
  facetForAction,
  objectsBeside,
  reachable,
  siteAt,
  hasReports,
  worldPressure,
  type MissionCommand,
  type Seat,
} from "@rifts/rules";
import { missionMap, playableMission, specialistFor } from "@rifts/content";
import { hexDistance, hexKey, parseHex } from "@rifts/shared";
import { BoardCanvas } from "./BoardCanvas.js";
import { EngineConsole, identities } from "./EngineConsole.js";
import { staggerDelay, useArrivals, usePrevious, usePulse } from "./motion.js";
import { useMission } from "./useMission.js";
import { useModalFocus } from "./useModalFocus.js";
import { Tutorial } from "./Tutorial.js";
import { RulesReference } from "./RulesReference.js";

const seats: Seat[] = ["dice", "cards", "bag", "systems"];
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

/** The first piece of apparatus at a site, which is what selecting it means. */
const apparatusOf = (site: string) =>
  missionMap.objects.find((object) => object.site === site)?.hex ??
  missionMap.sites.relay;

const joinLink = (): { room: string; seat: Seat } | null => {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  const requested = params.get("seat");
  return room && seats.some((s) => s === requested)
    ? { room, seat: requested as Seat }
    : null;
};

export function App() {
  const game = useMission();
  const { view, seat } = game;
  const [link] = useState(joinLink);
  // Selecting an objective means selecting its apparatus: the middle of the
  // room is no longer a place anyone can work from.
  const [selected, setSelected] = useState(hexKey(apparatusOf("relay")));
  const selectedSite = siteAt(parseHex(selected) ?? apparatusOf("relay"), 0);
  const [pieces, setPieces] = useState<string[]>([]);
  // Which socket on the Techno-Wizard's frame the next placement builds into.
  const [socket, setSocket] = useState<number | null>(null);
  const [action, setAction] = useState<Action>("contribute");
  const [ally, setAlly] = useState<Seat>("systems");
  const [foe, setFoe] = useState("");
  const [resource, setResource] = useState("power");
  const [lobbyMode, setLobbyMode] = useState<"practice" | "team">(
    link ? "team" : "practice",
  );
  const [lobbySeat, setLobbySeat] = useState<Seat>(link?.seat ?? "dice");
  const [invite, setInvite] = useState(link?.room ?? "");
  const [help, setHelp] = useState(false);
  const [artifact, setArtifact] = useState(false);
  const [history, setHistory] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
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
              : rulesOpen
                ? "rules"
                : "",
    () => {
      setArtifact(false);
      setFinishing(false);
      setHelp(false);
      setRulesOpen(false);
    },
  );
  const connect = game.connect;
  useEffect(() => {
    // connect() is idempotent per target, so a remounted effect reuses the
    // connection instead of opening a second socket for the same seat.
    if (!link) return;
    void connect("team", link.seat, link.room);
  }, [link, connect]);
  const identity = identities[seat];
  // The shared sidebar only ever receives whole snapshots, so it diffs the few
  // values the rules actually care about and replays a one-shot cue on each.
  // Every diff is taken against `view` rather than the value alone: joining a
  // table in progress is not the team gaining ground, and must stay silent.
  const progress = view?.progress ?? 0;
  const previousProgress = usePrevious(view ? progress : undefined);
  // The first cell of a gain, and the anchor for its left-to-right cascade.
  const progressFrom =
    previousProgress !== undefined && progress > previousProgress
      ? previousProgress
      : progress;
  const progressPulse = usePulse(progress);
  const instability = view?.instability ?? 0;
  const previousInstability = usePrevious(view ? instability : undefined);
  const escalating =
    previousInstability !== undefined && instability > previousInstability;
  const instabilityPulse = usePulse(instability);
  const round = view?.round ?? 1;
  const previousRound = usePrevious(view ? round : undefined);
  const roundTurned = previousRound !== undefined && round !== previousRound;
  const roundPulse = usePulse(round);
  // Traffic on the team channel and support landing on a seat: both are things
  // a teammate did to you, so they arrive rather than simply appear.
  const commsIds = [
    ...(view?.requests.map((entry) => `request:${entry.seat}`) ?? []),
    ...(view?.reports.map(
      (entry) => `report:${entry.seat}-${entry.location}`,
    ) ?? []),
  ];
  const commsArrivals = useArrivals(commsIds);
  const boostArrivals = useArrivals(
    seats
      .filter((role) => (view?.boosts[role] ?? 0) > 0)
      .map((role) => `${role}:${view?.boosts[role] ?? 0}`),
  );
  const freshComms = commsIds.filter((id) => commsArrivals.has(id));
  const arrived = (id: string) => commsArrivals.has(id);
  // Cascade only across the entries that landed together, so a long feed never
  // delays a single new report by its position in the list.
  const arrivalDelay = (id: string): CSSProperties | undefined =>
    arrived(id)
      ? ({
          "--motion-delay": `${staggerDelay(freshComms.indexOf(id))}ms`,
        } as CSSProperties)
      : undefined;
  const recipient = ally === seat ? seats.find((s) => s !== seat)! : ally;
  const pressure = worldPressure(view?.round ?? 1, view?.threat ?? 3);
  const tier = engineTier(view?.round ?? 1);
  const location =
    locations.find((item) => item.id === selectedSite) ?? locations[1]!;
  const player = view?.players.find((item) => item.seat === seat);
  // A surge is spent whole, so the Juicer never selects part of it.
  // Being in the room is no longer enough; you have to be beside something.
  const beside =
    view && player ? objectsBeside(player.position, player.size) : [];
  const facet = facetForAction[action];
  const committed =
    seat === "bag"
      ? (view?.engine.pending.map((t) => t.id) ?? [])
      : seat === "dice" && facet
        ? (view?.engine.dice ?? [])
            .filter(
              (die) =>
                die.facet === facet ||
                (action === "engage" &&
                  (die.facet === "boom" || die.facet === "bracing")),
            )
            .map((die) => die.id)
        : pieces;
  const inReach = (view?.enemies ?? []).filter(
    (enemy) =>
      player && hexDistance(player.position, enemy.position) <= player.size + 1,
  );
  const quarry = inReach.find((enemy) => enemy.id === foe) ?? inReach[0];
  const command: MissionCommand = {
    type: "act",
    action,
    target:
      action === "engage"
        ? (quarry?.id ?? "")
        : action === "assist"
          ? recipient
          : action === "acquire"
            ? resource
            : action === "recover"
              ? seat
              : action === "move"
                ? selected
                : (selectedSite ?? ""),
    pieces: committed,
    ...(socket === null ? {} : { socket }),
  };
  const preview = view ? previewAction(view, command) : null;
  // Where this commitment could carry the unit. The compiler memoizes this;
  // it only recomputes when the staged move actually changes.
  const moveReach = ((): ReadonlySet<string> | undefined => {
    const me = view?.players.find((entry) => entry.seat === seat);
    if (!view || !me || action !== "move" || !preview?.range) return undefined;
    const others = view.players.filter((entry) => entry.seat !== seat);
    const keys = new Set<string>();
    for (const [key] of reachable(
      me.position,
      me.size,
      preview.range,
      view.enemies,
    )) {
      const hex = parseHex(key);
      if (
        hex &&
        !others.some(
          (other) => hexDistance(hex, other.position) <= me.size + other.size,
        )
      )
        keys.add(key);
    }
    return keys;
  })();
  const send = (input: MissionCommand) => {
    game.send(input);
    // Holding a piece back does not spend anything, so it must not tear down
    // the weave, surge or placement the player is part way through staging.
    if (input.type === "keep") return;
    setPieces([]);
    setSocket(null);
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
        : seat === "dice" || seat === "systems"
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
          {view && game.mode === "practice" && (
            <button
              className="icon-button"
              aria-label={tutorial ? "Pause tutorial" : "Resume tutorial"}
              data-tutorial-toggle
              title={tutorial ? "Pause tutorial" : "Resume tutorial"}
              aria-pressed={tutorial}
              onClick={() => setTutorial(!tutorial)}
            >
              <Compass size={19} />
            </button>
          )}
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
          {game.roomId && game.mode === "team" && (
            <a
              className="table-link"
              href={`/?table=1&room=${encodeURIComponent(game.roomId)}`}
              target="_blank"
              rel="noreferrer"
              title="Open the shared table screen"
            >
              <Tv size={14} />
              Table screen
            </a>
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
      {view && game.mode === "practice" && (
        <Tutorial
          key={game.roomId}
          view={view}
          active={tutorial}
          guidance={{
            selected: selectedSite ?? "",
            pieces: committed,
            staged: pieces,
            socket,
            action,
            recipient,
            artifactOpen: artifact,
          }}
          onPause={() => {
            document
              .querySelector<HTMLElement>("[data-tutorial-toggle]")
              ?.focus();
            setTutorial(false);
          }}
        />
      )}
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
      <div className="cockpit">
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
                reachable={moveReach}
                focus={
                  player
                    ? { centre: player.position, radius: player.size + 7 }
                    : undefined
                }
              />
              <div className="map-labels">
                {locations.map((item) => (
                  <button
                    key={item.id}
                    className={`location-pin ${selectedSite === item.id ? "selected" : ""} ${item.id}`}
                    onClick={() => setSelected(hexKey(apparatusOf(item.id)))}
                    aria-pressed={selectedSite === item.id}
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
                  {player?.location === selectedSite
                    ? "You are here"
                    : "Remote"}
                </span>
              </div>
              <p>
                {selectedSite === "rift"
                  ? view?.frequencyKnown
                    ? "Frequency triangulated. Stabilization is safe. Each contribution consumes 1 shared Power."
                    : "Uncertain timing: blind stabilization adds 5 instability. Combine independent readings or investigate before committing."
                  : selectedSite === "gate"
                    ? "The patrol adds +1 instability at each world response. Engage at the gate to remove its strength."
                    : selectedSite === "archive"
                      ? "Investigate the records for Knowledge and safe breach timing. A known route through the noise."
                      : "An engine commitment and 2 shared Power restore the relay. Removing the shield doubles stabilization output."}
              </p>
              <p className="beside-line">
                {beside.length
                  ? `Beside ${beside.map((object) => object.name).join(", ")}.`
                  : "Beside nothing. Move up to a piece of apparatus to work on it."}
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
              {view && (
                <section
                  className="location-perception"
                  aria-label="Private location assessment"
                >
                  <div className="section-label">
                    <LockKeyhole size={14} /> {identity.title} / PRIVATE
                    ASSESSMENT
                  </div>
                  {view.perceptions
                    .filter((reading) => reading.location === selectedSite)
                    .map((reading) => (
                      <div
                        className={`intel ${reading.status}`}
                        key={reading.location}
                      >
                        <span>{reading.status}</span>
                        <p>{reading.text}</p>
                      </div>
                    ))}
                  <p className="muted">
                    Other specialists' unshared assessments are hidden.
                  </p>
                  <button
                    className="text-button"
                    disabled={
                      view.phase !== "action" ||
                      view.reports.some(
                        (r) => r.seat === seat && r.location === selectedSite,
                      )
                    }
                    onClick={() =>
                      send({ type: "share", target: selectedSite ?? "rift" })
                    }
                  >
                    <Send size={14} />{" "}
                    {view.reports.some(
                      (r) => r.seat === seat && r.location === selectedSite,
                    )
                      ? "Location assessment shared"
                      : "Share location assessment"}
                  </button>
                  {selectedSite === "gate" &&
                    hasReports(view, "gate", ["dice", "bag"]) && (
                      <p className="discovery-note">
                        PATROL WEAKNESS /{" "}
                        {view.discoveries.flankUsed
                          ? "Opening spent"
                          : "Next Engage at West gate gains +1 effect. Any specialist can exploit it."}
                      </p>
                    )}
                  {selectedSite === "archive" &&
                    hasReports(view, "archive", ["bag", "systems"]) && (
                      <p className="discovery-note">
                        POWER CACHE /{" "}
                        {view.discoveries.cacheUsed
                          ? "Cache recovered"
                          : "Investigate here with engine pieces to recover +2 shared Power, once only."}
                      </p>
                    )}
                </section>
              )}
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
                {/* Keyed on the pulse so a gain replays the surge even when the
                  counter is already mid-animation from the previous one. */}
                <strong
                  key={progressPulse}
                  className={
                    progressFrom < progress ? "motion-surge" : undefined
                  }
                >
                  {progress}
                  <small>
                    {" "}
                    /{" "}
                    {view?.requiredProgress ?? playableMission.requiredProgress}
                  </small>
                </strong>
                <span>STABILIZATION</span>
              </div>
              <div className="segmented-track">
                {Array.from(
                  {
                    length:
                      view?.requiredProgress ??
                      playableMission.requiredProgress,
                  },
                  (_, i) => {
                    const lit = i >= progressFrom && i < progress;
                    return (
                      <i
                        key={lit ? `${i}-${progressPulse}` : i}
                        className={
                          lit
                            ? "filled motion-ignite"
                            : i < progress
                              ? "filled"
                              : ""
                        }
                        style={
                          lit
                            ? ({
                                "--motion-delay": `${staggerDelay(i - progressFrom)}ms`,
                              } as CSSProperties)
                            : undefined
                        }
                      />
                    );
                  },
                )}
              </div>
            </section>
            <section className="pressure-section">
              <div className="section-label">
                <Activity size={14} />
                INSTABILITY<strong>{instability} / 12</strong>
              </div>
              {/* One flash, never a loop: a permanent alarm would stop reading
                as news long before instability actually reaches 12. */}
              <div
                key={instabilityPulse}
                className={`segmented-track danger${escalating ? " motion-flash" : ""}`}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} className={i < instability ? "filled" : ""} />
                ))}
              </div>
              <p>At 12, Greyhaven falls. Six rounds remain at deployment.</p>
              {/* The world answered and re-issued its forecast; the block settles
                back in so the escalation lands somewhere other than the log. */}
              <div
                key={roundPulse}
                className={`world-response${roundTurned ? " motion-settle" : ""}`}
              >
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
                    className={`assist-request${arrived(`request:${request.seat}`) ? " motion-settle" : ""}`}
                    style={arrivalDelay(`request:${request.seat}`)}
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
                  <div
                    className={`report${arrived(`report:${report.seat}-${report.location}`) ? " motion-settle" : ""}`}
                    style={arrivalDelay(
                      `report:${report.seat}-${report.location}`,
                    )}
                    key={`${report.seat}-${report.location}`}
                  >
                    <span style={{ color: identities[report.seat].color }}>
                      {identities[report.seat].title} /{" "}
                      {locations.find((l) => l.id === report.location)?.name} /
                      SHARED
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
              const boost = view?.boosts[role] ?? 0;
              const supported = boostArrivals.has(`${role}:${boost}`);
              return (
                <button
                  key={role}
                  style={{ "--crew-color": id.color } as CSSProperties}
                  className={`crew-seat ${seat === role ? "active" : ""}`}
                  data-tutorial-seat={role}
                  onClick={() => game.mode === "practice" && changeSeat(role)}
                  aria-pressed={seat === role}
                  disabled={game.mode === "team" && seat !== role}
                >
                  <id.icon size={22} />
                  <span>
                    <strong>{id.title}</strong>
                    <small>
                      {id.family} / {id.engine}
                    </small>
                  </span>
                  {/* Support is something a teammate spent on you; the label is
                    remounted on the new total so the flash replays. */}
                  <span
                    key={`${role}:${boost}`}
                    className={`crew-state${supported ? " motion-flash" : ""}`}
                  >
                    {game.mode === "team" && !game.onlineSeats.includes(role)
                      ? "OFFLINE"
                      : member?.ready
                        ? "FINISHED"
                        : member?.holding
                          ? "HOLDING"
                          : boost > 0
                            ? `+${boost} SUPPORT`
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
                    {tier > 0 ? ` / TIER ${tier}` : ""}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`${identity.title} rules reference`}
                    title={`${identity.title} rules reference`}
                    onClick={() => setRulesOpen(true)}
                  >
                    <CircleHelp size={20} />
                  </button>
                </div>
                <EngineConsole
                  view={view}
                  selected={pieces}
                  onSelect={selectPiece}
                  onDraw={() => send({ type: "draw" })}
                  onAllocate={(die, facet) =>
                    send({ type: "allocate", die, facet })
                  }
                  onKeep={(piece) => send({ type: "keep", piece })}
                  onSocket={setSocket}
                  socket={socket}
                  onAction={setAction}
                />
                <section className="advancement" aria-label="Advancement">
                  <div className="section-label">
                    <Sparkles size={13} /> ADVANCEMENT
                  </div>
                  <ol className="advance-track">
                    {specialistFor(seat).growth.map((step) => {
                      const held = tier >= engineTier(step.at);
                      return (
                        <li
                          key={step.at}
                          className={held ? "held" : "locked"}
                          aria-label={`${held ? "Unlocked" : "Locked"}: ${step.gain}`}
                        >
                          <span className="advance-when">
                            {held ? (
                              <Check size={12} />
                            ) : (
                              <LockKeyhole size={12} />
                            )}
                            ROUND {step.at}
                          </span>
                          <p>{step.gain}</p>
                        </li>
                      );
                    })}
                    <li
                      className={
                        player?.upgraded
                          ? "held"
                          : view.artifact
                            ? "offered"
                            : "spent"
                      }
                    >
                      <span className="advance-when">
                        {player?.upgraded ? (
                          <Check size={12} />
                        ) : (
                          <Diamond size={12} />
                        )}
                        POWER CORE
                      </span>
                      <p>
                        {player?.upgraded
                          ? identity.upgrade
                          : view.artifact
                            ? "Unclaimed. Keep it for a permanent upgrade, or donate it for 2 shared Power."
                            : "Donated to the team. This upgrade is forfeited for the mission."}
                      </p>
                    </li>
                  </ol>
                </section>
                <div className="engine-footer">
                  <button
                    className={`text-button ${player?.holding ? "highlight" : ""}`}
                    data-tutorial="hold"
                    onClick={() => send({ type: "hold" })}
                    disabled={player?.ready || view.phase !== "action"}
                  >
                    <Pause size={14} />
                    {player?.holding ? "Capability held" : "Hold capability"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setArtifact(true)}
                    data-tutorial="core"
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
                  {action === "engage" ? (
                    inReach.length ? (
                      <select
                        aria-label="Enemy to engage"
                        value={quarry?.id ?? ""}
                        onChange={(event) => setFoe(event.target.value)}
                      >
                        {inReach.map((enemy) => (
                          <option key={enemy.id} value={enemy.id}>
                            {enemy.name} ({enemy.strength})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong>Nothing in reach</strong>
                    )
                  ) : action === "assist" ? (
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
                    onClick={() =>
                      send({ type: "request", target: selectedSite ?? "power" })
                    }
                    data-tutorial="request"
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
                    data-tutorial="commit"
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
                    view.reports.some(
                      (r) => r.seat === seat && r.location === "rift",
                    )
                  }
                >
                  <Send size={13} />
                  {view.reports.some(
                    (r) => r.seat === seat && r.location === "rift",
                  )
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
      </div>
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
          {tutorial && game.mode === "practice" && (
            <button
              onClick={() =>
                document
                  .querySelector(".tutorial-band")
                  ?.scrollIntoView({ block: "start" })
              }
            >
              <Compass size={18} />
              Training
            </button>
          )}
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
                {lobbyMode === "practice" && (
                  <label className="tutorial-option">
                    <input
                      type="checkbox"
                      checked={tutorial}
                      onChange={(event) => setTutorial(event.target.checked)}
                    />
                    Guided tutorial / learn all four specialists
                  </label>
                )}
                <button
                  className="primary-button"
                  disabled={game.status === "connecting"}
                  onClick={() => {
                    setSelected(hexKey(apparatusOf("relay")));
                    setPieces([]);
                    setAction("contribute");
                    setArtifact(false);
                    setFinishing(false);
                    setHelp(false);
                    setHistory(false);
                    setRulesOpen(false);
                    void game.connect(
                      lobbyMode,
                      lobbyMode === "practice" ? "dice" : lobbySeat,
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
      {rulesOpen && view && view.phase === "action" && (
        <RulesReference
          initialSeat={seat}
          onClose={() => setRulesOpen(false)}
        />
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
            {tutorial && game.mode === "practice" && (
              <p>
                {view.phase === "won"
                  ? "Field training complete. Your next deployment can be an unguided solo table or a cooperative table with one specialist per player."
                  : "Training uses the real stakes. Deploy again to retry the guide: share two readings, restore the relay, and reserve Power for stabilization."}
              </p>
            )}
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
