import type { HostBridge } from "../../application/host-bridge";
import { McpAppsHostBridge } from "./mcp-apps-host-bridge";
import { StandaloneHostBridge } from "./standalone-host-bridge";
import type { LaboratoryScenario } from "./standalone-host-bridge";

const scenarios = new Set<LaboratoryScenario>(["ready", "invalid", "malformed", "race"]);

export function createHostBridge(windowObject: Window = window): HostBridge {
  const standalone = windowObject.parent === windowObject
    || new URLSearchParams(windowObject.location.search).has("demo");
  if (!standalone) return new McpAppsHostBridge();

  const requested = new URLSearchParams(windowObject.location.search).get("scenario");
  const scenario = requested !== null && scenarios.has(requested as LaboratoryScenario)
    ? requested as LaboratoryScenario
    : "ready";
  return new StandaloneHostBridge(scenario);
}
