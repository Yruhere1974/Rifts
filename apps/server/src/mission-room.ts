import { randomBytes, randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import {
  applyCommand,
  createMission,
  playerView,
  tableView,
  missionSeats,
  type Seat,
} from "@rifts/rules";
import {
  commandMessageSchema,
  joinOptionsSchema,
  seatMessageSchema,
} from "./messages.js";

type Role = "player" | "table";
type Session = {
  token: string;
  seat: Seat;
  clientKey: string;
  role: Role;
};

export class MissionRoom extends Room {
  // Never assign mission to Room.state: only filtered messages cross the wire.
  private mission = createMission();
  private mode: "practice" | "team" = "team";
  private readonly sessions = new Map<string, Session>();
  private readonly owners = new Map<Seat, string>();
  private started = false;

  override onCreate(options: unknown): void {
    const parsed = joinOptionsSchema.safeParse(options);
    if (!parsed.success) throw new ServerError(400, "Invalid mission options.");
    this.mode = parsed.data.mode;
    this.mission = createMission(
      this.mode === "practice" ? 1 : randomInt(1, 0x100000000),
    );
    this.started = this.mode === "practice";
    // Four seats plus shared screens, which hold no seat and send no commands.
    this.maxClients = this.mode === "practice" ? 2 : 8;
    this.maxMessagesPerSecond = 20;
    this.setPatchRate(null);

    // Request the first view after the browser installs its message listeners.
    this.onMessage("sync", (client) => this.sendView(client));
    this.onMessage("command", (client, payload: unknown) => {
      const parsed = commandMessageSchema.safeParse(payload);
      const session = this.sessions.get(client.sessionId);
      if (!parsed.success || !session || parsed.data.token !== session.token) {
        this.reject(client, "Invalid command or session.");
        return;
      }
      if (session.role !== "player") {
        this.reject(client, "A shared screen cannot act in the mission.");
        return;
      }
      try {
        if (
          !this.started &&
          parsed.data.command.type !== "share" &&
          parsed.data.command.type !== "request"
        ) {
          this.reject(
            client,
            "Waiting for all four specialists to join. Readings and requests can be shared now.",
          );
          return;
        }
        const result = applyCommand(
          this.mission,
          session.seat,
          parsed.data.command,
        );
        if (result.error) {
          this.reject(client, result.error);
          return;
        }
        this.mission = result.state;
        this.finishAbsentSeats();
        this.sendViews();
      } catch (error) {
        console.error("Mission command failed", error);
        this.reject(client, "The command could not be completed.");
      }
    });
    this.onMessage("seat", (client, payload: unknown) => {
      const parsed = seatMessageSchema.safeParse(payload);
      const session = this.sessions.get(client.sessionId);
      if (!parsed.success || !session || parsed.data.token !== session.token) {
        this.reject(client, "Invalid seat or session.");
        return;
      }
      if (this.mode !== "practice" || session.role !== "player") {
        this.reject(client, "Seats can only be switched in practice.");
        return;
      }
      session.seat = parsed.data.seat;
      session.token = randomBytes(32).toString("hex");
      this.sendView(client);
    });
    this.onMessage("*", (client) =>
      this.reject(client, "Unknown message type."),
    );
  }

  override onAuth(_client: Client, options: unknown): Session {
    const parsed = joinOptionsSchema.safeParse(options);
    if (!parsed.success || parsed.data.mode !== this.mode) {
      throw new ServerError(400, "Invalid mission options.");
    }
    const clientKey = parsed.data.clientKey;
    const role = parsed.data.role;
    const token = randomBytes(32).toString("hex");
    // A shared screen claims no seat, so seat ownership never applies to it.
    if (role === "table")
      return { token, seat: parsed.data.seat, clientKey, role };
    const existing = this.owners.get(parsed.data.seat);
    if (existing && existing !== clientKey)
      throw new ServerError(
        403,
        "This specialist is reserved for its original player.",
      );
    if (
      this.mode === "team" &&
      [...this.owners].some(
        ([seat, key]) => key === clientKey && seat !== parsed.data.seat,
      )
    )
      throw new ServerError(403, "Your seat is fixed for this mission.");
    return { token, seat: parsed.data.seat, clientKey, role };
  }

  override onJoin(client: Client, _options: unknown, auth: Session): void {
    if (auth.role === "table") {
      this.sessions.set(client.sessionId, auth);
      this.sendView(client);
      return;
    }
    // Check and claim without awaiting so concurrent joins cannot share a seat.
    const holder = [...this.sessions.entries()].find(
      ([, session]) => session.role === "player" && session.seat === auth.seat,
    );
    if (holder) {
      if (holder[1].clientKey !== auth.clientKey)
        throw new ServerError(409, "That seat is already occupied.");
      // Same owner: a reload or reconnect reclaims its seat rather than being
      // locked out by the session it is replacing.
      this.sessions.delete(holder[0]);
      this.clients.find((entry) => entry.sessionId === holder[0])?.leave(4001);
    }
    this.sessions.set(client.sessionId, auth);
    this.owners.set(auth.seat, auth.clientKey);
    if (this.seated().length === 4) this.started = true;
    this.sendViews(client);
  }

  override onLeave(client: Client): void {
    this.sessions.delete(client.sessionId);
    this.finishAbsentSeats();
    this.sendViews();
  }

  /** Seated players only; shared screens never gate the round or hold a seat. */
  private seated(): Session[] {
    return [...this.sessions.values()].filter(
      (session) => session.role === "player",
    );
  }

  private finishAbsentSeats(): void {
    if (!this.started || this.mode !== "team" || this.seated().length === 0)
      return;
    const online = new Set(this.seated().map((session) => session.seat));
    for (const seat of missionSeats) {
      if (
        !online.has(seat) &&
        !this.mission.players.find((player) => player.seat === seat)?.ready
      ) {
        this.mission = applyCommand(this.mission, seat, {
          type: "ready",
        }).state;
      }
    }
  }

  private sendViews(except?: Client): void {
    for (const client of this.clients)
      if (client !== except) this.sendView(client);
  }

  private sendView(client: Client): void {
    const session = this.sessions.get(client.sessionId);
    if (!session) return;
    const onlineSeats = this.seated().map((entry) => entry.seat);
    // A distinct message type, so a table client can never render a seat view.
    if (session.role === "table") {
      client.send("table", {
        view: tableView(this.mission),
        mode: this.mode,
        onlineSeats,
        started: this.started,
      });
      return;
    }
    client.send("view", {
      view: playerView(this.mission, session.seat),
      seat: session.seat,
      mode: this.mode,
      token: session.token,
      onlineSeats,
      started: this.started,
      clientKey: session.clientKey,
    });
  }

  private reject(client: Client, message: string): void {
    client.send("error", { message });
  }
}
