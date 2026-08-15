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
    expect(html).not.toContain('id="instrument-options"');
    expect(html).toContain('class="pause-glyph"');
    expect(html).toContain('<rect x="3" y="2.5" width="3.5" height="11" rx="1"');
    expect(html).not.toContain("Ⅱ");
    expect(main).toContain('instrumentInput.setAttribute("aria-controls", menuId)');
    expect(main).toContain('instrumentMenu.setAttribute("role", "listbox")');
    expect(main).toContain('option.setAttribute("role", "option")');
    expect(main).toContain('byId<HTMLButtonElement>("notice-dismiss").addEventListener');
  });

  it("pins transport and mixer together and removes the redundant fullscreen control", () => {
    expect(css).toMatch(/\.control-dock\s*\{[\s\S]*?position:\s*fixed;/);
    expect(html.indexOf('class="mixer"')).toBeGreaterThan(html.indexOf('class="transport"'));
    expect(css).toContain(".mixer[open]");
    expect(css).toContain("--abcoda-chat-clearance: 112px");
    expect(css).toMatch(/html\[data-display-mode="fullscreen"\] \.control-dock\s*\{/);
    expect(css).toContain('html[data-display-mode="fullscreen"] #fullscreen { display: none; }');
  });

  it("uses theme-aware custom checkbox and combobox presentation", () => {
    expect(css).toMatch(/\.mute-label input\s*\{[\s\S]*?appearance:\s*none;/);
    expect(css).toContain('.mute-label input:checked');
    expect(css).toContain(".instrument-menu");
    expect(css).toContain('.instrument-option[aria-selected="true"]');
  });
});
