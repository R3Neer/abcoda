import type {
  FormFamily,
  InstrumentFamily,
  PitchFramework,
  RhythmicFeel,
  StyleFamily,
  TextureModel,
} from "../schema.js";

export const styleGuidance: Record<StyleFamily, string[]> = {
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

export const formGuidance: Record<FormFamily, string[]> = {
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

export const pitchGuidance: Record<PitchFramework, string[]> = {
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

export const rhythmGuidance: Record<RhythmicFeel, string[]> = {
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

export const textureGuidance: Record<TextureModel, string[]> = {
  monophonic: ["Expose one line clearly; make contour, rhythm, articulation, register, implied harmony, and breathing/phrasing carry the full form."],
  heterophonic: ["Keep a shared melodic identity audible while coordinating simultaneous variants, ornaments, rhythmic offsets, registers, and cadential convergence."],
  melody_accompaniment: ["Protect the melody's register and rhythmic salience; make accompaniment supply pulse, bass, harmony, and transitions without continuously competing."],
  homorhythmic: ["Control spacing, doubling, chordal balance, text/accent alignment, and voice-leading while using occasional independence or register change to avoid inert block motion."],
  contrapuntal: ["Give lines independent contour and rhythm while controlling imitation, dissonance, crossing, spacing, density, and cadential coordination according to style."],
  layered_groove: ["Assign beat, bass, harmonic filler, melody, and optional novelty/call-response roles; interlock rhythmic profiles and vary entries/exits across sections."],
  color_mass: ["Shape sonority through register, spacing, doubling, articulation, density, attack/release, and timbral transfer; make changes in the mass articulate form."],
  mixed: ["Map texture by section and make each change serve hierarchy, contrast, buildup, release, or return; avoid changing it merely because more voices are available."],
};

export const instrumentGuidance: Record<InstrumentFamily, string[]> = {
  keyboard: ["Respect hand span/distribution, leaps, repeated notes, voicing, register, and texture; use separate voices for independent hands, and distinguish visible pedal instructions from ABCoda's currently unpedalled audio approximation."],
  bowed_string: ["Respect open strings, position/register, crossings, bow length/articulation, double-stop feasibility, sustained balance, and the difference between solo and section writing."],
  plucked_string: ["Respect tuning, courses/strings, resonance, damping, repeated-note speed, chord shapes, and decay; do not write keyboard voicings by default."],
  guitar: ["Respect tuning, fretboard position, practical stretch, barrés, string crossings, repeated attacks, sustain, chord fingering, and whether the part is melodic, riff-based, or chordal. Standard guitar notation normally uses `clef=treble-8`; describe its total written-to-sounding displacement as -12 semitones in the brief so ABCoda can avoid double transposition."],
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
