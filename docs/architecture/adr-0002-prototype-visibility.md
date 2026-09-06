# ADR-0002: Prototype Visibility And Room Lifecycle

## Status

Accepted for local playtesting. Extends ADR-0001; does not choose deployment or production authentication.

## Decision

One Colyseus `MissionRoom` owns the full mission state. It never assigns that state to `Room.state` or broadcasts it. Each client receives a separately constructed `playerView` through a typed `view` message. The view explicitly allowlists public fields and includes only the requesting character's engine, readings, ambition, and core choice.

Every command crosses a strict Zod boundary and carries a server-issued connection token. The acting seat comes from the server session, never a client-supplied actor. Pure rules validate selected pieces, target, phase, module availability, and current shared reserves before cloning/mutating anything. The same planning function generates client previews; the server remains authoritative if a preview becomes stale.

Practice rooms permit one connection to switch between all four viewpoints and rotate its command token on each switch. They intentionally use a reproducible seed for learning and regression playback. Team rooms draw their seed from Node cryptographic randomness and never send it, bag order, other players' hands, or unpublished readings to clients.

## Seats And Disconnections

The browser creates and stores a random UUID ownership key before matchmaking, using `crypto.getRandomValues`, which also works on local-network HTTP. It is kept in localStorage so a fresh tab in the same browser profile can rejoin. A room permanently associates a claimed specialist with that key while the room exists; leaving does not make its private state available to another key. One profile cannot change its claimed specialist within the same team room.

This is a bearer-key model for a local prototype, not an account identity or production access-control system. Separate people use separate devices/browser profiles. Do not publish keys or copy browser storage between participants. No account or password flow is added.

Four players must connect before cost-bearing commands are accepted. Readings and requests can be shared while waiting. Presence is transmitted separately from game state and rendered explicitly.

After the mission starts, a disconnected seat is automatically marked finished; it remains reserved and its future absent opportunities are forfeited so other players are not deadlocked. The original browser profile can rejoin the room code. If the seat was already finished, it can inspect and share information immediately but resumes spending at the next round. There is no silent replacement player or automatic full-state spectator.

Rooms are ephemeral and dispose after the last participant leaves. A server restart loses active missions. PostgreSQL/Drizzle persistence remains a future step, as do authenticated accounts and durable reconnection across restarts.

## Transport

Vite on port 5174 proxies HTTP and WebSocket traffic under `/game` to Colyseus on port 2568. This keeps multiplayer on the browser's current origin and works for a reachable local-network host. Colyseus owns the HTTP routing and provides `/__healthcheck`; a competing raw HTTP callback must not send responses to the same requests.

The explicit `express` runtime dependency is required by the selected WebSocket transport version. The previous scaffold typechecked without it but could not start the transport. Incoming payload size and message rate are bounded.
