import { useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import type { MissionTableView, Seat } from "@rifts/rules";
import { browserUuid } from "./browserUuid.js";
import {
  persistentClientKey,
  pingLifetimeMs,
  type MissionPing,
} from "./useMission.js";

type TableMessage = {
  view: MissionTableView;
  mode: "practice" | "team";
  onlineSeats: Seat[];
  started: boolean;
  seat: Seat;
  ownedSeats: Seat[];
  token: string;
  code: string;
  claimedSeats: Seat[];
  seatsPerPlayer: number;
  host: boolean;
};

function closeRoom(room: Room | null): void {
  if (!room) return;
  room.reconnection.enabled = false;
  void room.leave().catch(() => undefined);
}

/**
 * Joins a room without claiming a seat. The server sends "table" messages
 * carrying only public state, so this hook can never receive a seat's private
 * engine, whoever is holding it.
 *
 * Two surfaces use it. A shared screen owns nothing and is read-only. A
 * master tab shares its browser's client key with the console tabs it spawns,
 * so the server recognises it as the same person and lets it plan as a seat
 * it owns; it still holds no seat itself, so it never gates the round.
 */
export function useTableView(
  roomId: string | null,
  options?: {
    /** Create the room rather than join one. A master tab opens the mission. */
    create?: boolean;
    mode?: "practice" | "team";
    /** The claimed seat this tab plans as. Naming one is not owning one. */
    seat?: Seat;
    /**
     * "table" is a shared screen and stays read-only. "master" is the tab a
     * player keeps beside their console: it shares this browser's key, which
     * a spawned tab inherits, so the server can tell they are one person.
     */
    role?: "table" | "master";
    /** The four digits a table shares. Opening one mints it; joining uses it. */
    code?: string;
    /** People at the table, which decides how many seats one browser claims. */
    players?: 1 | 2 | 4;
  },
): {
  view: MissionTableView | null;
  pings: MissionPing[];
  onlineSeats: Seat[];
  started: boolean;
  status: string;
  error: string | null;
  roomId: string | null;
  ownedSeats: Seat[];
  code: string;
  claimedSeats: Seat[];
  seatsPerPlayer: number;
  host: boolean;
  send: (command: unknown) => void;
  ping: (hex: string) => void;
  claim: (seat: Seat) => void;
  start: () => void;
} {
  const [view, setView] = useState<MissionTableView | null>(null);
  const [pings, setPings] = useState<MissionPing[]>([]);
  const pingSeq = useRef(0);
  const pingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [onlineSeats, setOnlineSeats] = useState<Seat[]>([]);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState(
    roomId || options?.create ? "connecting" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(roomId);
  const [ownedSeats, setOwnedSeats] = useState<Seat[]>([]);
  const [code, setCode] = useState("");
  const [claimedSeats, setClaimedSeats] = useState<Seat[]>([]);
  const [seatsPerPlayer, setSeatsPerPlayer] = useState(1);
  const [host, setHost] = useState(false);
  const tokenRef = useRef<string>("");
  const roomRef = useRef<Room | null>(null);
  // One connection per room for the life of the page. A remounted effect must
  // reuse it rather than open a second socket and tear down the first.
  const connectedTo = useRef<string | null>(null);

  // Creating has no room id yet, so the connection is keyed on the intent.
  const create = options?.create === true;
  const mode = options?.mode ?? "team";
  const seat = options?.seat ?? "dice";
  const role = options?.role ?? "table";
  const joinCode = options?.code ?? "";
  const players = options?.players ?? 4;
  // Three ways in, and each is its own connection intent: open a table, join
  // one by its code, or attach to a known room as a screen.
  const key = roomId ?? (create ? `create:${joinCode}` : joinCode || null);

  useEffect(() => {
    if (!key || connectedTo.current === key) return;
    connectedTo.current = key;
    const live = () => connectedTo.current === key;
    const join = async () => {
      try {
        const client = new Client(`${window.location.origin}/game`);
        // A shared screen still sends a seat, which the server ignores for the
        // table role; it never claims one and never gates the round.
        const joinOptions = {
          mode,
          seat,
          // A shared screen is anonymous per connection; a master tab uses
          // the per-tab key its spawned consoles inherit.
          clientKey: role === "master" ? persistentClientKey() : browserUuid(),
          role,
        };
        const room = roomId
          ? await client.joinById(roomId.trim(), joinOptions)
          : create
            ? await client.create("mission", {
                ...joinOptions,
                code: joinCode,
                players,
              })
            : // Matched on the code, so this reaches the table that minted it
              // rather than any open room; a wrong code finds nothing.
              await client.join("mission", { ...joinOptions, code: joinCode });
        room.reconnection.enabled = false;
        roomRef.current = room;
        setJoinedId(room.roomId);
        room.onMessage<TableMessage>("table", (message) => {
          if (!live()) return;
          setView(message.view);
          setOnlineSeats(message.onlineSeats);
          setStarted(message.started);
          setOwnedSeats(message.ownedSeats);
          setCode(message.code);
          setClaimedSeats(message.claimedSeats);
          setSeatsPerPlayer(message.seatsPerPlayer);
          setHost(message.host);
          tokenRef.current = message.token;
          setStatus("connected");
          setError(null);
        });
        room.onMessage<{ seat: Seat; hex: string }>("ping", (message) => {
          if (!live()) return;
          pingSeq.current += 1;
          const entry = { id: pingSeq.current, ...message };
          setPings((current) => [...current, entry]);
          pingTimers.current.push(
            setTimeout(
              () =>
                setPings((current) =>
                  current.filter((item) => item.id !== entry.id),
                ),
              pingLifetimeMs,
            ),
          );
        });
        room.onMessage<{ message: string }>("error", (message) => {
          if (live()) setError(message.message);
        });
        room.onError((code, message) => {
          if (live()) setError(message ?? `Connection error (${code}).`);
        });
        room.onLeave(() => {
          if (!live()) return;
          setStatus("disconnected");
          setError("The table screen lost its connection to the mission.");
        });
        room.send("sync");
      } catch (cause) {
        if (!live()) return;
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to reach the mission server.",
        );
      }
    };
    void join();
  }, [key, roomId, mode, seat, create, role, joinCode, players]);

  // Close only when the page really goes away, never on a remount.
  useEffect(
    () => () => {
      for (const handle of pingTimers.current) clearTimeout(handle);
      pingTimers.current = [];
      closeRoom(roomRef.current);
      roomRef.current = null;
    },
    [],
  );

  return {
    view,
    pings,
    onlineSeats,
    started,
    status,
    error,
    roomId: joinedId,
    ownedSeats,
    code,
    claimedSeats,
    seatsPerPlayer,
    host,
    send: (command: unknown) =>
      roomRef.current?.send("command", { token: tokenRef.current, command }),
    ping: (hex: string) =>
      roomRef.current?.send("ping", { token: tokenRef.current, hex }),
    // Rebinding which claimed seat this tab plans as. The server checks
    // ownership when the mark is drawn, never when the seat is named.
    claim: (next: Seat) =>
      roomRef.current?.send("seat", { token: tokenRef.current, seat: next }),
    start: () => roomRef.current?.send("start", {}),
  };
}
