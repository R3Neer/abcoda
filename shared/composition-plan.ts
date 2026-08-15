import { z } from "zod/v4";

export const styleFamilies = [
  "medieval_renaissance", "baroque", "classical", "romantic",
  "impressionist_coloristic", "jazz_blues", "pop_rock_funk_rnb",
  "folk_traditional_dance", "minimalist_electronic_cinematic",
  "atonal_post_tonal", "experimental_free", "other_hybrid",
] as const;

export const formFamilies = [
  "period", "sentence", "binary", "rounded_binary", "ternary", "rondo",
  "sonata", "variation", "through_composed", "strophic", "verse_chorus",
  "aaba", "twelve_bar_blues", "fugue_invention", "canon", "dance",
  "process", "free", "other",
] as const;

export const pitchFrameworks = [
  "tonal_functional", "tonal_cyclic", "modal", "blues", "jazz_extended",
  "pentatonic", "symmetric_collection", "atonal_centric",
  "set_or_interval_cell", "twelve_tone", "other",
] as const;

export const rhythmicFeels = [
  "straight", "swing", "shuffle", "syncopated_groove", "dance_pattern",
  "rubato_flexible", "motoric_ostinato", "asymmetric_additive", "free", "mixed",
] as const;

export const textureModels = [
  "monophonic", "heterophonic", "melody_accompaniment", "homorhythmic",
  "contrapuntal", "layered_groove", "color_mass", "mixed",
] as const;

export const instrumentFamilies = [
  "keyboard", "bowed_string", "plucked_string", "guitar", "bass", "woodwind",
  "brass", "voice", "pitched_percussion", "drum_kit",
  "unpitched_percussion", "electronic", "other",
] as const;

export const voiceRoles = [
  "melody", "bass", "harmony", "countermelody", "inner_voice", "beat",
  "color", "solo", "other",
] as const;

export const difficultyLevels = ["beginner", "intermediate", "advanced", "virtuosic"] as const;
export const compositionIntents = ["performance", "study", "illustration", "accompaniment", "sketch"] as const;
export const compositionEffortLevels = ["quick", "standard", "careful", "exhaustive"] as const;

const sectionSchema = z.object({
  label: z.string().min(1).max(40),
  measures: z.number().int().min(1).max(512).optional(),
  function: z.string().min(1).max(160),
});

const ensembleVoiceSchema = z.object({
  voiceId: z.string().min(1).max(32).regex(/^[A-Za-z0-9_.-]+$/),
  instrument: z.string().min(1).max(100),
  family: z.enum(instrumentFamilies).default("other"),
  role: z.enum(voiceRoles),
  kind: z.enum(["pitched", "unpitched_percussion"]).default("pitched"),
  transpositionSemitones: z.number().int().min(-36).max(36).default(0)
    .describe("Written-to-sounding playback transposition; 0 for concert-pitch notation."),
});

export const compositionBriefSchema = z.object({
  styleFamily: z.enum(styleFamilies).describe("The governing idiom; style controls vocabulary, not automatically the form or pitch system."),
  styleDetail: z.string().min(1).max(160).optional().describe("Era, genre, regional practice, or high-level traits. Required in practice for a specific tradition."),
  formFamily: z.enum(formFamilies).default("other").describe("Structural archetype used to select form-specific guidance."),
  form: z.string().min(1).max(240).describe("Concrete phrase/section plan and any deliberate alteration of the archetype."),
  sectionPlan: z.array(sectionSchema).max(24).default([]),
  measures: z.number().int().min(1).max(512).describe("Target written measure count before repeat expansion."),
  meter: z.string().min(1).max(40).describe("ABC-compatible meter or deliberate free meter."),
  tempo: z.number().int().min(20).max(300).describe("Quarter-note beats per minute for ABCoda playback."),
  rhythmicFeel: z.enum(rhythmicFeels).default("mixed"),
  pitchFramework: z.enum(pitchFrameworks).default("other")
    .describe("The operative pitch/harmonic system. This overrides stylistic defaults when they conflict."),
  pitchLanguage: z.string().min(1).max(200).describe("Specific key, mode, collection, row, centricity, chord language, or other organisation."),
  texture: z.enum(textureModels).default("mixed"),
  difficulty: z.enum(difficultyLevels),
  effort: z.enum(compositionEffortLevels).default("standard")
    .describe("Composition and silent-review effort; independent of performer difficulty."),
  intent: z.enum(compositionIntents),
  ensemble: z.array(ensembleVoiceSchema).min(1).max(32),
  constraints: z.array(z.string().min(1).max(240)).max(24).default([]),
  departures: z.array(z.string().min(1).max(240)).max(16).default([])
    .describe("Explicit permissions to depart from ordinary conventions; these override generated defaults."),
});

export type CompositionBrief = z.infer<typeof compositionBriefSchema>;

const guidanceSchema = z.object({
  priorities: z.array(z.string()), style: z.array(z.string()), form: z.array(z.string()),
  pitch: z.array(z.string()), rhythm: z.array(z.string()), texture: z.array(z.string()),
  instruments: z.array(z.string()), difficultyAndIntent: z.array(z.string()),
  notation: z.array(z.string()), preflight: z.array(z.string()),
});

const reviewSchema = z.object({
  strategy: z.array(z.string()),
  form: z.array(z.string()),
  style: z.array(z.string()),
  pitch: z.array(z.string()),
  rhythm: z.array(z.string()),
  texture: z.array(z.string()),
  instruments: z.array(z.string()),
  integration: z.array(z.string()),
});

export const compositionPlanOutputSchema = z.object({
  schemaVersion: z.literal(3),
  brief: compositionBriefSchema,
  guidance: guidanceSchema,
  review: reviewSchema,
  compatibilityNotes: z.array(z.string()),
  renderHints: z.object({
    tempo: z.number().int(), meter: z.string(),
    voiceKinds: z.record(z.string(), z.enum(["pitched", "unpitched_percussion"])),
  }),
  prompt: z.string(),
});

