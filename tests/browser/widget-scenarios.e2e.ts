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
  {
    scenario: "invalid-after-ready",
    state: "invalid",
    status: "Invalid result",
    error: "ABCoda v2 accepts exactly one complete tune per request.",
  },
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
  await expect(page.locator("#mixer")).toBeHidden();
});

test("voice mixer keeps instrument and mute as independent local preferences", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const rows = page.locator(".voice-mix-row");
  await expect(rows).toHaveCount(2);
  const rightHand = rows.filter({ hasText: "RH" });
  const leftHand = rows.filter({ hasText: "LH" });
  const instrument = rightHand.locator("select");
  const mute = leftHand.locator('input[type="checkbox"]');

  await expect(instrument).toHaveValue("acoustic_grand_piano");
  await instrument.selectOption("cello");
  await expect(rightHand.locator("select")).toHaveValue("cello");
  await mute.check();
  await expect(leftHand.locator('input[type="checkbox"]')).toBeChecked();
  await expect(page.locator("#tempo-value")).toHaveText("84 BPM");
  await expect(page.locator("#playback")).toBeEnabled();
});

test("a late invalid result tears down playback from the previous score", async ({ page }) => {
  await page.goto("/?scenario=invalid-after-ready");
  await expect(page.locator("body")).toHaveAttribute("data-state", "invalid");
  await expect(page.locator("#playback")).toBeDisabled();
  await expect(page.locator("#tempo")).toHaveValue("84");
});

test("host safe-area insets are applied without horizontal overflow", async ({ page }) => {
  await page.goto("/?safeTop=11&safeRight=7&safeBottom=19&safeLeft=5");
  const root = page.locator("html");
  await expect(root).toHaveCSS("--host-safe-top", "11px");
  await expect(root).toHaveCSS("--host-safe-right", "7px");
  await expect(root).toHaveCSS("--host-safe-bottom", "19px");
  await expect(root).toHaveCSS("--host-safe-left", "5px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("clicking an engraved measure seeks and places the visual cursor", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#score .abcjs-mm1").first().dispatchEvent("click");
  const cursor = page.locator(".score-cursor");
  await expect(cursor).toBeVisible();
  await expect(cursor).not.toHaveCSS("height", "0px");
});

test("invalid local edits keep the last rendered score and can be discarded", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor summary").click();
  const source = page.locator("#abc-draft");
  const original = await source.inputValue();
  await source.fill(original.replace(/^X:1\n/, ""));
  await page.locator("#apply-draft").click();

  await expect(page.locator("#editor-state")).toHaveText("Needs attention");
  await expect(page.locator("#draft-diagnostics")).toContainText("must declare exactly one X:");
  await expect(page.locator("#status")).toHaveText("Revision 1 ready");
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");

  await page.locator("#discard-draft").click();
  await expect(source).toHaveValue(original);
  await expect(page.locator("#editor-state")).toHaveText("Revision 1 saved");
  await expect(page.locator("#draft-diagnostics")).toBeEmpty();
});

test("valid local edits create revisions and original restore stays monotonic", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor summary").click();
  const source = page.locator("#abc-draft");
  await source.fill((await source.inputValue()).replace(
    "T:First architecture v2 vertical",
    "T:Locally edited title",
  ));
  await page.locator("#apply-draft").click();

  await expect(page.locator("#status")).toHaveText("Revision 2 ready");
  await expect(page.locator("#editor-state")).toHaveText("Revision 2 saved");
  await expect(page.locator("#score")).toContainText("Locally edited title");

  await page.locator("#restore-original").click();
  await expect(page.locator("#status")).toHaveText("Revision 3 ready");
  await expect(page.locator("#editor-state")).toHaveText("Revision 3 saved");
  await expect(page.locator("#score")).toContainText("First architecture v2 vertical");
});

test("copy ABC is an explicit user action with visible feedback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await page.goto("/?scenario=ready");
  await page.locator("#editor summary").click();
  const expected = await page.locator("#abc-draft").inputValue();
  await page.locator("#copy-draft").click();

  await expect(page.locator("#copy-status")).toHaveText("Copied");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(expected);
});
