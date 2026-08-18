import { expect, test } from "@playwright/test";

test("instrument controls rewrite ABC labels and brace grouping", async ({ page }) => {
  await page.goto("/?scenario=ready");
  await page.locator("#mixer summary").click();

  const rows = page.locator(".voice-mix-row");
  const rightHand = rows.filter({ hasText: "RH" });
  const leftHand = rows.filter({ hasText: "LH" });

  await rightHand.locator("select").selectOption("cello");

  await expect.poll(() => page.locator("#abc-draft").inputValue()).toContain(
    "% abcoda:instrument RH cello",
  );
  await expect.poll(() => page.locator("#abc-draft").inputValue()).toContain(
    "%%score RH | LH",
  );
  await expect(page.locator('#score [data-name="brace"]')).toHaveCount(0);
  await expect(rightHand.locator("select")).toHaveValue("cello");
  await expect(leftHand.locator("select")).toHaveValue("acoustic_grand_piano");

  const splitDraft = await page.locator("#abc-draft").inputValue();
  expect(splitDraft).toContain('V:RH clef=treble name="Cello" subname="Vc."');
  expect(splitDraft).toContain('V:LH clef=bass name="Piano" subname="Pno."');

  await rightHand.locator("select").selectOption("acoustic_grand_piano");

  await expect.poll(() => page.locator("#abc-draft").inputValue()).toContain(
    "%%score { RH | LH }",
  );
  await expect(page.locator('#score [data-name="brace"]').first()).toBeVisible();

  const restoredDraft = await page.locator("#abc-draft").inputValue();
  expect(restoredDraft).toContain('V:RH clef=treble name="Piano"');
  expect(restoredDraft).toContain("V:LH clef=bass");
  expect(restoredDraft).not.toContain("subname=");
});
