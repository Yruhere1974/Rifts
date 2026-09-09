import { expect, type Page } from "@playwright/test";

/**
 * Page-scoped helpers for driving a seat through the hex map. Reaching an
 * objective now takes several commitments, so these check what is actually
 * possible before clicking rather than assuming a scripted sequence.
 */

export async function selectSite(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

export async function atSelectedSite(page: Page): Promise<boolean> {
  return (await page.locator(".location-presence").innerText()).includes(
    "You are here",
  );
}

/** Selects one available component for whichever engine is on screen. */
export async function selectAnyPiece(page: Page): Promise<boolean> {
  // Must be an unselected one: clicking a selected piece toggles it off, and
  // the commit then quietly falls back to spending a shared resource.
  for (const selector of [".die", ".playing-card", ".placement-marker"]) {
    const control = page
      .locator(`${selector}[aria-pressed="false"]:not([disabled])`)
      .first();
    if (await control.count()) {
      await control.click();
      return true;
    }
  }
  // The push-your-luck engine commits its whole surge, which is not clickable.
  return (await page.locator(".token-tray .bag-token").count()) > 0;
}

/** Pushes the bag until the surge holds at least one token. */
export async function pushOnce(page: Page): Promise<boolean> {
  const button = page.getByRole("button", {
    name: "Push for another surge token",
  });
  if (!(await button.count()) || !(await button.isEnabled())) return false;
  const status = page.locator(".risk-track > span");
  const tray = page.locator(".token-tray .bag-token");
  const held = await tray.count();
  const before = await status.innerText();
  await button.click();
  await expect
    .poll(
      async () =>
        (await tray.count()) !== held || (await status.innerText()) !== before,
      { timeout: 10_000 },
    )
    .toBe(true);
  return true;
}

export async function chooseAction(page: Page, action: string) {
  await page.getByRole("button", { name: action, exact: true }).click();
}

export async function canCommit(page: Page, action: string): Promise<boolean> {
  return page
    .getByRole("button", {
      name: `Commit ${action.toLowerCase()}`,
      exact: true,
    })
    .isEnabled();
}

const COMPONENTS = ".die, .playing-card, .placement-marker, .bag-token";

/**
 * Commits and waits for the component to actually be spent. The field log is
 * not a usable signal here: two identical commitments print identical lines.
 */
export async function commitAction(page: Page, action: string) {
  const held = await page.locator(COMPONENTS).count();
  await page
    .getByRole("button", {
      name: `Commit ${action.toLowerCase()}`,
      exact: true,
    })
    .click();
  // The mission can resolve mid-commit, which freezes the console behind the
  // resolution modal; that counts as the commit having landed.
  await expect
    .poll(
      async () =>
        (await isOver(page)) ||
        (await page.locator(COMPONENTS).count()) !== held,
      { timeout: 10_000 },
    )
    .toBe(true);
}

/** Stages an action with one component and commits it if the rules allow. */
export async function tryAction(page: Page, action: string): Promise<boolean> {
  if (await isOver(page)) return false;
  if (!(await selectAnyPiece(page))) return false;
  await chooseAction(page, action);
  if (!(await canCommit(page, action))) return false;
  await commitAction(page, action);
  return true;
}

/** Commits Move until this seat stands at the objective, or runs out. */
export async function headFor(page: Page, site: string): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await selectSite(page, site);
    if (await atSelectedSite(page)) return true;
    if (
      (await page.locator(".bag-engine").count()) &&
      !(await page.locator(".token-tray .bag-token").count()) &&
      !(await pushOnce(page))
    )
      return false;
    await selectSite(page, site);
    if (!(await tryAction(page, "Move"))) return false;
  }
  return false;
}

/** Spends this seat's remaining capability on the breach. */
export async function stabilise(page: Page): Promise<void> {
  for (let shot = 0; shot < 4; shot++) {
    await selectSite(page, "The breach");
    if (!(await atSelectedSite(page))) return;
    if (
      (await page.locator(".bag-engine").count()) &&
      !(await page.locator(".token-tray .bag-token").count()) &&
      !(await pushOnce(page))
    )
      return;
    if (await tryAction(page, "Contribute")) continue;
    // Out of Power: make some, then try again next pass.
    await chooseAction(page, "Acquire");
    await page.getByLabel("Resource to acquire").selectOption("power");
    if (!(await tryAction(page, "Acquire"))) return;
  }
}

/** Current instability, read from the pressure track. */
export async function instability(page: Page): Promise<number> {
  const text = await page
    .locator(".pressure-section .section-label strong")
    .innerText();
  return Number(text.split("/")[0]!.trim());
}

/**
 * The map made the mission longer, so pressure has to be managed rather than
 * outrun: hold instability down while the breach is still being closed.
 */
export async function relievePressure(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await instability(page)) < 6) return;
    if (!(await tryAction(page, "Recover"))) return;
  }
}

export async function finishRound(page: Page) {
  await page.getByRole("button", { name: "Finish round", exact: true }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();
}

export async function hasWon(page: Page): Promise<boolean> {
  return page.getByRole("heading", { name: "Greyhaven holds." }).isVisible();
}

/** True once the mission has resolved either way; its modal blocks all input. */
export async function isOver(page: Page): Promise<boolean> {
  return (await page.locator(".modal.resolution").count()) > 0;
}

export async function outcome(page: Page): Promise<string> {
  if (!(await isOver(page))) return "unresolved";
  return (await page.locator(".modal.resolution h2").innerText()).trim();
}

/**
 * Follows whatever the guide highlights, which exercises the tutorial through
 * real controls. Beacons vanish briefly across re-renders, so a miss is retried
 * before treating it as the end of the guided phase.
 */
export async function followGuide(
  page: Page,
  options: { steps?: number; until?: (title: string) => boolean } = {},
): Promise<string[]> {
  const seen: string[] = [];
  const choices = new Map<string, number>();
  for (let step = 0; step < (options.steps ?? 200); step++) {
    if (await isOver(page)) break;
    const title = await page
      .locator(".tutorial-copy h2")
      .innerText()
      .catch(() => "");
    if (title && seen.at(-1) !== title) seen.push(title);
    if (options.until?.(title)) break;
    const beacon = page.locator(".tutorial-beacon:visible").first();
    let found = false;
    for (let retry = 0; retry < 8 && !found; retry++) {
      if (await beacon.count()) found = true;
      else await page.waitForTimeout(250);
    }
    if (!found) break;
    const label = (await beacon.getAttribute("aria-label")) ?? "";
    if (label === "Assistance recipient" || label === "Resource to acquire") {
      // The recipient must be cycled until it is the one the lesson wants; a
      // resource just needs picking once.
      const count = await beacon.locator("option").count();
      const turn =
        label === "Assistance recipient"
          ? (choices.get(label) ?? 0) % Math.max(count, 1)
          : 0;
      choices.set(label, turn + 1);
      await beacon.selectOption({ index: turn }).catch(() => undefined);
      // Acquire highlights the selector and the commit button together, so the
      // commit still has to be pressed.
      const commit = page.locator('.tutorial-beacon[data-tutorial="commit"]');
      if (await commit.count()) await commit.click().catch(() => undefined);
      continue;
    }
    await beacon.click().catch(() => undefined);
  }
  return seen;
}
