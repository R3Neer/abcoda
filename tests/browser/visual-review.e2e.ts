import { test } from "@playwright/test";
import {
  captureVisualReview,
  openMixer,
  settleWidget,
} from "./helpers/visual-review";

for (const theme of ["light", "dark"] as const) {
  test(`captures the ready widget in ${theme} theme for visual review`, async ({ page }, testInfo) => {
    await page.goto(`/?scenario=ready&theme=${theme}`);
    await settleWidget(page, "Revision 1 ready");
    const mixer = await openMixer(page);
    await captureVisualReview(
      page,
      testInfo,
      `ready-${theme}-viewport-${testInfo.project.name}`,
    );
    await captureVisualReview(
      page,
      testInfo,
      `ready-${theme}-mixer-${testInfo.project.name}`,
      mixer,
    );
  });
}

test("captures pitched and percussion controls together for visual review", async ({ page }, testInfo) => {
  await page.goto("/?scenario=mixed&theme=light");
  await settleWidget(page, "Revision 1 ready");
  const mixer = await openMixer(page);
  await captureVisualReview(
    page,
    testInfo,
    `mixed-light-viewport-${testInfo.project.name}`,
  );
  await captureVisualReview(
    page,
    testInfo,
    `mixed-light-mixer-${testInfo.project.name}`,
    mixer,
  );
});

test("captures usual, extended, and unplayable instrument ranges for visual review", async ({ page }, testInfo) => {
  await page.goto("/?scenario=ranges&theme=light");
  await settleWidget(page, "Revision 1 ready");
  const mixer = await openMixer(page);
  await captureVisualReview(
    page,
    testInfo,
    `ranges-light-viewport-${testInfo.project.name}`,
  );
  await captureVisualReview(
    page,
    testInfo,
    `ranges-light-mixer-${testInfo.project.name}`,
    mixer,
  );
});
