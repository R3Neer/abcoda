# ABCoda · Instrument range research

Status: working product note for Phase 9 range enforcement.

Purpose: freeze the evidence and product decisions behind `playableRange` before implementation. This document is intentionally separate from SoundFont/sample coverage. Musical playability and synth capability are different layers.

## Policy

For pitched instruments ABCoda will eventually distinguish:

- `usualRange`: normal/recommended tessitura used for warnings.
- `playableRange`: conservative hard musical envelope used to classify notes as `unplayable`.
- synth/sample capability: adapter concern; never infer it from `playableRange`.

All pitches below are **sounding pitches** and use scientific pitch notation with C4 = middle C. MIDI values follow the same sounding-pitch convention.

`usualRange` must be contained in `playableRange`. Where the current catalog contradicts the researched playable range, the catalog must be corrected rather than widening `playableRange` merely to preserve old data.

## Proposed playable ranges

| ABCoda instrument | Proposed playableRange | MIDI | Confidence | Research note |
|---|---:|---:|---|---|
| `acoustic_grand_piano` | A0–C8 | 21–108 | high | Standard modern 88-key piano. |
| `bright_acoustic_piano` | A0–C8 | 21–108 | high | Same physical keyboard compass as standard piano. |
| `church_organ` | **do not hard-enforce yet** | — | low | Pipe-organ sounding compass depends on manuals, pedalboard and registration. A key may sound one octave lower or up to two octaves higher depending on stops. The GM preset is not a specific physical organ. Treat this as a product/synth profile, not a simple organological limit. |
| `acoustic_guitar_nylon` | E2–C6 | 40–84 | high | Standard tuning low E2; Yamaha's classical-guitar range chart assumes playability through the 20th fret, giving C6 on the first string. Existing E6 maximum is too generous for a generic classical guitar unless ABCoda deliberately models a 24-fret instrument. |
| `acoustic_bass` | E1–G4 | 28–67 | medium | Four-string standard tuning begins E1; modern 24-fret basses reach G4. Yamaha notes many modern basses have at least 21 frets and some 24. This is a product choice for a generic bass preset. |
| `violin` | G3–A7 | 55–105 | high | VSL gives G3–A7, with D8 available as a harmonic. Harmonics are not treated as ordinary pitch playability unless ABCoda later models playing technique. |
| `viola` | C3–A6 | 48–93 | high | VSL gives C3–A6; harmonic E7 exists but is technique-specific. Current catalog max E6 is a useful usual-range candidate. |
| `cello` | C2–C6 | 36–84 | high | Orchestration references give C2–C6. VSL gives ordinary range to A5 and much higher harmonics; C6 is a conservative hard ordinary-note ceiling for the generic instrument. |
| `contrabass` | B0–G4 | 23–67 | medium-high | VSL gives B0–G4 for a five-string double bass; standard four-string instruments begin at E1 and C extensions are common. Generic ABCoda `contrabass` may conservatively support the five-string envelope. |
| `string_ensemble_1` | B0–D7 | 23–98 | medium | Not a single physical instrument. VSL's full-range string-ensemble mapping spans B0–D7. This is an ensemble/product envelope, not an individual-instrument limit. |
| `choir_aahs` | **do not hard-enforce yet** | — | low | General MIDI `Choir Aahs` is a synthetic ensemble preset, not a defined SATB roster or individual voice type. A hard biological range would be arbitrary. Keep warning/enforcement disabled until ABCoda defines what ensemble this preset represents. |
| `trumpet` | F#3–F6 | 54–89 | high | VSL trumpet in C: F#3–C6 as normal compass, occasionally F6; virtuosos can exceed it. Existing D6 maximum fits inside this hard envelope. |
| `trombone` | E2–F5 | 40–77 | high | Standard tenor-trombone chromatic range E2–F5. Pedal/trigger notes below E2 are real but not a simple contiguous generic range, so they are excluded from the hard envelope for now. |
| `french_horn` | B1–F5 | 35–77 | high | VSL gives sounding B1–F5. Existing catalog already matches it. |
| `soprano_sax` | Ab3–F6 | 56–89 | medium-high | Generic written sax range Bb3–G6; Bb soprano sounds a major second lower. Avoid altissimo beyond the standard compass. |
| `alto_sax` | Db3–Bb5 | 49–82 | medium-high | Generic written sax range Bb3–G6; Eb alto sounds a major sixth lower. Avoid altissimo beyond the standard compass. |
| `tenor_sax` | Ab2–F5 | 44–77 | medium-high | Generic written sax range Bb3–G6; Bb tenor sounds a major ninth lower. Avoid altissimo beyond the standard compass. |
| `oboe` | Bb3–A6 | 58–93 | high | VSL gives Bb3–G6 with A6 available; orchestration reference also gives Bb3–A6. |
| `english_horn` | E3–B5 | 52–83 | medium-high | VSL gives sounding E3–A5 with B5 possible. Some orchestration charts extend farther; use B5 as conservative hard ceiling. **Current catalog E3–C6 should be corrected.** |
| `bassoon` | Bb1–F5 | 34–77 | high | VSL gives Bb1–Eb5, F5 possible with considerable effort. Existing Eb5 maximum is a good usual-range candidate. |
| `clarinet` | D3–Bb6 | 50–94 | high | For Bb clarinet, VSL gives sounding D3–Bb6, with orchestral use usually only to G6. **Current catalog label/range E3–C7 sounding is wrong for a Bb clarinet and should be corrected.** |
| `piccolo` | D5–C8 | 74–108 | high | VSL gives sounding D5–C8. Rare instruments/works may reach C5 below, but D5 is the normal physical lower bound. |
| `flute` | B3–F7 | 59–101 | high | VSL standard B3–D7, forced up to F7. Use B3–F7 as hard physical envelope and keep C4–D7 as a likely usual range. |
| `recorder` | **product decision required** | — | low | `Recorder` is not one fixed instrument. Soprano and alto recorders have different compasses. Before hard enforcement, either rename/model a specific subtype (recommended: soprano recorder, roughly C5–D7 for the common two-octave-plus compass) or keep the generic preset exempt. |
| `standard_drum_kit` | n/a | n/a | high | Unpitched percussion follows GM percussion-note semantics, not melodic `usualRange`/`playableRange`. |

