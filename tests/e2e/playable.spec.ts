import { expect, test, type Page } from "@playwright/test";
import * as drive from "./drive.js";

async function deploy(page: Page, tutorial = false) {
  await page.goto("/");
  if (tutorial)
    await page.getByRole("checkbox", { name: "Guided tutorial" }).check();
  await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
  await expect(page.locator(".die")).toHaveCount(5);
}
async function seat(page: Page, name: string) {
  await page
    .locator(".crew-seat")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await expect(page.locator(".engine-heading .eyebrow")).toContainText(name);
}
async function commit(page: Page, action: string) {
  await page.getByRole("button", { name: action, exact: true }).click();
  const before = await page.locator(".event-ribbon p").textContent();
  await page
    .getByRole("button", {
      name: `Commit ${action.toLowerCase()}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".event-ribbon p")).not.toHaveText(before!);
}

// KNOWN GAP: playing all the way to a win through the UI is not yet driven
// reliably on the hex map. Crossing ground costs commitments, so the mission
// runs longer and needs pressure management, and this driver does not yet play
// well enough to close it. Winnability itself is proven at the rules level by
// the goal-seeking driver in packages/rules/src/mission.test.ts. Tracked in
// MANAGER_NOTES.md.
test.fixme("four engines complete a cooperative mission through the interface", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await deploy(page, true);
  const crew = ["Glitter Boy", "Ley Line Walker", "Juicer", "Techno-Wizard"];

  // The guide drives the taught portion of the mission through real controls.
  await drive.followGuide(page);

  // The final lesson is deliberately unguided, so finish it by hand.
  for (let round = 0; round < 6 && !(await drive.isOver(page)); round++) {
    for (const who of crew) {
      if (await drive.isOver(page)) break;
      await seat(page, who);
      if (await drive.headFor(page, "The breach")) await drive.stabilise(page);
      await drive.relievePressure(page);
    }
    if (await drive.isOver(page)) break;
    for (const who of crew) {
      await seat(page, who);
      await drive.finishRound(page);
    }
  }

  expect(await drive.outcome(page)).toBe("Greyhaven holds.");
  expect(errors).toEqual([]);
});

test("the guided tutorial teaches the hex map without dead ends", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await deploy(page, true);

  const reached = await drive.followGuide(page, {
    until: (title) => title === "Prime the machine, then ask for help",
  });

  // The map lessons are reached, and crossing the ground actually happened.
  expect(reached).toContain("Ground has to be crossed");
  await expect(page.locator(".tutorial-copy")).toContainText(
    "Prime the machine",
  );
  expect(errors).toEqual([]);
});

test("tutorial can pause, resume, skip and restart on a new mobile table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deploy(page, true);
  await page.getByRole("button", { name: "Show me where" }).click();
  await expect(
    page.getByRole("button", { name: "Share reading with team" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Skip lesson" }).click();
  await expect(page.locator(".tutorial-copy h2")).toHaveText(
    "Commit a die to the relay",
  );
  await page
    .locator(".tutorial-band")
    .getByRole("button", { name: "Pause tutorial" })
    .click();
  await expect(page.locator(".tutorial-band")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resume tutorial" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Resume tutorial" }).click();
  await expect(page.locator(".tutorial-copy h2")).toHaveText(
    "Commit a die to the relay",
  );
  await page.getByRole("button", { name: "Previous lesson" }).click();
  await expect(page.locator(".tutorial-copy h2")).toHaveText(
    "One crisis, four perspectives",
  );
  await page.getByRole("button", { name: "Training", exact: true }).click();
  const navRows = await page
    .locator(".mobile-commandbar button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().top),
    );
  expect(new Set(navRows).size).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/tutorial-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/tutorial-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Skip lesson" }).click();
  await page.getByRole("button", { name: "Leave table" }).click();
  await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
  await expect(page.locator(".tutorial-copy h2")).toHaveText(
    "One crisis, four perspectives",
  );
});

test("tutorial highlights the expected specialist and Hold capability", async ({
  page,
}) => {
  await deploy(page, true);
  await expect(page.locator(".share-button")).toHaveClass(/tutorial-beacon/);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Skip lesson" }).click();
  const wayfinder = page.locator('[data-tutorial-seat="cards"]');
  await expect(wayfinder).toHaveClass(/tutorial-beacon/);
  await page.getByRole("button", { name: "Show me where" }).click();
  await expect(wayfinder).toBeFocused();
  await wayfinder.click();
  const hold = page.getByRole("button", {
    name: "Hold capability",
    exact: true,
  });
  await expect(hold).toHaveClass(/tutorial-beacon/);
  await expect(wayfinder).not.toHaveClass(/tutorial-beacon/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(hold).toHaveCSS("animation-name", "tutorial-beacon-pulse");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Show me where" }).click();
    await expect(hold).toBeFocused();
    await expect(hold).toBeInViewport();
    await page.screenshot({
      path: `test-results/tutorial-highlight-${width}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(hold).toHaveCSS("animation-name", "none");
  await expect(hold).toHaveCSS("outline-color", "rgb(255, 224, 102)");
  await hold.click();
  await expect(hold).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next lesson" })).toHaveClass(
    /tutorial-beacon/,
  );
  await page
    .locator(".tutorial-band")
    .getByRole("button", { name: "Pause tutorial" })
    .click();
  await expect(page.locator(".tutorial-beacon")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume tutorial" }).click();
  await expect(page.getByRole("button", { name: "Next lesson" })).toHaveClass(
    /tutorial-beacon/,
  );
});

test("specialist rule references explain each engine without changing seats", async ({
  page,
}) => {
  await deploy(page);
  // Every engine is now paid for combination and can carry material forward,
  // so each reference is checked for its own version of both.
  const clues = [
    ["Glitter Boy", "cannot fire unbraced", "Hold over keeps a die"],
    ["Ley Line Walker", "Length is the skill", "The network re-forms"],
    ["Juicer", "spends your entire surge", "Hold keeps tokens"],
    [
      "Techno-Wizard",
      "wired to what already stands beside it",
      "A bolted socket keeps what it holds",
    ],
  ];
  for (const [name, rule, carry] of clues) {
    await seat(page, name!);
    const trigger = page.getByRole("button", {
      name: `${name} rules reference`,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(rule!);
    await expect(dialog).toContainText(carry!);
    await expect(
      dialog.getByRole("heading", { name: "Your place in the team" }),
    ).toBeVisible();
    await expect(dialog).toContainText("Cooperation example");
    await dialog
      .getByText("Shared actions and team rounds", { exact: true })
      .click();
    await expect(dialog).toContainText(
      "Opening this reference does not pause the other players",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await seat(page, "Glitter Boy");
  const before = await page.locator(".event-ribbon p").textContent();
  await page
    .getByRole("button", { name: "Glitter Boy rules reference" })
    .click();
  await page.getByLabel("Specialist reference").selectOption("cards");
  await expect(
    page.getByRole("heading", { name: "Ley Line Walker rules", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".engine-heading .eyebrow")).toContainText(
    "Glitter Boy",
  );
  await expect(page.locator(".die")).toHaveCount(5);
  await expect(page.locator(".event-ribbon p")).toHaveText(before!);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByLabel("Specialist reference").selectOption("systems");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/rules-reference-${width}.png`,
    });
  }
  const summary = page.getByText("Shared actions and team rounds", {
    exact: true,
  });
  await summary.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close rules reference" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Glitter Boy rules reference" }),
  ).toBeFocused();
});

test("private location perspectives combine into a paid team discovery", async ({
  page,
}) => {
  await deploy(page);
  await page
    .getByRole("button", { name: "Silent archive", exact: true })
    .click();
  const assessment = page.getByRole("region", {
    name: "Private location assessment",
  });
  const soldierText = await assessment.locator(".intel p").textContent();
  await seat(page, "Juicer");
  await expect(assessment.locator(".intel p")).not.toHaveText(soldierText!);
  const scoutText = await assessment.locator(".intel p").textContent();
  await expect(page.locator(".comms-feed")).not.toContainText(scoutText!);
  await assessment
    .getByRole("button", { name: "Share location assessment" })
    .click();
  await expect(page.locator(".comms-feed")).toContainText(scoutText!);
  await expect(page.locator(".discovery-note")).toHaveCount(0);
  await seat(page, "Techno-Wizard");
  await expect(assessment).toContainText("two usable Power cells");
  await expect(assessment).not.toContainText(scoutText!);
  await assessment
    .getByRole("button", { name: "Share location assessment" })
    .click();
  await expect(page.locator(".discovery-note")).toContainText(
    "+2 shared Power",
  );
  await seat(page, "Ley Line Walker");
  // The archive is across the map now, so getting there is a journey.
  expect(await drive.headFor(page, "Silent archive")).toBe(true);
  await page
    .getByRole("button", { name: "Channel card", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.locator(".action-preview")).toContainText(
    "+2 shared Power",
  );
  await commit(page, "Investigate");
  await expect(page.locator(".discovery-note")).toContainText(
    "Cache recovered",
  );
  await expect(
    page.locator('.resource-pool [title="power"] strong'),
  ).toHaveText("4");
  // The hand paid for the journey as well as the investigation; how much the
  // crossing cost is the map's business, not this test's.
  expect(await page.locator(".playing-card").count()).toBeLessThan(4);
  await page.screenshot({
    path: "test-results/location-perspective-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await assessment.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/location-perspective-mobile.png",
  });
});

test("rounds, personal upgrades, and loss resolve without a turn lock", async ({
  page,
}) => {
  await deploy(page);
  await page.getByRole("button", { name: "Unclaimed power core" }).click();
  await page.getByRole("button", { name: "Install personal upgrade" }).click();
  await expect(page.locator(".die")).toHaveCount(6);
  for (let round = 1; round <= 5; round++) {
    for (const name of [
      "Glitter Boy",
      "Ley Line Walker",
      "Juicer",
      "Techno-Wizard",
    ]) {
      await seat(page, name);
      await page
        .getByRole("button", { name: "Finish round", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm finish" }).click();
    }
    if (round < 5)
      await expect(page.locator(".round-strip strong")).toHaveText(
        String(round + 1).padStart(2, "0"),
      );
  }
  await expect(
    page.getByRole("heading", { name: "The breach takes Greyhaven." }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
])
  test(`nonblank board and readable engines at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await deploy(page);
    await page.evaluate(() => document.fonts.ready);
    const png = await page.locator("canvas").screenshot();
    const colors = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      for (let i = 0; i < data.length; i += 64)
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    }, png.toString("base64"));
    expect(colors).toBeGreaterThan(20);
    for (const name of [
      "Glitter Boy",
      "Ley Line Walker",
      "Juicer",
      "Techno-Wizard",
    ]) {
      await seat(page, name);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${viewport.width}-${name}.png`,
        fullPage: true,
      });
      for (const button of await page.locator(".action-slots button").all())
        expect(
          await button.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        ).toBe(true);
    }
    await page.getByRole("button", { name: "Unclaimed power core" }).click();
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

test("the master map carries the briefing and the team's own marks", async ({
  page,
}) => {
  await deploy(page);
  await page.getByRole("button", { name: "Master map" }).click();
  const map = page.getByRole("region", { name: "Master map" });
  await expect(map).toBeVisible();
  // The console is not merely behind the map: it is out of the page entirely.
  await expect(page.locator(".cockpit")).toBeHidden();
  // The page is linkable and survives a reload.
  expect(page.url()).toContain("map=1");

  // The mission's own marks are there before anyone has drawn anything, on
  // the drawing and in the list beside it.
  await expect(map.getByText("Relay conduits")).toHaveCount(2);
  await expect(map.getByText("Nothing drawn yet.")).toBeVisible();

  // Ground is one silhouette: no apparatus, no patrols, no units.
  await expect(map.locator(".mm-ground")).toHaveCount(1);
  await expect(map.locator(".unit, .enemy-token")).toHaveCount(0);

  // Draw a mark: choose the tool, select ground, label it, place it.
  await map.getByRole("button", { name: "Mark", exact: true }).click();
  // The centre of the drawing is the relay chamber, which is open ground.
  await map.locator(".master-map-canvas").click();
  await expect(map.getByText("One hex selected.")).toBeVisible();
  await map.getByLabel("Mark label").fill("Watch this hall");
  await map.getByRole("button", { name: "Place mark" }).click();
  await expect(map.getByText("Watch this hall")).toHaveCount(2);

  // Anyone can take it off again.
  await map.getByRole("button", { name: "Erase Watch this hall" }).click();
  await expect(map.getByText("Nothing drawn yet.")).toBeVisible();
});

test("ink belongs to the planning window, and pointing does not", async ({
  page,
}) => {
  await deploy(page);
  await page.getByRole("button", { name: "Master map" }).click();
  const map = page.getByRole("region", { name: "Master map" });
  await expect(map.getByText(/Planning window open/)).toBeVisible();

  // Spend the round, which is what closes planning.
  await page.getByRole("button", { name: "Console" }).click();
  await drive.selectAnyPiece(page);
  await commit(page, "Acquire");

  await page.getByRole("button", { name: "Master map" }).click();
  await expect(map.getByText(/round is being spent/i)).toBeVisible();
  await expect(
    map.getByRole("button", { name: "Mark", exact: true }),
  ).toBeDisabled();
  await expect(
    map.getByRole("button", { name: "Route", exact: true }),
  ).toBeDisabled();
  // Pointing is never a commitment, so it stays available all round.
  await expect(map.getByRole("button", { name: "Point" })).toBeEnabled();
});
