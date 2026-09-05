import { expect, test } from "@playwright/test";

test("loads the prototype shell and Pixi board host", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Rifts Prototype" }),
  ).toBeVisible();
  await expect(page.getByText("Dimensional Stabilizer")).toBeVisible();
  await expect(page.getByTestId("board-canvas")).toBeVisible();
});