## Important corrections to the current catalog

The existing `range` values are not uniformly "usual" ranges and a few are inconsistent with the instrument they claim to model.

Before implementing `usualRange ⊆ playableRange`:

1. `acoustic_guitar_nylon`: current E2–E6 should not be blindly retained as `usualRange`; generic classical guitar ordinary compass is better capped around C6 unless ABCoda explicitly models a 24-fret instrument.
2. `english_horn`: current E3–C6 is too broad for the conservative VSL ordinary/extended range; proposed hard ceiling B5.
3. `clarinet`: current E3–C7 labelled "sounding" corresponds to the generic written clarinet compass, not the sounding range of Bb clarinet. For a Bb model, sounding hard range is D3–Bb6.
4. Saxophone current maxima are slightly narrower than the standard non-altissimo written compass transformed to sounding pitch. They are plausible `usualRange` values, with the proposed hard ranges above.
5. `contrabass`: low bound depends on 4-string, C-extension, or 5-string hardware. ABCoda should deliberately model the generic instrument as five-string-capable if B0 is accepted.

## Product decisions frozen for implementation

- Hard-range classification is based on sounding MIDI pitch.
- Harmonics, altissimo and other special techniques do **not** automatically widen ordinary `playableRange` unless ABCoda later models technique explicitly.
- `church_organ`, `choir_aahs` and generic `recorder` are exempt from hard range enforcement until their product semantics are made specific.
- `string_ensemble_1` may use a section-wide product envelope because it is explicitly an ensemble preset.
- Percussion remains outside melodic range logic.
- SoundFont coverage is separate. A note being musically playable does not guarantee a particular SoundFont sample exists; the abcjs adapter must separately guarantee safe synthesis.

## Sources consulted

Primary/detailed references were preferred where available.

- Vienna Symphonic Library Academy, Violin: https://www.vsl.co.at/academy/strings/violin/
- Vienna Symphonic Library Academy, Viola: https://www.vsl.co.at/academy/strings/viola
- Vienna Symphonic Library Academy, Cello: https://www.vsl.co.at/academy/strings/cello
- Vienna Symphonic Library Academy, Double bass: https://www.vsl.co.at/academy/strings/double-bass
- Vienna Symphonic Library Academy, Horn in F: https://www.vsl.co.at/academy/brass/horn-f
- Vienna Symphonic Library Academy, Trumpet in C: https://www.vsl.co.at/academy/brass/trumpet-c
- Vienna Symphonic Library Academy, Oboe: https://www.vsl.co.at/academy/woodwinds/oboe
- Vienna Symphonic Library Academy, English horn: https://www.vsl.co.at/academy/woodwinds/english-horn
- Vienna Symphonic Library Academy, Bassoon: https://preview.vsl.co.at/academy/woodwinds/bassoon
- Vienna Symphonic Library Academy, Clarinet in Bb: https://www.vsl.co.at/academy/woodwinds/clarinet
- Vienna Symphonic Library Academy, Concert flute: https://www.vsl.co.at/academy/woodwinds/concert-flute
- Vienna Symphonic Library Academy, Piccolo: https://www.vsl.co.at/academy/woodwinds/piccolo
- Vienna Symphonic Library, Prime Orchestra string/brass mappings: https://www.vsl.co.at/instruments/starter-editions/prime-orchestra
- Vienna Symphonic Library, Studio Saxophones: https://www.vsl.co.at/instruments/synchronized/saxophones
- Symphony Orchestra Library Center, Ranges of Orchestral Instruments: https://orchestralibrary.com/reftables/rang.html
- Yamaha Musical Instrument Guide, Piano 88-key compass: https://www.yamaha.com/en/musical_instrument_guide/piano/trivia/trivia007.html
- Yamaha Musical Instrument Guide, Classical guitar range: https://www.yamaha.com/en/musical_instrument_guide/classical_guitar/play/play003.html
- Yamaha, Bass Fingering 101: https://hub.yamaha.com/guitars/bass/bass-fingering-101/
- Yamaha Musical Instrument Guide, Pipe organ: https://www.yamaha.com/en/musical_instrument_guide/pipeorgan/play/
- Yamaha Musical Instrument Guide, Recorder fingering/variants: https://www.yamaha.com/en/musical_instrument_guide/recorder/play/play002.html

## Implementation consequence

Patch 1 may now implement researched hard ranges for the high/medium-confidence concrete instruments and explicit `rangePolicy: "unbounded" | "melodic" | "percussion"` (name to be decided) for ambiguous presets. Do **not** fabricate numeric hard ranges for organ, choir or generic recorder just to make the TypeScript shape uniform.
