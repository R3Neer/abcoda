import ABCJS from "abcjs";
import type {
  Engraver,
  EngravingOptions,
  EngravingResult,
} from "../../application/score-session";
import type {
  ScorePresentationDto,
  ScoreSnapshotDto,
} from "../../../../../packages/contracts/src/index";
import {
  classifyInstrumentPitch,
} from "../../../../../packages/domain/src/index";
import { timelineForTune } from "./abcjs-timeline";
import type { PlaybackTimingCallback } from "../../application/score-cursor";
import { AbcjsPlaybackSource } from "./abcjs-playback-source";
import {
  analyzeVoicePitches,
  type VoicePitchTarget,
} from "./abcjs-voice-pitches";
import { scoreStaffWidth } from "../../application/score-layout";
import type { VoiceMixSnapshot } from "../../application/voice-mix";

interface SelectionRange {
  readonly start: number;
  readonly end: number;
}

type HighlightableTune = {
  readonly engraver?: {
    rangeHighlight?: (start: number, end: number) => void;
  };
};

export class AbcjsEngraver implements Engraver {
  private selectedRange: SelectionRange | undefined;
  private rangeTargets: Readonly<Record<string, readonly VoicePitchTarget[]>> = {};

  constructor(
    private readonly target: HTMLElement,
    private readonly audioTarget: HTMLElement,
    private readonly callbacks: {
      readonly onPlaybackStarted: () => void;
      readonly onPlaybackFinished: () => void;
      readonly onPlaybackEvent: (event: PlaybackTimingCallback) => void;
      readonly onScoreSelection: (sourceOffsets: readonly number[]) => void;
    },
  ) {}

  async render(
    snapshot: ScoreSnapshotDto,
    presentation: ScorePresentationDto | undefined,
    signal: AbortSignal,
    options: EngravingOptions = {},
  ): Promise<EngravingResult> {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();

    const preserveSelection = options.includePlayback === false;
    if (!preserveSelection) this.selectedRange = undefined;

    const availableWidth = this.target.clientWidth;
    const staffWidth = scoreStaffWidth(
      availableWidth,
      presentation?.preferredMeasuresPerLine,
    );
    const tunes = ABCJS.renderAbc(this.target, snapshot.document.source.text, {
      add_classes: true,
      expandToWidest: true,
      format: {
        stretchlast: 1,
      },
      foregroundColor: "currentColor",
      paddingleft: 32,
      paddingright: 32,
      clickListener: (abcElement) => {
        if (typeof abcElement.startChar === "number") {
          const start = abcElement.startChar;
          const end = typeof abcElement.endChar === "number"
            && abcElement.endChar > start
            ? abcElement.endChar
            : start + 1;

          this.selectedRange = { start, end };
          this.callbacks.onScoreSelection([start]);
        }
      },
      staffwidth: staffWidth,
      ...(presentation?.preferredMeasuresPerLine === undefined
        ? {}
        : {
            wrap: {
              preferredMeasuresPerLine: presentation.preferredMeasuresPerLine,
              minSpacing: 1.7,
              maxSpacing: 2.8,
            },
          }),
    });
    signal.throwIfAborted();

    if (tunes.length !== 1) {
      this.clear();
      throw new Error("Expected exactly one engraved tune.");
    }

    if (preserveSelection && this.selectedRange) {
      const tune = tunes[0] as unknown as HighlightableTune;
      tune.engraver?.rangeHighlight?.(
        this.selectedRange.start,
        this.selectedRange.end,
      );
    }

    const bpm = snapshot.document.tempo?.bpm ?? 96;
    const timeline = timelineForTune(tunes[0], bpm);
    const pitchAnalysis = analyzeVoicePitches(
      tunes[0],
      snapshot.document.voices.map((voice) => voice.id),
      bpm,
    );
    this.rangeTargets = pitchAnalysis.targetsByVoice;

    if (options.includePlayback === false) {
      return { timeline };
    }

    const voicePitches = pitchAnalysis.pitchesByVoice;
    if (!ABCJS.synth.supportsAudio()) return { timeline, voicePitches };
    return {
      timeline,
      voicePitches,
      playbackSource: new AbcjsPlaybackSource(
        this.audioTarget,
        tunes[0],
        bpm,
        this.callbacks,
      ),
    };
  }

  showVoiceRanges(mix: VoiceMixSnapshot): void {
    this.clearVoiceRangeClasses();

    for (const voice of mix.voices) {
      if (voice.kind !== "pitched") continue;

      for (const target of this.rangeTargets[voice.id] ?? []) {
        const status = targetRangeStatus(
          target.pitches,
          voice.instrument,
        );

        target.element.setAttribute("data-range-status", status);
        if (status === "extended") {
          target.element.classList.add("abcoda-range-extended");
        }
        if (status === "unplayable") {
          target.element.classList.add("abcoda-range-unplayable");
        }
      }
    }
  }

  clear(): void {
    this.rangeTargets = {};
    this.target.replaceChildren();
  }

  private clearVoiceRangeClasses(): void {
    for (const targets of Object.values(this.rangeTargets)) {
      for (const target of targets) {
        target.element.classList.remove(
          "abcoda-range-extended",
          "abcoda-range-unplayable",
        );
        target.element.removeAttribute("data-range-status");
      }
    }
  }
}

function targetRangeStatus(
  pitches: readonly number[],
  instrument: VoiceMixSnapshot["voices"][number]["instrument"],
): "usual" | "extended" | "unplayable" | "unbounded" {
  let status: "usual" | "extended" = "usual";

  for (const pitch of pitches) {
    const classification = classifyInstrumentPitch(pitch, instrument);
    if (classification === "unbounded") return "unbounded";
    if (classification === "unplayable") return "unplayable";
    if (classification === "extended") status = "extended";
  }

  return status;
}
