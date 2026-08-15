import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("widget editing controls", () => {
  const html = fs.readFileSync(new URL("../web/index.html", import.meta.url), "utf8");

  it("exposes score/code toggle, editor actions, and transposition controls", () => {
    for (const id of [
      "code-toggle", "abc-panel", "abc-source", "abc-copy", "abc-reset", "abc-apply",
      "transpose-down", "transpose-output", "transpose-up", "transpose-reset",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('id="abc-panel" class="abc-panel" aria-label="ABC source editor" hidden');
  });
});
