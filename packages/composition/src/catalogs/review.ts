import type {
  CompositionBrief,
  CompositionEffort,
  FormFamily,
  InstrumentFamily,
  PitchFramework,
  RhythmicFeel,
  StyleFamily,
  TextureModel,
} from "../schema.js";

export const styleReviewGuidance: Record<StyleFamily, string[]> = {
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

export const formReviewGuidance: Record<FormFamily, string[]> = {
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

export const pitchReviewGuidance: Record<PitchFramework, string[]> = {
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

export const rhythmReviewGuidance: Record<RhythmicFeel, string[]> = {
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

export const textureReviewGuidance: Record<TextureModel, string[]> = {
  monophonic: ["Check whether one line alone sustains contour, rhythm, register, articulation, implied harmony, breath, contrast, and arrival; remove filler that harmony would otherwise conceal."],
  heterophonic: ["Check that variants share an unmistakable melodic identity, offsets and ornaments remain intentional, and cadential convergence is controlled rather than merely untidy unison."],
  melody_accompaniment: ["Check that accompaniment leaves registral and rhythmic space, supports direction, and changes with form; flag automatic filler, constant competition, or doubling that weakens the melody."],
  homorhythmic: ["Audit spacing, doubling, balance, text/accent alignment, and style-relevant voice leading; flag inert block motion or inner parts that exist only to complete chords."],
  contrapuntal: ["Check each line independently for contour and rhythm, then together for imitation, dissonance, crossing, spacing, density, and cadence; flag nominal counterpoint that becomes accompaniment."],
  layered_groove: ["Solo the conceptual beat, bass, harmony, melody, and novelty layers: each must have a role, interlock cleanly, and enter/exit with form; flag constant full-stack density."],
  color_mass: ["Check the evolution of register, spacing, doubling, articulation, density, attack/release, and timbral transfer; flag an attractive sonority held without formal consequence."],
  mixed: ["Map texture by section and verify that each change creates hierarchy, contrast, buildup, release, or return; flag gratuitous switching or continuous tutti caused merely by available voices."],
};

export const instrumentReviewGuidance: Record<InstrumentFamily, string[]> = {
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
  macro: string[];
  meso: string[];
  finalHolisticAudit: string[];
}

export const effortReviewGuidance: Record<CompositionEffort, EffortReviewPlan> = {
  quick: {
    strategy: [
      "After the draft, run a light MACRO sanity check, then a combined LOCAL/playability sanity check, then mechanical preflight; do not turn a sound miniature into a thesis.",
      "Backtrack only for a clear failure: after fixing it, re-check the highest earlier level the fix could obviously have disturbed before continuing.",
    ],
    macro: ["Check that the principal idea is recognisable, the ending is earned, and no section or part obviously contradicts the brief."],
    meso: [],
    finalHolisticAudit: [],
  },
  standard: {
    strategy: [
      "Review silently from MACRO → DEVELOPMENT/MESO → LOCAL MUSICAL → PERFORMANCE/EXPRESSION, then run mechanical preflight. Do not advance while the current layer has a clear substantive defect.",
      "After a substantive correction, return to the highest earlier layer reasonably affected—at least one layer back—and descend again. Treat this as convergence, not a one-pass checklist.",
      "Correct clear substantive problems without narrating a public self-critique.",
    ],
    macro: [
      "Check that climax/arrival, large-scale register and density, and closure support one coherent trajectory rather than several unrelated local successes.",
    ],
    meso: [
      "Check that repetition creates identity or function, every section changes the musical situation, and contrast does not erase the principal material.",
    ],
    finalHolisticAudit: [],
  },
  careful: {
    strategy: [
      "Plan and draft, then review silently from MACRO → DEVELOPMENT/MESO → LOCAL MUSICAL → PERFORMANCE/EXPRESSION. Do not advance while the current layer contains a substantive defect.",
      "Backtracking is mandatory after every substantive change: return to the highest earlier layer reasonably affected, with a minimum of one layer back, then descend again until all musical layers converge.",
      "The first draft is not sacred. If a routed test exposes a substantive weakness, rewrite phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections instead of limiting revision to local polish.",
    ],
    macro: [
      "Track register, density, harmonic rhythm/pitch activity, texture, and rhythmic activity: flag long spans where too many remain constant without stylistic purpose.",
      "Check that each section changes the musical situation, the climax is prepared and consequential, striking gestures grow from established material, and contrast preserves identity.",
    ],
    meso: [
      "Identify any material that merely fills bars, can be removed without loss, or repeats because development was avoided; judge repetition and non-functional harmony only by the declared style and process.",
    ],
    finalHolisticAudit: [],
  },
  exhaustive: {
    strategy: [
      "Silently follow PLAN → DRAFT → MACRO → DEVELOPMENT/MESO → LOCAL MUSICAL → PERFORMANCE/EXPRESSION, with scope-aware backtracking until every musical layer converges; only then run FINAL HOLISTIC AUDIT → MECHANICAL PREFLIGHT.",
      "Do not advance while the current layer contains a substantive defect. After every substantive change, return to the highest earlier layer reasonably affected, with a minimum of one layer back; structural rewrites return to MACRO.",
      "The first draft is not sacred. Rebuild phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections whenever structural evidence demands it; deletion is preferable to polishing inert material.",
    ],
    macro: [
      "Verify that each section changes the musical situation, every transition alters expectation, and the climax is both prepared and consequential.",
      "Audit simultaneous constancy of register, density, harmonic rhythm/pitch activity, texture, and rhythmic activity; require either purposeful stasis or directed change.",
    ],
    meso: [
      "Find every bar-filling passage and ask what audible function would be lost if it vanished; remove or transform material with no answer.",
      "For every repetition, distinguish identity/process from avoidance of development using the declared idiom rather than a universal novelty bias.",
    ],
    finalHolisticAudit: [
      "After all layers converge, re-hear the revised piece as one uninterrupted whole. Re-test identity, proportion, trajectory, climax, closure, contrast, balance, playability, and expressive logic rather than trusting the preceding local approvals.",
      "Verify that conspicuous gestures derive from established material, contrast retains identity, identity avoids stagnation, and no technically correct passage remains merely generic.",
    ],
  },
};

export const difficultyGuidance: Record<CompositionBrief["difficulty"], string[]> = {
  beginner: ["Limit range, leaps, accidentals, independent layers, chord spans, subdivisions, tempo pressure, and simultaneous demands while preserving the defining style/form idea."],
  intermediate: ["Allow moderate independence, syncopation, chromaticism, position/register changes, and articulation variety, but provide preparation and recovery around difficult gestures."],
  advanced: ["Permit sustained independence, complex rhythm/harmony, wider range, rapid changes, and extended spans only when idiomatic and structurally motivated; avoid difficulty by clutter."],
  virtuosic: ["Use extreme speed, range, leaps, density, independence, endurance, or special techniques selectively as dramatic/formal events and keep them physically realisable."],
};

export const intentGuidance: Record<CompositionBrief["intent"], string[]> = {
  performance: ["Deliver a complete, rehearsable arc with practical notation, breathing or page-turn-like rests where relevant, balanced difficulty, and a convincing ending."],
  study: ["Foreground the target concept or technique consistently, sequence difficulty progressively, avoid unrelated complications, and make success/failure musically audible."],
  illustration: ["Isolate the requested concept clearly and economically; prefer a short unmistakable example over a richer piece that obscures the lesson."],
  accompaniment: ["Leave registral, rhythmic, and dynamic space for the absent principal part; provide dependable cues, support, introductions/interludes/endings, and avoid stealing focus."],
  sketch: ["Prioritise the core motif, form, pitch plan, and textural trajectory; simplify secondary detail but still produce complete valid bars and a usable ending."],
};
