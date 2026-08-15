import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("widget editing controls", () => {
  const html = fs.readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../web/src/main.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../web/src/style.css", import.meta.url), "utf8");

  it("exposes score/code toggle, editor actions, and transposition controls", () => {
    for (const id of [
      "code-toggle", "abc-panel", "abc-source", "abc-copy", "abc-reset", "abc-apply",
      "transpose-down", "transpose-output", "transpose-up", "transpose-reset",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('id="abc-panel" class="abc-panel" aria-label="ABC source editor" hidden');
  });

  it("uses accessible widget controls for notices, playback, and instrument search", () => {
    expect(html).toContain('id="notice-dismiss"');
    expect(html).toContain('id="instrument-options"');
    expect(html).toContain('class="pause-glyph"');
    expect(html).toContain('<rect x="3" y="2.5" width="3.5" height="11" rx="1"');
    expect(html).not.toContain("Ⅱ");
    expect(main).toContain('instrumentInput.setAttribute("list", "instrument-options")');
    expect(main).toContain('byId<HTMLButtonElement>("notice-dismiss").addEventListener');
  });

  it("pins transport to the viewport and removes the redundant fullscreen control", () => {
    expect(css).toMatch(/\.transport\s*\{[\s\S]*?position:\s*fixed;/);
    expect(css).toContain('html[data-display-mode="fullscreen"] #fullscreen { display: none; }');
  });
});
