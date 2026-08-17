import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/v2/**/*.test.ts"],
    exclude: [...configDefaults.exclude],
  },
});
