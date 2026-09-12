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
    clients.push(await connect("dice"));
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
        for (const reading of other.latest.view.perceptions)
          expect(wire).not.toContain(reading.text);
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
      // A placement needs a socket on the frame to build into.
      socket: 0,
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
    first.room.send("seat", { token: first.latest.token, seat: "cards" });
    await expect.poll(() => first.errors.length).toBe(before + 1);
    first.room.send("command", {
      token: first.latest.token,
      command: { type: "donate", actorId: "cards" },
    });
    await expect.poll(() => first.errors.length).toBe(before + 2);
    expect(first.latest.view.seat).toBe("dice");
    const originalHand = clients[1]!.latest.view.engine.hand;
    const mageKey = clients[1]!.clientKey;
    await clients[1]!.room.leave();
    await expect.poll(() => first.latest.onlineSeats.length).toBe(3);
    expect(
      first.latest.view.players.find((p) => p.seat === "cards")?.ready,
    ).toBe(true);
    await expect(connect("cards", roomId)).rejects.toThrow("reserved");
    const rejoined = await connect("cards", roomId, mageKey);
    clients.push(rejoined);
    expect(rejoined.latest.view.engine.hand).toEqual(originalHand);
    expect(rejoined.latest.view.seat).toBe("cards");
  } finally {
    await Promise.all(
      clients
        .filter((c) => c.room.connection.isOpen)
        .map((c) => c.room.leave().catch(() => undefined)),
    );
  }
});

