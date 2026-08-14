import { describe, expect, it } from "vitest";
import {
  eventProgress,
  firstEventInMeasure,
  measureAtPoint,
  nextCursorEvent,
  totalMeasureFromClasses,
  visibleTimingEvents,
} from "../web/src/cursor";

const events = visibleTimingEvents([
  { type: "event", milliseconds: 0, millisecondsPerMeasure: 2000, left: 20, top: 10, height: 50, line: 0, measureNumber: 0 },
  { type: "event", milliseconds: 500, millisecondsPerMeasure: 2000, left: 60, top: 10, height: 50, line: 0, measureNumber: 0 },
  { type: "event", milliseconds: 2000, millisecondsPerMeasure: 2000, left: 120, top: 10, height: 50, line: 0, measureNumber: 1 },
  { type: "event", milliseconds: 4000, millisecondsPerMeasure: 2000, left: 20, top: 80, height: 50, line: 1, measureNumber: 2 },
  { type: "end", milliseconds: 6000, millisecondsPerMeasure: 2000 },
]);

describe("score seeking helpers", () => {
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
});
