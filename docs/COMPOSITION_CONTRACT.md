# ABCoda composition contract: rationale and sources

ABCoda uses two deliberately separate layers.

1. The MCP server sends a short workflow contract from `shared/composer-instructions.ts`.
2. Before new composition or arrangement, the model calls `prepare_composition` with the typed brief in `shared/composition-plan.ts`. The stateless assembler returns only the relevant generation modules, musical-review criteria, and mechanical preflight. The same complete brief is carried into `render_score`; nothing is stored server-side.
3. `shared/abc-lint.ts` performs only conservative, testable normalisation and linting. It does not reject parallel fifths, demand tonal cadences, or otherwise turn aesthetic conventions into universal syntax errors.

That separation matters. Counterpoint, harmony, form, texture, and orchestration describe different relationships, and strict voice-leading is a pedagogical model rather than a universal historical style. Pop/rock, jazz, impressionist, post-tonal, and experimental idioms often organise musical time and vertical sonority differently from common-practice tonal music.

## Composition brief v4

The form is intentionally multidimensional. A style label cannot safely imply a form, pitch system, texture, or rhythmic feel: jazz may be modal or functional; a canon may be tonal or twelve-tone; and coloristic music may use ternary, process, or free form. The typed fields therefore route independent prompt modules:

| Domain | Typed selector | Coverage |
| --- | --- | --- |
| Idiomatic vocabulary | `styleFamily`, `styleDetail` | 12 broad families plus a concrete tradition/era/genre description |
| Architecture | `formFamily`, `form`, `sectionPlan`, `measures` | 19 archetypes, including phrase forms, binary/ternary/rondo/sonata, song forms, blues, imitative forms, process and free form |
| Pitch/harmony | `pitchFramework`, `pitchLanguage` | 11 systems: functional/cyclic tonal, modal, blues, jazz-extended, pentatonic, symmetric, centric, cell/set, twelve-tone and custom |
| Time | `meter`, `tempo`, `rhythmicFeel` | 10 feels plus simple, compound, additive and free-meter interpretation |
| Distribution | `texture` | 8 textures from monophony and heterophony through counterpoint, groove layers and color mass |
| Physical writing | ensemble `family`, `role`, `kind`, `transpositionSemitones` | 13 instrument families with voice-specific role and notation metadata |
| Performer scope | `difficulty`, `intent` | 4 performer difficulty levels and 5 purposes |
| Composition process | `effort` | `quick`, `standard`, `careful`, or `exhaustive` silent review strategy |
| Overrides | `constraints`, `departures` | requirements and deliberate exceptions |

Conflict precedence is explicit: constraints and departures first; then pitch framework for pitch/harmony, form family for architecture, feel/meter for time, texture for distribution, instrument family for physical realisation, and style for idiomatic vocabulary. Atypical combinations generate compatibility notes rather than being silently normalised.

`difficulty` and `effort` are orthogonal. Difficulty describes what the performer must do; effort describes how deliberately the model plans, audits, and revises. A beginner miniature with exhaustive compositional effort is therefore valid. The schema default is `standard`; explicit user requests win, and the workflow instructions tell the model to infer a reasonable level rather than ask unnecessarily.

Effort changes the process, not merely the number or intensity of adjectives:

| Effort | Silent workflow |
| --- | --- |
| `quick` | Draft, macro sanity check, combined local/playability sanity check, mechanical preflight, render; backtrack only for clear failures |
| `standard` | Draft, macro → meso → local → performance review, backtrack after substantive repairs, preflight, render |
| `careful` | Plan and draft, all four layers explicitly, mandatory scope-aware backtracking until convergence, preflight, render |
| `exhaustive` | All four layers with scope-aware backtracking, convergence, a final holistic audit of the revised whole, preflight, render |

For `careful` and `exhaustive`, the first draft is explicitly disposable: phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections may be rewritten. `standard` also repairs clear substantive defects; `quick` stays proportionate to a rapid request.

