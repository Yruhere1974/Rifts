import { expect, test, type Page } from "@playwright/test";

async function deploy(page: Page) {
  await page.goto("/");
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
  await deploy(page);
  await page.getByRole("button", { name: "Share reading with team" }).click();
  await page.locator(".die").first().click();
  await commit(page, "Contribute");
  await expect(page.locator(".location-facts")).toContainText(
    "Shield suppressed",
  );
  await donate(page);
  await seat(page, "Wayfinder");
  await page.getByRole("button", { name: "Share reading with team" }).click();
  await expect(page.locator(".location-facts")).toContainText(
    "Safe frequency known",
  );
  await page.getByRole("button", { name: "Hold capability" }).click();
  await expect(
    page.getByRole("button", { name: "Capability held" }),
  ).toBeVisible();
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
  await seat(page, "Wayfinder");
  await page.getByRole("button", { name: "Exploit Opening card" }).click();
  await page.getByRole("button", { name: "Assist", exact: true }).click();
  await page.getByLabel("Assistance recipient").selectOption("operator");
  await commit(page, "Assist");
  await expect(page.locator(".assist-request")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Exploit Opening card" }),
  ).toHaveCount(0);
  await seat(page, "Operator");
  await page.locator(".placement-marker").first().click();
  await page.getByRole("button", { name: "Contribute", exact: true }).click();
  await expect(page.locator(".action-preview")).toContainText(
    "8 rift progress",
  );
  await commit(page, "Contribute");
  await expect(page.locator(".objective-counter strong")).toContainText("8");
  await seat(page, "Pathfinder");
  for (
    let i = 0;
    i < 8 && (await page.locator(".bag-token:not(.hazard)").count()) < 2;
    i++
  ) {
    const before = await page.locator(".draw-bag small").textContent();
    await page.getByRole("button", { name: "Draw from bag" }).click();
    await expect(page.locator(".draw-bag small")).not.toHaveText(before!);
  }
  await page.getByRole("button", { name: "Bank haul" }).click();
  await expect(
    page.getByRole("button", { name: "Draw from bag" }),
  ).toBeDisabled();
  await page.locator(".bag-token:not(.hazard)").first().click();
  await commit(page, "Move");
  await page.locator(".bag-token:not(.hazard)").first().click();
  await commit(page, "Contribute");
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
  expect(errors).toEqual([]);
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
