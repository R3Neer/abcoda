import { describe, expect, it } from "vitest";
import { synchronizeInstrumentationAbc } from "@abcoda/abc-codec";

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

  it("removes a brace when its voices become different instruments", () => {
    const result = synchronizeInstrumentationAbc(seedPiano(), {
      RH: "cello",
      LH: "acoustic_grand_piano",
    });

    expect(result).toContain("%%score RH | LH");
    expect(result).not.toContain("%%score { RH | LH }");
    expect(result).toContain('V:RH clef=treble name="Cello" subname="Vc."');
    expect(result).toContain('V:LH clef=bass name="Piano" subname="Pno."');
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

  it("uses later-system abbreviations when more than one instrument unit remains", () => {
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
    expect(result).toContain('V:Vln clef=treble name="Violin I" subname="Vln. I"');
  });
});