export type CompositionPlanOutput = z.infer<typeof compositionPlanOutputSchema>;
type StyleFamily = CompositionBrief["styleFamily"];
type FormFamily = CompositionBrief["formFamily"];
type PitchFramework = CompositionBrief["pitchFramework"];
type RhythmicFeel = CompositionBrief["rhythmicFeel"];
type TextureModel = CompositionBrief["texture"];
type InstrumentFamily = CompositionBrief["ensemble"][number]["family"];
type CompositionEffort = CompositionBrief["effort"];

const styleGuidance: Record<StyleFamily, string[]> = {
  medieval_renaissance: [
    "Let modal centre, melodic contour, text/phrase, and independent singable lines govern the style; avoid importing later functional harmony by reflex.",
    "Control consonance and dissonance according to the requested contrapuntal practice, including preparation, metric placement, suspension, and resolution where historically relevant.",
  ],
  baroque: [
    "Derive surface activity from compact motives through imitation, sequence, invertible relationships, ornament, and directed bass motion rather than generic arpeggiation.",
    "Use rhetoric, harmonic rhythm, contrapuntal density, and cadential strength to articulate phrase and tonal direction; reserve stile antico restrictions for requests that actually call for them.",
  ],
  classical: [
    "Make initiating, medial, and cadential functions audible; use clear thematic economy, cadential hierarchy, contrast, and proportion without forcing every unit into four-plus-four bars.",
    "Let accompaniment pattern, register, articulation, and harmonic rhythm clarify the form while the principal material remains recognisable under development.",
  ],
  romantic: [
    "Use expanded or irregular phrase rhythm, chromatic voice leading, mixture, tonicisation, registral growth, and expressive pacing in service of a long-range arrival.",
    "Treat density, rubato-like surface detail, and intensified dissonance as directed expressive resources, not as substitutes for thematic continuity.",
  ],
  impressionist_coloristic: [
    "Organise colour through mode or collection, pedals, planing, added-note sonorities, spacing, resonance, register, and timbral succession.",
    "Parallel motion and unresolved colour tones may be the grammar; preserve intentional sonority instead of repairing it into common-practice voice leading.",
  ],
  jazz_blues: [
    "Define groove and chorus/form before detail; use blues, modal, or functional syntax as specified, with selective extensions, alterations, approach tones, and idiomatic phrasing.",
    "Connect voicings through guide tones and purposeful bass motion; leave rhythmic and registral space instead of stacking every available tension.",
  ],
  pop_rock_funk_rnb: [
    "Build around a memorable hook, riff, groove, or vocal-shaped idea; use sectional changes in density, register, instrumentation, and harmonic rhythm to create momentum.",
    "Treat beat, bass, harmonic filler, melody, and optional novelty/call-response as functional layers; parallel motion and cyclic root-position harmony may be idiomatic.",
  ],
  folk_traditional_dance: [
    "Respect the named tradition's tune type, accent pattern, mode, range, phrase length, ornaments, repetition, and social or dance function.",
    "Do not fabricate authenticity from generic drones and exotic scales: use the supplied styleDetail conservatively and avoid mixing regional markers without a reason.",
  ],
  minimalist_electronic_cinematic: [
    "Make process, ostinato, pulse, layering, density, register, timbral transfer, and long-range accumulation or subtraction carry the form.",
    "Give repetition a perceivable process or dramatic function; distinguish a loop that establishes identity from one that merely avoids development.",
  ],
  atonal_post_tonal: [
    "Make the declared collection, interval cell, axis, centricity, set relation, or row operations audible through recurrence and transformation.",
    "Create tension and arrival through register, rhythm, density, invariant pitches, contour, and formal recurrence rather than secretly imposing tonal cadences.",
  ],
  experimental_free: [
    "Let gesture, register, density, articulation, silence, process, or timbre provide perceptible structure when metre and functional harmony do not.",
    "Use indeterminacy or discontinuity only to the degree representable in ABC; translate the concept into precise playable events rather than vague notation.",
  ],
  other_hybrid: [
    "Assign each source idiom a domain—pitch/harmony, rhythm, form, texture, or instrumentation—so the hybrid has a hierarchy rather than an averaged generic style.",
    "When conventions conflict, follow the explicit pitchFramework, formFamily, rhythmicFeel, texture, and departures fields instead of guessing which style wins.",
  ],
};

