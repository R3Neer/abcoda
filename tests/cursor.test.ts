import { describe, expect, it } from "vitest";
import {
  cursorMotionFrom,
  eventProgress,
  firstEventInMeasure,
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

  it("sweeps to the end and fades before wrapping to the next system", () => {
    expect(cursorMotionFrom(events, events[1]!)).toEqual({ x: 120, duration: 1500, wrapsLine: false });
    expect(cursorMotionFrom(events, events[2]!)).toEqual({ x: 180, duration: 2000, wrapsLine: true });
  });
});
