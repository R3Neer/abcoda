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
  await page.goto("/?scenario=ready&theme=light");
  const play = page.locator("#playback");
  const loop = page.locator("#loop");
  const tempo = page.locator("#tempo");
  const tempoValue = page.locator("#tempo-value");

  await expect(play).toBeVisible();
  await expect(play).toBeEnabled();
  await expect(play).toHaveAttribute("aria-label", "Play");
  await expect(loop).toHaveAttribute("aria-label", "Enable loop");
  await expect(tempoValue).toHaveValue("84");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await expect(loop).toHaveAttribute("aria-label", "Disable loop");
  await expect(loop).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(loop).toHaveCSS("color", "rgb(255, 255, 255)");
  await tempo.fill("109");
  await expect(tempoValue).toHaveValue("109");
  await tempo.fill("110");
  await tempo.dispatchEvent("change");
  await expect(tempoValue).toHaveValue("110");
  await tempoValue.fill("126");
  await expect(tempo).toHaveValue("126");
  await tempoValue.dispatchEvent("change");
  await expect(tempo).toHaveValue("126");
  await tempoValue.fill("");
  await tempoValue.dispatchEvent("change");
  await expect(tempoValue).toHaveValue("126");
});

test("transport orders play before rewind", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const order = await page.locator(".transport > button").evaluateAll((buttons) => (
    buttons.map((button) => button.id)
  ));
  expect(order.slice(0, 2)).toEqual(["playback", "rewind"]);
});

test("piano voices share a full grand-staff brace while unrelated voices do not", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const brace = page.locator('#score [data-name="brace"]');
  const staves = page.locator("#score .abcjs-staff");
  await expect(brace).toHaveCount(1);
  await expect(staves).toHaveCount(2);
  const braceBox = await brace.boundingBox();
  const upperBox = await staves.nth(0).boundingBox();
  const lowerBox = await staves.nth(1).boundingBox();
  expect(braceBox).not.toBeNull();
  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  expect(braceBox!.y).toBeLessThanOrEqual(upperBox!.y + 2);
  expect(braceBox!.y + braceBox!.height).toBeGreaterThanOrEqual(lowerBox!.y + lowerBox!.height - 2);

  await page.goto("/?scenario=mixed");
  await expect(page.locator('#score [data-name="brace"]')).toHaveCount(0);
});

test("schema 1 presentation preferences survive the v2 widget boundary", async ({ page }) => {
  await page.goto("/?scenario=legacy");
  await expect(page.locator("#score-title")).toHaveText("Legacy presentation");
  await expect(page.locator("#tempo-value")).toHaveValue("112");
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

  for (const row of [rightHand, leftHand]) {
    const nameBox = await row.locator(".voice-name").boundingBox();
    const instrumentBox = await row.locator("select").boundingBox();
    const muteBox = await row.locator("button.voice-mute").boundingBox();
    expect(nameBox).not.toBeNull();
    expect(instrumentBox).not.toBeNull();
    expect(muteBox).not.toBeNull();
    expect(nameBox!.x).toBeLessThan(instrumentBox!.x);
    expect(instrumentBox!.x).toBeLessThan(muteBox!.x);
    expect(Math.abs((nameBox!.y + nameBox!.height / 2) - (instrumentBox!.y + instrumentBox!.height / 2))).toBeLessThan(2);
    expect(Math.abs((muteBox!.y + muteBox!.height / 2) - (instrumentBox!.y + instrumentBox!.height / 2))).toBeLessThan(2);
  }

  await expect(instrument).toHaveValue("acoustic_grand_piano");
  await instrument.selectOption("cello");
  await expect(rightHand.locator("select")).toHaveValue("cello");
  await mute.click();
  await expect(leftHand.locator("button.voice-mute")).toHaveAttribute("aria-pressed", "true");
  await expect(leftHand.locator("button.voice-mute")).toHaveAttribute("aria-label", "Unmute LH");
  await expect(page.locator("#tempo-value")).toHaveValue("84");
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
  await page.mouse.click(
    noteBox!.x + Math.min(2, noteBox!.width / 2),
    noteBox!.y + noteBox!.height / 2,
  );
  const selected = page.locator("#score .abcjs-note_selected");
  await expect(selected).toHaveCount(1);
  const selectedBox = await selected.boundingBox();
  const cursorBox = await page.locator(".score-cursor").boundingBox();
  expect(selectedBox).not.toBeNull();
  expect(cursorBox).not.toBeNull();
  expect(Math.abs(cursorBox!.x + cursorBox!.width - selectedBox!.x)).toBeLessThan(8);
});

test("the cursor returns to the first note when non-looping playback finishes", async ({ page }) => {
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
  const firstNoteBox = await page.locator("#score .abcjs-note").first().boundingBox();
  expect(cursorBox).not.toBeNull();
  expect(firstNoteBox).not.toBeNull();
  expect(Math.abs(cursorBox!.x + cursorBox!.width - firstNoteBox!.x)).toBeLessThan(8);
});

