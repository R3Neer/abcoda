import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const MIB = 1024 * 1024;
const budgets = {
  widgetRaw: 1.1 * MIB,
  widgetGzip: 300 * 1024,
  workerRaw: 1.6 * MIB,
  workerGzip: 300 * 1024,
};

const [widget, worker] = await Promise.all([
  readFile(new URL("../dist/widget/index.html", import.meta.url)),
  readFile(new URL("../dist/worker/index.js", import.meta.url)),
]);
const widgetText = widget.toString("utf8");
const workerText = worker.toString("utf8");
const metrics = {
  widgetRaw: widget.byteLength,
  widgetGzip: gzipSync(widget).byteLength,
  workerRaw: worker.byteLength,
  workerGzip: gzipSync(worker).byteLength,
};

for (const [name, size] of Object.entries(metrics)) {
  const budget = budgets[name];
  if (size > budget) throw new Error(`${name} is ${size} bytes; budget is ${budget} bytes.`);
}

for (const forbidden of ["SynthController", "renderAbc"]) {
  if (workerText.includes(forbidden)) {
    throw new Error(`Worker bundle contains forbidden browser dependency marker ${forbidden}.`);
  }
}

const serverSourceRoots = [
  new URL("../apps/worker/src/", import.meta.url),
  new URL("../packages/", import.meta.url),
];
const abcjsImport = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']abcjs(?:\/[^"']*)?["']/;
for (const root of serverSourceRoots) {
  for (const file of await sourceFiles(root)) {
    const source = await readFile(file, "utf8");
    if (abcjsImport.test(source)) {
      throw new Error(`Server source graph imports forbidden browser dependency abcjs in ${file.pathname}.`);
    }
  }
}

if (/<script\b[^>]*\bsrc\s*=/i.test(widgetText)) {
  throw new Error("Widget HTML references an external script instead of being self-contained.");
}
if (/<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i.test(widgetText)) {
  throw new Error("Widget HTML references an external stylesheet instead of being self-contained.");
}

const report = {
  artifactHash: createHash("sha256").update(widget).digest("hex"),
  metrics,
  budgets,
  workerBrowserMarkers: "absent",
  widgetPackaging: "single-html",
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [url] : [];
  }));
  return nested.flat();
}
