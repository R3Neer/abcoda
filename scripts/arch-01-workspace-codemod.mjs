import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const workspaces = {
  domain: { root: "packages/domain", packageName: "@abcoda/domain" },
  application: { root: "packages/application", packageName: "@abcoda/application" },
  "abc-codec": { root: "packages/abc-codec", packageName: "@abcoda/abc-codec" },
  contracts: { root: "packages/contracts", packageName: "@abcoda/contracts" },
  composition: { root: "packages/composition", packageName: "@abcoda/composition" },
  widget: { root: "apps/widget", packageName: "@abcoda/widget" },
  worker: { root: "apps/worker", packageName: "@abcoda/worker" },
};

const dependencies = {
  application: {
    "@abcoda/domain": "0.0.0",
  },
  "abc-codec": {
    "@abcoda/application": "0.0.0",
    "@abcoda/domain": "0.0.0",
  },
  contracts: {
    zod: "^4.1.13",
  },
  composition: {
    zod: "^4.1.13",
  },
  widget: {
    "@abcoda/abc-codec": "0.0.0",
    "@abcoda/application": "0.0.0",
    "@abcoda/contracts": "0.0.0",
    "@abcoda/domain": "0.0.0",
    "@modelcontextprotocol/ext-apps": "^1.0.1",
    abcjs: "^6.5.2",
  },
  worker: {
    "@abcoda/abc-codec": "0.0.0",
    "@abcoda/application": "0.0.0",
    "@abcoda/composition": "0.0.0",
    "@abcoda/contracts": "0.0.0",
    "@abcoda/domain": "0.0.0",
    "@modelcontextprotocol/ext-apps": "^1.0.1",
    "@modelcontextprotocol/sdk": "^1.20.2",
  },
};

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [entryPath]
      : [];
  });
}

function workspaceForPath(file) {
  for (const [id, workspace] of Object.entries(workspaces)) {
    const workspaceRoot = path.join(root, workspace.root);
    if (file === workspaceRoot || file.startsWith(`${workspaceRoot}${path.sep}`)) return id;
  }
  return undefined;
}

function publicPackageForResolvedPath(resolved) {
  for (const [id, workspace] of Object.entries(workspaces)) {
    if (!workspace.root.startsWith("packages/")) continue;
    const workspaceRoot = path.join(root, workspace.root);
    const publicEntry = path.join(workspaceRoot, "src", "index");
    const normalized = resolved.replace(/\.(?:ts|js)$/, "");
    if (normalized === publicEntry || normalized === `${publicEntry}${path.sep}`) {
      return { id, packageName: workspace.packageName };
    }
  }
  return undefined;
}

let rewrittenImports = 0;
for (const workspace of Object.values(workspaces)) {
  const sourceRoot = path.join(root, workspace.root, "src");
  if (!fs.existsSync(sourceRoot)) continue;
  for (const file of filesUnder(sourceRoot)) {
    const owner = workspaceForPath(file);
    const original = fs.readFileSync(file, "utf8");
    const rewritten = original.replace(
      /(["'])(\.\.?(?:\/[^"']+)+)\1/g,
      (match, quote, specifier) => {
        const target = publicPackageForResolvedPath(path.resolve(path.dirname(file), specifier));
        if (!target || target.id === owner) return match;
        rewrittenImports += 1;
        return `${quote}${target.packageName}${quote}`;
      },
    );
    if (rewritten !== original) fs.writeFileSync(file, rewritten);
  }
}

for (const [id, declared] of Object.entries(dependencies)) {
  const packagePath = path.join(root, workspaces[id].root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...declared,
  };
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

console.log(`Rewrote ${rewrittenImports} cross-workspace private imports.`);
if (rewrittenImports !== 30) {
  throw new Error(`Expected to rewrite the 30 characterized imports, rewrote ${rewrittenImports}.`);
}
