import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  abcjsSynthCapability,
  safeSynthPitch,
  synthSupportsPitch,
} from "../../apps/widget/src/adapters/abcjs/abcjs-synth-capability";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("abcjs synth capability profile", () => {
  it("matches the characterized FluidR3_GM sample boundaries", () => {
    expect(synthSupportsPitch("pitched", 20)).toBe(false);
    expect(synthSupportsPitch("pitched", 21)).toBe(true);
    expect(synthSupportsPitch("pitched", 108)).toBe(true);
    expect(synthSupportsPitch("pitched", 109)).toBe(false);

    expect(synthSupportsPitch("unpitched_percussion", 27)).toBe(false);
    expect(synthSupportsPitch("unpitched_percussion", 28)).toBe(true);
    expect(synthSupportsPitch("unpitched_percussion", 87)).toBe(true);
    expect(synthSupportsPitch("unpitched_percussion", 88)).toBe(false);
  });

  it("uses safe samples inside each characterized backend range", () => {
    const melodic = safeSynthPitch("pitched");
    const percussion = safeSynthPitch("unpitched_percussion");

    expect(melodic).toBe(60);
    expect(percussion).toBe(36);
    expect(synthSupportsPitch("pitched", melodic)).toBe(true);
    expect(synthSupportsPitch("unpitched_percussion", percussion)).toBe(true);
  });

  it("forces re-characterization when the installed abcjs version changes", () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
    ) as { packages?: Record<string, { version?: string }> };

    expect(lock.packages?.["node_modules/abcjs"]?.version).toBe(
      abcjsSynthCapability.abcjsVersion,
    );
  });
});
