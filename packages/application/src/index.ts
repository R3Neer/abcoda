import type {
  ApplyScoreOperationResult,
  DecodeScoreResult,
  Diagnostic,
  PlaybackProfile,
  ScoreDocument,
  ScoreOperation,
  ScoreSnapshot,
} from "@abcoda/domain";
import { asRevisionId } from "@abcoda/domain";

export interface ScoreCodec {
  decode(source: string): DecodeScoreResult;
  encode(document: ScoreDocument): string;
}

export interface CompositionKnowledge<Brief, Plan> {
  prepare(brief: Brief): Plan;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator<Id = string> {
  next(): Id;
}

export interface Telemetry {
  record(event: {
    readonly name: string;
    readonly outcome: "success" | "invalid" | "unsupported" | "failure";
    readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  }): void;
}

export interface PrepareCompositionCommand<Brief> {
  readonly brief: Brief;
}

export class PrepareComposition<Brief, Plan> {
  constructor(private readonly knowledge: CompositionKnowledge<Brief, Plan>) {}

  execute(command: PrepareCompositionCommand<Brief>): Plan {
    return this.knowledge.prepare(command.brief);
  }
}

export interface ScoreOperationExecutor {
  apply(command: ApplyScoreOperationCommand): ApplyScoreOperationResult;
}

export interface ApplyScoreOperationCommand {
  readonly document: ScoreDocument;
  readonly original: ScoreDocument;
  readonly playback: PlaybackProfile;
  readonly operation: ScoreOperation;
}

export class ApplyScoreOperation {
  constructor(private readonly executor: ScoreOperationExecutor) {}

  execute(command: ApplyScoreOperationCommand): ApplyScoreOperationResult {
    return this.executor.apply(command);
  }
}

export interface EvaluateScoreCommand {
  readonly abc: string;
  readonly revision: number;
}

export type EvaluateScoreResult =
  | {
      readonly status: "success";
      readonly snapshot: ScoreSnapshot;
    }
  | {
      readonly status: "invalid";
      readonly diagnostics: readonly Diagnostic[];
    };

export class EvaluateScore {
  constructor(private readonly codec: ScoreCodec) {}

  execute(command: EvaluateScoreCommand): EvaluateScoreResult {
    const decoded = this.codec.decode(command.abc);
    if (!decoded.ok) {
      return { status: "invalid", diagnostics: decoded.diagnostics };
    }
    if (decoded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return { status: "invalid", diagnostics: decoded.diagnostics };
    }

    return {
      status: "success",
      snapshot: {
        schemaVersion: 2,
        revision: asRevisionId(command.revision),
        document: {
          tuneId: decoded.document.tuneId,
          ...(decoded.document.header.title
            ? { title: decoded.document.header.title }
            : {}),
          ...(decoded.document.header.meter
            ? { meter: decoded.document.header.meter }
            : {}),
          ...(decoded.document.header.key
            ? { key: decoded.document.header.key }
            : {}),
          ...(decoded.document.header.tempo
            ? { tempo: decoded.document.header.tempo }
            : {}),
          voices: decoded.document.voices.map((voice) => ({
            id: voice.id,
            kind: voice.kind,
          })),
          source: decoded.document.source,
        },
        diagnostics: decoded.diagnostics,
      },
    };
  }
}

export interface PresentScoreCommand {
  readonly snapshot: ScoreSnapshot;
}

export class PresentScore {
  constructor(private readonly evaluateScore: EvaluateScore) {}

  execute(command: PresentScoreCommand): EvaluateScoreResult {
    return this.evaluateScore.execute({
      abc: command.snapshot.document.source.text,
      revision: command.snapshot.revision,
    });
  }
}

export interface ExportScoreCommand {
  readonly document: ScoreDocument;
}

export class ExportScore {
  constructor(private readonly codec: ScoreCodec) {}

  execute(command: ExportScoreCommand): { readonly format: "abc"; readonly content: string } {
    return { format: "abc", content: this.codec.encode(command.document) };
  }
}
