import { describe, expect, it } from "vitest";
import {
  cursorMotionFrom,
  clampCursorX,
  expandedScoreBounds,
  cursorPlaybackActive,
  eventProgress,
  firstEventInMeasure,
  matchingCursorEvent,
  measureAtPoint,
  nextCursorEvent,
  timingEventsForTune,
  totalMeasureFromClasses,
  visibleTimingEvents,
} from "../web/src/cursor";

const events = visibleTimingEvents([
  { type: "event", milliseconds: 0, millisecondsPerMeasure: 2000, left: 20, top: 10, height: 50, line: 0, measureNumber: 0 },
  { type: "event", milliseconds: 500, millisecondsPerMeasure: 2000, left: 60, top: 10, height: 50, line: 0, measureNumber: 0 },
  { type: "event", milliseconds: 2000, millisecondsPerMeasure: 2000, left: 120, endX: 180, top: 10, height: 50, line: 0, measureNumber: 1 },
  { type: "event", milliseconds: 4000, millisecondsPerMeasure: 2000, left: 20, top: 80, height: 50, line: 1, measureNumber: 2 },
  { type: "end", milliseconds: 6000, millisecondsPerMeasure: 2000 },
]);

describe("score seeking helpers", () => {
  it("keeps abcjs setTiming bound to its tune object", () => {
    const tune = {
      setTiming(this: unknown, bpm: number) {
        expect(this).toBe(tune);
        expect(bpm).toBe(96);
        return [];
      },
    };
    expect(timingEventsForTune(tune as never, 96)).toEqual([]);
  });

  it("prefers global abcjs measure classes across wrapped systems", () => {
    expect(totalMeasureFromClasses("abcjs-note abcjs-m1 abcjs-mm13", 0)).toBe(13);
    expect(totalMeasureFromClasses("abcjs-note abcjs-m2", 0)).toBe(2);
  });

  it("finds measure starts and normalized playback progress", () => {
    const measure = firstEventInMeasure(events, 1);
    expect(measure?.left).toBe(120);
    expect(measure && eventProgress(measure, events, 6000)).toBeCloseTo(1 / 3);
  });

  it("maps clicks in score whitespace to the surrounding measure", () => {
    expect(measureAtPoint(events, 30, 35)).toBe(0);
    expect(measureAtPoint(events, 150, 35)).toBe(1);
    expect(measureAtPoint(events, 50, 100)).toBe(2);
    expect(measureAtPoint(events, 50, 200)).toBeUndefined();
  });

  it("chooses the next distinct timed note for continuous motion", () => {
    expect(nextCursorEvent(events, events[0]!)?.milliseconds).toBe(500);
    expect(nextCursorEvent(events, events.at(-1)!)).toBeUndefined();
  });

  it("moves continuously but only across the current glyph before a system wrap", () => {
    expect(cursorMotionFrom(events, events[1]!)).toEqual({ x: 120, duration: 1500, wrapsLine: false });
    expect(cursorMotionFrom(events, events[2]!)).toEqual({ x: 152, duration: 2000, wrapsLine: true });
  });

  it("does not chase protruding engraving across a system break", () => {
    const protruding = visibleTimingEvents([
      { type: "event", milliseconds: 0, millisecondsPerMeasure: 2000, left: 700, endX: 1400, top: 10, height: 50, line: 0, measureNumber: 0 },
      { type: "event", milliseconds: 1000, millisecondsPerMeasure: 2000, left: 20, top: 80, height: 50, line: 1, measureNumber: 1 },
    ]);
    expect(cursorMotionFrom(protruding, protruding[0]!)).toEqual({ x: 732, duration: 1000, wrapsLine: true });
  });

  it("expands modest engraving overflow and clamps the cursor to the viewport", () => {
    expect(expandedScoreBounds(
      { x: 0, y: 0, width: 740, height: 500 },
      { x: -20, y: -8, width: 790, height: 540 },
    )).toEqual({ x: -24, y: -12, width: 798, height: 548 });
    expect(expandedScoreBounds(
      { x: 0, y: 0, width: 740, height: 500 },
      { x: -500, y: -500, width: 2000, height: 2000 },
    )).toEqual({ x: -56, y: -72, width: 852, height: 644 });
    expect(clampCursorX(-40, { x: -20, width: 780 })).toBe(-18);
    expect(clampCursorX(900, { x: -20, width: 780 })).toBe(758);
  });

  it("matches abcjs playback callbacks by source position despite geometry or timing drift", () => {
    const positioned = visibleTimingEvents([
      { type: "event", milliseconds: 0, millisecondsPerMeasure: 2000, left: 20, top: 10, height: 50, line: 0, measureNumber: 0, startCharArray: [12, 24] },
      { type: "event", milliseconds: 500, millisecondsPerMeasure: 2000, left: 60, top: 10, height: 50, line: 0, measureNumber: 0, startChar: 30 },
    ]);
    expect(matchingCursorEvent(positioned, {
      type: "event", milliseconds: 17, millisecondsPerMeasure: 2000, startChar: 24,
    })).toBe(positioned[0]);
  });

  it("uses playback time to disambiguate a source position repeated by repeat signs", () => {
    const repeated = visibleTimingEvents([
      { type: "event", milliseconds: 0, millisecondsPerMeasure: 2000, left: 20, top: 10, height: 50, line: 0, measureNumber: 0, startChar: 12 },
      { type: "event", milliseconds: 8000, millisecondsPerMeasure: 2000, left: 20, top: 10, height: 50, line: 0, measureNumber: 0, startChar: 12 },
    ]);
    expect(matchingCursorEvent(repeated, {
      type: "event", milliseconds: 8000.5, millisecondsPerMeasure: 2000, startChar: 12,
    })).toBe(repeated[1]);
  });

  it("falls back to tolerant timing and does not advance during audio preparation", () => {
    expect(matchingCursorEvent(events, {
      type: "event", milliseconds: 501.5, millisecondsPerMeasure: 2000, line: 0, left: 58,
    })).toBe(events[1]);
    expect(matchingCursorEvent(events, {
      type: "event", milliseconds: 510, millisecondsPerMeasure: 2000,
    })).toBeUndefined();
    expect(cursorPlaybackActive({ playing: true, busy: true })).toBe(false);
    expect(cursorPlaybackActive({ playing: true, busy: false })).toBe(true);
  });
});
