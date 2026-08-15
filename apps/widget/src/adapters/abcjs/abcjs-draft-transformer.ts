import ABCJS from "abcjs";
import type { DraftTransformer } from "../../application/draft-session";

export class AbcjsDraftTransformer implements DraftTransformer {
  transpose(abc: string, semitones: number): string {
    if (semitones === 0) return abc;
    if (!Number.isInteger(semitones) || semitones < -24 || semitones > 24) {
      throw new Error("Transposition must be a whole number between -24 and 24 semitones.");
    }
    const tunes = ABCJS.parseOnly(abc);
    if (!tunes[0]) throw new Error("The ABC could not be parsed for transposition.");
    return ABCJS.strTranspose(abc, tunes, semitones);
  }
}
