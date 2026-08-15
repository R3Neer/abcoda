import type { HostBridge } from "../../application/host-bridge";
import { McpAppsHostBridge } from "./mcp-apps-host-bridge";
import { StandaloneHostBridge } from "./standalone-host-bridge";
import type { LaboratoryScenario } from "./standalone-host-bridge";

const scenarios = new Set<LaboratoryScenario>([
  "ready",
  "mixed",
  "invalid",
  "malformed",
  "race",
  "invalid-after-ready",
]);

export function createHostBridge(windowObject: Window = window): HostBridge {
  const standalone = windowObject.parent === windowObject
    || new URLSearchParams(windowObject.location.search).has("demo");
  if (!standalone) return new McpAppsHostBridge();

  const requested = new URLSearchParams(windowObject.location.search).get("scenario");
  const scenario = requested !== null && scenarios.has(requested as LaboratoryScenario)
    ? requested as LaboratoryScenario
    : "ready";
  const requestedTheme = new URLSearchParams(windowObject.location.search).get("theme");
  const theme = requestedTheme === "light" || requestedTheme === "dark"
    ? requestedTheme
    : windowObject.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const safeAreaInsets = {
    top: nonNegativeNumber(windowObject, "safeTop"),
    right: nonNegativeNumber(windowObject, "safeRight"),
    bottom: nonNegativeNumber(windowObject, "safeBottom"),
    left: nonNegativeNumber(windowObject, "safeLeft"),
  };
  return new StandaloneHostBridge(scenario, {
    theme,
    displayMode: "inline",
    safeAreaInsets,
  });
}

function nonNegativeNumber(windowObject: Window, name: string): number {
  const value = Number(new URLSearchParams(windowObject.location.search).get(name) ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
