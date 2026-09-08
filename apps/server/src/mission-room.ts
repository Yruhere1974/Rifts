import { randomBytes, randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import {
  applyCommand,
  createMission,
  playerView,
  missionSeats,
  type Seat,
} from "@rifts/rules";
import {
  commandMessageSchema,
  joinOptionsSchema,
  seatMessageSchema,
} from "./messages.js";

type Session = { token: string; seat: Seat; clientKey: string };

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
    this.maxClients = this.mode === "practice" ? 1 : 4;
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
      if (this.mode !== "practice") {
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
    const existing = this.owners.get(parsed.data.seat);
    const clientKey = parsed.data.clientKey;
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
    return {
      token: randomBytes(32).toString("hex"),
      seat: parsed.data.seat,
      clientKey,
    };
  }

  override onJoin(client: Client, _options: unknown, auth: Session): void {
    // Check and claim without awaiting so concurrent joins cannot share a seat.
    if (
      [...this.sessions.values()].some((session) => session.seat === auth.seat)
    ) {
      throw new ServerError(409, "That seat is already occupied.");
    }
    this.sessions.set(client.sessionId, auth);
    this.owners.set(auth.seat, auth.clientKey);
    if (this.sessions.size === 4) this.started = true;
    this.sendViews(client);
  }

  override onLeave(client: Client): void {
    this.sessions.delete(client.sessionId);
    this.finishAbsentSeats();
    this.sendViews();
  }

  private finishAbsentSeats(): void {
    if (!this.started || this.mode !== "team" || this.sessions.size === 0)
      return;
    const online = new Set(
      [...this.sessions.values()].map((session) => session.seat),
    );
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
    client.send("view", {
      view: playerView(this.mission, session.seat),
      seat: session.seat,
      mode: this.mode,
      token: session.token,
      onlineSeats: [...this.sessions.values()].map((entry) => entry.seat),
      started: this.started,
      clientKey: session.clientKey,
    });
  }

  private reject(client: Client, message: string): void {
    client.send("error", { message });
  }
}
