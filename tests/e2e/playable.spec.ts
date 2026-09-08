import { expect, test, type Page } from "@playwright/test";

async function deploy(page: Page, tutorial = false) {
  await page.goto("/");
  if (tutorial)
    await page.getByRole("checkbox", { name: "Guided tutorial" }).check();
  await page.getByRole("button", { name: "Deploy to Greyhaven" }).click();
  await expect(page.locator(".die")).toHaveCount(5);
}
async function nextLesson(page: Page) {
  await expect(page.locator(".tutorial-status")).toContainText(
    "Lesson complete",
  );
  await page.getByRole("button", { name: "Next lesson" }).click();
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
/** Pushes the bag until the surge holds `target` tokens, absorbing busts. */
async function push(page: Page, target: number) {
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
}
async function donate(page: Page) {
  await page.getByRole("button", { name: "Unclaimed power core" }).click();
  await page.getByRole("button", { name: "Donate core to team" }).click();
  await expect(
    page.getByRole("button", { name: "Core donated" }),
  ).toBeVisible();
}

test("four engines complete a cooperative mission through the interface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await deploy(page, true);
  await expect(
    page.getByRole("button", { name: "Next lesson" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Share reading with team" }).click();
  await nextLesson(page);
  await page.locator(".die").first().click();
  await commit(page, "Contribute");
  await expect(page.locator(".location-facts")).toContainText(
    "Shield suppressed",
  );
  await nextLesson(page);
  await page.getByRole("button", { name: "Show me where" }).click();
  await expect(
    page.getByRole("button", { name: "Unclaimed power core" }),
  ).toBeFocused();
  await donate(page);
  await nextLesson(page);
  await seat(page, "Wayfinder");
  await page.getByRole("button", { name: "Share reading with team" }).click();
  await expect(page.locator(".location-facts")).toContainText(
    "Safe frequency known",
  );
  await nextLesson(page);
  await page.getByRole("button", { name: "Hold capability" }).click();
  await expect(
    page.getByRole("button", { name: "Capability held" }),
  ).toBeVisible();
  await nextLesson(page);
  await seat(page, "Operator");
  await page.getByRole("button", { name: "The breach", exact: true }).click();
  await page.locator(".placement-marker").first().click();
  await commit(page, "Move");
  await page.locator(".placement-marker").first().click();
  await commit(page, "Recover");
  await expect(page.locator(".system-note")).toContainText("PRIMED");
  await page.getByRole("button", { name: "Request help" }).click();
  await expect(page.locator(".assist-request")).toContainText(
    "Operator needs support",
  );
  await nextLesson(page);
  await seat(page, "Wayfinder");
  await page.getByRole("button", { name: "Exploit Opening card" }).click();
  await page.getByRole("button", { name: "Assist", exact: true }).click();
  await page.getByLabel("Assistance recipient").selectOption("operator");
  await commit(page, "Assist");
  await expect(page.locator(".assist-request")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Exploit Opening card" }),
  ).toHaveCount(0);
  await nextLesson(page);
  await seat(page, "Operator");
  await page.locator(".placement-marker").first().click();
  await page.getByRole("button", { name: "Contribute", exact: true }).click();
  await expect(page.locator(".action-preview")).toContainText(
    "8 rift progress",
  );
  await commit(page, "Contribute");
  await expect(page.locator(".objective-counter strong")).toContainText("8");
  await nextLesson(page);
  await seat(page, "Pathfinder");
  await push(page, 2);
  await nextLesson(page);
  await commit(page, "Move");
  await push(page, 1);
  await commit(page, "Contribute");
  await nextLesson(page);
  await seat(page, "Wayfinder");
  await donate(page);
  await page
    .getByRole("button", { name: "Channel card", exact: true })
    .first()
    .click();
  await commit(page, "Move");
  await page
    .getByRole("button", { name: "Channel card", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Resonance card", exact: true })
    .first()
    .click();
  await commit(page, "Contribute");
  await nextLesson(page);
  await seat(page, "Pathfinder");
  await donate(page);
  await seat(page, "Operator");
  await page.locator(".placement-marker").first().click();
  await page.getByRole("button", { name: "Assist", exact: true }).click();
  await page.getByLabel("Assistance recipient").selectOption("soldier");
  await commit(page, "Assist");
  await seat(page, "Vanguard");
  await page.getByRole("button", { name: "Die 1", exact: true }).click();
  await commit(page, "Move");
  await page.getByRole("button", { name: "Die 4", exact: true }).click();
  await commit(page, "Contribute");
  await page.getByRole("button", { name: "Die 5", exact: true }).click();
  await commit(page, "Contribute");
  await expect(
    page.getByRole("heading", { name: "Greyhaven holds." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Guided tutorial" }),
  ).toHaveCount(0);
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
  const wayfinder = page.locator('[data-tutorial-seat="mage"]');
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
  const clues = [
    ["Vanguard", "Engage requires 4+"],
    ["Wayfinder", "No other two-card combination is valid"],
    ["Pathfinder", "spends your entire surge"],
    ["Operator", "Every module accepts only one placement per round"],
  ];
  for (const [name, rule] of clues) {
    await seat(page, name!);
    const trigger = page.getByRole("button", {
      name: `${name} rules reference`,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(rule!);
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
  await seat(page, "Vanguard");
  const before = await page.locator(".event-ribbon p").textContent();
  await page.getByRole("button", { name: "Vanguard rules reference" }).click();
  await page.getByLabel("Specialist reference").selectOption("mage");
  await expect(
    page.getByRole("heading", { name: "Wayfinder rules", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".engine-heading .eyebrow")).toContainText(
    "Vanguard",
  );
  await expect(page.locator(".die")).toHaveCount(5);
  await expect(page.locator(".event-ribbon p")).toHaveText(before!);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByLabel("Specialist reference").selectOption("operator");
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
    page.getByRole("button", { name: "Vanguard rules reference" }),
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
  await seat(page, "Pathfinder");
  await expect(assessment.locator(".intel p")).not.toHaveText(soldierText!);
  const scoutText = await assessment.locator(".intel p").textContent();
  await expect(page.locator(".comms-feed")).not.toContainText(scoutText!);
  await assessment
    .getByRole("button", { name: "Share location assessment" })
    .click();
  await expect(page.locator(".comms-feed")).toContainText(scoutText!);
  await expect(page.locator(".discovery-note")).toHaveCount(0);
  await seat(page, "Operator");
  await expect(assessment).toContainText("two usable Power cells");
  await expect(assessment).not.toContainText(scoutText!);
  await assessment
    .getByRole("button", { name: "Share location assessment" })
    .click();
  await expect(page.locator(".discovery-note")).toContainText(
    "+2 shared Power",
  );
  await seat(page, "Wayfinder");
  await page
    .getByRole("button", { name: "Channel card", exact: true })
    .first()
    .click();
  await commit(page, "Move");
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
  await expect(page.locator(".playing-card")).toHaveCount(3);
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
    for (const name of ["Vanguard", "Wayfinder", "Pathfinder", "Operator"]) {
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
    for (const name of ["Vanguard", "Wayfinder", "Pathfinder", "Operator"]) {
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
