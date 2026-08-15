import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

describe("widget composition root architecture", () => {
  it("keeps session state and reflow policy out of main.ts", () => {
    const main = source("apps/widget/src/main.ts");

    expect(main).toContain("WidgetSessionCoordinator");
    expect(main).not.toMatch(/\blet\s+/);
    expect(main).not.toContain("setTimeout");
    expect(main).not.toContain("PlaybackSessionController");
    expect(main).not.toContain("ScoreSessionController");
    expect(main).not.toContain("VoiceMixController");
    expect(main).not.toContain("DraftSessionController");
    expect(main).not.toContain("PlaybackMixCoordinator");
    expect(main).not.toContain("scoreStaffWidth");
    expect(main).not.toContain("assessVoiceRanges");
  });

  it("keeps the coordinator independent of DOM and abcjs adapters", () => {
    const coordinator = source(
      "apps/widget/src/application/widget-session-coordinator.ts",
    );

    expect(coordinator).not.toContain("abcjs");
    expect(coordinator).not.toContain("DomWidgetView");
    expect(coordinator).not.toContain("AbcjsEngraver");
    expect(coordinator).not.toContain("ResizeObserver");
    expect(coordinator).not.toContain("document.");
    expect(coordinator).not.toContain("window.");
    expect(coordinator).not.toContain("../adapters/");
  });
});
