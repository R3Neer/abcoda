import {
  evaluateScoreResultSchema,
  type ScorePresentationDto,
  type ScoreSnapshotDto,
} from "@abcoda/contracts";
import type { ScoreTimeline } from "./score-timeline";
import type { VoiceMixPlaybackSource } from "./voice-mix";

export interface EngravingResult {
  readonly playbackSource?: VoiceMixPlaybackSource;
  readonly timeline?: ScoreTimeline;
  readonly voicePitches?: Readonly<Record<string, readonly number[]>>;
}

export interface EngravingOptions {
  readonly includePlayback?: boolean;
}

export type EngravingReason = "content" | "reflow";

export interface Engraver {
  render(
    snapshot: ScoreSnapshotDto,
    presentation: ScorePresentationDto | undefined,
    signal: AbortSignal,
    options?: EngravingOptions,
  ): Promise<EngravingResult>;
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
  private activeSnapshot: ScoreSnapshotDto | undefined;
  private activePresentation: ScorePresentationDto | undefined;

  constructor(
    private readonly engraver: Engraver,
    private readonly onState: StateListener,
    private readonly onEngraved: (
      snapshot: ScoreSnapshotDto,
      result: EngravingResult,
      presentation: ScorePresentationDto | undefined,
      reason: EngravingReason,
    ) => void = () => undefined,
  ) {
    this.onState({ status: "booting" });
  }

  async receive(input: unknown): Promise<void> {
    const parsed = evaluateScoreResultSchema.safeParse(input);
    if (!parsed.success) {
      this.activeEffect?.abort();
      this.activeSnapshot = undefined;
      this.activePresentation = undefined;
      this.engraver.clear();
      this.onState({
        status: "invalid",
        message: "The host supplied an invalid score snapshot.",
      });
      return;
    }

    if (parsed.data.status === "invalid") {
      this.activeEffect?.abort();
      this.activeSnapshot = undefined;
      this.activePresentation = undefined;
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
      this.activeSnapshot = undefined;
      this.activePresentation = undefined;
      this.engraver.clear();
      this.onState({ status: "invalid", message: "The score result has no snapshot." });
      return;
    }
    if (snapshot.revision < this.activeRevision) return;

    this.activeEffect?.abort();
    const effect = new AbortController();
    this.activeEffect = effect;
    this.activeRevision = snapshot.revision;
    this.activeSnapshot = snapshot;
    this.activePresentation = parsed.data.presentation;
    this.onState({ status: "loading", revision: snapshot.revision });

    try {
      const result = await this.engraver.render(snapshot, parsed.data.presentation, effect.signal);
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      this.onEngraved(snapshot, result, parsed.data.presentation, "content");
      this.onState({ status: "ready", snapshot });
    } catch (error) {
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      const message = error instanceof Error ? error.message : "The score could not be engraved.";
      this.engraver.clear();
      this.onState({ status: "failed", message });
    }
  }

  async reflow(): Promise<void> {
    const snapshot = this.activeSnapshot;
    if (!snapshot) return;
    this.activeEffect?.abort();
    const effect = new AbortController();
    this.activeEffect = effect;
    try {
      const result = await this.engraver.render(
        snapshot,
        this.activePresentation,
        effect.signal,
        { includePlayback: false },
      );
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      this.onEngraved(snapshot, result, this.activePresentation, "reflow");
      this.onState({ status: "ready", snapshot });
    } catch (error) {
      if (effect.signal.aborted || snapshot.revision !== this.activeRevision) return;
      const message = error instanceof Error ? error.message : "The score could not be reflowed.";
      this.engraver.clear();
      this.onState({ status: "failed", message });
    }
  }

  dispose(): void {
    this.activeEffect?.abort();
    this.activeEffect = undefined;
    this.activeSnapshot = undefined;
    this.activePresentation = undefined;
    this.engraver.clear();
  }
}
