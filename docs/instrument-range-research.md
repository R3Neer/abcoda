# ABCoda · Instrument range research

Status: implemented reference for Phase 9 range enforcement.

Purpose: record the evidence and product decisions behind ABCoda's instrument-range policy. Musical playability and SoundFont/sample coverage are intentionally separate concerns.

## Policy

All numeric pitches below are **sounding pitches**, using scientific pitch notation with C4 = middle C and the equivalent MIDI values.

ABCoda distinguishes three range-policy kinds:

- `bounded`: a concrete instrument with a defensible continuous musical compass.
  - `usualRange`: practical/idiomatic writing range. Leaving it is a warning, not an error.
  - `playableRange`: conservative hard musical envelope. Notes beyond it remain notated but are silent.
- `unbounded`: a generic, synthetic, ensemble or otherwise underspecified preset for which ABCoda must not invent a physical hard limit.
- `percussion`: unpitched GM percussion-note semantics; melodic tessitura rules do not apply.

For every bounded instrument, `usualRange ⊆ playableRange`.

`playableRange` is **not** SoundFont coverage. The abcjs adapter is responsible for safe synthesis independently of organological classification.

## Implemented catalog

| ABCoda instrument | Policy | usualRange | playableRange | MIDI playable | Rationale |
|---|---|---:|---:|---:|---|
| `acoustic_grand_piano` | bounded | A0–C8 | A0–C8 | 21–108 | Standard modern 88-key piano. |
| `bright_acoustic_piano` | bounded | A0–C8 | A0–C8 | 21–108 | Same physical keyboard compass as acoustic grand. |
| `church_organ` | unbounded | — | — | — | Organ compass and sounding pitch depend on instrument, manuals, pedalboard and registration/stops. |
| `acoustic_guitar_nylon` | bounded | E2–B5 | E2–C6 | 40–84 | Standard tuning; Yamaha's range chart assumes playability through the 20th fret. |
| `acoustic_bass` | bounded | E1–D4 | E1–G4 | 28–67 | Generic four-string acoustic/upright-bass product profile; upper extension kept playable but outside normal writing. |
| `violin` | bounded | G3–E7 | G3–A7 | 55–105 | VSL gives G3–A7; the very top is treated as extended rather than usual. |
| `viola` | bounded | C3–E6 | C3–A6 | 48–93 | VSL gives C3–A6; its characteristic/ordinary writing lies lower. |
| `cello` | bounded | C2–A5 | C2–C6 | 36–84 | A5 is a conservative normal ceiling; C6 remains available as extended professional writing. |
| `contrabass` | bounded | E1–D4 | B0–G4 | 23–67 | Usual four-string writing begins at E1; B0 assumes a five-string/extended low instrument and is therefore extended. |
| `string_ensemble_1` | unbounded | — | — | — | General MIDI ensemble preset, not one physical instrument with one continuous individual compass. |
| `choir_aahs` | unbounded | — | — | — | General MIDI synthetic/ensemble preset; GM does not define a biological SATB roster or hard compass. |
| `trumpet` | bounded | F♯3–C6 | F♯3–F6 | 54–89 | VSL: C trumpet F♯3–C6, F6 occasional/virtuosic. |
| `trombone` | bounded | E2–B♭4 | E2–F5 | 40–77 | VSL tenor trombone E2–F5; top register is deliberately extended. Pedal notes are excluded because the low compass is not a single contiguous generic interval. |
| `french_horn` | bounded | B1–B♭4 | B1–F5 | 35–77 | VSL sounding compass B1–F5; high C5–F5 is treated as demanding extended writing. |
| `soprano_sax` | bounded | C4–B♭5 | A♭3–E6 | 56–88 | Standard non-altissimo written sax compass transformed to sounding pitch for B♭ soprano; narrower central band is the usual writing region. |
| `alto_sax` | bounded | F3–E♭5 | D♭3–A5 | 49–81 | Standard non-altissimo written sax compass transformed to sounding pitch for E♭ alto. |
| `tenor_sax` | bounded | C3–B♭4 | A♭2–E5 | 44–76 | Standard non-altissimo written sax compass transformed to sounding pitch for B♭ tenor. |
| `oboe` | bounded | B♭3–G6 | B♭3–A6 | 58–93 | VSL gives B♭3–G6 with A6 available. |
| `english_horn` | bounded | E3–A5 | E3–B5 | 52–83 | VSL gives E3–A5 with B5 possible. |
| `bassoon` | bounded | B♭1–E♭5 | B♭1–F5 | 34–77 | VSL gives B♭1–E♭5; E5/F5 require considerable effort. |
| `clarinet` | bounded | D3–G6 | D3–B♭6 | 50–94 | B♭ clarinet **sounding** compass. VSL explicitly gives D3–B♭6 and notes orchestral use normally only to G6. |
| `piccolo` | bounded | D5–C8 | D5–C8 | 74–108 | VSL gives D5–C8 for standard C piccolo. |
| `flute` | bounded | B3–D7 | B3–F7 | 59–101 | VSL standard range B3–D7; F7 is an extreme/forced extension. |
| `recorder` | unbounded | — | — | — | `Recorder` is a family name. Yamaha and VSL distinguish soprano, alto, tenor, bass/great-bass instruments with different compasses. The existing GM id is kept for compatibility but the UI labels it `Recorder (generic)`. |
| `standard_drum_kit` | percussion | — | — | GM 35–81 | GM unpitched percussion semantics. |

