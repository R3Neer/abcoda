export interface HostBridgeHandlers {
  readonly onResult: (result: unknown) => void;
  readonly onTeardown: () => void;
}

export interface HostBridge {
  connect(handlers: HostBridgeHandlers): Promise<void>;
  disconnect(): Promise<void>;
}

export interface ScoreSession {
  receive(input: unknown): Promise<void>;
  dispose(): void;
}

export class WidgetRuntime {
  private connected = false;
  private sessionDisposed = false;

  constructor(
    private readonly session: ScoreSession,
    private readonly host: HostBridge,
  ) {}

  async start(): Promise<void> {
    await this.host.connect({
      onResult: (result) => {
        if (this.sessionDisposed) return;
        void this.session.receive(result);
      },
      onTeardown: () => this.disposeSession(),
    });
    this.connected = true;
  }

  async dispose(): Promise<void> {
    this.disposeSession();
    if (!this.connected) return;
    this.connected = false;
    await this.host.disconnect();
  }

  private disposeSession(): void {
    if (this.sessionDisposed) return;
    this.sessionDisposed = true;
    this.session.dispose();
  }
}
