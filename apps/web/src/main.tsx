import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { TableScreen } from "./TableScreen.js";
import "./game.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

// Query params rather than paths, so the shared screen needs no SPA fallback.
const params = new URLSearchParams(window.location.search);
const isTable = params.get("table") === "1";
const room = params.get("room");

createRoot(root).render(
  <StrictMode>{isTable ? <TableScreen roomId={room} /> : <App />}</StrictMode>,
);