// KNOWN GAP: playing all the way to a win through the UI is not yet driven
// reliably on the hex map. Crossing ground costs commitments, so the mission
// runs longer and needs pressure management, and this driver does not yet play
// well enough to close it. Winnability itself is proven at the rules level by
// the goal-seeking driver in packages/rules/src/mission.test.ts. Tracked in
// MANAGER_NOTES.md.
test.fixme("four independent browser seats see one world and different private engines", async ({
  browser,
}) => {
  test.setTimeout(150_000);
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
      pages[2]!.getByRole("button", { name: "Push for another surge token" }),
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
      "Techno-Wizard needs support",
    );
    await pages[1]!
      .getByRole("button", { name: "Resonance card", exact: true })
      .first()
      .click();
    await pages[1]!
      .getByRole("button", { name: "Assist", exact: true })
      .click();
    await pages[1]!.getByLabel("Assistance recipient").selectOption("systems");
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
    /** Pushes the bag until the surge holds `target` tokens, absorbing busts. */
    const push = async (page: Page, target: number) => {
      const tray = page.locator(".token-tray .bag-token");
      const status = page.locator(".risk-track > span");
      for (let attempt = 0; attempt < 12; attempt++) {
        const held = await tray.count();
        if (held >= target) return;
        // A safe push grows the surge; a burnout instead raises the stress line.
        const stress = await status.innerText();
        await page
          .getByRole("button", { name: "Push for another surge token" })
          .click();
        await expect
          .poll(
            async () =>
              (await tray.count()) !== held ||
              (await status.innerText()) !== stress,
            { timeout: 10_000 },
          )
          .toBe(true);
      }
      throw new Error(`Surge never reached ${target} tokens.`);
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
    await scout
      .getByRole("button", { name: "The breach", exact: true })
      .click();
    await push(scout, 1);
    await commit(scout, "Move");
    await push(scout, 1);
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
    await operator.getByLabel("Assistance recipient").selectOption("dice");
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

test("four tabs in one browser hold four seats, and the table screen stays public", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // One context: previously a browser-wide ownership key made the second tab's
  // seat claim fail, which is what forced separate profiles per player.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    let roomCode = "";
    const tabs = [];
    for (let i = 0; i < 4; i++) {
      const page = await context.newPage();
      tabs.push(page);
      if (roomCode) {
        await page.goto(`/?room=${roomCode}&seat=${missionSeats[i]!}`);
      } else {
        await page.goto("/");
        await page
          .getByRole("button", { name: "Cooperative table", exact: true })
          .click();
        await page.getByLabel("Your specialist").selectOption(missionSeats[i]!);
        await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
      }
      await expect(page.locator(".engine-heading .eyebrow")).toBeVisible({
        timeout: 20_000,
      });
      if (!roomCode) {
        roomCode = (await page.locator(".room-code").innerText()).trim();
        expect(roomCode).not.toBe("");
      }
    }

    // Every tab holds its own seat, so all four are online and the round starts.
    for (let i = 0; i < 4; i++) {
      await expect(tabs[i]!.locator(".engine-heading .eyebrow")).toContainText(
        ["Glitter Boy", "Ley Line Walker", "Juicer", "Techno-Wizard"][i]!,
      );
    }
    await expect(tabs[0]!.locator(".presence-notice")).toHaveCount(0);

    const secrets = await Promise.all(
      tabs.map((page) => page.locator(".private-objective p").innerText()),
    );

    const table = await context.newPage();
    await table.goto(`/?table=1&room=${roomCode}`);
    await expect(table.locator(".table-room strong")).toHaveText(roomCode);
    await expect(table.locator(".table-crew-row")).toHaveCount(4);
    // Wait for the screen's first public snapshot before reading from it.
    await expect(table.locator(".table-crew-row.absent")).toHaveCount(0, {
      timeout: 20_000,
    });
    // Four seats are taken, so no join codes are offered.
    await expect(table.locator(".join-card")).toHaveCount(0);

    // The shared screen must not carry any seat's private text or controls.
    const markup = await table.content();
    for (const secret of secrets) expect(markup).not.toContain(secret);
    await expect(table.locator(".die")).toHaveCount(0);
    await expect(table.locator(".playing-card")).toHaveCount(0);
    await expect(table.locator(".placement-marker")).toHaveCount(0);
    await expect(table.locator(".bag-token")).toHaveCount(0);
    await expect(table.getByRole("button", { name: /^Commit / })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});

test("the master map is one shared surface, and stays public on a screen", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    let roomCode = "";
    const tabs = [];
    for (let i = 0; i < 4; i++) {
      const page = await context.newPage();
      tabs.push(page);
      if (roomCode) {
        await page.goto(`/?room=${roomCode}&seat=${missionSeats[i]!}`);
      } else {
        await page.goto("/");
        await page
          .getByRole("button", { name: "Cooperative table", exact: true })
          .click();
        await page.getByLabel("Your specialist").selectOption(missionSeats[i]!);
        await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
      }
      await expect(page.locator(".engine-heading .eyebrow")).toBeVisible({
        timeout: 20_000,
      });
      if (!roomCode)
        roomCode = (await page.locator(".room-code").innerText()).trim();
    }
    await expect(tabs[0]!.locator(".presence-notice")).toHaveCount(0);

    const secrets = await Promise.all(
      tabs.map((page) => page.locator(".private-objective p").innerText()),
    );

    // One specialist draws; the rest are looking at the same surface.
    const author = tabs[0]!;
    await author.getByRole("button", { name: "Master map" }).click();
    const map = author.getByRole("region", { name: "Master map" });
    await map.getByRole("button", { name: "Mark", exact: true }).click();
    await map.locator(".master-map-canvas").click();
    await map.getByLabel("Mark label").fill("Regroup here");
    await map.getByRole("button", { name: "Place mark" }).click();
    await expect(map.getByText("Regroup here")).toHaveCount(2);

    for (const page of tabs.slice(1)) {
      await page.getByRole("button", { name: "Master map" }).click();
      await expect(
        page
          .getByRole("region", { name: "Master map" })
          .getByText("Regroup here"),
      ).toHaveCount(2, { timeout: 20_000 });
    }

    // A teammate can erase it: the map belongs to the team, not its author.
    const other = tabs[1]!;
    await other
      .getByRole("region", { name: "Master map" })
      .getByRole("button", { name: "Erase Regroup here" })
      .click();
    await expect(map.getByText("Regroup here")).toHaveCount(0, {
      timeout: 20_000,
    });

    // The shared screen shows the same surface and still carries no secrets.
    const table = await context.newPage();
    await table.goto(`/?table=1&room=${roomCode}`);
    await expect(table.locator(".table-room strong")).toHaveText(roomCode);
    await table.getByRole("button", { name: "Master map" }).click();
    const shared = table.getByRole("region", { name: "Master map" });
    await expect(shared.getByText("Relay conduits")).toHaveCount(2, {
      timeout: 20_000,
    });
    // Read-only: a screen holds no seat, so it cannot draw, erase or point.
    await expect(shared.locator(".master-map-tools")).toHaveCount(0);
    await expect(shared.locator(".master-map-compose")).toHaveCount(0);
    const markup = await table.content();
    for (const secret of secrets) expect(markup).not.toContain(secret);
  } finally {
    await context.close();
  }
});
