import { expect, test, type Locator } from "@playwright/test";
import {
  openMixer,
  settleWidget,
} from "./helpers/visual-review";

const rowFor = (mixer: Locator, voiceId: string) => mixer.locator(
  `.voice-mix-row:has(.voice-instrument[data-voice-id="${voiceId}"])`,
);

test("instrument range states drive controls and engraved note colors", async ({ page }) => {
  await page.goto("/?scenario=ranges&theme=light");
  await settleWidget(page, "Revision 1 ready");
  const mixer = await openMixer(page);

  const usual = rowFor(mixer, "USUAL");
  const extended = rowFor(mixer, "EXTENDED");
  const unplayable = rowFor(mixer, "UNPLAYABLE");

  await expect(usual.locator(".voice-instrument")).toHaveAttribute(
    "data-range-status",
    "usual",
  );
  await expect(extended.locator(".voice-instrument")).toHaveAttribute(
    "data-range-status",
    "extended",
  );
  await expect(unplayable.locator(".voice-instrument")).toHaveAttribute(
    "data-range-status",
    "unplayable",
  );

  await expect(usual.locator(".voice-range-warning")).toHaveCount(0);
  await expect(extended.locator(".voice-range-warning")).toHaveClass(/sr-only/);
  await expect(unplayable.locator(".voice-range-warning")).toHaveClass(/sr-only/);
  await expect(extended.locator(".voice-instrument")).toHaveAttribute(
    "aria-describedby",
    /voice-range-/,
  );
  await expect(unplayable.locator(".voice-instrument")).toHaveAttribute(
    "aria-describedby",
    /voice-range-/,
  );

  expect(await page.locator("#score .abcoda-range-extended").count()).toBeGreaterThan(0);
  expect(await page.locator("#score .abcoda-range-unplayable").count()).toBeGreaterThan(0);

  const extendedColor = await extended.locator(".voice-instrument").evaluate((element) => (
    getComputedStyle(element).backgroundColor
  ));
  const unplayableColor = await unplayable.locator(".voice-instrument").evaluate((element) => (
    getComputedStyle(element).backgroundColor
  ));
  const usualColor = await usual.locator(".voice-instrument").evaluate((element) => (
    getComputedStyle(element).backgroundColor
  ));

  expect(extendedColor).not.toBe(usualColor);
  expect(unplayableColor).not.toBe(usualColor);
  expect(unplayableColor).not.toBe(extendedColor);
});

test("unbounded presets remove fabricated range warnings and restore them when returning to a bounded instrument", async ({ page }) => {
  await page.goto("/?scenario=ranges&theme=light");
  await settleWidget(page, "Revision 1 ready");
  const mixer = await openMixer(page);
  const row = rowFor(mixer, "UNPLAYABLE");
  const select = row.locator(".voice-instrument");

  await expect(select).toHaveAttribute("data-range-status", "unplayable");
  expect(await page.locator("#score .abcoda-range-unplayable").count()).toBeGreaterThan(0);

  await select.selectOption("choir_aahs");
  await expect(select).toHaveAttribute("data-range-status", "unbounded");
  await expect(row.locator(".voice-range-warning")).toHaveCount(0);
  await expect(page.locator("#score .abcoda-range-unplayable")).toHaveCount(0);

  await select.selectOption("trumpet");
  await expect(select).toHaveAttribute("data-range-status", "unplayable");
  await expect(row.locator(".voice-range-warning")).toHaveClass(/sr-only/);
  expect(await page.locator("#score .abcoda-range-unplayable").count()).toBeGreaterThan(0);
});
