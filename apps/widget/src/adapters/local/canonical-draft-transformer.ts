import {
  transposeAbc,
  transposeVoiceAbc,
} from "../../../../../packages/abc-codec/src/index";
import type {
  DraftTransformer,
} from "../../application/draft-session";

export class CanonicalDraftTransformer implements DraftTransformer {
  transpose(
    abc: string,
    semitones: number,
  ): string {
    return transposeAbc(
      abc,
      semitones,
    );
  }

  transposeVoice(
    abc: string,
    voiceId: string,
    semitones: number,
  ): string {
    return transposeVoiceAbc(
      abc,
      voiceId,
      semitones,
    );
  }
}