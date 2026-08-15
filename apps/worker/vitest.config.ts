import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./apps/worker/wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["tests/worker/**/*.test.ts"],
  },
});
