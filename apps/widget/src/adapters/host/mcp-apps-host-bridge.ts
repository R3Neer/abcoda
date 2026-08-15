import { App } from "@modelcontextprotocol/ext-apps";
import type {
  HostBridge,
  HostBridgeHandlers,
  HostPresentationContext,
} from "../../application/host-bridge";

function presentationContext(context: ReturnType<App["getHostContext"]>): HostPresentationContext {
  if (!context) return {};
  return {
    ...(context.theme === undefined ? {} : { theme: context.theme }),
    ...(context.displayMode === undefined ? {} : { displayMode: context.displayMode }),
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
