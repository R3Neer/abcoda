import { expect, test } from "@playwright/test";

const cases = [
  { scenario: "ready", state: "ready", status: "Revision 1 ready", error: "" },
  { scenario: "legacy", state: "ready", status: "Revision 1 ready", error: "" },
  { scenario: "mixed", state: "ready", status: "Revision 1 ready", error: "" },
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
  await expect(play).toHaveAttribute("aria-label", "Play");
  await expect(loop).toHaveAttribute("aria-label", "Enable loop");
  await expect(page.locator("#tempo-value")).toHaveText("84 BPM");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await expect(loop).toHaveAttribute("aria-label", "Disable loop");
  await tempo.fill("110");
  await tempo.dispatchEvent("change");
  await expect(page.locator("#tempo-value")).toHaveText("110 BPM");
});

test("schema 1 presentation preferences survive the v2 widget boundary", async ({ page }) => {
  await page.goto("/?scenario=legacy");
  await expect(page.locator("#score-title")).toHaveText("Legacy presentation");
  await expect(page.locator("#tempo-value")).toHaveText("112 BPM");
  await expect(page.locator("#loop")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#mixer summary").click();
  const rightHand = page.locator(".voice-mix-row").filter({ hasText: "RH" });
  const leftHand = page.locator(".voice-mix-row").filter({ hasText: "LH" });
  await expect(rightHand.locator("select")).toHaveValue("cello");
  await expect(leftHand.locator("button.voice-mute")).toHaveAttribute("aria-pressed", "true");
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
  const mixer = page.locator("#mixer");
  await expect(mixer).not.toHaveAttribute("open", "");
  await mixer.locator("summary").click();
  await expect(mixer).toHaveAttribute("open", "");
  const rows = page.locator(".voice-mix-row");
  await expect(rows).toHaveCount(2);
  const rightHand = rows.filter({ hasText: "RH" });
  const leftHand = rows.filter({ hasText: "LH" });
  const instrument = rightHand.locator("select");
  const mute = leftHand.locator("button.voice-mute");

  await expect(instrument).toHaveValue("acoustic_grand_piano");
  await instrument.selectOption("cello");
  await expect(rightHand.locator("select")).toHaveValue("cello");
  await mute.click();
  await expect(leftHand.locator("button.voice-mute")).toHaveAttribute("aria-pressed", "true");
  await expect(leftHand.locator("button.voice-mute")).toHaveAttribute("aria-label", "Unmute LH");
  await expect(page.locator("#tempo-value")).toHaveText("84 BPM");
  await expect(page.locator("#playback")).toBeEnabled();
});

test("voice mixer warns when a selected instrument is outside the sounding range", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#mixer summary").click();
  const rightHand = page.locator(".voice-mix-row").filter({ hasText: "RH" });
  await rightHand.locator("select").selectOption("piccolo");
  await expect(rightHand.locator(".voice-range-warning")).toContainText(
    "outside the usual D5–C8 sounding range",
  );
  await rightHand.locator("select").selectOption("acoustic_grand_piano");
  await expect(rightHand.locator(".voice-range-warning")).toHaveCount(0);
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

test("clicking an engraved note seeks and places the cursor immediately before it", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const note = page.locator("#score .abcjs-note").nth(2);
  const noteBox = await note.boundingBox();
  expect(noteBox).not.toBeNull();
  await page.mouse.click(noteBox!.x + noteBox!.width / 2, noteBox!.y + noteBox!.height / 2);
  const cursor = page.locator(".score-cursor");
  await expect(cursor).toBeVisible();
  await expect(cursor).not.toHaveCSS("height", "0px");
  const cursorBox = await cursor.boundingBox();
  expect(cursorBox).not.toBeNull();
  expect(Math.abs(cursorBox!.x + cursorBox!.width - noteBox!.x)).toBeLessThan(8);
});

test("a near-note click follows ABCJS selection instead of the previous timing span", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const note = page.locator("#score .abcjs-note").nth(1);
  const noteBox = await note.boundingBox();
  expect(noteBox).not.toBeNull();
  await page.mouse.click(noteBox!.x - 6, noteBox!.y + noteBox!.height / 2);
  await expect(note).toHaveClass(/abcjs-note_selected/);
  const cursorBox = await page.locator(".score-cursor").boundingBox();
  expect(cursorBox).not.toBeNull();
  expect(Math.abs(cursorBox!.x + cursorBox!.width - noteBox!.x)).toBeLessThan(8);
});

