import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const widgetRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: widgetRoot,
  plugins: [viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL("../../dist/widget", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
  },
});
