export interface HostBridgeHandlers {
  readonly onResult: (result: unknown) => void;
  readonly onContext: (context: HostPresentationContext) => void;
  readonly onTeardown: () => void;
}

export interface HostContainerDimensions {
  readonly height?: number;
  readonly maxHeight?: number;
  readonly width?: number;
  readonly maxWidth?: number;
}

export interface HostPresentationContext {
  readonly theme?: "light" | "dark";
  readonly displayMode?: "inline" | "fullscreen" | "pip";
  readonly containerDimensions?: HostContainerDimensions;
  readonly safeAreaInsets?: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
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
    private readonly onContext: (context: HostPresentationContext) => void = () => undefined,
    private readonly onResult: (result: unknown) => void = () => undefined,
  ) {}

  async start(): Promise<void> {
    await this.host.connect({
      onResult: (result) => {
        if (this.sessionDisposed) return;
        this.onResult(result);
        void this.session.receive(result);
      },
      onContext: this.onContext,
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
