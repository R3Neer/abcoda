import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const theme = readFileSync(
  new URL("../../apps/widget/src/styles/openai-theme.css", import.meta.url),
  "utf8",
);
const widgetEntry = readFileSync(
  new URL("../../apps/widget/src/main.ts", import.meta.url),
  "utf8",
);

describe("OpenAI Apps SDK UI theme integration", () => {
  it("maps ABCoda semantic aliases to the OpenAI token contract", () => {
    expect(theme).toContain("@openai/apps-sdk-ui v0.2.2");

    for (const token of [
      "--color-text",
      "--color-text-secondary",
      "--color-ring",
      "--color-surface",
      "--color-surface-secondary",
      "--color-surface-elevated",
      "--color-border",
      "--color-background-primary-soft",
      "--color-background-primary-solid",
      "--color-text-danger",
      "--color-text-warning",
      "--font-sans",
      "--font-mono",
    ]) {
      expect(theme).toContain(token);
    }

    expect(theme).toContain("--accent: var(--color-ring)");
    expect(theme).toContain("--control-bg: var(--color-background-primary-soft)");
    expect(theme).toContain("--danger: var(--color-text-danger)");
    expect(theme).toContain("--range-extended: var(--color-text-warning)");
  });

  it("loads the OpenAI theme after the widget's structural styles", () => {
    const baseIndex = widgetEntry.indexOf('import "./styles/index.css"');
    const rangesIndex = widgetEntry.indexOf('import "./styles/ranges.css"');
    const openAiIndex = widgetEntry.indexOf('import "./styles/openai-theme.css"');

    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(rangesIndex).toBeGreaterThan(baseIndex);
    expect(openAiIndex).toBeGreaterThan(rangesIndex);
  });
});
