import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface WranglerWorkerConfig {
  readonly main?: string;
  readonly assets?: {
    readonly binding?: string;
    readonly run_worker_first?: boolean | readonly string[];
  };
}

function readWorkerConfig(): WranglerWorkerConfig {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "apps/worker/wrangler.jsonc"), "utf8"),
  ) as WranglerWorkerConfig;
}

describe("Worker routing configuration", () => {
  it("routes every public request through the Worker before the asset binding", () => {
    const config = readWorkerConfig();

    expect(config.main).toBe("src/index.ts");
    expect(config.assets?.binding).toBe("ASSETS");
    expect(config.assets?.run_worker_first).toBe(true);
  });
});
