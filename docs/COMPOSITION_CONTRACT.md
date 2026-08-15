# ABCoda composition contract: rationale and sources

ABCoda uses two deliberately separate layers.

1. The MCP server sends a short workflow contract from `shared/composer-instructions.ts`.
2. Before new composition or arrangement, the model calls `prepare_composition` with the typed brief in `shared/composition-plan.ts`. The stateless assembler returns only the relevant generation modules, musical-review criteria, and mechanical preflight. The same complete brief is carried into `render_score`; nothing is stored server-side.
3. `shared/abc-lint.ts` performs only conservative, testable normalisation and linting. It does not reject parallel fifths, demand tonal cadences, or otherwise turn aesthetic conventions into universal syntax errors.

That separation matters. Counterpoint, harmony, form, texture, and orchestration describe different relationships, and strict voice-leading is a pedagogical model rather than a universal historical style. Pop/rock, jazz, impressionist, post-tonal, and experimental idioms often organise musical time and vertical sonority differently from common-practice tonal music.

## Composition brief v3

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
| `quick` | Draft, one integrated sanity check, mechanical preflight, render |
| `standard` | Draft, material/form check, playability/notation-readiness check, repair clear problems, preflight, render |
| `careful` | Plan and draft, separate domain passes, global integration audit, substantive revision, preflight, render |
| `exhaustive` | Plan and draft, all domain audits, substantive revision, a second audit of the revised whole, preflight, render |

For `careful` and `exhaustive`, the first draft is explicitly disposable: phrases, accompaniment, harmony, rhythm, orchestration, transitions, or complete sections may be rewritten. `standard` also repairs clear substantive defects; `quick` stays proportionate to a rapid request.

The output separates three concerns:

1. `guidance` tells the model what to compose for the selected profile.
2. `review` asks what characteristic failures to find in that particular result. Its form, style, pitch, rhythm, texture, and instrument criteria are routed only from selectors present in the brief; integration depth comes from `effort`. It includes “technically correct but mediocre” tests at higher effort while interpreting repetition, non-functional harmony, parallel motion, and other features through the declared idiom.
3. `guidance.preflight` checks mechanical ABC/playback consistency: headers, voices, measures, accidentals, tuplets, ties, repeats, clefs, transposition, voice kinds, tempo, instruments, and abcjs compatibility.

Musical review occurs silently inside the prompt returned by `prepare_composition`, before mechanical preflight. It does not create a separate `review_composition` tool or add server state. `renderHints` still carries tempo, meter, and typed voice kinds forward mechanically.

This is a rubric, not an “automatic genius” switch. It should reduce random-note output, contradictory instructions, and stylistic category errors, but no text-only validator can hear the result. Musical quality still depends on model capability, requested scope, and iteration with the listener.

## Mechanical policy

Safe automatic changes currently include:

- normalising line endings;
- inserting or aligning `Q:1/4=<tempo>` with the tool's quarter-note playback tempo;
- applying `clef=perc` and voice-local `K:none` only to voices explicitly marked `unpitched_percussion`;
- deriving voice kind and non-zero ABC `transpose=` metadata from the shared composition brief;
- retaining the original score otherwise.

Warnings cover missing core score headers, duplicate header voice declarations, unknown voice IDs in tool configuration, missing/unknown `%%score` voices, differences between brief and rendered tempo/meter/voices/kinds, and abcjs parser warnings. Musical taste is never emitted as a parser error.

## Verification policy

The suite includes representative “golden” profiles and a pairwise coverage matrix. It validates every option individually and all style×form, style×pitch, style×rhythm, and style×texture pairs (576 combinations). Pairwise coverage proves that every selectable combination assembles a typed, bounded, complete prompt without missing modules; it does not prove the aesthetic success of every possible piece. Tool discovery is separately tested with direct, indirect, and negative examples documented in `GOLDEN_PROMPTS.md`.

## Bibliography and implementation references

- OpenAI, [Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server): MCP server instructions, tool metadata, resources, CSP, and versioned widget URIs.
- OpenAI, [Optimize Metadata](https://developers.openai.com/apps-sdk/guides/optimize-metadata): focused “use this when” descriptions, parameter documentation, and direct/indirect/negative golden-prompt evaluation.
- ABC notation, [ABC 2.1 standard](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1): information fields, tempo, voices, clefs, `K:none`, rhythm, ties, tuplets, repeats, and playback conventions.
- abcjs, [ABC notation support](https://docs.abcjs.net/overview/abc-notation) and [synthesized sound](https://docs.abcjs.net/audio/synthesized-sound): supported notation and client-side playback behaviour.
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
