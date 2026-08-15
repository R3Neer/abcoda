import {
  evaluateScoreResultSchema,
  type ScoreSnapshotDto,
} from "../../../../packages/contracts/src/index";

export interface Engraver {
  render(abc: string, signal: AbortSignal): Promise<void>;
  clear(): void;
}

export type ScoreSessionState =
  | { readonly status: "booting" }
  | { readonly status: "loading"; readonly revision: number }
  | { readonly status: "ready"; readonly snapshot: ScoreSnapshotDto }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "failed"; readonly message: string };

export type StateListener = (state: ScoreSessionState) => void;

export class ScoreSessionController {
  private activeRevision = -1;
  private activeEffect: AbortController | undefined;

  constructor(
    private readonly engraver: Engraver,
    private readonly onState: StateListener,
  ) {
    this.onState({ status: "booting" });
  }

  async receive(input: unknown): Promise<void> {
    const parsed = evaluateScoreResultSchema.safeParse(input);
    if (!parsed.success) {
      this.activeEffect?.abort();
      this.engraver.clear();
      this.onState({
        status: "invalid",
        message: "The host supplied an invalid score snapshot.",
      });
      return;
    }

    if (parsed.data.status === "invalid") {
      this.activeEffect?.abort();
      this.engraver.clear();
      this.onState({
        status: "invalid",
        message: parsed.data.diagnostics?.map((diagnostic) => diagnostic.message).join(" ")
          ?? "The score is invalid.",
      });
      return;
    }

    const snapshot = parsed.data.snapshot;
    if (!snapshot) {
      this.engraver.clear();
      this.onState({ status: "invalid", message: "The score result has no snapshot." });
      return;
    }
    if (snapshot.revision < this.activeRevision) return;

    this.activeEffect?.abort();
    const effect = new AbortController();
    this.activeEffect = effect;
    this.activeRevision = snapshot.revision;
    this.onState({ status: "loading", revision: snapshot.revision });

    try {
      await this.engraver.render(snapshot.document.source.text, effect.signal);
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      this.onState({ status: "ready", snapshot });
    } catch (error) {
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      const message = error instanceof Error ? error.message : "The score could not be engraved.";
      this.engraver.clear();
      this.onState({ status: "failed", message });
    }
  }

  dispose(): void {
    this.activeEffect?.abort();
    this.activeEffect = undefined;
    this.engraver.clear();
  }
}
