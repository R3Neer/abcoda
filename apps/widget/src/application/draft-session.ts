import type {
  EvaluateScoreResultDto,
  ScoreSnapshotDto,
} from "../../../../packages/contracts/src/index";

type ScoreDiagnosticDto = NonNullable<EvaluateScoreResultDto["diagnostics"]>[number];

export interface DraftEvaluator {
  evaluate(abc: string, revision: number, signal: AbortSignal): Promise<EvaluateScoreResultDto>;
}

export interface DraftTransformer {
  transpose(abc: string, semitones: number): string;
}

export interface DraftVersion {
  readonly id: string;
  readonly label: string;
  readonly status: "original" | "valid" | "invalid";
  readonly abc: string;
  readonly snapshot?: ScoreSnapshotDto;
  readonly diagnostics: readonly ScoreDiagnosticDto[];
}

interface DraftContext {
  readonly original: ScoreSnapshotDto;
  readonly lastGood: ScoreSnapshotDto;
  readonly draft: string;
  readonly history: readonly DraftVersion[];
  readonly currentVersionId?: string;
}

export type DraftSessionState =
  | { readonly status: "unavailable" }
  | ({ readonly status: "clean" | "dirty" | "validating" } & DraftContext)
  | ({ readonly status: "invalid"; readonly diagnostics: readonly ScoreDiagnosticDto[] } & DraftContext);