test("the cursor reaches the final bar when playback finishes", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const lastNote = page.locator("#score .abcjs-note").last();
  const lastNoteBox = await lastNote.boundingBox();
  expect(lastNoteBox).not.toBeNull();
  await page.mouse.click(
    lastNoteBox!.x + lastNoteBox!.width / 2,
    lastNoteBox!.y + lastNoteBox!.height / 2,
  );
  await page.locator("#playback").click();
  await expect(page.locator("#playback")).toHaveAttribute("aria-label", "Play", { timeout: 15000 });
  const cursorBox = await page.locator(".score-cursor").boundingBox();
  const finalBarBox = await page.locator("#score .abcjs-bar").last().boundingBox();
  expect(cursorBox).not.toBeNull();
  expect(finalBarBox).not.toBeNull();
  expect(Math.abs(cursorBox!.x - finalBarBox!.x)).toBeLessThan(12);
});

test("play starts at the first note and seeking while playing keeps playback alive", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const cursor = page.locator(".score-cursor");
  const firstNote = page.locator("#score .abcjs-note").first();
  const initialCursor = await cursor.boundingBox();
  const firstNoteBox = await firstNote.boundingBox();
  expect(initialCursor).not.toBeNull();
  expect(firstNoteBox).not.toBeNull();
  expect(Math.abs(initialCursor!.x + initialCursor!.width - firstNoteBox!.x)).toBeLessThan(8);

  await page.locator("#playback").click();
  await expect(page.locator("#playback")).toHaveAttribute("aria-label", "Pause");
  const laterNote = page.locator("#score .abcjs-note").nth(6);
  const laterNoteBox = await laterNote.boundingBox();
  expect(laterNoteBox).not.toBeNull();
  await page.mouse.click(
    laterNoteBox!.x + laterNoteBox!.width / 2,
    laterNoteBox!.y + laterNoteBox!.height / 2,
  );
  await expect(page.locator("#playback")).toHaveAttribute("aria-label", "Pause");
  await expect(laterNote).toHaveClass(/abcjs-note_selected/);
});

test("invalid local edits keep the last rendered score and remain in version history", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  const source = page.locator("#abc-draft");
  const original = await source.inputValue();
  await source.fill(original.replace(/^X:1\n/, ""));

  await expect(page.locator("#editor-state")).toHaveText("Not applied");
  await expect(page.locator("#draft-diagnostics")).toContainText("must declare exactly one X:");
  await expect(page.locator("#status")).toHaveText("Revision 1 ready");
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");
  const invalidVersion = page.locator('#version-history button[data-version-status="invalid"]');
  await expect(invalidVersion).toHaveCount(1);

  await page.locator("#version-picker > summary").click();
  await page.locator('#version-history button[data-version-id="original"]').click();
  await expect(source).toHaveValue(original);
  await expect(page.locator("#editor-state")).toHaveText("Revision 3 saved");
  await expect(page.locator("#draft-diagnostics")).toBeEmpty();
});

test("valid local edits create revisions and original restore stays monotonic", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  const source = page.locator("#abc-draft");
  await source.fill((await source.inputValue()).replace(
    "T:First architecture v2 vertical",
    "T:Locally edited title",
  ));

  await expect(page.locator("#status")).toHaveText("Revision 2 ready");
  await expect(page.locator("#editor-state")).toHaveText("Revision 2 saved");
  await expect(page.locator("#score")).toContainText("Locally edited title");

  await page.locator("#version-picker > summary").click();
  await page.locator('#version-history button[data-version-id="original"]').click();
  await expect(page.locator("#status")).toHaveText("Revision 3 ready");
  await expect(page.locator("#editor-state")).toHaveText("Revision 3 saved");
  await expect(page.locator("#score")).toContainText("First architecture v2 vertical");
});

