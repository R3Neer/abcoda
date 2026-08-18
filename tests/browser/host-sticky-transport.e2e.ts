import { expect, test } from "@playwright/test";

test("host max height keeps the transport docked while ABCoda scrolls internally", async ({ page }) => {
  await page.goto("/?scenario=ranges&theme=light&maxHeight=420");
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("html")).toHaveAttribute("data-host-height", "max");

  const shell = page.locator(".shell");
  const transport = page.locator(".transport");
  await expect(shell).toHaveCSS("max-height", "420px");
  await expect(transport).toHaveCSS("position", "sticky");

  const mixer = page.locator("#mixer");
  await mixer.locator(":scope > summary").click();
  const editor = page.locator("#editor");
  await editor.locator(":scope > summary").click();
  await expect(editor).toHaveAttribute("open", "");
  await expect(transport).toHaveCSS("position", "sticky");

  const dimensions = await shell.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

  await shell.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(50);

  const [shellBox, transportBox] = await Promise.all([
    shell.boundingBox(),
    transport.boundingBox(),
  ]);
  expect(shellBox).not.toBeNull();
  expect(transportBox).not.toBeNull();

  const bottomGap = shellBox!.y + shellBox!.height
    - (transportBox!.y + transportBox!.height);
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(bottomGap).toBeLessThanOrEqual(24);
});
