import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PrototypeRoom } from "./prototype-room.js";

const port = Number(process.env.PORT ?? 2567);
const server = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("prototype", PrototypeRoom);

await gameServer.listen(port);
console.log(`Rifts server listening on ws://localhost:${port}`);
