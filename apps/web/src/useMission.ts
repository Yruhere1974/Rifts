import { useCallback, useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import type { MissionCommand, MissionView, Seat } from "@rifts/rules";

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

function persistentClientKey(): string {
  const existing = localStorage.getItem("rifts-client-key");
  if (existing) return existing;
  // getRandomValues works on a local-network HTTP origin as well as HTTPS.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const key = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
  localStorage.setItem("rifts-client-key", key);
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
  connect(mode: Mode, seat: Seat, roomId?: string): Promise<void>;
  switchSeat(seat: Seat): void;
  send(command: MissionCommand): void;
  leave: () => void;
} {
  const [view, setView] = useState<MissionView | null>(null);
  const [seat, setSeat] = useState<Seat>("soldier");
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

  const reset = useCallback(() => {
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
      nextSeat: Seat = "soldier",
      id?: string,
    ) => {
      reset();
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
      generation.current += 1;
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
