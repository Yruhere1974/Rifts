import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { MasterScreen } from "./MasterScreen.js";
import { TableScreen } from "./TableScreen.js";
import "./game.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

// Query params rather than paths, so the shared screen needs no SPA fallback.
const params = new URLSearchParams(window.location.search);
const isTable = params.get("table") === "1";
// The master tab: opens the mission, keeps the map, spawns a console per seat.
const isMaster = params.get("master") === "1";
const room = params.get("room");
// A code joins somebody else's table; its absence means opening one.
const code = params.get("code");
const players = ([1, 2, 4] as const).find(
  (count) => String(count) === params.get("players"),
);

createRoot(root).render(
  <StrictMode>
    {isTable ? (
      <TableScreen roomId={room} />
    ) : isMaster ? (
      <MasterScreen roomId={room} code={code} players={players ?? 4} />
    ) : (
      <App />
    )}
  </StrictMode>,
);
