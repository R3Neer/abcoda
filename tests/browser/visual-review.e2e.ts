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
    await openMixer(page);
    await captureVisualReview(
      page,
      testInfo,
      `ready-${theme}-${testInfo.project.name}`,
    );
  });
}

test("captures pitched and percussion controls together for visual review", async ({ page }, testInfo) => {
  await page.goto("/?scenario=mixed&theme=light");
  await settleWidget(page, "Revision 1 ready");
  await openMixer(page);
  await captureVisualReview(
    page,
    testInfo,
    `mixed-light-${testInfo.project.name}`,
  );
});
