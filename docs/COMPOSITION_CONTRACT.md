# ABCoda composition contract: rationale and sources

ABCoda uses two deliberately separate layers.

1. The MCP server sends a short workflow contract from `shared/composer-instructions.ts`.
2. Before new composition or arrangement, the model calls `prepare_composition` with the typed brief in `shared/composition-plan.ts`. The stateless style router returns only the relevant theory, form, instrumentation, notation, and preflight guidance. The same brief is carried into `render_score`; nothing is stored server-side.
3. `shared/abc-lint.ts` performs only conservative, testable normalisation and linting. It does not reject parallel fifths, demand tonal cadences, or otherwise turn aesthetic conventions into universal syntax errors.

That separation matters. Counterpoint, harmony, form, texture, and orchestration describe different relationships, and strict voice-leading is a pedagogical model rather than a universal historical style. Pop/rock, jazz, impressionist, post-tonal, and experimental idioms often organise musical time and vertical sonority differently from common-practice tonal music.

## What the runtime prompt covers

- brief interpretation and constraint priority;
- motif/riff, phrase/form, harmonic or pitch language, texture, register, roles, and trajectory;
- general but style-conditioned quality review;
- modules for modal/species, Baroque, Classical, Romantic, impressionist, jazz/blues, pop/rock, traditional dance, minimalist/cinematic, post-tonal, and free-meter writing;
- instrumental feasibility and ensemble balance;
- complete abcjs-compatible ABC and multi-voice conventions;
- a final silent musical and notational preflight.

This is a rubric, not an “automatic genius” switch. It should substantially reduce random-note output and stylistic category errors, but musical quality still depends on model capability, the requested scope, and iteration with the listener.

## Mechanical policy

Safe automatic changes currently include:

- normalising line endings;
- inserting or aligning `Q:1/4=<tempo>` with the tool's quarter-note playback tempo;
- applying `clef=perc` and voice-local `K:none` only to voices explicitly marked `unpitched_percussion`;
- retaining the original score otherwise.

Warnings cover missing core score headers, duplicate header voice declarations, unknown voice IDs in tool configuration, missing/unknown `%%score` voices, and abcjs parser warnings. Musical taste is never emitted as a parser error.

## Bibliography and implementation references

- OpenAI, [Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server): MCP server instructions, tool metadata, resources, CSP, and versioned widget URIs.
- ABC notation, [ABC 2.1 standard](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1): information fields, tempo, voices, clefs, `K:none`, rhythm, ties, tuplets, repeats, and playback conventions.
- abcjs, [ABC notation support](https://docs.abcjs.net/overview/abc-notation) and [synthesized sound](https://docs.abcjs.net/audio/synthesized-sound): supported notation and client-side playback behaviour.
- Open Music Theory, [table of contents](https://openmusictheory.github.io/contents.html): fundamentals, model composition, harmony, form, pop/rock, and post-tonal theory.
- Open Music Theory, [Introduction to strict voice-leading](https://openmusictheory.github.io/speciesIntro.html): distinction among voice-leading, harmony, and form, and the pedagogical status of strict counterpoint.
- Open Music Theory, [Harmonic syntax: the idealized phrase](https://openmusictheory.github.io/harmonicSyntax1.html), [Classical cadence types](https://openmusictheory.github.io/cadenceTypes.html), [The sentence](https://openmusictheory.github.io/sentence.html), and [The period](https://openmusictheory.github.io/period.html): common-practice phrase and cadence models.
- Open Music Theory, [Harmony in pop/rock music](https://openmusictheory.github.io/harmonicFunctionsInPop.html), [Syncopation in pop/rock music](https://openmusictheory.github.io/syncopation.html), and [Texture in pop music](https://viva.pressbooks.pub/openmusictheory/chapter/texture-in-pop-music/): cyclic harmony, groove, syncopation, and functional layers.
- Open Music Theory, [Collections and scales](https://openmusictheory.github.io/scales.html): modal and post-tonal pitch organisation.
- Open Music Theory, [Core principles of orchestration](https://viva.pressbooks.pub/openmusictheory/chapter/core-principles-of-orchestration/) and [Texture](https://viva.pressbooks.pub/openmusictheory/chapter/texture/): register, density, instrumental roles, and changing textures.
- Nikolay Rimsky-Korsakov, [Principles of Orchestration](https://www.gutenberg.org/files/33900/33900-h/33900-h.htm): public-domain historical reference on instrumental combination and balance.
- Johann Joseph Fux, [Gradus ad Parnassum](https://imslp.org/wiki/Gradus_ad_Parnassum_(Fux%2C_Johann_Joseph)): public-domain historical source for species counterpoint; used as a style-specific model, not a universal validator.
- Bach Digital, [work and source catalogue](https://www.bach-digital.de/): primary-source catalogue for Bach manuscripts and works.
- Berklee Online, [Voice-leading paradigms for harmony](https://online.berklee.edu/takenote/voice-leading-paradigms-for-harmony-in-music-composition/): contrasting voice-leading practices across Classical, jazz, pop, and rock contexts.

The runtime instructions paraphrase concepts and do not embed copied textbook passages. The project code remains MIT; linked texts retain their own licences.
