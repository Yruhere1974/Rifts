import { useCallback, useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import type { MissionCommand, MissionView, Seat } from "@rifts/rules";
import { browserUuid } from "./browserUuid.js";

type Mode = "practice" | "team";
type ViewMessage = {
  view: MissionView;
  seat: Seat;
  mode: Mode;
  token: string;
  onlineSeats: Seat[];
  started: boolean;
  clientKey: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to connect to the mission server.";
}

function closeRoom(room: Room | null): void {
  if (!room) return;
  room.reconnection.enabled = false;
  void room.leave().catch(() => undefined);
}

/**
 * Per-tab, not per-browser: sessionStorage survives a reload but is unique to
 * each tab, so four tabs on one machine can hold four different seats. A
 * browser-wide key would make the server refuse the second tab's seat claim.
 */
function persistentClientKey(): string {
  const existing = sessionStorage.getItem("rifts-client-key");
  if (existing) return existing;
  const key = browserUuid();
  sessionStorage.setItem("rifts-client-key", key);
  return key;
}

export function useMission(): {
  view: MissionView | null;
  seat: Seat;
  status: string;
  error: string | null;
  roomId: string | null;
  mode: Mode | null;
  onlineSeats: Seat[];
  started: boolean;
  // Property signatures, not methods: these are stable callbacks and may be
  // destructured from the hook result without losing their binding.
  connect: (mode: Mode, seat: Seat, roomId?: string) => Promise<void>;
  switchSeat: (seat: Seat) => void;
  send: (command: MissionCommand) => void;
  leave: () => void;
} {
  const [view, setView] = useState<MissionView | null>(null);
  const [seat, setSeat] = useState<Seat>("dice");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [onlineSeats, setOnlineSeats] = useState<Seat[]>([]);
  const [started, setStarted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const tokenRef = useRef<string | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Which room/seat this hook is already connecting to, or null when idle. */
  const target = useRef<string | null>(null);

  const reset = useCallback(() => {
    target.current = null;
    generation.current += 1;
    clearTimeout(timer.current);
    const previous = roomRef.current;
    roomRef.current = null;
    tokenRef.current = null;
    closeRoom(previous);
    setView(null);
    setRoomId(null);
    setMode(null);
  }, []);

  const leave = useCallback(() => {
    reset();
    setStatus("idle");
    setError(null);
  }, [reset]);

  const connect = useCallback(
    async (
      nextMode: Mode = "practice",
      nextSeat: Seat = "dice",
      id?: string,
    ) => {
      // Two sockets for one seat race each other on the server, and the loser
      // is whichever connection this tab happens to be rendering.
      const wanted = `${nextMode}|${nextSeat}|${id ?? "new"}`;
      if (target.current === wanted) return;
      reset();
      target.current = wanted;
      const attempt = generation.current;
      setStatus("connecting");
      setError(null);
      setSeat(nextSeat);
      try {
        if (id && nextMode !== "team")
          throw new Error("Only team missions can be joined by room ID.");
        const client = new Client(`${window.location.origin}/game`);
        const clientKey = persistentClientKey();
        const options = { mode: nextMode, seat: nextSeat, clientKey };
        const room = id
          ? await client.joinById(id.trim(), options)
          : await client.create("mission", options);
        room.reconnection.enabled = false;
        if (generation.current !== attempt) {
          closeRoom(room);
          return;
        }
        roomRef.current = room;
        const active = () =>
          generation.current === attempt && roomRef.current === room;
        const disconnected = (message: string) => {
          if (!active()) return;
          reset();
          setStatus("disconnected");
          setError(message);
        };
        room.onMessage<ViewMessage>("view", (message) => {
          if (!active()) return;
          clearTimeout(timer.current);
          tokenRef.current = message.token;
          setView(message.view);
          setSeat(message.seat);
          setMode(message.mode);
          setOnlineSeats(message.onlineSeats);
          setStarted(message.started);
          setRoomId(room.roomId);
          setStatus("connected");
          setError(null);
        });
        room.onMessage<{ message: string }>("error", (message) => {
          if (active()) setError(message.message);
        });
        room.onError((code, message) => {
          if (active()) setError(message ?? `Connection error (${code}).`);
        });
        room.onDrop(() =>
          disconnected(
            "Connection lost. Return to the lobby to join again; the mission is not saved.",
          ),
        );
        room.onLeave(() =>
          disconnected(
            "Disconnected. Return to the lobby to join again; the mission is not saved.",
          ),
        );
        timer.current = setTimeout(
          () =>
            disconnected(
              "The mission server did not send a view. Please try again.",
            ),
          10_000,
        );
        room.send("sync");
      } catch (cause) {
        if (generation.current !== attempt) return;
        reset();
        setStatus("error");
        setError(errorMessage(cause));
      }
    },
    [reset],
  );

  const transmit = useCallback((type: "command" | "seat", payload: object) => {
    const room = roomRef.current;
    const token = tokenRef.current;
    if (!room || !token) {
      setError("Connect to a mission before sending commands.");
      return;
    }
    try {
      setError(null);
      room.send(type, { token, ...payload });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const send = useCallback(
    (command: MissionCommand) => transmit("command", { command }),
    [transmit],
  );
  const switchSeat = useCallback(
    (nextSeat: Seat) => transmit("seat", { seat: nextSeat }),
    [transmit],
  );

  useEffect(
    () => () => {
      // Deliberately no generation bump: a remounted effect would otherwise
      // orphan a connection that is still being established.
      clearTimeout(timer.current);
      closeRoom(roomRef.current);
      roomRef.current = null;
      tokenRef.current = null;
    },
    [],
  );

  return {
    view,
    seat,
    status,
    error,
    roomId,
    mode,
    onlineSeats,
    started,
    connect,
    switchSeat,
    send,
    leave,
  };
}
