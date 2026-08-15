import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export async function settleWidget(
  page: Page,
  expectedStatus: string | RegExp = /Revision \d+ ready/,
): Promise<void> {
  await expect(page.locator("body")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#status")).toHaveText(expectedStatus);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

export async function openMixer(page: Page): Promise<Locator> {
  const mixer = page.locator("#mixer");
  await expect(mixer).toBeVisible();
  if ((await mixer.getAttribute("open")) === null) {
    await mixer.locator("summary").click();
  }
  await expect(mixer).toHaveAttribute("open", "");
  return mixer;
}

export async function stabilizeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

export async function captureVisualReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
  target: Locator = page.locator(".shell"),
): Promise<void> {
  await stabilizeVisuals(page);
  const path = testInfo.outputPath("visual-review", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await target.screenshot({
    path,
    animations: "disabled",
  });
  await testInfo.attach(name, {
    path,
    contentType: "image/png",
  });
}
