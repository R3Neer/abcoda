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

const workspaces = {
  domain: {
    root: "packages/domain",
    packageName: "@abcoda/domain",
    internal: [] as const,
  },
  application: {
    root: "packages/application",
    packageName: "@abcoda/application",
    internal: ["domain"] as const,
  },
  "abc-codec": {
    root: "packages/abc-codec",
    packageName: "@abcoda/abc-codec",
    internal: ["application", "domain"] as const,
  },
  contracts: {
    root: "packages/contracts",
    packageName: "@abcoda/contracts",
    internal: [] as const,
  },
  composition: {
    root: "packages/composition",
    packageName: "@abcoda/composition",
    internal: [] as const,
  },
  widget: {
    root: "apps/widget",
    packageName: "@abcoda/widget",
    internal: ["application", "abc-codec", "contracts", "domain"] as const,
  },
  worker: {
    root: "apps/worker",
    packageName: "@abcoda/worker",
    internal: ["application", "abc-codec", "composition", "contracts", "domain"] as const,
  },
} as const;

type WorkspaceId = keyof typeof workspaces;

const packageWorkspaceIds: readonly WorkspaceId[] = [
  "domain",
  "application",
  "abc-codec",
  "contracts",
  "composition",
];

const allowedExternalDependencies: Readonly<Partial<Record<WorkspaceId, readonly string[]>>> = {
  domain: [],
  application: [],
  "abc-codec": [],
  contracts: ["zod/v4"],
  composition: ["zod/v4"],
};

function sourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [entryPath]
      : [];
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

function absoluteWorkspaceRoot(id: WorkspaceId): string {
  return path.join(repositoryRoot, workspaces[id].root);
}

function workspaceForPath(file: string): WorkspaceId | undefined {
  return (Object.keys(workspaces) as WorkspaceId[]).find((id) => {
    const root = absoluteWorkspaceRoot(id);
    return file === root || file.startsWith(`${root}${path.sep}`);
  });
}

function workspaceFromPublicSpecifier(specifier: string): WorkspaceId | undefined {
  return (Object.keys(workspaces) as WorkspaceId[]).find(
    (id) => specifier === workspaces[id].packageName,
  );
}

function workspaceFromRelativeSpecifier(file: string, specifier: string): WorkspaceId | undefined {
  if (!specifier.startsWith(".")) return undefined;
  return workspaceForPath(path.resolve(path.dirname(file), specifier));
}

function manifest(id: WorkspaceId): {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
} {
  return JSON.parse(
    fs.readFileSync(path.join(absoluteWorkspaceRoot(id), "package.json"), "utf8"),
  ) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };
}

function declaredDependency(id: WorkspaceId, packageName: string): boolean {
  const packageJson = manifest(id);
  return packageName in (packageJson.dependencies ?? {})
    || packageName in (packageJson.devDependencies ?? {});
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

describe("architecture v2 workspace boundaries", () => {
  const packageGraph = new Map<string, Set<string>>();
  const directionViolations: string[] = [];
  const privateBoundaryViolations: string[] = [];
  const manifestViolations: string[] = [];
  const externalViolations: string[] = [];

  for (const id of Object.keys(workspaces) as WorkspaceId[]) {
    if (packageWorkspaceIds.includes(id)) packageGraph.set(id, new Set<string>());
    const allowedInternal = new Set<WorkspaceId>(workspaces[id].internal);
    const allowedExternal = allowedExternalDependencies[id];
    const directory = path.join(absoluteWorkspaceRoot(id), "src");

    for (const file of sourceFiles(directory)) {
      for (const specifier of imports(file)) {
        const publicDependency = workspaceFromPublicSpecifier(specifier);
        const relativeDependency = workspaceFromRelativeSpecifier(file, specifier);
        const dependency = publicDependency ?? relativeDependency;

        if (relativeDependency && relativeDependency !== id) {
          privateBoundaryViolations.push(
            `${path.relative(repositoryRoot, file)} imports private ${specifier} from ${relativeDependency}`,
          );
        }

        if (dependency && dependency !== id) {
          if (!allowedInternal.has(dependency)) {
            directionViolations.push(
              `${id} -> ${dependency} (${path.relative(repositoryRoot, file)})`,
            );
          }
          if (packageWorkspaceIds.includes(id) && packageWorkspaceIds.includes(dependency)) {
            packageGraph.get(id)?.add(dependency);
          }
          if (publicDependency && !declaredDependency(id, workspaces[dependency].packageName)) {
            manifestViolations.push(
              `${id} uses ${workspaces[dependency].packageName} without declaring it`,
            );
          }
          continue;
        }

        if (
          packageWorkspaceIds.includes(id)
          && !specifier.startsWith(".")
          && !publicDependency
          && !(allowedExternal ?? []).includes(specifier)
        ) {
          externalViolations.push(
            `${id} -> ${specifier} (${path.relative(repositoryRoot, file)})`,
          );
        }
      }
    }
  }

  it("allows only workspace dependencies declared by the architecture", () => {
    expect(directionViolations).toEqual([]);
  });

  it("forbids reaching into another workspace through a relative private path", () => {
    expect(privateBoundaryViolations).toEqual([]);
  });

  it("requires public workspace imports to be declared in the consumer manifest", () => {
    expect(manifestViolations).toEqual([]);
  });

  it("keeps package external dependencies intentionally small", () => {
    expect(externalViolations).toEqual([]);
  });

  it("contains no package dependency cycles", () => {
    expect(findCycle(packageGraph)).toBeUndefined();
  });
});
