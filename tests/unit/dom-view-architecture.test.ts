import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("DOM view architecture", () => {
  it("keeps DomWidgetView as a facade over cohesive subviews", () => {
    const facade = source("apps/widget/src/adapters/dom/dom-widget-view.ts");
    expect(facade).toContain("WidgetShellView");
    expect(facade).toContain("TransportView");
    expect(facade).toContain("MixerView");
    expect(facade).toContain("EditorView");
    expect(facade).not.toContain("createElement(");
    expect(facade).not.toContain("addEventListener(");
    expect(facade).not.toContain("setTimeout(");
  });

  it("keeps transport independent of draft and musical policy", () => {
    const transport = source("apps/widget/src/adapters/dom/transport-view.ts");
    expect(transport).not.toContain("draft-session");
    expect(transport).not.toContain("voice-mix");
    expect(transport).not.toContain("@abcoda/domain");
    expect(transport).not.toContain("abcjs");
  });

  it("keeps editor independent of playback, mix, and musical policy", () => {
    const editor = source("apps/widget/src/adapters/dom/editor-view.ts");
    expect(editor).not.toContain("playback-session");
    expect(editor).not.toContain("voice-mix");
    expect(editor).not.toContain("@abcoda/domain");
    expect(editor).not.toContain("abcjs");
  });

  it("keeps mixer from reimplementing range classification", () => {
    const mixer = source("apps/widget/src/adapters/dom/mixer-view.ts");
    expect(mixer).not.toContain("playback-session");
    expect(mixer).not.toContain("draft-session");
    expect(mixer).not.toContain("classifyInstrumentPitch");
    expect(mixer).not.toContain("assessInstrumentRange");
    expect(mixer).not.toContain("abcjs");
  });
});
