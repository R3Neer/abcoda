import { expect, test } from "@playwright/test";

test("mobile mixer controls can scroll fully above the sticky transport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact sticky transport regression.");

  await page.goto("/?scenario=ranges&theme=light");
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");

  const mixer = page.locator("#mixer");
  await mixer.locator("summary").click();
  await expect(mixer).toHaveAttribute("open", "");

  const lastControl = mixer.locator(".voice-mix-row").last().locator(".transpose-stepper");
  const transport = page.locator(".transport");
  await expect(lastControl).toBeVisible();
  await expect(transport).toBeVisible();

  await lastControl.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));

  const [controlBox, transportBox] = await Promise.all([
    lastControl.boundingBox(),
    transport.boundingBox(),
  ]);
  expect(controlBox).not.toBeNull();
  expect(transportBox).not.toBeNull();

  const gap = transportBox!.y - (controlBox!.y + controlBox!.height);
  expect(gap).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