test("copy ABC is an explicit user action with visible feedback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  const expected = await page.locator("#abc-draft").inputValue();
  await page.locator("#copy-draft").click();

  await expect(page.locator("#copy-status")).toHaveText("Copied");
  await expect(page.locator("#copy-draft")).toBeDisabled();
  await expect(page.locator("#copy-draft")).toHaveAttribute("aria-label", "Copied");
  await expect(page.locator("#copy-draft .copied-icon")).toBeVisible();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(expected);
  await expect(page.locator("#copy-draft")).toBeEnabled({ timeout: 2500 });
  await expect(page.locator("#copy-draft")).toHaveAttribute("aria-label", "Copy ABC");
});

test("version history opens and closes with hover", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  await page.locator("#version-picker > summary").hover();
  await expect(page.locator("#version-picker")).toHaveAttribute("open", "");
  await page.locator("#abc-draft").hover();
  await expect(page.locator("#version-picker")).not.toHaveAttribute("open", "");
});

test("transposition is reviewable before it creates a new score revision", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  await page.locator("#transpose-up").click();

  await expect(page.locator("#editor-state")).toHaveText("Saving soon…");
  await expect(page.locator("#status")).toHaveText("Revision 1 ready");
  await expect(page.locator("#abc-draft")).toHaveValue(/K:(?:Db|C#)/);

  await expect(page.locator("#status")).toHaveText("Revision 2 ready");
  await expect(page.locator("#editor-state")).toHaveText("Revision 2 saved");
  await expect(page.locator("#score")).toContainText("First architecture v2 vertical");
});

test("mixed pitched and percussion voices keep compatible controls and transposition", async ({ page }) => {
  await page.goto("/?scenario=mixed");
  const percussionInstrument = page.getByLabel("Instrument for D");
  await expect(percussionInstrument.locator("option")).toHaveCount(1);
  await expect(percussionInstrument).toHaveValue("standard_drum_kit");

  await page.locator("#editor > summary").click();
  await page.locator("#transpose-up").click();
  const draft = page.locator("#abc-draft");
  await expect(draft).toHaveValue(/K:Db/);
  await expect(draft).toHaveValue(/\[V:D\]\[K:none clef=perc\] C D E F\|C D E F\|\]/);
  await expect(page.locator("#status")).toHaveText("Revision 2 ready");
  await expect(percussionInstrument).toHaveValue("standard_drum_kit");
});

test("primary controls follow a visible and operable keyboard path", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.keyboard.press("Tab");
  const mixerSummary = page.locator("#mixer summary");
  await expect(mixerSummary).toBeFocused();
  await expect(mixerSummary).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(page.locator("#mixer")).toHaveAttribute("open", "");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Instrument for RH")).toBeFocused();
  await expect(page.getByLabel("Instrument for RH")).toHaveCSS("outline-style", "solid");

  await page.keyboard.press("Tab");
  const muteRight = page.locator('button.voice-mute[data-voice-id="RH"]');
  await expect(muteRight).toBeFocused();
  await page.keyboard.press("Space");
  await expect(muteRight).toHaveAttribute("aria-pressed", "true");
  await expect(muteRight).toHaveAttribute("aria-label", "Unmute RH");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Instrument for LH")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('button.voice-mute[data-voice-id="LH"]')).toBeFocused();
  await page.keyboard.press("Tab");
  const editorSummary = page.locator("#editor > summary");
  await expect(editorSummary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#editor")).toHaveAttribute("open", "");
  await page.keyboard.press("Tab");
  await expect(page.locator("#version-picker > summary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('#version-history button[data-version-id="original"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#abc-draft")).toBeFocused();
});

test("reduced-motion preference suppresses nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=ready");
  await expect(page.locator("#playback")).toHaveCSS("transition-duration", "1e-05s");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
});
