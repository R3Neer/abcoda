import {
  formGuidance,
  instrumentGuidance,
  pitchGuidance,
  rhythmGuidance,
  styleGuidance,
  textureGuidance,
} from "./catalogs/guidance.js";
import {
  difficultyGuidance,
  effortReviewGuidance,
  formReviewGuidance,
  instrumentReviewGuidance,
  intentGuidance,
  pitchReviewGuidance,
  rhythmReviewGuidance,
  styleReviewGuidance,
  textureReviewGuidance,
} from "./catalogs/review.js";
import {
  expressiveNotationGuidance,
  expressiveReviewGuidance,
} from "./performance-policy.js";
import type {
  CompositionBrief,
  CompositionPlanOutput,
  PitchFramework,
} from "./schema.js";

function lengthGuidance(measures: number): string {
  if (measures <= 8) return "Use one principal idea and one convincing arrival; do not compress several unrelated formal functions into the miniature.";
  if (measures <= 32) return "Establish, vary, contrast, and return or resolve the principal material with section proportions that fit the available span.";
  return "Track thematic, pitch/harmonic, rhythmic, textural, and registral trajectories across sections so the larger span has hierarchy and memory.";
}

function meterGuidance(meter: string): string {
  const compact = meter.replace(/\s/g, "").toLowerCase();
  if (compact === "none" || compact === "m:none" || compact === "free") return "The meter is free: use M:none and organise duration through gesture, breath, proportion, or process rather than arbitrary bar lines.";
  if (/[()+]/.test(compact) || /^(5|7|8|10|11|13)\//.test(compact)) return `Treat meter ${meter} as grouped/additive: preserve a perceivable subdivision, and align beaming, accent, bass, and motives with it.`;
  const match = compact.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const numerator = Number(match[1]);
    if (numerator >= 6 && numerator % 3 === 0) return `Treat meter ${meter} as compound unless specified otherwise: hear dotted beats subdivided into three and shape accents above the notation-unit level.`;
    return `Establish the beat hierarchy of meter ${meter} clearly and use hypermetric/phrase accents rather than accenting every notated beat equally.`;
  }
  return `Interpret meter “${meter}” explicitly in grouping, accent, beaming, and phrase rhythm; do not rely on the label alone.`;
}

function sectionPlanGuidance(brief: CompositionBrief): string[] {
  if (brief.sectionPlan.length === 0) return [];
  const total = brief.sectionPlan.reduce((sum, section) => sum + (section.measures ?? 0), 0);
  const plan = brief.sectionPlan.map((section) => `${section.label}${section.measures ? ` (${section.measures} bars)` : ""}: ${section.function}`).join("; ");
  return [
    `Follow this section map: ${plan}.`,
    total > 0 && total !== brief.measures
      ? `The section map totals ${total} bars while the target is ${brief.measures}; reconcile the discrepancy deliberately before writing ABC.`
      : "Make transitions and arrivals match the declared section functions, not just their labels.",
  ];
}

function compatibilityNotes(brief: CompositionBrief): string[] {
  const notes: string[] = [];
  const tonal = new Set<PitchFramework>(["tonal_functional", "tonal_cyclic", "modal", "blues", "jazz_extended"]);
  if (brief.styleFamily === "atonal_post_tonal" && tonal.has(brief.pitchFramework)) notes.push("A post-tonal style is paired with a tonal/modal framework. Treat it as an intentional hybrid: pitchFramework governs pitch syntax while post-tonal traits govern other declared domains.");
  if (["medieval_renaissance", "baroque", "classical"].includes(brief.styleFamily) && ["blues", "jazz_extended", "tonal_cyclic"].includes(brief.pitchFramework)) notes.push("The historical style and pitch framework are atypical together. Preserve named form/texture traits but let pitchFramework govern harmony; do not silently normalise it to common-practice tonality.");
  if (brief.formFamily === "fugue_invention" && !["contrapuntal", "mixed"].includes(brief.texture)) notes.push("Fugue/invention requires locally contrapuntal exposition despite the global texture field; let form govern those passages and return to the declared texture elsewhere.");
  if (brief.formFamily === "twelve_bar_blues" && !["blues", "jazz_extended", "tonal_functional", "tonal_cyclic"].includes(brief.pitchFramework)) notes.push("Use the 12-bar response/turnaround architecture without forcing I–IV–V harmony; translate its three-part function into the declared pitch framework.");
  if (brief.rhythmicFeel === "free" && !/none|free/i.test(brief.meter)) notes.push("A fixed meter and free feel coexist. Use meter as a notational/proportional frame while making surface timing flexible.");
  for (const voice of brief.ensemble) {
    if ((voice.family === "drum_kit" || voice.family === "unpitched_percussion") && voice.kind !== "unpitched_percussion") notes.push(`Voice ${voice.voiceId} is ${voice.family} but kind=pitched; use unpitched_percussion unless pitched drums were explicitly intended.`);
    if (voice.kind === "unpitched_percussion" && voice.role === "melody") notes.push(`Voice ${voice.voiceId} is unpitched percussion with role=melody; interpret melody as a recognisable timbral/rhythmic lead unless pitched percussion was intended.`);
  }
  if (brief.styleFamily === "folk_traditional_dance" && !brief.styleDetail) notes.push("No specific tradition is named. Use a modest generic tune/dance vocabulary and do not claim historical or regional authenticity.");
  return [...new Set(notes)];
}