const formGuidance: Record<FormFamily, string[]> = {
  period: [
    "Shape an antecedent and consequent around related opening material, with the first arrival less conclusive than the second; parallelism may be exact, varied, or contrasting as specified.",
    "Do not equate period with a compulsory eight bars: preserve antecedent/consequent function under expansions, contractions, or asymmetry.",
  ],
  sentence: [
    "Use a presentation that states and repeats or sequences a basic idea, followed by continuation through fragmentation, liquidation, acceleration, harmonic motion, and cadence.",
    "Make the continuation sound more processive than the presentation; do not merely write four unrelated two-bar ideas.",
  ],
  binary: [
    "Create two dependent spans with a meaningful first-section departure or arrival and a second-section return/closure; decide whether each section is open/closed and sectional/continuous.",
    "Use repeats only when they serve the style, and make the second part answer or reinterpret the first rather than act as an unrelated B piece.",
  ],
  rounded_binary: [
    "After contrasting material at the start of the second part, bring back the opening idea within that same second part, often shortened or adjusted for final closure.",
    "Keep the returning A material subordinate to the two-part design; do not accidentally turn it into a fully independent ternary reprise.",
  ],
  ternary: [
    "Build A–B–A or A–B–A′ with a proportionate B that contrasts through key/collection, texture, register, rhythm, material, or instrumentation.",
    "Make the return perceptible and consequential: restore stability, transform the opening after the contrast, or both.",
  ],
  rondo: [
    "Alternate a recognisable refrain with episodes; control the tonal/pitch, textural, and thematic distance of each episode and the freshness of each return.",
    "Plan a five- or seven-part design appropriate to the requested scope rather than endlessly alternating labels.",
  ],
  sonata: [
    "Plan exposition functions, a destabilising development, and a recapitulatory return/resolution; scale transitions, secondary material, closing material, and coda to the available length.",
    "Treat sonata as a dramatic tonal/thematic process, not merely ABA with different key signatures; for non-tonal use, translate opposition and return into the declared pitch language.",
  ],
  variation: [
    "State the theme or governing pattern clearly, choose invariants, and vary melody, bass, harmony, rhythm, metre, texture, register, ornament, or orchestration deliberately.",
    "Order variations to create an arc; avoid disguising unrelated miniatures under a repeated bar count.",
  ],
  through_composed: [
    "Allow new sections or continuously evolving material, but bind them through recurring interval, contour, rhythm, harmony/collection, text, or timbral identity.",
    "Track large-scale energy and arrival explicitly because literal return will not supply coherence automatically.",
  ],
  strophic: [
    "Design music that can support repeated stanzas while preserving phrase clarity, prosody, and a reusable harmonic/rhythmic frame.",
    "If variation between strophes is requested, keep the shared identity audible and alter accompaniment, register, ornament, or cadence strategically.",
  ],
  verse_chorus: [
    "Differentiate verse and chorus by function: the verse advances material or narrative, while the chorus concentrates the main hook; use auxiliary sections only when useful.",
    "Create sectional lift or contrast through melody, register, density, groove, harmony, and instrumentation—not merely louder dynamics.",
  ],
  aaba: [
    "Make the A strain memorable and returnable, give the bridge a clear harmonic, melodic, registral, or textural departure, and let the final A sound informed by that contrast.",
    "Allocate the four spans deliberately; do not confuse 32-bar AABA terminology with verse–chorus form.",
  ],
  twelve_bar_blues: [
    "Articulate three four-bar functions—opening tonic area, move toward subdominant/response, and dominant/turnaround resolution—while allowing idiomatic substitutions.",
    "Preserve the 12-bar hearing and phrase response when reharmonising; integrate riffs, blue-note language, fills, and turnaround with the groove.",
  ],
  fugue_invention: [
    "Define subject length/profile, answer strategy, countersubject or companion, entry order, episodes, pitch route, and final intensification before writing the full texture.",
    "Derive episodes and counterpoint from subject material; keep entries audible through register and density, and do not label arbitrary imitation a fugue.",
  ],
  canon: [
    "Specify the imitative rule—delay, interval, direction, transformation, and voices—and test every overlap for harmonic/pitch and registral viability.",
    "Plan how the canon begins and ends through a free voice, cadential release, truncation, or designed loop instead of abandoning the rule accidentally.",
  ],
  dance: [
    "Let the named dance's metre, grouping, accent, characteristic rhythm, tempo, phrase design, and repeat practice govern the motion.",
    "Preserve bodily pulse and phrase-level lift; ornaments and harmony must serve the specific dance/tradition rather than a generic period costume.",
  ],
  process: [
    "State a perceptible process—addition, subtraction, phase, rotation, substitution, accumulation, transformation, or orchestral transfer—and define its start and destination.",
    "Introduce exceptions only as structural events; otherwise the listener cannot distinguish process from arbitrary repetition.",
  ],
  free: [
    "Define continuity through gesture, contour, register, density, timbre, text, interval, or proportion, and map a clear energy trajectory.",
    "Free form removes a preset template, not the need for memory, contrast, pacing, and arrival.",
  ],
  other: [
    "Translate the concrete description into ordered sections or phrase functions with proportions, contrast, return, transition, climax, and closure explicitly planned.",
    "If it borrows an established archetype, follow its perceptual logic without pretending the label alone guarantees it.",
  ],
};

const pitchGuidance: Record<PitchFramework, string[]> = {
  tonal_functional: [
    "Establish tonic hierarchy, control harmonic rhythm, prolong stable functions, prepare predominant/dominant motion, and differentiate cadential strength according to style.",
    "Treat non-chord tones as intentional melodic/rhythmic events; allow chromaticism without losing long-range function.",
  ],
  tonal_cyclic: [
    "Use a repeating root-position or loop-based progression as stable syntax and create direction through melody, bass, rhythm, inversion, texture, register, and sectional recombination.",
    "Do not force every loop into tonic–predominant–dominant rhetoric; define where the cycle begins perceptually and how sections refresh it.",
  ],
  modal: [
    "Make the modal final/centre and characteristic degrees audible through melodic emphasis, cadential figures, drones/pedals, or modal harmony appropriate to the style.",
    "Avoid neutralising the mode through automatic leading-tone dominant–tonic syntax unless mixture is explicitly intended.",
  ],
  blues: [
    "Coordinate blue-note inflection, call-response, riff vocabulary, dominant-quality tonic/subdominant possibilities, turnaround, and groove rather than treating blues as a major scale with flattened decorations.",
    "Keep melodic inflection and accompaniment harmony in productive tension when idiomatic; not every chromatic pitch needs classical resolution.",
  ],
  jazz_extended: [
    "Choose extensions and alterations by function, melody, register, and voice leading; prioritise guide tones and economical connections among voicings.",
    "Distinguish functional ii–V motion, modal harmony, planing, substitutions, and pedal harmony instead of mixing them indiscriminately.",
  ],
  pentatonic: [
    "Use contour, register, rhythmic identity, pedal/ostinato, rotation, transposition, or complementary material to prevent the limited collection from becoming shapeless.",
    "Name the exact pentatonic collection and do not claim a cultural style from the scale alone.",
  ],
  symmetric_collection: [
    "Exploit interval pattern, limited transpositions, common tones, axes, planing, and registral colour of the specified whole-tone, octatonic, augmented, or other collection.",
    "Create contrast through collection change, subset emphasis, rhythm, texture, or register because functional roots may be ambiguous.",
  ],
  atonal_centric: [
    "Create a perceptible centre without functional tonality through recurrence, registral anchoring, pedals, interval attraction, rhythmic emphasis, or formal placement.",
    "Control aggregate saturation and chromatic density so centricity remains audible rather than asserted only in the description.",
  ],
  set_or_interval_cell: [
    "Define the governing interval/set cell and derive motives, verticalities, transpositions, inversions, registral projections, and larger spans from it.",
    "Balance invariance with transformation; preserve enough intervallic identity for the listener to recognise relationships.",
  ],
  twelve_tone: [
    "State the row and use prime, inversion, retrograde, and retrograde-inversion forms or derived segments deliberately; track order and aggregate completion accurately.",
    "Use rhythm, contour, register, partition, invariants, and orchestration to phrase the row; serial bookkeeping alone does not create musical form.",
  ],
  other: [
    "Define stable, unstable, connecting, and arrival behavior explicitly for the stated pitch language; do not fall back unconsciously to C-major defaults.",
    "Choose a small set of repeatable pitch relationships and make their hierarchy audible rather than relying on labels.",
  ],
};

