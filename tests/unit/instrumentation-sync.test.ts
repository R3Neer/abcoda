import { describe, expect, it } from "vitest";
import { parseAbc, synchronizeInstrumentationAbc } from "@abcoda/abc-codec";

const piano = `X:1
T:Grand staff
M:4/4
L:1/4
%%score { RH | LH }
V:RH clef=treble name="Right hand" subname="RH"
V:LH clef=bass name="Left hand" subname="LH"
K:C
[V:RH name="Right hand"] C D E F|]
[V:LH name="Left hand"] C, D, E, F,|]`;

const seedPiano = () => synchronizeInstrumentationAbc(piano, {
  RH: "acoustic_grand_piano",
  LH: "acoustic_grand_piano",
});

describe("instrumentation synchronization", () => {
  it("prints one piano name for a single braced instrument and no repeated subname", () => {
    const result = seedPiano();

    expect(result).toContain("%%score { RH | LH }");
    expect(result).toContain('V:RH clef=treble name="Piano"');
    expect(result).toContain("V:LH clef=bass");
    expect(result).not.toContain('name="Right hand"');
    expect(result).not.toContain('name="Left hand"');
    expect(result).not.toContain("subname=");
    expect(result).toContain("[V:RH] C D E F|]");
    expect(result).toContain("[V:LH] C, D, E, F,|]");
    expect(result).toContain("% abcoda:brace-group RH LH");
  });

  it("removes a brace when its voices become different instruments without inventing a replacement piano staff", () => {
    const result = synchronizeInstrumentationAbc(seedPiano(), {
      RH: "cello",
      LH: "acoustic_grand_piano",
    });

    expect(result).toContain("%%score RH | LH");
    expect(result).not.toContain("%%score { RH | LH }");
    expect(result).toContain('V:RH clef=treble name="Cello" subname="Vc."');
    expect(result).toContain('V:LH clef=bass name="Piano" subname="Pno."');
    expect(result).not.toContain("LH_upper");
    expect(result).toContain("% abcoda:brace-group RH LH");
    expect(result).toContain("% abcoda:instrument RH cello");
    expect(result).toContain("% abcoda:instrument LH acoustic_grand_piano");
  });

  it("restores the remembered brace when the voices share an instrument again", () => {
    const split = synchronizeInstrumentationAbc(seedPiano(), {
      RH: "cello",
      LH: "acoustic_grand_piano",
    });
    const restored = synchronizeInstrumentationAbc(split, {
      RH: "bright_acoustic_piano",
      LH: "bright_acoustic_piano",
    });

    expect(restored).toContain("%%score { RH | LH }");
    expect(restored).toContain('V:RH clef=treble name="Piano"');
    expect(restored).toContain("V:LH clef=bass");
    expect(restored).not.toContain("subname=");
  });

  it("uses canonical later-system abbreviations when more than one instrument unit remains", () => {
    const ensemble = `X:1
T:Trio
M:4/4
L:1/4
%%score { RH | LH } Vln
V:RH clef=treble
V:LH clef=bass
V:Vln clef=treble name="Violin I" subname="Vln. I"
K:C
[V:RH] C D E F|]
[V:LH] C, D, E, F,|]
[V:Vln] G A B c|]`;

    const result = synchronizeInstrumentationAbc(ensemble, {
      RH: "acoustic_grand_piano",
      LH: "acoustic_grand_piano",
      Vln: "violin",
    });

    expect(result).toContain('V:RH clef=treble name="Piano" subname="Pno."');
    expect(result).toContain("V:LH clef=bass");
    expect(result).toContain('V:Vln clef=treble name="Violin" subname="Vln."');
    expect(result).not.toContain('name="Violin I"');
  });

  it("completes a one-staff treble piano with a silent lower staff", () => {
    const source = `X:1
T:One-line piano
M:4/4
L:1/4
V:P clef=treble name="Piano right hand"
K:C
[V:P] C D E F|G A B c|]`;

    const result = synchronizeInstrumentationAbc(source, {
      P: "acoustic_grand_piano",
    });

    expect(result).toContain("%%score { P | P_lower }");
    expect(result).toContain('V:P clef=treble name="Piano"');
    expect(result).toContain("V:P_lower clef=bass");
    expect(result).toContain("[V:P_lower] z4| z4|]");
    expect(result).not.toContain("subname=");

    const parsed = parseAbc(result);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.voices.map((voice) => String(voice.id))).toEqual(["P", "P_lower"]);
      expect(parsed.document.voices[0]?.measures).toHaveLength(2);
      expect(parsed.document.voices[1]?.measures).toHaveLength(2);
    }
  });

  it("completes an implicit default piano voice instead of requiring ChatGPT to declare V", () => {
    const source = `X:1
T:Implicit piano
M:4/4
L:1/4
K:C
C D E F|G A B c|]`;

    const result = synchronizeInstrumentationAbc(source, {
      default: "acoustic_grand_piano",
    });

    expect(result).toContain("%%score { default | default_lower }");
    expect(result).toContain('V:default clef=treble name="Piano"');
    expect(result).toContain("V:default_lower clef=bass");
    expect(result).toContain("[V:default_lower] z4| z4|]");

    const parsed = parseAbc(result);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.voices.map((voice) => String(voice.id))).toEqual([
        "default",
        "default_lower",
      ]);
    }
  });

  it("puts a one-staff bass piano on the lower staff and creates the silent upper staff", () => {
    const source = `X:1
T:Bass piano line
M:3/4
L:1/4
V:P clef=bass
K:C
[V:P] C, D, E,|F, G, A,|]`;

    const result = synchronizeInstrumentationAbc(source, {
      P: "bright_acoustic_piano",
    });

    expect(result).toContain("%%score { P_upper | P }");
    expect(result).toContain('V:P_upper clef=treble name="Piano"');
    expect(result).toContain("V:P clef=bass");
    expect(result).toContain("[V:P_upper] z3| z3|]");
  });

  it("replaces stale LLM labels and supplies a missing piano staff in an ensemble", () => {
    const source = `X:1
T:Clarinet and piano
M:4/4
L:1/4
%%score Cl P
V:Cl clef=treble name="Clarinet in B♭" subname="Clarinet in B♭"
V:P clef=treble name="Piano RH"
K:C
[V:Cl name="Clarinet in B♭"] C D E F|]
[V:P name="Piano RH"] G A B c|]`;

    const result = synchronizeInstrumentationAbc(source, {
      Cl: "flute",
      P: "acoustic_grand_piano",
    });

    expect(result).toContain("%%score Cl { P | P_lower }");
    expect(result).toContain('V:Cl clef=treble name="Flute" subname="Fl."');
    expect(result).toContain('V:P clef=treble name="Piano" subname="Pno."');
    expect(result).toContain("V:P_lower clef=bass");
    expect(result).not.toContain("Clarinet in B♭");
    expect(result).not.toContain('[V:Cl name=');
    expect(result).not.toContain('[V:P name=');
  });
});
