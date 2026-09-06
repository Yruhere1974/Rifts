import { randomUUID } from "node:crypto";
import { Client } from "@colyseus/sdk";
import { expect, test, type Page } from "@playwright/test";
import {
  missionSeats,
  type MissionCommand,
  type MissionView,
  type Seat,
} from "@rifts/rules";

type Snapshot = {
  view: MissionView;
  token: string;
  started: boolean;
  onlineSeats: Seat[];
  clientKey: string;
};
async function connect(seat: Seat, roomId?: string, clientKey = randomUUID()) {
  const client = new Client("http://127.0.0.1:2568");
  const options = { mode: "team", seat, clientKey };
  const room = roomId
    ? await client.joinById(roomId, options)
    : await client.create("mission", options);
  room.reconnection.enabled = false;
  const snapshots: Snapshot[] = [];
  const errors: string[] = [];
  room.onMessage<Snapshot>("view", (data) => snapshots.push(data));
  room.onMessage<{ message: string }>("error", (data) =>
    errors.push(data.message),
  );
  room.send("sync");
  await expect.poll(() => snapshots.length).toBeGreaterThan(0);
  return {
    room,
    snapshots,
    errors,
    clientKey,
    get latest() {
      return snapshots[snapshots.length - 1]!;
    },
    send(command: MissionCommand) {
      room.send("command", {
        token: snapshots[snapshots.length - 1]!.token,
        command,
      });
    },
  };
}

test("authoritative rooms redact secrets, bind seats, and serialize shared costs", async () => {
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  try {
    clients.push(await connect("soldier"));
    const first = clients[0]!;
    const roomId = first.room.roomId;
    first.send({ type: "donate" });
    await expect.poll(() => first.errors.length).toBe(1);
    expect(first.latest.view.artifact).toBe(true);
    for (const seat of missionSeats.slice(1))
      clients.push(await connect(seat, roomId));
    await expect.poll(() => first.latest.started).toBe(true);
    for (const player of clients) {
      const wire = JSON.stringify(player.latest);
      expect(player.latest.view).not.toHaveProperty("private");
      expect(player.latest.view).not.toHaveProperty("random");
      for (const other of clients.filter((c) => c !== player)) {
        expect(wire).not.toContain(other.latest.view.intel[0]!.text);
        expect(wire).not.toContain(other.latest.view.objective);
        expect(wire).not.toContain(other.latest.token);
      }
    }
    first.send({ type: "share" });
    clients[1]!.send({ type: "share" });
    await expect
      .poll(() => clients.every((c) => c.latest.view.frequencyKnown))
      .toBe(true);
    const operator = clients[3]!;
    first.send({
      type: "act",
      action: "contribute",
      target: "relay",
      pieces: [first.latest.view.engine.dice[0]!.id],
    });
    operator.send({
      type: "act",
      action: "contribute",
      target: "relay",
      pieces: [operator.latest.view.engine.markers[0]!],
    });
    await expect
      .poll(() => first.errors.length + operator.errors.length)
      .toBe(2);
    expect(first.latest.view.resources.power).toBe(0);
    expect(first.latest.view.shield).toBe(false);
    expect(
      first.latest.view.engine.dice.length +
        operator.latest.view.engine.markers.length,
    ).toBe(8);
    const before = first.errors.length;
    first.room.send("seat", { token: first.latest.token, seat: "mage" });
    await expect.poll(() => first.errors.length).toBe(before + 1);
    first.room.send("command", {
      token: first.latest.token,
      command: { type: "donate", actorId: "mage" },
    });
    await expect.poll(() => first.errors.length).toBe(before + 2);
    expect(first.latest.view.seat).toBe("soldier");
    const originalHand = clients[1]!.latest.view.engine.hand;
    const mageKey = clients[1]!.clientKey;
    await clients[1]!.room.leave();
    await expect.poll(() => first.latest.onlineSeats.length).toBe(3);
    expect(
      first.latest.view.players.find((p) => p.seat === "mage")?.ready,
    ).toBe(true);
    await expect(connect("mage", roomId)).rejects.toThrow("reserved");
    const rejoined = await connect("mage", roomId, mageKey);
    clients.push(rejoined);
    expect(rejoined.latest.view.engine.hand).toEqual(originalHand);
    expect(rejoined.latest.view.seat).toBe("mage");
  } finally {
    await Promise.all(
      clients
        .filter((c) => c.room.connection.isOpen)
        .map((c) => c.room.leave().catch(() => undefined)),
    );
  }
});