const rhythmGuidance: Record<RhythmicFeel, string[]> = {
  straight: ["Establish a clear subdivision and use repetition, accent, rests, ties, and phrase-level variation without unintended swing or mechanical sameness."],
  swing: ["Preserve swing as a performance subdivision and accent/phrasing practice; avoid spelling every swung pair as a rigid triplet unless the notation truly requires it."],
  shuffle: ["Build the groove from persistent long–short triplet subdivision, backbeat/accent placement, bass interaction, and controlled fills without confusing shuffle with generic swing."],
  syncopated_groove: ["Design syncopation against a stable metric reference; coordinate attacks, ties, anticipations, rests, bass, and beat layer so displacement strengthens the groove."],
  dance_pattern: ["Use the requested dance's characteristic beat grouping, accent hierarchy, pickup behavior, cadence rhythm, and phrase periodicity consistently."],
  rubato_flexible: ["Keep notated proportion and phrase direction clear while using agogic space, rests, harmonic rhythm, and surface flexibility to imply rubato; playback is approximate."],
  motoric_ostinato: ["Maintain a recognisable pulse/ostinato and create motion through phase, accent shift, additive change, harmony, register, density, or orchestration rather than random interruption."],
  asymmetric_additive: ["State the beat grouping explicitly, for example 2+3 or 3+2+2, and make accents, beaming, bass, and motives reinforce it across the ensemble."],
  free: ["Use M:none only intentionally; organise durations and silence through gesture, breath, proportion, text, or process so free rhythm remains performable and perceptible."],
  mixed: ["Name where rhythmic characters change, preserve a shared pulse or deliberate transition, and use the change to articulate form rather than switching arbitrarily."],
};

const textureGuidance: Record<TextureModel, string[]> = {
  monophonic: ["Expose one line clearly; make contour, rhythm, articulation, register, implied harmony, and breathing/phrasing carry the full form."],
  heterophonic: ["Keep a shared melodic identity audible while coordinating simultaneous variants, ornaments, rhythmic offsets, registers, and cadential convergence."],
  melody_accompaniment: ["Protect the melody's register and rhythmic salience; make accompaniment supply pulse, bass, harmony, and transitions without continuously competing."],
  homorhythmic: ["Control spacing, doubling, chordal balance, text/accent alignment, and voice-leading while using occasional independence or register change to avoid inert block motion."],
  contrapuntal: ["Give lines independent contour and rhythm while controlling imitation, dissonance, crossing, spacing, density, and cadential coordination according to style."],
  layered_groove: ["Assign beat, bass, harmonic filler, melody, and optional novelty/call-response roles; interlock rhythmic profiles and vary entries/exits across sections."],
  color_mass: ["Shape sonority through register, spacing, doubling, articulation, density, attack/release, and timbral transfer; make changes in the mass articulate form."],
  mixed: ["Map texture by section and make each change serve hierarchy, contrast, buildup, release, or return; avoid changing it merely because more voices are available."],
};

const instrumentGuidance: Record<InstrumentFamily, string[]> = {
  keyboard: ["Respect hand span/distribution, leaps, repeated notes, voicing, register, and texture; use separate voices for independent hands, and treat nuanced pedal playback as unavailable."],
  bowed_string: ["Respect open strings, position/register, crossings, bow length/articulation, double-stop feasibility, sustained balance, and the difference between solo and section writing."],
  plucked_string: ["Respect tuning, courses/strings, resonance, damping, repeated-note speed, chord shapes, and decay; do not write keyboard voicings by default."],
  guitar: ["Respect tuning, fretboard position, practical stretch, barrés, string crossings, repeated attacks, sustain, chord fingering, and whether the part is melodic, riff-based, or chordal."],
  bass: ["Keep the line physically playable and registrally clear; coordinate roots, approaches, articulations, rests, and rhythmic placement with harmony and groove instead of doubling continuously."],
  woodwind: ["Respect written/sounding transposition, breath length, register breaks/colour, fingering difficulty, articulation speed, leaps, and endurance; leave breaths in exposed lines."],
  brass: ["Respect transposition, overtone/register behaviour, breath, attack, mute assumptions, dynamic balance, endurance, and recovery after high or loud passages."],
  voice: ["Respect tessitura more than theoretical extremes, breath, vowel sustain, consonant placement, prosody, text stress, leaps, registration, and ensemble balance."],
  pitched_percussion: ["Respect instrument-specific range, sustain/damping, roll technique, mallet changes, chord capacity, and mobility; use pitched notation and an appropriate clef/key."],
  drum_kit: ["Design a physically possible limb pattern, stable coordination, idiomatic kit roles, and fills that lead into form; use percussion-clef/no-key notation, noting that playback is approximate."],
  unpitched_percussion: ["Specify instruments/timbres and feasible simultaneous actions, rolls, damping, stick/mallet changes, cues, and rests; use percussion clef and no key signature."],
  electronic: ["Translate timbral intent into register, envelope-like articulation, density, layering, repetition, and pitch/rhythm that ABC and the available GM approximation can communicate."],
  other: ["Verify the exact instrument's range, transposition, technique, sustain, articulation, polyphonic capacity, and notation conventions before composing its part."],
};

