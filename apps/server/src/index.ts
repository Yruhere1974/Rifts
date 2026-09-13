import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MissionRoom } from "./mission-room.js";

const port = Number(process.env.PORT ?? 2568);
const server = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server, maxPayload: 8192 }),
});

// Matched on the shared code, so `join` reaches the table that created it
// rather than any open room.
gameServer.define("mission", MissionRoom).filterBy(["code"]);

await gameServer.listen(port);
console.log(`Rifts server listening on ws://localhost:${port}`);