The output separates three concerns:

1. `guidance` tells the model what to compose for the selected profile.
2. `review` asks what characteristic failures to find in that particular result and exposes them as `macro`, `meso`, `local`, `performance`, and (for exhaustive work) `finalHolisticAudit`. Form, style, pitch, rhythm, texture, and instrument tables remain the routing sources, but each selected criterion is placed at the coarsest useful layer instead of becoming an independent domain audit. It includes “technically correct but mediocre” tests at higher effort while interpreting repetition, non-functional harmony, parallel motion, and other features through the declared idiom.
3. `guidance.preflight` checks mechanical ABC/playback consistency: headers, voices, measures, accidentals, tuplets, ties, repeats, clefs, transposition, voice kinds, tempo, instruments, and abcjs compatibility.

Musical review occurs silently inside the prompt returned by `prepare_composition`, before mechanical preflight. The model may descend only when the current layer has no substantive defect. A repair sends it back to the highest earlier layer reasonably affected, never less than one layer for `careful`/`exhaustive`; structural rewrites return to macro. The loop ends when the musical layers converge, not when a checklist has been traversed once. `exhaustive` then performs a `FINAL HOLISTIC AUDIT` before the separate preflight. This does not create a separate `review_composition` tool or add server state. `renderHints` still carries tempo, meter, and typed voice kinds forward mechanically.

This is a rubric, not an “automatic genius” switch. It should reduce random-note output, contradictory instructions, and stylistic category errors, but no text-only validator can hear the result. Musical quality still depends on model capability, requested scope, and iteration with the listener.

## Mechanical policy

Safe automatic changes currently include:

- normalising line endings;
- inserting or aligning `Q:1/4=<tempo>` with the tool's quarter-note playback tempo;
- applying `clef=perc` and voice-local `K:none` only to voices explicitly marked `unpitched_percussion`;
- deriving voice kind and non-zero ABC `transpose=` metadata from the shared composition brief;
- retaining the original score otherwise.

Warnings cover missing core score headers, duplicate header voice declarations, unknown voice IDs in tool configuration, missing/unknown `%%score` voices, differences between brief and rendered tempo/meter/voices/kinds, and abcjs parser warnings. Musical taste is never emitted as a parser error.

### Beam grouping

ABC uses whitespace as notation, not merely source formatting: adjacent eighth-or-shorter note tokens are beamed together, while spaces split a beam group. `prepare_composition` therefore instructs the model to encode groups deliberately and to make them expose the prevailing metre: simple-beat or accepted submeasure groupings, dotted beats in compound metre, and explicit subdivisions in additive/irregular metre.

This is not a universal “beam everything” rule. Rests, barlines, metric and phrase boundaries, syllabic vocal notation, historical practice, and deliberate syncopation can require separation or exceptional grouping. The linter consequently does not rewrite whitespace. For generated music carrying a composition brief, it only warns when it finds a run of at least four consecutive eighth-or-shorter pitched events with no beam at all; supplied ABC without a brief is left aesthetically unjudged.

### Expressive and performance notation

Expressive detail is routed from the higher of performer `difficulty` and compositional `effort`. This preserves their independence: an exhaustive beginner piece may be easy to play but fully edited, while a quick virtuosic part still needs enough information to be executable. The thresholds concern function rather than symbol count:

| Detail threshold | Minimum recommendation |
| --- | --- |
| `quick` + `beginner` | Necessary ties and slurs; basic staccato, tenuto, or accents wherever attack/duration changes. No routine ornamental clutter. |
| `standard` or `intermediate` | A purposeful dynamic baseline/trajectory, hairpins with destinations, phrase/breath and fermata decisions, plus idiomatic instrument signs. Suitable piano styles may receive a sparse, clear pedal plan. |
| `careful` or `advanced` | Detailed dynamic hierarchy and selectively idiomatic ornaments, arpeggios, glissandi, bowings, open/harmonic signs, fingerings, rolls, or technique text. |
| `exhaustive` or `virtuosic` | A complete audit for contradictory, redundant, uncancelled, unplayable, unsupported, or visually excessive performance marks. |