function instrumentSection(brief: CompositionBrief): string[] {
  const parts = brief.ensemble.map((voice) => `${voice.voiceId}: ${voice.instrument}; family=${voice.family}; role=${voice.role}; kind=${voice.kind}; ${voice.transpositionSemitones === 0 ? "concert pitch" : `transpose ${voice.transpositionSemitones} semitones for playback`}`);
  const families = [...new Set(brief.ensemble.map((voice) => voice.family))];
  return [
    `Write specifically for these voices: ${parts.join(" | ")}.`,
    ...families.flatMap((family) => instrumentGuidance[family]),
    "Balance written/sounding register, density, entrances, exits, doubling, articulation, and endurance across the ensemble; continuous tutti is a choice, not a default.",
  ];
}

function reviewSection(brief: CompositionBrief): CompositionPlanOutput["review"] {
  const effortPlan = effortReviewGuidance[brief.effort];
  const families = [...new Set(brief.ensemble.map((voice) => voice.family))];
  const beamReview = "Inspect the engraved beam groups, not only the durations: beams must reveal the prevailing beat/subdivision, spaces in ABC must split groups deliberately, and an all-unbeamed run of eighth-or-shorter notes requires a musical reason rather than source-code formatting.";

  if (brief.effort === "quick") {
    return {
      strategy: effortPlan.strategy,
      macro: [
        "MACRO sanity: reject an obvious failure of global identity, declared form, proportion, tension, climax, or closure before inspecting details.",
        ...formReviewGuidance[brief.formFamily],
        ...styleReviewGuidance[brief.styleFamily],
        ...pitchReviewGuidance[brief.pitchFramework],
        ...effortPlan.macro,
      ],
      meso: [],
      local: [
        "LOCAL/playability sanity: reject obvious rhythmic, textural, registral, balance, or physical-writing failures; polish only marks that materially change execution.",
        ...rhythmReviewGuidance[brief.rhythmicFeel],
        ...textureReviewGuidance[brief.texture],
        ...families.flatMap((family) => instrumentReviewGuidance[family]),
        ...expressiveReviewGuidance(brief),
        beamReview,
      ],
      performance: [],
      finalHolisticAudit: [],
    };
  }

  return {
    strategy: effortPlan.strategy,
    macro: [
      "Establish the coarsest verdict first: global identity, form and section plan, proportions, large contrasts, tension trajectory, climax, and closure must work before any finer repair is allowed to legitimise them.",
      ...formReviewGuidance[brief.formFamily],
      ...effortPlan.macro,
    ],
    meso: [
      "Test section and phrase function, motive development/transformation, pitch or harmonic trajectory and style-appropriate arrivals, transitions, repetition versus development, and the way rhythm and texture articulate the form.",
      ...styleReviewGuidance[brief.styleFamily],
      ...pitchReviewGuidance[brief.pitchFramework],
      ...textureReviewGuidance[brief.texture],
      ...effortPlan.meso,
    ],
    local: [
      "Inspect local musical causality: style-appropriate voice leading and dissonance, counterpoint, spacing/register, rhythmic accents, balance among layers, and physical playability must support the already-approved larger functions.",
      ...rhythmReviewGuidance[brief.rhythmicFeel],
      ...families.flatMap((family) => instrumentReviewGuidance[family]),
      beamReview,
    ],
    performance: [
      "Only after the musical substance survives the preceding layers, audit articulations, slurs, dynamics and hairpins, pedal, bowing, ornaments, breath marks, beaming, and other expressive/notational realisation for idiom, scope, legibility, and executable intent.",
      ...expressiveReviewGuidance(brief),
    ],
    finalHolisticAudit: effortPlan.finalHolisticAudit,
  };
}

