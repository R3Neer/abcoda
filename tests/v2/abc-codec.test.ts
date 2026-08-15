import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CanonicalAbcCodec,
  parseAbc,
  serializeAbc,
} from "@abcoda/abc-codec";

const fixtureNames = [
  "inline-clef",
  "multi-voice",
  "octave-clef",
  "percussion",
  "single-voice",
] as const;

const readFixture = (name: (typeof fixtureNames)[number]) =>
  fs.readFile(
    fileURLToPath(
      new URL(`../characterization/fixtures/abc/${name}.abc`, import.meta.url),
    ),
    "utf8",
  );

function decodedDocument(source: string) {
  const decoded = parseAbc(source);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw new Error("Expected ABC to decode.");
  return decoded.document;
}

describe("canonical ABC codec", () => {
  it.each(fixtureNames)("losslessly round-trips the %s corpus fixture", async (name) => {
    const source = await readFixture(name);
    const first = decodedDocument(source);
    const encoded = serializeAbc(first);
    const second = decodedDocument(encoded);

    expect(encoded).toBe(source.replace(/\r\n?/g, "\n"));
    expect(second).toEqual(first);
  });

  it("builds ordered voices, measures, durations and exact source maps", async () => {
    const source = await readFixture("multi-voice");
    const document = decodedDocument(source);

    expect(document.voices.map((voice) => voice.id)).toEqual(["RH", "LH"]);
    for (const voice of document.voices) {
      expect(voice.measures).toHaveLength(2);
      expect(voice.measures.map((measure) => measure.expectedDuration)).toEqual([
        { numerator: 1, denominator: 1 },
        { numerator: 1, denominator: 1 },
      ]);
      expect(voice.measures.map((measure) => measure.actualDuration)).toEqual([
        { numerator: 1, denominator: 1 },
        { numerator: 1, denominator: 1 },
      ]);
    }

    const firstNote = document.voices[0]!.measures[0]!.events[0]!;
    expect(firstNote).toMatchObject({ kind: "note", lexeme: "C" });
    expect(source.slice(firstNote.source.start.offset, firstNote.source.end.offset)).toBe("C");
  });

  it("represents inline fields and compound musical events without discarding syntax", async () => {
    const inline = decodedDocument(await readFixture("inline-clef"));
    expect(inline.voices[0]!.measures[1]!.events[0]).toMatchObject({
      kind: "inline_field",
      lexeme: "[K:C clef=bass]",
    });

    const compound = decodedDocument(
      "X:1\nM:4/4\nL:1/8\nK:C\n(3CDE [CEG]2 z2 C2|]",
    );
    expect(compound.voices[0]!.measures[0]!.events.map((event) => event.kind)).toEqual([
      "tuplet",
      "note",
      "note",
      "note",
      "chord",
      "rest",
      "note",
    ]);
    expect(compound.voices[0]!.measures[0]!.actualDuration).toEqual({
      numerator: 1,
      denominator: 1,
    });
  });

  it("indexes header, body and inline ABC fields with exact value source ranges", () => {
    const source = [
      "X:1",
      "T:Fields",
      "L:1/4",
      "K:  C  ",
      "C D|",
      "K:  G  ",
      "[K:  D ] E F|]",
      "",
    ].join("\n");
    const document = decodedDocument(source);
    const keys = document.fields.filter((field) => field.name === "K");

    expect(keys.map((field) => ({
      placement: field.placement,
      value: field.value,
      source: source.slice(field.source.start.offset, field.source.end.offset),
      valueSource: source.slice(
        field.valueSource.start.offset,
        field.valueSource.end.offset,
      ),
    }))).toEqual([
      {
        placement: "header",
        value: "C",
        source: "K:  C  ",
        valueSource: "C",
      },
      {
        placement: "body",
        value: "G",
        source: "K:  G  ",
        valueSource: "G",
      },
      {
        placement: "inline",
        value: "D",
        source: "[K:  D ]",
        valueSource: "D",
      },
    ]);

    expect(document.voices[0]?.measures.flatMap((measure) => measure.events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "inline_field", lexeme: "[K:  D ]" }),
      ]),
    );
  });

  it("normalizes only newlines and offers an encode/decode port", () => {
    const codec = new CanonicalAbcCodec();
    const decoded = codec.decode("X:1\r\nK:C\r\nC4|]\r\n");
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("Expected ABC to decode.");
    expect(codec.encode(decoded.document)).toBe("X:1\nK:C\nC4|]\n");
  });

  it("round-trips a bounded generated note corpus as a codec property", () => {
    const pitches = ["C", "^D", "_E", "F,", "g'"];
    const lengths = ["", "2", "/", "3/2"];

    for (const pitch of pitches) {
      for (const length of lengths) {
        const source = `X:property-${pitch}-${length}\nL:1/8\nK:C\n${pitch}${length}|]\n`;
        const first = decodedDocument(source);
        const second = decodedDocument(serializeAbc(first));
        expect(second).toEqual(first);
      }
    }
  });
});