The modules remain instrument-aware. Winds, brass, and voice receive breathing/attack checks; bowed strings receive bow-group and technique checks; fretted/plucked instruments receive string/fret-oriented signs; percussion hairpins require a roll or sustaining sound; electronic production instructions remain text when General MIDI cannot express them. Difficulty still limits physical demands—more editorial effort does not make a beginner part harder.

Piano pedal is conditional, not automatic. Romantic, impressionist/coloristic, and resonant minimalist/cinematic piano writing normally merits consideration from the standard/intermediate threshold; classical, jazz, pop, and hybrid writing requires contextual evidence such as cantabile, ballad, or resonant texture. Baroque, dry, detached, organ, and harpsichord-like writing remains unpedalled unless explicitly overridden. Because ABC 2.1 and abcjs do not expose a native piano-pedal decoration, ABCoda asks for below-staff `"_Ped."` and `"_*"` annotations at depression/release or retake points. These are honest visual instructions: the current synth does not realise sustain or half-pedal playback.

ABC/abcjs-supported vocabulary used by the router includes immediate dynamics and `sfz`, crescendo/diminuendo spans, staccato/tenuto/accent/marcato, slurs and ties, fermata and breath, trill/turn/mordent and tradition-specific rolls, arpeggio and glissando spans, fingerings 0–5, up/down bows, open/harmonic, snap and thumb signs, phrase marks, coda/segno, and D.C./D.S./Fine. Some of these engrave without a corresponding General MIDI performance effect; the prompt must not claim otherwise.

## Verification policy

The suite includes representative “golden” profiles and a pairwise coverage matrix. It validates every option individually and all style×form, style×pitch, style×rhythm, and style×texture pairs (576 combinations). Pairwise coverage proves that every selectable combination assembles a typed, bounded, complete prompt without missing modules; it does not prove the aesthetic success of every possible piece. Tool discovery is separately tested with direct, indirect, and negative examples documented in `GOLDEN_PROMPTS.md`.

## Bibliography and implementation references

