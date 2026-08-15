import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "packages/composition/src/index.ts");
const source = fs.readFileSync(sourcePath, "utf8");

function uniqueIndex(marker) {
  const first = source.indexOf(marker);
  if (first < 0) throw new Error(`Missing marker: ${marker}`);
  if (source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`Marker is not unique: ${marker}`);
  }
  return first;
}

const schemaStart = uniqueIndex("export const styleFamilies = [");
const guidanceStart = uniqueIndex("const styleGuidance: Record<StyleFamily, string[]> = {");
const performanceStart = uniqueIndex("const difficultyRank: Record<CompositionBrief[\"difficulty\"], number> = {");
const reviewStart = uniqueIndex("const styleReviewGuidance: Record<StyleFamily, string[]> = {");
const plannerStart = uniqueIndex("function lengthGuidance(measures: number): string {");

if (!(schemaStart < guidanceStart && guidanceStart < performanceStart && performanceStart < reviewStart && reviewStart < plannerStart)) {
  throw new Error("Composition source markers are out of the characterized order.");
}

function exportTypeAliases(block) {
  return block.replace(
    /^type (StyleFamily|FormFamily|PitchFramework|RhythmicFeel|TextureModel|InstrumentFamily|CompositionEffort) =/gm,
    "export type $1 =",
  );
}

function exportTopLevelConsts(block) {
  return block.replace(/^const ([A-Za-z][A-Za-z0-9_]*)/gm, "export const $1");
}

function exportFunction(block, name) {
  return block.replace(new RegExp(`^function ${name}\\(`, "m"), `export function ${name}(`);
}

const schemaBlock = exportTypeAliases(source.slice(schemaStart, guidanceStart).trimEnd());
const guidanceBlock = exportTopLevelConsts(source.slice(guidanceStart, performanceStart).trimEnd());
let performanceBlock = source.slice(performanceStart, reviewStart).trimEnd();
performanceBlock = exportFunction(performanceBlock, "expressiveNotationGuidance");
performanceBlock = exportFunction(performanceBlock, "expressiveReviewGuidance");
const reviewBlock = exportTopLevelConsts(source.slice(reviewStart, plannerStart).trimEnd());
const plannerBlock = source.slice(plannerStart).trim();

const srcDir = path.join(root, "packages/composition/src");
const catalogsDir = path.join(srcDir, "catalogs");
fs.mkdirSync(catalogsDir, { recursive: true });

fs.writeFileSync(
  path.join(srcDir, "schema.ts"),
  `import { z } from "zod/v4";\n\n${schemaBlock}\n`,
);

fs.writeFileSync(
  path.join(catalogsDir, "guidance.ts"),
  `import type {\n  FormFamily,\n  InstrumentFamily,\n  PitchFramework,\n  RhythmicFeel,\n  StyleFamily,\n  TextureModel,\n} from "../schema.js";\n\n${guidanceBlock}\n`,
);

fs.writeFileSync(
  path.join(srcDir, "performance-policy.ts"),
  `import type { CompositionBrief, InstrumentFamily } from "./schema.js";\n\n${performanceBlock}\n`,
);

fs.writeFileSync(
  path.join(catalogsDir, "review.ts"),
  `import type {\n  CompositionBrief,\n  CompositionEffort,\n  FormFamily,\n  InstrumentFamily,\n  PitchFramework,\n  RhythmicFeel,\n  StyleFamily,\n  TextureModel,\n} from "../schema.js";\n\n${reviewBlock}\n`,
);

fs.writeFileSync(
  path.join(srcDir, "planner.ts"),
  `import {\n  formGuidance,\n  instrumentGuidance,\n  pitchGuidance,\n  rhythmGuidance,\n  styleGuidance,\n  textureGuidance,\n} from "./catalogs/guidance.js";\nimport {\n  difficultyGuidance,\n  effortReviewGuidance,\n  formReviewGuidance,\n  instrumentReviewGuidance,\n  intentGuidance,\n  pitchReviewGuidance,\n  rhythmReviewGuidance,\n  styleReviewGuidance,\n  textureReviewGuidance,\n} from "./catalogs/review.js";\nimport {\n  expressiveNotationGuidance,\n  expressiveReviewGuidance,\n} from "./performance-policy.js";\nimport type {\n  CompositionBrief,\n  CompositionPlanOutput,\n  PitchFramework,\n} from "./schema.js";\n\n${plannerBlock}\n`,
);

fs.writeFileSync(
  sourcePath,
  `export { abcodaComposerInstructions } from "./instructions.js";\nexport {\n  compositionBriefSchema,\n  compositionEffortLevels,\n  compositionIntents,\n  compositionPlanOutputSchema,\n  difficultyLevels,\n  formFamilies,\n  instrumentFamilies,\n  pitchFrameworks,\n  rhythmicFeels,\n  styleFamilies,\n  textureModels,\n  voiceRoles,\n} from "./schema.js";\nexport type { CompositionBrief, CompositionPlanOutput } from "./schema.js";\nexport { buildCompositionPlan } from "./planner.js";\n`,
);

console.log("Split composition knowledge into schema, catalogs, performance policy and planner modules.");