export class DraftSessionController {
  private state: DraftSessionState = { status: "unavailable" };
  private nextRevision = 1;
  private generation = 0;
  private evaluation: AbortController | undefined;
  private autoApplyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly evaluator: DraftEvaluator,
    private readonly onState: (state: DraftSessionState) => void,
    private readonly onApplied: (result: EvaluateScoreResultDto) => void,
    private readonly transformer?: DraftTransformer,
    private readonly autoApplyDelayMs?: number,
  ) {
    this.emit();
  }

  snapshot(): DraftSessionState {
    if (this.state.status === "unavailable") return this.state;
    return {
      ...this.state,
      original: structuredClone(this.state.original),
      lastGood: structuredClone(this.state.lastGood),
      history: this.state.history.map((version) => structuredClone(version)),
      ...(this.state.status === "invalid"
        ? { diagnostics: this.state.diagnostics.map((diagnostic) => structuredClone(diagnostic)) }
        : {}),
    };
  }

  adoptHostSnapshot(snapshot: ScoreSnapshotDto): void {
    this.cancelEvaluation();
    this.nextRevision = Math.max(this.nextRevision, snapshot.revision + 1);
    this.state = {
      status: "clean",
      original: snapshot,
      lastGood: snapshot,
      draft: snapshot.document.source.text,
      history: [{
        id: "original",
        label: "Original",
        status: "original",
        abc: snapshot.document.source.text,
        snapshot,
        diagnostics: [],
      }],
      currentVersionId: "original",
    };
    this.emit();
  }

  edit(draft: string): void {
    const context = this.requiredContext();
    this.cancelEvaluation();
    this.state = {
      status: draft === context.lastGood.document.source.text ? "clean" : "dirty",
      original: context.original,
      lastGood: context.lastGood,
      draft,
      history: context.history,
    };
    this.emit();
    if (this.state.status === "dirty") this.scheduleAutoApply();
  }

  async apply(): Promise<void> {
    const context = this.requiredContext();
    if (this.state.status === "clean") return;
    const revision = this.nextRevision++;
    this.cancelEvaluation();
    const evaluation = new AbortController();
    this.evaluation = evaluation;
    const generation = this.generation;
    this.state = { status: "validating", ...context };
    this.emit();

    try {
      const result = await this.evaluator.evaluate(context.draft, revision, evaluation.signal);
      if (evaluation.signal.aborted || generation !== this.generation) return;
      this.evaluation = undefined;
      if (result.status === "success" && result.snapshot) {
        const version: DraftVersion = {
          id: `revision-${revision}`,
          label: `Version ${revision}`,
          status: "valid",
          abc: result.snapshot.document.source.text,
          snapshot: result.snapshot,
          diagnostics: [],
        };
        this.state = {
          status: "clean",
          original: context.original,
          lastGood: result.snapshot,
          draft: result.snapshot.document.source.text,
          history: appendVersion(context.history, version),
          currentVersionId: version.id,
        };
        this.emit();
        this.onApplied(result);
        return;
      }
      const diagnostics = result.diagnostics ?? [];
      const version: DraftVersion = {
        id: `attempt-${revision}`,
        label: `Attempt ${revision}`,
        status: "invalid",
        abc: context.draft,
        diagnostics,
      };
      this.state = {
        status: "invalid",
        ...context,
        history: appendVersion(context.history, version),
        currentVersionId: version.id,
        diagnostics,
      };
      this.emit();
    } catch (error) {
      if (evaluation.signal.aborted || generation !== this.generation) return;
      this.evaluation = undefined;
      const diagnostics: readonly ScoreDiagnosticDto[] = [{
        code: "ABC_SOURCE_EMPTY",
        severity: "error",
        message: error instanceof Error ? error.message : "Draft validation failed.",
      }];
      const version: DraftVersion = {
        id: `attempt-${revision}`,
        label: `Attempt ${revision}`,
        status: "invalid",
        abc: context.draft,
        diagnostics,
      };
      this.state = {
        status: "invalid",
        ...context,
        history: appendVersion(context.history, version),
        currentVersionId: version.id,
        diagnostics,
      };
      this.emit();
    }
  }

  transpose(semitones: number): void {
    const context = this.requiredContext();
    try {
      if (!this.transformer) throw new Error("Score transposition is unavailable.");
      const transformed = this.transformer.transpose(context.draft, semitones);
      this.edit(transformed);
    } catch (error) {
      this.cancelEvaluation();
      this.state = {
        status: "invalid",
        ...context,
        diagnostics: [{
          code: "ABC_TRANSPOSITION_FAILED",
          severity: "error",
          message: error instanceof Error ? error.message : "The draft could not be transposed.",
        }],
      };
      this.emit();
    }
  }

  restoreOriginal(): void {
    const context = this.requiredContext();
    this.cancelEvaluation();
    const restored: ScoreSnapshotDto = {
      ...structuredClone(context.original),
      revision: this.nextRevision++,
    };
    const result: EvaluateScoreResultDto = { status: "success", snapshot: restored };
    this.state = {
      status: "clean",
      original: context.original,
      lastGood: restored,
      draft: context.original.document.source.text,
      history: context.history,
      currentVersionId: "original",
    };
    this.emit();
    this.onApplied(result);
  }

  restoreLastGood(): void {
    const context = this.requiredContext();
    this.cancelEvaluation();
    const currentVersionId = lastMatchingVersionId(
      context.history,
      context.lastGood.document.source.text,
    );
    this.state = {
      status: "clean",
      original: context.original,
      lastGood: context.lastGood,
      draft: context.lastGood.document.source.text,
      history: context.history,
      ...(currentVersionId ? { currentVersionId } : {}),
    };
    this.emit();
  }

  restoreVersion(id: string): void {
    const context = this.requiredContext();
    const version = context.history.find((candidate) => candidate.id === id);
    if (!version) return;
    this.cancelEvaluation();
    if (version.status === "invalid" || !version.snapshot) {
      this.state = {
        status: "invalid",
        ...context,
        draft: version.abc,
        currentVersionId: version.id,
        diagnostics: version.diagnostics,
      };
      this.emit();
      return;
    }
    const restored = { ...structuredClone(version.snapshot), revision: this.nextRevision++ };
    this.state = {
      status: "clean",
      original: context.original,
      lastGood: restored,
      draft: version.abc,
      history: context.history,
      currentVersionId: version.id,
    };
    this.emit();
    this.onApplied({ status: "success", snapshot: restored });
  }

  dispose(): void {
    this.cancelEvaluation();
    this.state = { status: "unavailable" };
    this.emit();
  }

  private requiredContext(): DraftContext {
    if (this.state.status === "unavailable") throw new Error("No score is available for editing.");
    return {
      original: this.state.original,
      lastGood: this.state.lastGood,
      draft: this.state.draft,
      history: this.state.history,
      ...(this.state.currentVersionId ? { currentVersionId: this.state.currentVersionId } : {}),
    };
  }

  private cancelEvaluation(): void {
    if (this.autoApplyTimer) clearTimeout(this.autoApplyTimer);
    this.autoApplyTimer = undefined;
    this.generation += 1;
    this.evaluation?.abort();
    this.evaluation = undefined;
  }

  private scheduleAutoApply(): void {
    if (this.autoApplyDelayMs === undefined) return;
    this.autoApplyTimer = setTimeout(() => {
      this.autoApplyTimer = undefined;
      void this.apply();
    }, this.autoApplyDelayMs);
  }

  private emit(): void {
    this.onState(this.snapshot());
  }
}

function appendVersion(history: readonly DraftVersion[], version: DraftVersion): readonly DraftVersion[] {
  const previous = history.at(-1);
  if (previous?.abc === version.abc && previous.status === version.status) {
    return [...history.slice(0, -1), version];
  }
  return [...history, version];
}

function lastMatchingVersionId(history: readonly DraftVersion[], abc: string): string | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const version = history[index];
    if (version && version.status !== "invalid" && version.abc === abc) return version.id;
  }
  return undefined;
}
