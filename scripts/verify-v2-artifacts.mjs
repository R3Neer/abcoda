import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const MIB = 1024 * 1024;
const budgets = {
  widgetRaw: 1.1 * MIB,
  widgetGzip: 300 * 1024,
  workerRaw: 1.6 * MIB,
  workerGzip: 300 * 1024,
};

const [widget, worker] = await Promise.all([
  readFile(new URL("../dist/v2-widget/index.html", import.meta.url)),
  readFile(new URL("../dist/v2-worker/index.js", import.meta.url)),
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

for (const forbidden of ["SynthController", "renderAbc", "abcjs"]) {
  if (workerText.includes(forbidden)) {
    throw new Error(`Worker bundle contains forbidden browser dependency marker ${forbidden}.`);
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
