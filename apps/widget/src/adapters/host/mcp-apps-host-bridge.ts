import { App } from "@modelcontextprotocol/ext-apps";
import type {
  HostBridge,
  HostBridgeHandlers,
  HostContainerDimensions,
  HostPresentationContext,
} from "../../application/host-bridge";

type McpHostContext = NonNullable<ReturnType<App["getHostContext"]>>;

function containerDimensions(
  dimensions: McpHostContext["containerDimensions"],
): HostContainerDimensions | undefined {
  if (!dimensions) return undefined;
  const result: {
    height?: number;
    maxHeight?: number;
    width?: number;
    maxWidth?: number;
  } = {};
  if ("height" in dimensions && typeof dimensions.height === "number") {
    result.height = dimensions.height;
  }
  if ("maxHeight" in dimensions && typeof dimensions.maxHeight === "number") {
    result.maxHeight = dimensions.maxHeight;
  }
  if ("width" in dimensions && typeof dimensions.width === "number") {
    result.width = dimensions.width;
  }
  if ("maxWidth" in dimensions && typeof dimensions.maxWidth === "number") {
    result.maxWidth = dimensions.maxWidth;
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

function presentationContext(context: ReturnType<App["getHostContext"]>): HostPresentationContext {
  if (!context) return {};
  const dimensions = containerDimensions(context.containerDimensions);
  return {
    ...(context.theme === undefined ? {} : { theme: context.theme }),
    ...(context.displayMode === undefined ? {} : { displayMode: context.displayMode }),
    ...(dimensions === undefined ? {} : { containerDimensions: dimensions }),
    ...(context.safeAreaInsets === undefined
      ? {}
      : { safeAreaInsets: context.safeAreaInsets }),
  };
}

export class McpAppsHostBridge implements HostBridge {
  private readonly app = new App(
    { name: "ABCoda score", version: "0.13.0-alpha.1" },
    {},
    { strict: true },
  );

  async connect(handlers: HostBridgeHandlers): Promise<void> {
    this.app.ontoolresult = (params) => handlers.onResult(params.structuredContent);
    this.app.onhostcontextchanged = (context) => {
      handlers.onContext(presentationContext(context));
    };
    this.app.onteardown = () => {
      handlers.onTeardown();
      return {};
    };
    await this.app.connect();
    handlers.onContext(presentationContext(this.app.getHostContext()));
  }

  async disconnect(): Promise<void> {
    this.app.ontoolresult = undefined;
    this.app.onhostcontextchanged = undefined;
    this.app.onteardown = undefined;
    await this.app.close();
  }
}
