import type {
  EvaluateScoreResultDto,
  ScoreSnapshotDto,
} from "../../../../packages/contracts/src/index";

type ScoreDiagnosticDto = NonNullable<EvaluateScoreResultDto["diagnostics"]>[number];

export interface DraftEvaluator {
  evaluate(abc: string, revision: number, signal: AbortSignal): Promise<EvaluateScoreResultDto>;
}

interface DraftContext {
  readonly original: ScoreSnapshotDto;
  readonly lastGood: ScoreSnapshotDto;
  readonly draft: string;
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

  constructor(
    private readonly evaluator: DraftEvaluator,
    private readonly onState: (state: DraftSessionState) => void,
    private readonly onApplied: (result: EvaluateScoreResultDto) => void,
  ) {
    this.emit();
  }

  snapshot(): DraftSessionState {
    if (this.state.status === "unavailable") return this.state;
    return {
      ...this.state,
      original: structuredClone(this.state.original),
      lastGood: structuredClone(this.state.lastGood),
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
    };
    this.emit();
  }

  async apply(): Promise<void> {
    const context = this.requiredContext();
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
        this.state = {
          status: "clean",
          original: context.original,
          lastGood: result.snapshot,
          draft: result.snapshot.document.source.text,
        };
        this.emit();
        this.onApplied(result);
        return;
      }
      this.state = {
        status: "invalid",
        ...context,
        diagnostics: result.diagnostics ?? [],
      };
      this.emit();
    } catch (error) {
      if (evaluation.signal.aborted || generation !== this.generation) return;
      this.evaluation = undefined;
      this.state = {
        status: "invalid",
        ...context,
        diagnostics: [{
          code: "ABC_SOURCE_EMPTY",
          severity: "error",
          message: error instanceof Error ? error.message : "Draft validation failed.",
        }],
      };
      this.emit();
    }
  }

  restoreOriginal(): void {
    const context = this.requiredContext();
    this.cancelEvaluation();
    const result: EvaluateScoreResultDto = { status: "success", snapshot: context.original };
    this.state = {
      status: "clean",
      original: context.original,
      lastGood: context.original,
      draft: context.original.document.source.text,
    };
    this.emit();
    this.onApplied(result);
  }

  restoreLastGood(): void {
    const context = this.requiredContext();
    this.cancelEvaluation();
    this.state = {
      status: "clean",
      original: context.original,
      lastGood: context.lastGood,
      draft: context.lastGood.document.source.text,
    };
    this.emit();
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
    };
  }

  private cancelEvaluation(): void {
    this.generation += 1;
    this.evaluation?.abort();
    this.evaluation = undefined;
  }

  private emit(): void {
    this.onState(this.snapshot());
  }
}
