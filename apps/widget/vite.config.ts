import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const widgetRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: widgetRoot,
  build: {
    outDir: fileURLToPath(new URL("../../dist/v2-widget", import.meta.url)),
    emptyOutDir: true,
  },
});