test("loop enabled while playback starts survives the first ending", async ({ page }) => {
  await page.goto("/?scenario=ready");
  const lastNote = page.locator("#score .abcjs-note").last();
  const lastNoteBox = await lastNote.boundingBox();
  expect(lastNoteBox).not.toBeNull();
  await page.mouse.click(
    lastNoteBox!.x + lastNoteBox!.width / 2,
    lastNoteBox!.y + lastNoteBox!.height / 2,
  );

  await page.locator("#playback").click();
  await page.locator("#loop").click();
  await expect(page.locator("#loop")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(2500);
  await expect(page.locator("#playback")).toHaveAttribute("aria-label", "Pause");
});

test("the cursor fades through a wrapped system jump", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  await page.locator("#abc-draft").fill([
    "X:1",
    "T:Wrapped cursor",
    "M:4/4",
    "L:1/4",
    "Q:1/4=300",
    "K:C",
    "C D E F|G A B c|",
    "c B A G|F E D C|",
    "C E G c|c G E C|",
    "D F A d|d A F D|]",
  ].join("\n"));
  await expect(page.locator("#status")).toHaveText("Revision 2 ready");
  await page.evaluate(() => {
    Reflect.set(window, "__abcodaCursorWrapped", false);
    const cursor = document.querySelector(".score-cursor");
    if (!cursor) return;
    new MutationObserver(() => {
      if (cursor.classList.contains("is-wrapping")) {
        Reflect.set(window, "__abcodaCursorWrapped", true);
      }
    }).observe(cursor, { attributeFilter: ["class"] });
  });

  await page.locator("#playback").click();
  await expect.poll(() => page.evaluate(
    () => Reflect.get(window, "__abcodaCursorWrapped") === true,
  ), { timeout: 10000 }).toBe(true);
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
  await expect(invalidVersion).toHaveCount(0);
  await page.locator("#begin-commit").click();
  await page.locator("#commit-message").fill("Broken experiment");
  await page.locator("#submit-commit").click();
  await expect(invalidVersion).toHaveCount(1);
  await expect(invalidVersion).toContainText("Broken experiment");

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
  await expect(page.locator("#version-history button")).toHaveCount(1);
  await page.locator("#begin-commit").click();
  await page.locator("#commit-message").fill("Edited title");
  await page.locator("#submit-commit").click();
  await expect(page.locator("#version-history button")).toHaveCount(2);
  await expect(page.locator("#version-history")).toContainText("Edited title");

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
  await page.locator("#version-history").hover();
  await page.waitForTimeout(250);
  await expect(page.locator("#version-picker")).toHaveAttribute("open", "");
  await page.locator("#abc-draft").hover();
  await expect(page.locator("#version-picker")).not.toHaveAttribute("open", "");
});

test("commit entry can be cancelled without creating a version", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  expect(await page.evaluate(() => {
    const commit = document.querySelector(".commit-control");
    const versions = document.querySelector("#version-picker");
    return Boolean(commit && versions && (commit.compareDocumentPosition(versions) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.locator("#begin-commit").click();
  await page.locator("#commit-message").fill("Do not save");
  await page.locator("#cancel-commit").click();

  await expect(page.locator("#commit-form")).toBeHidden();
  await expect(page.locator("#begin-commit")).toBeVisible();
  await expect(page.locator("#begin-commit")).toBeFocused();
  await expect(page.locator("#version-history button")).toHaveCount(1);
});

test("score transposition applies immediately and creates a new score revision", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#editor > summary").click();
  const transpose = page.getByRole("group", { name: "score" });
  await expect(transpose.getByLabel("score step in semitones")).toHaveValue("1");
  await transpose.getByRole("button", { name: "Transpose score up" }).click();

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
  const transpose = page.getByRole("group", { name: "score" });
  await transpose.getByRole("button", { name: "Transpose score up" }).click();
  const draft = page.locator("#abc-draft");
  await expect(draft).toHaveValue(/K:C#/);
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
  await expect(page.getByRole("button", { name: "Transpose voice RH down" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("voice RH step in semitones")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Transpose voice RH up" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Instrument for LH")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('button.voice-mute[data-voice-id="LH"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Transpose voice LH down" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("voice LH step in semitones")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Transpose voice LH up" })).toBeFocused();

  await page.keyboard.press("Tab");
  const editorSummary = page.locator("#editor > summary");
  await expect(editorSummary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#editor")).toHaveAttribute("open", "");
  await page.keyboard.press("Tab");
  await expect(page.locator("#begin-commit")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#version-picker > summary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('#version-history button[data-version-id="original"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#abc-draft")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#copy-draft")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Transpose score down" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("score step in semitones")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Transpose score up" })).toBeFocused();
});

test("reduced-motion preference suppresses nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?scenario=ready");
  await expect(page.locator("#playback")).toHaveCSS("transition-duration", "1e-05s");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
});

test("responsive reflow retains the selected musical event", async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 760 });
  await page.goto("/?scenario=ready");
  const selectedIndex = 6;
  const note = page.locator("#score .abcjs-note").nth(selectedIndex);
  const before = await note.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.click(before!.x + before!.width / 2, before!.y + before!.height / 2);

  await page.setViewportSize({ width: 520, height: 760 });
  await expect.poll(async () => {
    const cursor = await page.locator(".score-cursor").boundingBox();
    const reflowedNote = await page.locator("#score .abcjs-note").nth(selectedIndex).boundingBox();
    if (!cursor || !reflowedNote) return Number.POSITIVE_INFINITY;
    return Math.abs(cursor.x + cursor.width - reflowedNote.x);
  }).toBeLessThan(8);
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  )).toBe(true);
});

test("browser zoom and forced colors keep controls and notation legible", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/?scenario=mixed");
  await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  await expect(page.locator("#score svg")).toBeVisible();
  await expect(page.locator("#playback")).toBeVisible();
  await page.locator("#playback").focus();
  await expect(page.locator("#playback")).toHaveCSS("outline-style", "solid");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