const styleReviewGuidance: Record<StyleFamily, string[]> = {
  medieval_renaissance: ["Check that modal centre, singable line, cadence, consonance/dissonance treatment, and text/phrase remain coherent; flag accidental later functional-tonal reflexes or mechanical pseudo-species writing."],
  baroque: ["Look for imitation that is merely cosmetic, sequences without direction, voices that collapse into accompaniment, inert bass motion, weak cadential hierarchy, unrelated ornament, or stile antico restrictions applied where the requested Baroque practice does not require them."],
  classical: ["Check whether thematic economy, initiating/medial/cadential functions, cadence hierarchy, accompaniment pattern, contrast, and proportion are perceptible; flag square regularity or decorative activity that obscures formal rhetoric."],
  romantic: ["Look for excessively square phrase rhythm, chromatic decoration without direction, uniform density, mechanical sequences, an unprepared climax, registral or harmonic tension without consequence, and material too weak to sustain the long-range trajectory."],
  impressionist_coloristic: ["Audit collection/mode, pedals, spacing, register, resonance, timbral contrast, and evolution of colour. Do not penalise parallel motion, unresolved colour tones, or non-functional sonority, and ensure the draft was not repaired toward common-practice voice leading by reflex."],
  jazz_blues: ["Check groove and chorus/form first, then idiomatic phrase placement, blue-note or modal/functional consistency, guide-tone continuity, bass purpose, voicing clarity, and selective tensions; flag crowded extensions or classical resolutions that erase the idiom."],
  pop_rock_funk_rnb: ["Test hook identity, groove, beat–bass relationship, functional layers, sectional lift, register/density changes, and singable phrasing; do not condemn cyclic harmony or parallel motion merely for lacking common-practice function."],
  folk_traditional_dance: ["Compare tune type, mode, accent, range, phrase length, ornament, repeats, and social/dance function with the named tradition; flag generic exoticism, mixed regional markers, or invented claims of authenticity."],
  minimalist_electronic_cinematic: ["Do not treat repetition itself as a defect. Determine whether a perceptible process or dramatic trajectory governs change, whether repetition establishes identity rather than avoiding development, and whether exceptions to the process have structural purpose."],
  atonal_post_tonal: ["Check recurrence and transformation of the declared cell, set, row, axis, or centre through invariants, register, density, contour, and formal placement. Do not demand tonal cadences or repair dissonance into functional tonality."],
  experimental_free: ["Check whether gesture, silence, register, density, articulation, timbre, or process creates memory and direction, and whether every intended effect is encoded precisely enough to perform in ABC rather than surviving only as prose."],
  other_hybrid: ["Verify that each source idiom still governs its assigned domain and that conflicts are resolved by the brief hierarchy; flag a generic averaged style or an attention-grabbing borrowed gesture with no structural integration."],
};

const formReviewGuidance: Record<FormFamily, string[]> = {
  period: ["Verify related antecedent/consequent identity and a meaningful difference in arrival strength where appropriate; detect two adjacent phrases with no question–answer function, but do not impose an automatic eight-bar template."],
  sentence: ["Verify that presentation establishes a basic idea plus repetition/sequence and that continuation becomes more processive through fragmentation, liquidation, acceleration, harmonic motion, or cadence; flag four juxtaposed ideas with no functional change."],
  binary: ["Check that the first span creates a meaningful departure/arrival and the second answers, returns, or closes it; flag two unrelated miniatures or repeats that contribute nothing to the two-part function."],
  rounded_binary: ["Check that contrasting material begins the second part and the opening idea returns recognisably within it; flag either an inaudible rounding or a full independent reprise that accidentally turns the design into ternary."],
  ternary: ["Confirm that A establishes recognisable identity, B provides substantive contrast, and A/A′ is heard as return; review proportions, transitions, climax placement, and what the return changes or resolves."],
  rondo: ["Check refrain recognisability, episode differentiation, tonal/pitch and textural distance, freshness of returns, transition economy, and whether the final return closes an arc rather than merely repeating the alternation."],
  sonata: ["Audit exposition oppositions, transition, secondary/closing function, developmental destabilisation, recapitulatory return/resolution, and scale; flag a labelled ABA whose thematic or tonal/pitch conflicts never undergo a consequential process."],
  variation: ["Identify the invariant that makes every variation belong to the theme, then check that successive transformations differ meaningfully and form an arc; flag unrelated miniatures or surface decoration without a new perspective."],
  through_composed: ["Trace recurring interval, contour, rhythm, collection, text, or timbre across new sections and test the global energy/arrival curve; flag novelty that destroys memory or continuity that merely disguises stasis."],
  strophic: ["Check that the reusable frame supports every stanza's prosody and cadence and that any variation preserves identity; flag accompaniment detail that depends on only one stanza or repeated music with no expressive fit."],
  verse_chorus: ["Verify that verses advance material while the chorus concentrates the principal hook, and that pre-chorus/bridge functions are earned; flag sections distinguished only by volume or labels rather than melody, register, density, groove, or harmony."],
  aaba: ["Check the A strain's returnability, the bridge's substantive departure, and the final A's renewed function; flag a bridge that feels like another A or an AABA label masking verse–chorus behaviour."],
  twelve_bar_blues: ["Hear the three four-bar functions, response pattern, turnaround, riff/fill placement, and groove despite substitutions; flag reharmonisation that obscures the 12-bar cycle or a nominal blues lacking idiomatic phrase tension."],
  fugue_invention: ["Verify a recognisable subject, audible entries, coherent answer strategy, viable companion/countersubject, episodes derived from the material, and register/density that reveals entries; flag counterpoint that degenerates into melody plus filler."],
  canon: ["Re-test delay, interval, direction, transformation, and every overlap; verify that the rule stays audible and that beginning/end are designed, not produced by silently abandoning the canon."],
  dance: ["Check characteristic metre/grouping, accent, pickup, tempo, bodily pulse, phrase lift, cadence rhythm, and repeat practice; flag generic periodic music wearing only a dance label."],
  process: ["Verify that the process is perceptible, directional, and has a meaningful destination; distinguish identity-building repetition from stalled repetition and require every exception to perform a structural function."],
  free: ["Trace memory, contrast, pacing, energy, and arrival through gesture, contour, register, density, timbre, or proportion; flag arbitrary succession hidden behind the absence of a preset form."],
  other: ["Reconstruct the declared section/phrase functions and test proportion, transition, contrast, return, climax, and closure; flag labels added after the fact that do not correspond to audible events."],
};

