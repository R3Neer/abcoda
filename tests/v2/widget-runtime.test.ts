import { describe, expect, it, vi } from "vitest";
import type {
  HostBridge,
  HostBridgeHandlers,
  ScoreSession,
} from "../../apps/widget/src/application/host-bridge";
import { WidgetRuntime } from "../../apps/widget/src/application/host-bridge";

class FakeHostBridge implements HostBridge {
  handlers: HostBridgeHandlers | undefined;
  readonly disconnect = vi.fn(() => Promise.resolve());

  connect(handlers: HostBridgeHandlers): Promise<void> {
    this.handlers = handlers;
    return Promise.resolve();
  }
}

describe("WidgetRuntime", () => {
  it("routes host results through the session port and owns teardown", async () => {
    const host = new FakeHostBridge();
    const receive = vi.fn(() => Promise.resolve());
    const dispose = vi.fn();
    const session: ScoreSession = {
      receive,
      dispose,
    };
    const observeResult = vi.fn();
    const runtime = new WidgetRuntime(session, host, () => undefined, observeResult);

    await runtime.start();
    const result = { status: "success", snapshot: { revision: 4 } };
    host.handlers?.onResult(result);
    host.handlers?.onContext({ theme: "dark", displayMode: "inline" });
    host.handlers?.onTeardown();
    await runtime.dispose();

    expect(receive).toHaveBeenCalledWith(result);
    expect(observeResult).toHaveBeenCalledWith(result);
    expect(dispose).toHaveBeenCalledOnce();
    expect(host.disconnect).toHaveBeenCalledOnce();
  });

  it("forwards neutral host presentation context without exposing the MCP SDK", async () => {
    const host = new FakeHostBridge();
    const contextListener = vi.fn();
    const runtime = new WidgetRuntime({
      receive: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(),
    }, host, contextListener);

    await runtime.start();
    host.handlers?.onContext({ theme: "light", displayMode: "fullscreen" });

    expect(contextListener).toHaveBeenCalledWith({ theme: "light", displayMode: "fullscreen" });
  });

  it("does not disconnect a bridge whose connection failed", async () => {
    const disconnect = vi.fn(() => Promise.resolve());
    const host: HostBridge = {
      connect: () => Promise.reject(new Error("host unavailable")),
      disconnect,
    };
    const dispose = vi.fn();
    const session: ScoreSession = {
      receive: vi.fn(() => Promise.resolve()),
      dispose,
    };
    const runtime = new WidgetRuntime(session, host);

    await expect(runtime.start()).rejects.toThrow("host unavailable");
    await runtime.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
