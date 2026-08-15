import { App } from "@modelcontextprotocol/ext-apps";
import type {
  HostBridge,
  HostBridgeHandlers,
} from "../../application/host-bridge";

export class McpAppsHostBridge implements HostBridge {
  private readonly app = new App(
    { name: "ABCoda score", version: "0.13.0-alpha.1" },
    {},
    { strict: true },
  );

  async connect(handlers: HostBridgeHandlers): Promise<void> {
    this.app.ontoolresult = (params) => handlers.onResult(params.structuredContent);
    this.app.onteardown = () => {
      handlers.onTeardown();
      return {};
    };
    await this.app.connect();
  }

  async disconnect(): Promise<void> {
    this.app.ontoolresult = undefined;
    this.app.onteardown = undefined;
    await this.app.close();
  }
}