const pitchReviewGuidance: Record<PitchFramework, string[]> = {
  tonal_functional: ["Reconstruct the harmonic trajectory phrase by phrase: test tonicisations/chromaticism, harmonic rhythm, dissonance, style-appropriate voice leading, and whether cadential hierarchy supports the form."],
  tonal_cyclic: ["Check where the loop begins perceptually and whether bass, inversion, melody, rhythm, register, and texture refresh or redirect it; do not demand classical predominant–dominant rhetoric from a deliberately cyclic syntax."],
  modal: ["Check that final/centre and characteristic degrees remain audible and that cadence, drone/pedal, melody, and harmony do not accidentally neutralise the mode through habitual leading-tone tonality."],
  blues: ["Check blue-note inflection, riff/call-response, melodic–harmonic tension, dominant-quality areas where idiomatic, and turnaround; do not force every chromatic pitch into classical resolution."],
  jazz_extended: ["Audit guide-tone paths, melody–voicing compatibility, bass function, spacing, and the purpose of every extension/alteration; flag indiscriminate tension stacking or unexplained switching among functional, modal, planar, and pedal syntax."],
  pentatonic: ["Check exact collection membership and whether contour, rhythm, register, transposition, pedal, or complementary material supplies hierarchy; flag shapeless saturation or unsupported cultural claims based on scale alone."],
  symmetric_collection: ["Check collection integrity, common tones, axes, limited transpositions, subset emphasis, and contrast by register/rhythm/texture; do not invent functional roots where the declared collection makes them ambiguous."],
  atonal_centric: ["Test whether recurrence, anchoring, register, rhythm, formal placement, or interval attraction makes the centre genuinely perceptible and whether chromatic saturation obscures it."],
  set_or_interval_cell: ["Trace the cell/set through motives, verticalities, transposition, inversion, and register; flag transformations that lose recognisable interval identity or literal repetitions that never acquire function."],
  twelve_tone: ["Verify row/order and intended transformations or partitions, then assess invariants, contour, register, rhythm, and phrasing; flag bookkeeping errors as well as serial correctness that produces no musical articulation."],
  other: ["Reconstruct the stated stable, unstable, connecting, and arrival behaviours and test their recurrence; flag unconscious C-major defaults or a pitch label with no audible hierarchy."],
};

const rhythmReviewGuidance: Record<RhythmicFeel, string[]> = {
  straight: ["Check subdivision, accent, rests, ties, activity, and phrase-level variation for clarity without unintended swing or mechanical sameness."],
  swing: ["Check metric feel, phrase placement, accents, articulation, and coordination with bass/groove; do not require literal triplet spelling unless the notation itself calls for it."],
  shuffle: ["Check persistent long–short subdivision, backbeat/accent, bass lock, and fill placement; flag drift into generic swing or fills that interrupt rather than lead the form."],
  syncopated_groove: ["Verify a stable metric reference beneath anticipations, ties, rests, and displaced attacks, and check beat–bass–melody interlock; flag syncopation that merely muddies the pulse."],
  dance_pattern: ["Check characteristic grouping, accent hierarchy, pickup, cadence rhythm, and phrase periodicity against the named dance; flag accents or fills that break bodily continuity."],
  rubato_flexible: ["Check notated proportional clarity, breath, harmonic pacing, and phrase direction beneath flexibility; flag arbitrary duration changes or over-quantisation that erases rubato character."],
  motoric_ostinato: ["Check ostinato recognisability and long-range change by accent, phase, harmony, register, density, or orchestration; flag random interruption or unchanged repetition with no process."],
  asymmetric_additive: ["Recount grouping in every layer and verify beaming, accent, bass, and motives reinforce it; flag parts whose competing accents accidentally erase the additive metre."],
  free: ["Check that duration and silence follow gesture, breath, text, proportion, or process and remain performable; flag arbitrary values that communicate neither freedom nor structure."],
  mixed: ["Locate each rhythmic-character change, test the transition or shared pulse, and verify that the contrast articulates form rather than appearing as an unexplained switch."],
};

const textureReviewGuidance: Record<TextureModel, string[]> = {
  monophonic: ["Check whether one line alone sustains contour, rhythm, register, articulation, implied harmony, breath, contrast, and arrival; remove filler that harmony would otherwise conceal."],
  heterophonic: ["Check that variants share an unmistakable melodic identity, offsets and ornaments remain intentional, and cadential convergence is controlled rather than merely untidy unison."],
  melody_accompaniment: ["Check that accompaniment leaves registral and rhythmic space, supports direction, and changes with form; flag automatic filler, constant competition, or doubling that weakens the melody."],
  homorhythmic: ["Audit spacing, doubling, balance, text/accent alignment, and style-relevant voice leading; flag inert block motion or inner parts that exist only to complete chords."],
  contrapuntal: ["Check each line independently for contour and rhythm, then together for imitation, dissonance, crossing, spacing, density, and cadence; flag nominal counterpoint that becomes accompaniment."],
  layered_groove: ["Solo the conceptual beat, bass, harmony, melody, and novelty layers: each must have a role, interlock cleanly, and enter/exit with form; flag constant full-stack density."],
  color_mass: ["Check the evolution of register, spacing, doubling, articulation, density, attack/release, and timbral transfer; flag an attractive sonority held without formal consequence."],
  mixed: ["Map texture by section and verify that each change creates hierarchy, contrast, buildup, release, or return; flag gratuitous switching or continuous tutti caused merely by available voices."],
};

