import {
  defaultInstrument,
  isInstrumentCompatible,
  type InstrumentId,
  type VoiceKind,
} from "@abcoda/domain";
import type { PlaybackEngine } from "./playback-session";

export interface MixableVoice {
  readonly id: string;
  readonly kind: VoiceKind;
}

export interface VoiceMixEntry extends MixableVoice {
  readonly instrument: InstrumentId;
  readonly muted: boolean;
}

export interface VoiceMixSnapshot {
  readonly revision: number;
  readonly voices: readonly VoiceMixEntry[];
}

export interface InitialVoiceMix {
  readonly instruments?: Readonly<Record<string, InstrumentId>>;
  readonly mutedVoices?: readonly string[];
}

export interface VoiceMixPlaybackSource {
  create(mix: VoiceMixSnapshot): Promise<PlaybackEngine>;
}

export class VoiceMixController {
  private state: VoiceMixSnapshot = { revision: 0, voices: [] };

  constructor(private readonly onState: (state: VoiceMixSnapshot) => void) {
    this.emit();
  }

  snapshot(): VoiceMixSnapshot {
    return {
      revision: this.state.revision,
      voices: this.state.voices.map((voice) => ({ ...voice })),
    };
  }

  adoptVoices(
    revision: number,
    voices: readonly MixableVoice[],
    initial: InitialVoiceMix = {},
  ): void {
    const previous = new Map(this.state.voices.map((voice) => [voice.id, voice]));
    const initiallyMuted = new Set(initial.mutedVoices);
    this.state = {
      revision,
      voices: voices.map((voice) => {
        const existing = previous.get(voice.id);
        const requested = initial.instruments?.[voice.id];
        return {
          ...voice,
          instrument: existing && isInstrumentCompatible(voice.kind, existing.instrument)
            ? existing.instrument
            : requested && isInstrumentCompatible(voice.kind, requested)
              ? requested
            : defaultInstrument(voice.kind),
          muted: existing?.muted ?? initiallyMuted.has(voice.id),
        };
      }),
    };
    this.emit();
  }

  setInstrument(voiceId: string, instrument: InstrumentId): void {
    const voice = this.requiredVoice(voiceId);
    if (!isInstrumentCompatible(voice.kind, instrument)) {
      throw new Error(`Instrument ${instrument} is incompatible with ${voice.kind} voice ${voiceId}.`);
    }
    if (voice.instrument === instrument) return;
    this.replace(voiceId, { ...voice, instrument });
  }

  setMuted(voiceId: string, muted: boolean): void {
    const voice = this.requiredVoice(voiceId);
    if (voice.muted === muted) return;
    this.replace(voiceId, { ...voice, muted });
  }

  private requiredVoice(voiceId: string): VoiceMixEntry {
    const voice = this.state.voices.find((entry) => entry.id === voiceId);
    if (!voice) throw new Error(`Unknown voice ${voiceId}.`);
    return voice;
  }

  private replace(voiceId: string, replacement: VoiceMixEntry): void {
    this.state = {
      ...this.state,
      voices: this.state.voices.map((voice) => voice.id === voiceId ? replacement : voice),
    };
    this.emit();
  }

  private emit(): void {
    this.onState(this.snapshot());
  }
}