function notationSection(brief: CompositionBrief): string[] {
  const percussion = brief.ensemble.filter((voice) => voice.kind === "unpitched_percussion").map((voice) => voice.voiceId);
  const transposing = brief.ensemble.filter((voice) => voice.transpositionSemitones !== 0);
  return [
    `Encode M:${brief.meter}, Q:1/4=${brief.tempo}, and “${brief.pitchLanguage}” with an appropriate K: field; use K:none with explicit accidentals when a conventional key signature would misrepresent the pitch framework.`,
    "Begin X:1, T:, M:, L:, Q:, then place %%score before any V: declarations and finish the header with the first K:. For multiple voices, use braces only for parts that belong to one grand staff (for example, %%score { RH | LH } for piano, where | connects barlines); list unrelated staves without braces. Complete simultaneous bars and end voices together with |].",
    percussion.length > 0 ? `Set notation.voiceKinds for ${percussion.join(", ")} to unpitched_percussion and select playback instrument percussion; ABCoda will enforce percussion clef, voice-local K:none, and the General MIDI percussion sample map. Choose staff pitches as deliberate GM percussion mappings rather than arbitrary melody notes.` : "Use notation.voiceKinds={} unless an explicitly unpitched percussion voice is added.",
    transposing.length > 0 ? `Apply explicit ABC transpose= values for ${transposing.map((voice) => `${voice.voiceId}=${voice.transpositionSemitones}`).join(", ")}; verify written and sounding ranges separately.` : "Keep notation at concert pitch unless exact instrument convention requires a written transposing part.",
    "Choose an idiomatic clef for each written part and reconsider it after a sustained register change: use treble, bass, alto, or tenor clef—and a well-placed inline `[K:<current-key> clef=<new-clef>]` before the first affected note—rather than leaving long passages on excessive ledger lines. Do not change clef for a brief outlier, strand a clef/key at a line ending, or forget to preserve the intended sounding pitches when respelling notes after a change.",
    "Use abcjs octave clefs such as `clef=treble-8`, `clef=treble+8`, `clef=bass-8`, or their inline K-field equivalents only for genuine octave-transposing notation (commonly guitar or tenor voice), not as a cosmetic cure for ledger lines. abcjs applies the octave to audio too. Encode the total written-to-sounding interval once in ensemble.transpositionSemitones; ABCoda removes the octave-clef contribution from `transpose=` to prevent a double shift. Treat `octave=` as a pitch-input shorthand without an octave-clef sign, never as an interchangeable engraving instruction.",
    "Encode beams deliberately: in ABC, adjacent eighth-or-shorter note tokens without spaces share a beam, while whitespace breaks the beam. Use no spaces inside an intended group and spaces between groups; backticks may improve ABC readability without breaking a beam. Group by the audible meter—simple beats or accepted submeasure groups, dotted beats in compound meter, and the declared subdivision in additive/irregular meter. Do not beam indiscriminately across rests, barlines, or meaningful metric/phrasing boundaries; syllabic vocal and historically specific practices may justify separate flags.",
    ...expressiveNotationGuidance(brief),
    "Use valid abcjs-compatible durations, rests, chords, tuplets, ties, slurs, repeats, endings, fields, clefs, decorations, and bar lines. Do not invent directives or promise unavailable playback nuance.",
  ];
}

function priorities(brief: CompositionBrief): string[] {
  return [
    `Highest priority: satisfy explicit constraints${brief.constraints.length ? ` — ${brief.constraints.join("; ")}` : " (none beyond the typed brief)"}.`,
    `Explicit departures override ordinary conventions${brief.departures.length ? ` — ${brief.departures.join("; ")}` : "; none are declared"}.`,
    "Resolve combinations by domain: pitchFramework governs pitch/harmony; formFamily governs architecture; rhythmicFeel plus meter govern timing; texture governs distribution; instrument families govern physical realisation; style supplies idiomatic vocabulary.",
    "Atypical combinations are intentional hybrids unless stated otherwise. Translate functions across idioms instead of silently replacing a field with a conventional choice.",
    "For named composers or artists, use original material and only high-level traits; do not copy or closely paraphrase recognisable passages.",
  ];
}