const instrumentReviewGuidance: Record<InstrumentFamily, string[]> = {
  keyboard: ["Re-test hand allocation, spans, leaps, repeated notes, voicing, register, independence, and recovery; flag textures that are theoretically valid but physically or expressively awkward under two hands."],
  bowed_string: ["Re-test strings/positions, crossings, bow length, articulation, double stops, sustain, register balance, and solo-versus-section assumptions; flag impossible simultaneities or phrasing with no bow logic."],
  plucked_string: ["Re-test tuning, string/course allocation, chord shapes, resonance, damping, repeated attacks, mobility, and decay; flag keyboard-derived voicings or sustain the instrument cannot produce."],
  guitar: ["Re-test fretboard positions, stretches, barrés, string crossings, chord shapes, repeated attacks, sustain, and voice leading across strings; flag passages requiring impossible hand relocation or keyboard-like spacing."],
  bass: ["Check range, mobility, rests, articulation, approach tones, root/independent motion, and rhythmic lock with harmony/groove; flag continuous doubling or density that destroys low-register clarity."],
  woodwind: ["Mark breaths and re-test tessitura, register breaks/colour, fingering combinations, articulation speed, leaps, transposition, and endurance; flag exposed phrases with no viable breath or recovery."],
  brass: ["Mark breaths/recovery and re-test sounding transposition, overtone/register behaviour, attacks, endurance, mute assumptions, high/loud duration, and ensemble balance."],
  voice: ["Read the line as sung text: test tessitura, breath, vowel sustain, consonant placement, prosody/stress, leaps, registration, and balance; flag technically possible notes that make the phrase unsingable."],
  pitched_percussion: ["Re-test exact range, mallet mobility, chord capacity, rolls, damping, sustain, and mallet changes; flag resonance collisions or gestures borrowed from sustaining instruments."],
  drum_kit: ["Assign every simultaneous event to a limb and check coordination, groove stability, fills, transitions, GM mapping, rests, and physical setup; flag impossible overlaps or fills with no formal destination."],
  unpitched_percussion: ["Re-test instrument identity, simultaneous actions, stick/mallet changes, rolls, damping, cues, rests, setup, and GM mapping; flag unspecified timbres or impossible rapid logistics."],
  electronic: ["Check whether register, envelope-like articulation, layering, density, repetition, and transitions communicate the timbral process under ABC/GM limits; flag effects promised only in prose."],
  other: ["Verify exact range, transposition, technique, sustain, articulation, polyphony, notation, endurance, and setup for the named instrument; do not approve the part from family-level assumptions alone."],
};

interface EffortReviewPlan {
  strategy: string[];
  integration: string[];
}

const effortReviewGuidance: Record<CompositionEffort, EffortReviewPlan> = {
  quick: {
    strategy: [
      "After the draft, run one brief integrated sanity check using the routed criteria below; fix the single most damaging mismatch, then proceed to mechanical preflight.",
      "Keep this proportionate to a casual or rapid request: do not turn a sound miniature into an iterative redesign unless a glaring structural or playability failure demands it.",
    ],
    integration: ["Check that the principal idea is recognisable, the ending is earned, and no section or part obviously contradicts the brief."],
  },
  standard: {
    strategy: [
      "After drafting, review material and formal function first; then review playability and notation readiness. Correct every clear substantive problem before mechanical preflight.",
      "Use the routed domain criteria below as observable tests, not as invitations to narrate a public self-critique.",
    ],
    integration: [
      "Check that repetition creates identity or function, every section changes the musical situation, and contrast does not erase the principal material.",
      "Check that climax/arrival, register, density, harmonic or pitch activity, rhythm, and texture support one coherent trajectory rather than several unrelated local successes.",
    ],
  },
  careful: {
    strategy: [
      "Plan before drafting, then run separate silent passes for form/material; style/pitch/rhythm; texture/instruments; and global integration before mechanical preflight.",
      "The first draft is not sacred. If a routed test exposes a substantive weakness, rewrite phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections instead of limiting revision to local polish.",
    ],
    integration: [
      "Identify any material that merely fills bars, can be removed without loss, or repeats because development was avoided; judge repetition and non-functional harmony only by the declared style and process.",
      "Track register, density, harmonic rhythm/pitch activity, texture, and rhythmic activity: flag long spans where too many remain constant without stylistic purpose.",
      "Check that each section changes the musical situation, the climax is prepared and consequential, striking gestures grow from established material, and contrast preserves identity.",
    ],
  },
  exhaustive: {
    strategy: [
      "Silently follow PLAN → DRAFT → FORM/MOTIF AUDIT → STYLE/PITCH AUDIT → RHYTHM/TEXTURE AUDIT → INSTRUMENT AUDIT → GLOBAL AUDIT → SUBSTANTIVE REVISION → SECOND GLOBAL AUDIT → MECHANICAL PREFLIGHT.",
      "The first draft is not sacred. Rebuild phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections whenever structural evidence demands it; deletion is preferable to polishing inert material.",
      "After revision, conduct a second global audit on the revised whole rather than assuming that local fixes preserved proportion, identity, balance, and trajectory.",
    ],
    integration: [
      "Find every bar-filling passage and ask what audible function would be lost if it vanished; remove or transform material with no answer.",
      "For every repetition, distinguish identity/process from avoidance of development using the declared idiom rather than a universal novelty bias.",
      "Verify that each section changes the musical situation, every transition alters expectation, and the climax is both prepared and consequential.",
      "Audit simultaneous constancy of register, density, harmonic rhythm/pitch activity, texture, and rhythmic activity; require either purposeful stasis or directed change.",
      "Verify that conspicuous gestures derive from established material, contrast retains identity, identity avoids stagnation, and no technically correct passage remains merely generic.",
    ],
  },
};

const difficultyGuidance: Record<CompositionBrief["difficulty"], string[]> = {
  beginner: ["Limit range, leaps, accidentals, independent layers, chord spans, subdivisions, tempo pressure, and simultaneous demands while preserving the defining style/form idea."],
  intermediate: ["Allow moderate independence, syncopation, chromaticism, position/register changes, and articulation variety, but provide preparation and recovery around difficult gestures."],
  advanced: ["Permit sustained independence, complex rhythm/harmony, wider range, rapid changes, and extended spans only when idiomatic and structurally motivated; avoid difficulty by clutter."],
  virtuosic: ["Use extreme speed, range, leaps, density, independence, endurance, or special techniques selectively as dramatic/formal events and keep them physically realisable."],
};

