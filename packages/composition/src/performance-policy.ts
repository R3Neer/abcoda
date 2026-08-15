import type { CompositionBrief, InstrumentFamily } from "./schema.js";

const difficultyRank: Record<CompositionBrief["difficulty"], number> = {
  beginner: 0, intermediate: 1, advanced: 2, virtuosic: 3,
};

const effortRank: Record<CompositionBrief["effort"], number> = {
  quick: 0, standard: 1, careful: 2, exhaustive: 3,
};

function expressiveDetail(brief: CompositionBrief): number {
  // A carefully made easy piece may need complete expressive notation, while
  // a difficult part must remain executable even when requested quickly.
  return Math.max(difficultyRank[brief.difficulty], effortRank[brief.effort]);
}

function pianoVoices(brief: CompositionBrief): CompositionBrief["ensemble"] {
  return brief.ensemble.filter((voice) =>
    voice.family === "keyboard" && /\b(?:piano|pianoforte|fortepiano|grand|upright)\b/i.test(voice.instrument),
  );
}

function pianoPedalIsRelevant(brief: CompositionBrief): boolean {
  const explicitText = [brief.styleDetail, ...brief.constraints, ...brief.departures].filter(Boolean).join(" ");
  if (/\b(?:no|without|senza|sin)\s+(?:sustain\s+)?pedal\b/i.test(explicitText)) return false;
  if (/\b(?:sustain\s+)?pedal(?:ling)?\b/i.test(explicitText)) return true;
  if (["romantic", "impressionist_coloristic", "minimalist_electronic_cinematic"].includes(brief.styleFamily)) return true;
  return ["classical", "jazz_blues", "pop_rock_funk_rnb", "other_hybrid"].includes(brief.styleFamily)
    && /\b(?:lyric|cantabile|ballad|resonan|legato|atmospher|nocturne|piano)\b/i.test(explicitText);
}

export function expressiveNotationGuidance(brief: CompositionBrief): string[] {
  const detail = expressiveDetail(brief);
  const families = new Set(brief.ensemble.map((voice) => voice.family));
  const lines = [
    "Notate execution, not decoration: use ties for sustained duration, slurs for phrasing/legato, and basic note articulations such as `.`/`!staccato!`, `!tenuto!`, and `!accent!` whenever they materially change attack or length—even in beginner music. Do not mark every note by habit.",
  ];

  if (detail >= 1) lines.push(
    "Give performance-oriented music a purposeful dynamic baseline and trajectory using abcjs-compatible `!pppp!`…`!ffff!`, `!mp!`, `!mf!`, `!sfz!`, and paired `!crescendo(!`/`!crescendo)!` or `!diminuendo(!`/`!diminuendo)!`; make every hairpin lead to an audible target rather than float without an endpoint.",
    "Use `!fermata!`, `!breath!`, `!marcato!`, phrase slurs, ornaments, and grace notes only where form, rhetoric, breath, groove, or the named idiom requires them. A fermata changes pacing; it is not a generic final-bar ornament.",
  );
  if (detail >= 2) lines.push(
    "Where idiomatic and playable, ABC/abcjs can engrave `!trill!`, turns, mordents, `!arpeggio!`, `!glissando(!`…`!glissando)!`, fingerings `!0!`…`!5!`, `!upbow!`/`!downbow!`, `!open!` (open string/harmonic sign), `!snap!`, `!thumb!`, phrase marks, coda/segno and D.C./D.S./Fine. Select only techniques that belong to the actual instrument and style; many engrave correctly but are not realised by the General MIDI playback.",
  );
  if (detail >= 3) lines.push(
    "Run a complete performance-mark audit: remove redundant or contradictory signs, ensure continuations have explicit cancellation/return instructions, keep marks legible in every voice, and prefer a few consequential symbols to dense but unaudible ink.",
  );

  const pianos = pianoVoices(brief);
  if (pianos.length > 0 && detail >= 1) {
    if (pianoPedalIsRelevant(brief)) lines.push(
      `For piano voice${pianos.length === 1 ? "" : "s"} ${pianos.map((voice) => voice.voiceId).join(", ")}, add sustain pedal where resonance is idiomatic: place below-staff annotations such as \`\"_Ped.\"\` at depression and \`\"_*\"\` at release/retake, changing with harmony, articulation, rests, and desired blur. Keep beginner pedalling sparse and coordinate the two staves as one instrument. abcjs has no native piano-pedal decoration, and ABCoda does not yet reproduce these pedal changes in audio.`,
    );
    else lines.push("Do not add sustain pedal merely because the instrument is piano: the declared style/texture calls for a dry, detached, historical, or otherwise unpedalled default unless the user explicitly requests resonance.");
  }

  if (families.has("bowed_string") && detail >= 1) lines.push("For bowed strings, use slurs and selective `!upbow!`/`!downbow!` where bow grouping or attack matters; reserve harmonics, snap pizzicato, thumb position, and special-technique text for passages that require them, and cancel continuing `pizz.`/`arco` instructions explicitly.");
  if ((families.has("guitar") || families.has("plucked_string")) && detail >= 1) lines.push("For fretted/plucked parts, use `!arpeggio!`, slurs, `!slide!`/glissando, harmonics, open-string signs, and fingerings only when they clarify a feasible string/fret solution; write unsupported bends, tapping, damping, or string choices as concise text annotations.");
  if ((families.has("woodwind") || families.has("brass") || families.has("voice")) && detail >= 1) lines.push("For wind, brass, and voice, make slurs, tonguing/attack, dynamics, and `!breath!` agree with real phrase length and recovery; do not use breath marks to excuse an otherwise impossible continuous line.");
  if (["pitched_percussion", "drum_kit", "unpitched_percussion"].some((family) => families.has(family as InstrumentFamily)) && detail >= 1) lines.push("For percussion, prioritise accents/marcato, dynamics, rolls/tremolo or concise mallet/stick/damping text and technique-specific mapping; a sustained hairpin needs an actual roll or sustaining instrument, not an impossible crescendo on a decaying single strike.");
  if (families.has("electronic") && detail >= 1) lines.push("For electronic parts, use standard dynamics and articulations only when they communicate a playable envelope; put filter, timbre, gate, or production changes in concise text because General MIDI playback cannot infer them.");
  return lines;
}

export function expressiveReviewGuidance(brief: CompositionBrief): string[] {
  const detail = expressiveDetail(brief);
  const lines = [
    "Check every slur, tie, accent, staccato, tenuto, and fermata against the intended attack, duration, phrase, and metre; remove symbols that merely restate the obvious or contradict one another.",
  ];
  if (detail >= 1) lines.push("Trace dynamics and hairpins as an audible trajectory by phrase and voice, including real destinations, balance, and instrument response; do not confuse more markings with more expression.");
  if (detail >= 2) lines.push("Audit every ornament and instrument-specific sign for stylistic vocabulary, physical execution, scope, cancellation, and abcjs support; accept that some signs are visual instructions rather than synthesized effects.");
  if (pianoVoices(brief).length > 0 && detail >= 1 && pianoPedalIsRelevant(brief)) lines.push("Rehearse the piano pedal plan against harmony, rests, texture, and articulation: require clear depression/release or retake points, avoid continuous blur, and do not claim that the current audio preview proves the pedalling works.");
  return lines;
}
