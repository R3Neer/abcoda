import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ScriptKind,
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isImportDeclaration,
  isStringLiteral,
} from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const packagesRoot = path.join(repositoryRoot, "packages");

const allowedInternalDependencies: Readonly<Record<string, readonly string[]>> = {
  domain: [],
  application: ["domain"],
  "abc-codec": ["application", "domain"],
  contracts: [],
};

const allowedExternalDependencies: Readonly<Record<string, readonly string[]>> = {
  domain: [],
  application: [],
  "abc-codec": [],
  contracts: ["zod/v4"],
};

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function imports(file: string): string[] {
  const source = createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ScriptTarget.Latest,
    true,
    ScriptKind.TS,
  );
  const result: string[] = [];
  forEachChild(source, (node) => {
    if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
      result.push(node.moduleSpecifier.text);
    }
  });
  return result;
}

function internalPackage(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("@abcoda/")) return specifier.slice("@abcoda/".length).split("/")[0];
  if (!specifier.startsWith(".")) return undefined;

  const resolved = path.resolve(path.dirname(file), specifier);
  return Object.keys(allowedInternalDependencies).find((packageName) => {
    const packagePath = path.join(packagesRoot, packageName);
    return resolved === packagePath || resolved.startsWith(`${packagePath}${path.sep}`);
  });
}

function findCycle(graph: ReadonlyMap<string, ReadonlySet<string>>): string[] | undefined {
  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (node: string, trail: readonly string[]): string[] | undefined => {
    if (active.has(node)) return [...trail, node];
    if (visited.has(node)) return undefined;
    visited.add(node);
    active.add(node);
    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency, [...trail, node]);
      if (cycle) return cycle;
    }
    active.delete(node);
    return undefined;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node, []);
    if (cycle) return cycle;
  }
  return undefined;
}

describe("architecture v2 dependency boundaries", () => {
  const graph = new Map<string, Set<string>>();
  const violations: string[] = [];

  for (const [packageName, allowedInternal] of Object.entries(allowedInternalDependencies)) {
    const dependencies = new Set<string>();
    graph.set(packageName, dependencies);
    const allowedExternal = allowedExternalDependencies[packageName] ?? [];
    const directory = path.join(packagesRoot, packageName, "src");

    for (const file of sourceFiles(directory)) {
      for (const specifier of imports(file)) {
        const dependency = internalPackage(file, specifier);
        if (dependency) {
          dependencies.add(dependency);
          if (dependency !== packageName && !allowedInternal.includes(dependency)) {
            violations.push(`${packageName} -> ${dependency} (${path.relative(repositoryRoot, file)})`);
          }
        } else if (!specifier.startsWith(".") && !allowedExternal.includes(specifier)) {
          violations.push(`${packageName} -> ${specifier} (${path.relative(repositoryRoot, file)})`);
        }
      }
    }
  }

  it("allows only dependencies that point toward the domain", () => {
    expect(violations).toEqual([]);
  });

  it("contains no package dependency cycles", () => {
    expect(findCycle(graph)).toBeUndefined();
  });
});