const intentGuidance: Record<CompositionBrief["intent"], string[]> = {
  performance: ["Deliver a complete, rehearsable arc with practical notation, breathing or page-turn-like rests where relevant, balanced difficulty, and a convincing ending."],
  study: ["Foreground the target concept or technique consistently, sequence difficulty progressively, avoid unrelated complications, and make success/failure musically audible."],
  illustration: ["Isolate the requested concept clearly and economically; prefer a short unmistakable example over a richer piece that obscures the lesson."],
  accompaniment: ["Leave registral, rhythmic, and dynamic space for the absent principal part; provide dependable cues, support, introductions/interludes/endings, and avoid stealing focus."],
  sketch: ["Prioritise the core motif, form, pitch plan, and textural trajectory; simplify secondary detail but still produce complete valid bars and a usable ending."],
};

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
  return {
    strategy: effortPlan.strategy,
    form: formReviewGuidance[brief.formFamily],
    style: styleReviewGuidance[brief.styleFamily],
    pitch: pitchReviewGuidance[brief.pitchFramework],
    rhythm: [
      ...rhythmReviewGuidance[brief.rhythmicFeel],
      "Inspect the engraved beam groups, not only the durations: beams must reveal the prevailing beat/subdivision, spaces in ABC must split groups deliberately, and an all-unbeamed run of eighth-or-shorter notes requires a musical reason rather than source-code formatting.",
    ],
    texture: textureReviewGuidance[brief.texture],
    instruments: families.flatMap((family) => instrumentReviewGuidance[family]),
    integration: effortPlan.integration,
  };
}

function notationSection(brief: CompositionBrief): string[] {
  const percussion = brief.ensemble.filter((voice) => voice.kind === "unpitched_percussion").map((voice) => voice.voiceId);
  const transposing = brief.ensemble.filter((voice) => voice.transpositionSemitones !== 0);
  return [
    `Encode M:${brief.meter}, Q:1/4=${brief.tempo}, and “${brief.pitchLanguage}” with an appropriate K: field; use K:none with explicit accidentals when a conventional key signature would misrepresent the pitch framework.`,
    "Begin X:1, T:, M:, L:, Q:, then V: declarations and finish the header with the first K:. For multiple voices add %%score, complete simultaneous bars, and end voices together with |].",
    percussion.length > 0 ? `Set notation.voiceKinds for ${percussion.join(", ")} to unpitched_percussion and select playback instrument percussion; ABCoda will enforce percussion clef, voice-local K:none, and the General MIDI percussion sample map. Choose staff pitches as deliberate GM percussion mappings rather than arbitrary melody notes.` : "Use notation.voiceKinds={} unless an explicitly unpitched percussion voice is added.",
    transposing.length > 0 ? `Apply explicit ABC transpose= values for ${transposing.map((voice) => `${voice.voiceId}=${voice.transpositionSemitones}`).join(", ")}; verify written and sounding ranges separately.` : "Keep notation at concert pitch unless exact instrument convention requires a written transposing part.",
    "Encode beams deliberately: in ABC, adjacent eighth-or-shorter note tokens without spaces share a beam, while whitespace breaks the beam. Use no spaces inside an intended group and spaces between groups; backticks may improve ABC readability without breaking a beam. Group by the audible meter—simple beats or accepted submeasure groups, dotted beats in compound meter, and the declared subdivision in additive/irregular meter. Do not beam indiscriminately across rests, barlines, or meaningful metric/phrasing boundaries; syllabic vocal and historically specific practices may justify separate flags.",
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
    ["SILENT MUSICAL REVIEW STRATEGY", review.strategy],
    ["REVIEW — FORM AND MATERIAL", review.form],
    ["REVIEW — STYLE", review.style],
    ["REVIEW — PITCH AND HARMONY", review.pitch],
    ["REVIEW — RHYTHM", review.rhythm],
    ["REVIEW — TEXTURE", review.texture],
    ["REVIEW — INSTRUMENTS", review.instruments],
    ["REVIEW — GLOBAL INTEGRATION", review.integration],
    ["MECHANICAL ABC PREFLIGHT", guidance.preflight],
  ];
  if (notes.length > 0) sections.splice(1, 0, ["COMBINATION NOTES", notes]);
  return [
    `COMPOSITION PROFILE: ${brief.styleFamily}${brief.styleDetail ? ` — ${brief.styleDetail}` : ""}; ${brief.formFamily}; ${brief.pitchFramework}; ${brief.rhythmicFeel}; ${brief.texture}; effort=${brief.effort}.`,
    ...sections.map(([title, lines]) => `${title}\n${lines.map((line) => `- ${line}`).join("\n")}`),
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
      "Verify X/T/M/L/Q/K order, V:/%%score IDs, clefs and transposition, bar durations, pickups, accidentals, tuplets, ties, repeats/endings, final bars, voiceKinds, tempo, and instruments.",
      "Check that every simultaneous voice has complete bars, declared IDs match playback/notation maps, percussion uses intentional GM mappings, beam grouping is encoded through deliberate ABC whitespace, and the final ABC is abcjs-compatible.",
      "If render_score reports substantive mechanical warnings, repair the ABC and render once more. Parser acceptance proves syntax compatibility, not musical quality.",
    ],
  };
  const review = reviewSection(brief);
  const result: CompositionPlanOutput = {
    schemaVersion: 3, brief, guidance, review, compatibilityNotes: notes,
    renderHints: { tempo: brief.tempo, meter: brief.meter, voiceKinds: Object.fromEntries(brief.ensemble.map((voice) => [voice.voiceId, voice.kind])) },
    prompt: "",
  };
  result.prompt = renderPrompt(brief, guidance, review, notes);
  return result;
}