- OpenAI, [Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server): MCP server instructions, tool metadata, resources, CSP, and versioned widget URIs.
- OpenAI, [Optimize Metadata](https://developers.openai.com/apps-sdk/guides/optimize-metadata): focused “use this when” descriptions, parameter documentation, and direct/indirect/negative golden-prompt evaluation.
- ABC notation, [ABC 2.1 standard](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1): information fields, tempo, voices, clefs, `K:none`, rhythm, ties, tuplets, repeats, and playback conventions.
- ABC notation, [ABC 2.1 decorations](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1#decorations): standard articulations, dynamics, hairpins, ornaments, bowing, fingering, navigation marks, and limited playback expectations for decorations.
- ABC notation, [ABC 2.1 beams](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1#beams): whitespace splits beam groups, while backticks can improve source readability without breaking a beam.
- abcjs, [ABC notation support](https://docs.abcjs.net/overview/abc-notation) and [synthesized sound](https://docs.abcjs.net/audio/synthesized-sound): supported notation and client-side playback behaviour.
- Steinberg Dorico, [Articulations](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/notation_reference/notation_reference_articulations/notation_reference_articulations_c.html), [Playing techniques](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/notation_reference/notation_reference_playing_techniques/notation_reference_playing_techniques_c.html), and [sustain-pedal retakes/levels](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/notation_reference/notation_reference_pedal_lines/notation_reference_pedal_lines_piano_retakes_changes_c.html): distinction among attack/duration articulations, continuing instrument techniques, and timed pedal release/retake information.
- MuseScore Studio Handbook, [Beams](https://handbook.musescore.org/notation/rhythm-meter-and-measures/beams), and Dorico, [Beam grouping according to meters](https://www.steinberg.help/r/dorico-se/6.1/en/dorico/topics/notation_reference/notation_reference_beaming/notation_reference_beaming_according_to_meter_c.html): beams communicate rhythmic grouping and vary with simple, compound, and irregular metres.
- LilyPond, [Beams](https://lilypond.org/doc/v2.25/Documentation/notation/beams): meter-dependent defaults, historical alternatives in triple metre, exceptional beaming over rests, and vocal practice.
- Open Music Theory, [table of contents](https://openmusictheory.github.io/contents.html): fundamentals, model composition, harmony, form, pop/rock, and post-tonal theory.
- Open Music Theory, [Introduction to strict voice-leading](https://openmusictheory.github.io/speciesIntro.html): distinction among voice-leading, harmony, and form, and the pedagogical status of strict counterpoint.
- Open Music Theory, [Harmonic syntax: the idealized phrase](https://openmusictheory.github.io/harmonicSyntax1.html), [Classical cadence types](https://openmusictheory.github.io/cadenceTypes.html), [The sentence](https://openmusictheory.github.io/sentence.html), and [The period](https://openmusictheory.github.io/period.html): common-practice phrase and cadence models.
- Open Music Theory, [Ternary form](https://viva.pressbooks.pub/openmusictheory/chapter/ternary-form/), [AABA form](https://viva.pressbooks.pub/openmusictheory/chapter/aaba-form/), [Verse–chorus form](https://viva.pressbooks.pub/openmusictheory/chapter/verse-chorus-form/), and [Twelve-bar blues](https://viva.pressbooks.pub/openmusictheory/chapter/12-bar-blues/): independent formal archetypes and their perceptual functions.
- Open Music Theory, [Harmony in pop/rock music](https://openmusictheory.github.io/harmonicFunctionsInPop.html), [Syncopation in pop/rock music](https://openmusictheory.github.io/syncopation.html), and [Texture in pop music](https://viva.pressbooks.pub/openmusictheory/chapter/texture-in-pop-music/): cyclic harmony, groove, syncopation, and functional layers.
- Open Music Theory, [Collections and scales](https://openmusictheory.github.io/scales.html): modal and post-tonal pitch organisation.
- Open Music Theory, [Core principles of orchestration](https://viva.pressbooks.pub/openmusictheory/chapter/core-principles-of-orchestration/) and [Texture](https://viva.pressbooks.pub/openmusictheory/chapter/texture/): register, density, instrumental roles, and changing textures.
- Nikolay Rimsky-Korsakov, [Principles of Orchestration](https://www.gutenberg.org/files/33900/33900-h/33900-h.htm): public-domain historical reference on instrumental combination and balance.
- Johann Joseph Fux, [Gradus ad Parnassum](https://imslp.org/wiki/Gradus_ad_Parnassum_(Fux%2C_Johann_Joseph)): public-domain historical source for species counterpoint; used as a style-specific model, not a universal validator.
- Bach Digital, [work and source catalogue](https://www.bach-digital.de/): primary-source catalogue for Bach manuscripts and works.
- Berklee Online, [Voice-leading paradigms for harmony](https://online.berklee.edu/takenote/voice-leading-paradigms-for-harmony-in-music-composition/): contrasting voice-leading practices across Classical, jazz, pop, and rock contexts.
- Music Theory for the 21st-Century Classroom, [Jazz chord voicings](https://musictheory.pugetsound.edu/mt21c/JazzChordVoicings.html): guide-tone priority and economical jazz voicing.
- Philharmonia, [Instruments](https://philharmonia.co.uk/resources/instruments/): instrument families, registers, techniques, and orchestral roles used to cross-check the family modules.

The runtime instructions paraphrase concepts and do not embed copied textbook passages. The project code remains MIT; linked texts retain their own licences.
