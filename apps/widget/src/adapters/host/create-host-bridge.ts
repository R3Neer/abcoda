import type { HostBridge } from "../../application/host-bridge";
import { McpAppsHostBridge } from "./mcp-apps-host-bridge";
import { StandaloneHostBridge } from "./standalone-host-bridge";

export function createHostBridge(windowObject: Window = window): HostBridge {
  const standalone = windowObject.parent === windowObject
    || new URLSearchParams(windowObject.location.search).has("demo");
  return standalone ? new StandaloneHostBridge() : new McpAppsHostBridge();
}
