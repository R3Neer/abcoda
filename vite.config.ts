import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "web",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../dist/widget",
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
  },
});
