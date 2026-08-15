import { expect, test } from "@playwright/test";

const cases = [
  { scenario: "ready", state: "ready", status: "Revision 1 ready", error: "" },
  {
    scenario: "invalid",
    state: "invalid",
    status: "Invalid result",
    error: "ABCoda v2 accepts exactly one complete tune per request.",
  },
  {
    scenario: "malformed",
    state: "invalid",
    status: "Invalid result",
    error: "The host supplied an invalid score snapshot.",
  },
  { scenario: "race", state: "ready", status: "Revision 3 ready", error: "" },
] as const;

for (const scenario of cases) {
  test(`${scenario.scenario} reaches a stable responsive state`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto(`/?scenario=${scenario.scenario}`);
    await expect(page.locator("body")).toHaveAttribute("data-state", scenario.state);
    await expect(page.locator("#status")).toHaveText(scenario.status);
    await expect(page.locator("#error")).toHaveText(scenario.error);
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}

test("standalone host theme is explicit and overridable", async ({ page }) => {
  await page.goto("/?scenario=ready&theme=light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");

  await page.goto("/?scenario=ready&theme=dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});