function renderPrompt(
  brief: CompositionBrief,
  guidance: CompositionPlanOutput["guidance"],
  review: CompositionPlanOutput["review"],
  notes: string[],
): string {
  const sections: Array<[string, string[]]> = [
    ["PRIORITIES AND CONFLICT RESOLUTION", guidance.priorities], ["STYLE", guidance.style],
    ["FORM AND DEVELOPMENT", guidance.form], ["PITCH AND HARMONY", guidance.pitch],
    ["RHYTHM AND METER", guidance.rhythm], ["TEXTURE", guidance.texture],
    ["INSTRUMENTS AND VOICES", guidance.instruments], ["DIFFICULTY AND PURPOSE", guidance.difficultyAndIntent],
    ["ABC AND PLAYBACK", guidance.notation],
    ["SILENT HIERARCHICAL REVIEW STRATEGY", review.strategy],
    ["L1 — MACRO / ARCHITECTURE", review.macro],
    ["L2 — DEVELOPMENT / MESO", review.meso],
    ["L3 — LOCAL MUSICAL", review.local],
    ["L4 — PERFORMANCE / EXPRESSION", review.performance],
    ["FINAL HOLISTIC AUDIT", review.finalHolisticAudit],
    ["MECHANICAL ABC PREFLIGHT", guidance.preflight],
  ];
  if (notes.length > 0) sections.splice(1, 0, ["COMBINATION NOTES", notes]);
  return [
    `COMPOSITION PROFILE: ${brief.styleFamily}${brief.styleDetail ? ` — ${brief.styleDetail}` : ""}; ${brief.formFamily}; ${brief.pitchFramework}; ${brief.rhythmicFeel}; ${brief.texture}; effort=${brief.effort}.`,
    ...sections.filter(([, lines]) => lines.length > 0).map(([title, lines]) => `${title}\n${lines.map((line) => `- ${line}`).join("\n")}`),
  ].join("\n\n");
}

export function buildCompositionPlan(brief: CompositionBrief): CompositionPlanOutput {
  const notes = compatibilityNotes(brief);
  const guidance: CompositionPlanOutput["guidance"] = {
    priorities: priorities(brief),
    style: styleGuidance[brief.styleFamily],
    form: [
      `Realise “${brief.form}” as ${brief.formFamily} across approximately ${brief.measures} written measures; do not merely attach labels after composing.`,
      ...formGuidance[brief.formFamily], ...sectionPlanGuidance(brief), lengthGuidance(brief.measures),
      "Develop recognisable material through style-appropriate repetition and change: sequence, fragmentation, extension, displacement, inversion, register, reharmonisation, orchestration, call-response, or subtraction.",
    ],
    pitch: [`The operative pitch framework is ${brief.pitchFramework}: ${brief.pitchLanguage}. It overrides any conflicting stylistic default.`, ...pitchGuidance[brief.pitchFramework]],
    rhythm: [`The rhythmic feel is ${brief.rhythmicFeel} at quarter-note BPM ${brief.tempo}.`, meterGuidance(brief.meter), ...rhythmGuidance[brief.rhythmicFeel], "Make rests, pickups, ties, accents, tuplets, and activity changes structural; coordinate subdivision with phrase-level pacing and arrival."],
    texture: [`The governing texture is ${brief.texture}.`, ...textureGuidance[brief.texture]],
    instruments: instrumentSection(brief),
    difficultyAndIntent: [`Write at ${brief.difficulty} level for ${brief.intent}.`, ...difficultyGuidance[brief.difficulty], ...intentGuidance[brief.intent]],
    notation: notationSection(brief),
    preflight: [
      "Verify X/T/M/L/Q/K order, V:/%%score IDs, idiomatic clefs and section changes, octave-clef versus transpose accounting, written and sounding ranges, bar durations, pickups, accidentals, tuplets, ties, repeats/endings, final bars, voiceKinds, tempo, and instruments.",
      "Check that every simultaneous voice has complete bars, declared IDs match playback/notation maps, percussion uses intentional GM mappings, beam grouping is encoded through deliberate ABC whitespace, and the final ABC is abcjs-compatible.",
      "If render_score reports substantive mechanical warnings, repair the ABC and render once more. Parser acceptance proves syntax compatibility, not musical quality.",
    ],
  };
  const review = reviewSection(brief);
  const result: CompositionPlanOutput = {
    schemaVersion: 4, brief, guidance, review, compatibilityNotes: notes,
    renderHints: { tempo: brief.tempo, meter: brief.meter, voiceKinds: Object.fromEntries(brief.ensemble.map((voice) => [voice.voiceId, voice.kind])) },
    prompt: "",
  };
  result.prompt = renderPrompt(brief, guidance, review, notes);
  return result;
}
