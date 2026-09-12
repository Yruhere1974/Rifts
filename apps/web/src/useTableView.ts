import { useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import type { MissionTableView, Seat } from "@rifts/rules";
import { browserUuid } from "./browserUuid.js";
import { pingLifetimeMs, type MissionPing } from "./useMission.js";

type TableMessage = {
  view: MissionTableView;
  mode: "practice" | "team";
  onlineSeats: Seat[];
  started: boolean;
};

function closeRoom(room: Room | null): void {
  if (!room) return;
  room.reconnection.enabled = false;
  void room.leave().catch(() => undefined);
}

/**
 * Joins a room as a shared screen. The server sends "table" messages carrying
 * only public state, so this hook can never receive a seat's private engine.
 */
export function useTableView(roomId: string | null): {
  view: MissionTableView | null;
  pings: MissionPing[];
  onlineSeats: Seat[];
  started: boolean;
  status: string;
  error: string | null;
} {
  const [view, setView] = useState<MissionTableView | null>(null);
  const [pings, setPings] = useState<MissionPing[]>([]);
  const pingSeq = useRef(0);
  const pingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [onlineSeats, setOnlineSeats] = useState<Seat[]>([]);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState(roomId ? "connecting" : "idle");
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  // One connection per room for the life of the page. A remounted effect must
  // reuse it rather than open a second socket and tear down the first.
  const connectedTo = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId || connectedTo.current === roomId) return;
    connectedTo.current = roomId;
    const live = () => connectedTo.current === roomId;
    const join = async () => {
      try {
        const client = new Client(`${window.location.origin}/game`);
        // A shared screen still sends a seat, which the server ignores for the
        // table role; it never claims one and never gates the round.
        const room = await client.joinById(roomId.trim(), {
          mode: "team",
          seat: "dice",
          clientKey: browserUuid(),
          role: "table",
        });
        room.reconnection.enabled = false;
        roomRef.current = room;
        room.onMessage<TableMessage>("table", (message) => {
          if (!live()) return;
          setView(message.view);
          setOnlineSeats(message.onlineSeats);
          setStarted(message.started);
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
  }, [roomId]);

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

  return { view, pings, onlineSeats, started, status, error };
}
