import type {
  DecodeScoreResult,
  Diagnostic,
  ScoreDocument,
  ScoreSnapshot,
} from "../../domain/src/index";
import { asRevisionId } from "../../domain/src/index";

export interface ScoreCodec {
  decode(source: string): DecodeScoreResult;
  encode(document: ScoreDocument): string;
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