test("four independent browser seats see one world and different private engines", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(
    missionSeats.map(() => browser.newContext({ reducedMotion: "reduce" })),
  );
  try {
    let roomCode = "";
    const pages = [];
    for (let i = 0; i < 4; i++) {
      const page = await contexts[i]!.newPage();
      pages.push(page);
      await page.goto("/");
      await page
        .getByRole("button", { name: "Cooperative table", exact: true })
        .click();
      await page.getByLabel("Your specialist").selectOption(missionSeats[i]!);
      if (roomCode)
        await page.getByRole("textbox", { name: "Room code" }).fill(roomCode);
      await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
      await expect(page.locator(".connection-indicator")).toHaveText(
        "connected",
      );
      roomCode = (await page.locator(".room-code").innerText()).trim();
    }
    for (const page of pages)
      await expect(page.locator(".presence-notice")).toHaveCount(0);
    await expect(pages[0]!.locator(".die")).toHaveCount(5);
    await expect(pages[1]!.locator(".playing-card")).toHaveCount(5);
    await expect(
      pages[2]!.getByRole("button", { name: "Draw from bag" }),
    ).toBeVisible();
    await expect(pages[3]!.locator(".placement-marker")).toHaveCount(4);
    const mageReading = await pages[1]!
      .locator(".intel.character-specific p")
      .innerText();
    await expect(pages[0]!.locator("body")).not.toContainText(mageReading);
    await pages[1]!
      .getByRole("button", { name: "Share reading with team" })
      .click();
    await expect(pages[0]!.locator(".comms-feed")).toContainText(mageReading);
    await pages[3]!.getByRole("button", { name: "Request help" }).click();
    await expect(pages[0]!.locator(".assist-request")).toContainText(
      "Operator needs support",
    );
    await pages[1]!
      .getByRole("button", { name: "Resonance card", exact: true })
      .first()
      .click();
    await pages[1]!
      .getByRole("button", { name: "Assist", exact: true })
      .click();
    await pages[1]!.getByLabel("Assistance recipient").selectOption("operator");
    await pages[1]!
      .getByRole("button", { name: "Commit assist", exact: true })
      .click();
    await expect(pages[3]!.locator(".crew-seat.active")).toContainText(
      "+1 SUPPORT",
    );
    await expect(pages[1]!.locator(".playing-card")).toHaveCount(4);
    const [vanguard, mage, scout, operator] = pages as [Page, Page, Page, Page];
    const commit = async (page: Page, action: string) => {
      await page.getByRole("button", { name: action, exact: true }).click();
      const before = await page.locator(".event-ribbon p").innerText();
      await page
        .getByRole("button", {
          name: `Commit ${action.toLowerCase()}`,
          exact: true,
        })
        .click();
      await expect(page.locator(".event-ribbon p")).not.toHaveText(before);
    };
    const donate = async (page: Page) => {
      await page.getByRole("button", { name: "Unclaimed power core" }).click();
      await page.getByRole("button", { name: "Donate core to team" }).click();
      await expect(
        page.getByRole("button", { name: "Core donated" }),
      ).toBeVisible();
    };
    await vanguard
      .getByRole("button", { name: "Share reading with team" })
      .click();
    await vanguard.locator(".die").first().click();
    await commit(vanguard, "Contribute");
    await donate(vanguard);
    await operator
      .getByRole("button", { name: "The breach", exact: true })
      .click();
    await operator.locator(".placement-marker").first().click();
    await commit(operator, "Move");
    await operator.locator(".placement-marker").first().click();
    await commit(operator, "Recover");
    await mage.getByRole("button", { name: "Exploit Opening card" }).click();
    await commit(mage, "Assist");
    await expect(operator.locator(".crew-seat.active")).toContainText(
      "+2 SUPPORT",
    );
    await operator.locator(".placement-marker").first().click();
    await commit(operator, "Contribute");
    await expect(scout.locator(".objective-counter strong")).toContainText("8");
    for (
      let i = 0;
      i < 8 && (await scout.locator(".bag-token:not(.hazard)").count()) < 2;
      i++
    ) {
      const before = await scout.locator(".draw-bag small").innerText();
      await scout.getByRole("button", { name: "Draw from bag" }).click();
      await expect(scout.locator(".draw-bag small")).not.toHaveText(before);
    }
    await scout.getByRole("button", { name: "Bank haul" }).click();
    await scout
      .getByRole("button", { name: "The breach", exact: true })
      .click();
    await scout.locator(".bag-token:not(.hazard)").first().click();
    await commit(scout, "Move");
    await scout.locator(".bag-token:not(.hazard)").first().click();
    await commit(scout, "Contribute");
    await donate(scout);
    await donate(mage);
    await mage.getByRole("button", { name: "The breach", exact: true }).click();
    await mage
      .getByRole("button", { name: "Channel card", exact: true })
      .first()
      .click();
    await commit(mage, "Move");
    await mage
      .getByRole("button", { name: "Channel card", exact: true })
      .first()
      .click();
    await mage
      .getByRole("button", { name: "Resonance card", exact: true })
      .first()
      .click();
    await commit(mage, "Contribute");
    await operator.locator(".placement-marker").first().click();
    await operator.getByRole("button", { name: "Assist", exact: true }).click();
    await operator.getByLabel("Assistance recipient").selectOption("soldier");
    await commit(operator, "Assist");
    await vanguard
      .getByRole("button", { name: "The breach", exact: true })
      .click();
    await vanguard.locator(".die").first().click();
    await commit(vanguard, "Move");
    for (
      let i = 0;
      i < 3 &&
      !(await vanguard
        .getByRole("heading", { name: "Greyhaven holds." })
        .isVisible());
      i++
    ) {
      await vanguard.locator(".die").first().click();
      await commit(vanguard, "Contribute");
    }
    for (const page of pages)
      await expect(
        page.getByRole("heading", { name: "Greyhaven holds." }),
      ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
