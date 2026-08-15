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

test("playback controls adopt score tempo and remain operable without starting audio", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const play = page.locator("#playback");
  const loop = page.locator("#loop");
  const tempo = page.locator("#tempo");

  await expect(play).toBeVisible();
  await expect(play).toBeEnabled();
  await expect(page.locator("#tempo-value")).toHaveText("84 BPM");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await tempo.fill("110");
  await tempo.dispatchEvent("change");
  await expect(page.locator("#tempo-value")).toHaveText("110 BPM");
});

test("invalid scores never expose active playback controls", async ({ page }) => {
  await page.goto("/?scenario=invalid");
  await expect(page.locator("#playback")).toBeDisabled();
  await expect(page.locator("#rewind")).toBeDisabled();
  await expect(page.locator("#loop")).toBeDisabled();
});