## Important modeling decisions

### Sounding pitch

Transposing instruments are classified only after conversion to sounding MIDI pitch. No UI-specific compensation is permitted. This matters particularly for B♭ clarinet, F horn, soprano/tenor saxophones and E♭ alto saxophone.

### Registers versus hard limits

A player's absolute maximum is not automatically `usualRange`. Where a source explicitly distinguishes ordinary orchestral use from occasional/extreme notes, ABCoda maps the former to `usualRange` and the latter to `playableRange`.

Examples:

- trumpet: C6 usual ceiling, F6 extended;
- bassoon: E♭5 usual ceiling, F5 extended;
- English horn: A5 usual ceiling, B5 extended;
- clarinet in B♭: G6 usual orchestral ceiling, B♭6 extended;
- flute: D7 usual ceiling, F7 extended.

### Non-contiguous special registers

The current range model is one continuous interval. Therefore special disjoint registers are not folded into a misleading continuous `playableRange`. The clearest case is tenor-trombone pedal notes below E2: VSL documents a gap between the pedals and the normal chromatic register on a plain tenor trombone. ABCoda therefore keeps E2 as the generic hard lower bound until the domain can represent disjoint playable regions or explicit instrument variants.

### Generic presets

General MIDI defines program identities for interoperability but does not define the detailed acoustic characteristics of each implementation. `Choir Aahs` and `String Ensemble 1` therefore do not receive invented biological/organological hard limits. The same principle is applied to `church_organ`, whose sounding compass varies with the actual instrument and stop registration, and to the underspecified generic `recorder` family id.

## Sources consulted

Primary/manufacturer or specialist technical sources were preferred for concrete compass data.

- Vienna Symphonic Library Academy, Violin: https://www.vsl.co.at/academy/strings/violin
- Vienna Symphonic Library Academy, Viola: https://www.vsl.co.at/academy/strings/viola
- Vienna Symphonic Library Academy, Cello: https://www.vsl.co.at/academy/strings/cello
- Vienna Symphonic Library Academy / Studio Dimension Strings, Double Bass: https://www.vsl.co.at/instruments/synchronized/dimension-strings
- Vienna Symphonic Library Academy, Trumpet in C: https://www.vsl.co.at/academy/brass/trumpet-c
- Vienna Symphonic Library Academy, Tenor Trombone: https://www.vsl.co.at/academy/brass/tenor-trombone
- Vienna Symphonic Library Academy, Horn in F: https://www.vsl.co.at/academy/brass/horn-f
- Vienna Symphonic Library Academy, Oboe: https://www.vsl.co.at/academy/woodwinds/oboe
- Vienna Symphonic Library Academy, English Horn: https://www.vsl.co.at/academy/woodwinds/english-horn
- Vienna Symphonic Library Academy, Bassoon: https://www.vsl.co.at/academy/woodwinds/bassoon
- Vienna Symphonic Library Academy, Clarinet in B♭: https://www.vsl.co.at/academy/woodwinds/clarinet
- Vienna Symphonic Library Academy, Concert Flute: https://www.vsl.co.at/academy/woodwinds/concert-flute
- Vienna Symphonic Library Academy, Piccolo: https://www.vsl.co.at/academy/woodwinds/piccolo
- Vienna Symphonic Library, Studio Saxophones: https://www.vsl.co.at/instruments/synchronized/saxophones
- Vienna Symphonic Library, Historic Winds / recorder family: https://preview.vsl.co.at/de/instruments/synchronized/historic-winds
- MIDI Association, General MIDI Level 1: https://midi.org/general-midi-level-1
- Yamaha Musical Instrument Guide, Classical Guitar Range: https://www.yamaha.com/en/musical_instrument_guide/classical_guitar/play/play003.html
- Yamaha Musical Instrument Guide, Pipe Organ: https://www.yamaha.com/en/musical_instrument_guide/pipeorgan/play/
- Yamaha Musical Instrument Guide, Recorder Variants: https://www.yamaha.com/en/musical_instrument_guide/recorder/structure/structure004.html
- Yamaha Musical Instrument Guide, Saxophone Transposition: https://www.yamaha.com/en/musical_instrument_guide/saxophone/play/play003.html

## Future refinement

Two future domain improvements would allow greater precision without weakening the current policy:

1. model explicit instrument variants (e.g. four-string vs five-string contrabass, soprano vs alto recorder);
2. allow disjoint playable regions for special registers such as tenor-trombone pedals.

Neither is required for the current `usual / extended / unplayable` behavior to remain musically coherent.
