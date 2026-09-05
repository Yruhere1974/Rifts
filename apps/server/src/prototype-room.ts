import { Room, type Client } from "@colyseus/core";
import { prototypeScenario } from "@rifts/content";
import { createInitialGameState } from "@rifts/rules";
import { clientMessageSchema } from "./messages.js";

type PrototypeRoomState = {
  scenarioId: string;
  playerCount: number;
  readyClients: number;
};

export class PrototypeRoom extends Room<{ state: PrototypeRoomState }> {
  private readonly gameState = createInitialGameState();

  override onCreate(): void {
    this.setState({
      scenarioId: prototypeScenario.id,
      playerCount: prototypeScenario.playerCount,
      readyClients: 0,
    });

    this.onMessage("*", (client, message: unknown) => {
      const parsed = clientMessageSchema.safeParse(message);

      if (!parsed.success) {
        client.send("error", { message: "Invalid client message" });
        return;
      }

      if (parsed.data.type === "ready") {
        this.state.readyClients += 1;
        client.send("snapshot", {
          round: this.gameState.round,
          phase: this.gameState.phase,
        });
      }
    });
  }

  override onJoin(client: Client): void {
    client.send("scenario", {
      id: prototypeScenario.id,
      name: prototypeScenario.name,
    });
  }
}
