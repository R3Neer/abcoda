import { describe, expect, it } from "vitest";
import {
  cursorMotionFrom,
  eventAtPoint,
  eventForSourceOffsets,
  eventProgress,
  firstEventInMeasure,
  matchingTimingEvent,
  measureAtPoint,
  type ScoreTimingEvent,
} from "../../apps/widget/src/application/score-timeline";

const events: ScoreTimingEvent[] = [
  { timeMs: 0, x: 20, y: 10, height: 50, line: 0, measure: 0, sourceOffsets: [12] },
  { timeMs: 500, x: 60, y: 10, height: 50, line: 0, measure: 0, sourceOffsets: [24] },
  { timeMs: 2000, x: 120, endX: 180, y: 10, height: 50, line: 0, measure: 1, sourceOffsets: [30] },
  { timeMs: 4000, x: 20, y: 80, height: 50, line: 1, measure: 2, sourceOffsets: [40] },
];

describe("v2 score timeline", () => {
  it("maps source positions and disambiguates repeats by playback time", () => {
    const repeated = [events[0]!, { ...events[0]!, timeMs: 8000 }];
    expect(matchingTimingEvent(repeated, { timeMs: 7999, sourceOffsets: [12] })).toBe(repeated[1]);
    expect(matchingTimingEvent(events, { timeMs: 501.5, sourceOffsets: [], line: 0, x: 58 })).toBe(events[1]);
  });

  it("finds measure starts, point targets and normalized progress", () => {
    expect(firstEventInMeasure(events, 1)).toBe(events[2]);
    expect(eventProgress(events[2]!, 6000)).toBeCloseTo(1 / 3);
    expect(measureAtPoint(events, 150, 35)).toBe(1);
    expect(measureAtPoint(events, 50, 100)).toBe(2);
    expect(measureAtPoint(events, 50, 200)).toBeUndefined();
    expect(eventAtPoint(events, 62, 35)).toBe(events[1]);
    expect(eventAtPoint(events, 150, 35)).toBe(events[2]);
    expect(eventAtPoint(events, 50, 100)).toBe(events[3]);
    expect(eventAtPoint(events, 50, 200)).toBeUndefined();
  });

  it("animates within a system and limits motion before a wrap", () => {
    expect(cursorMotionFrom(events, events[1]!)).toEqual({
      x: 120,
      durationMs: 1500,
      wrapsLine: false,
    });
    expect(cursorMotionFrom(events, events[2]!)).toEqual({
      x: 152,
      durationMs: 2000,
      wrapsLine: true,
    });
  });

  it("moves from the last note to the final bar for the remaining duration", () => {
    const last = { ...events[3]!, endX: 180 };
    expect(cursorMotionFrom([...events.slice(0, 3), last], last, 5500)).toEqual({
      x: 180,
      durationMs: 1500,
      wrapsLine: false,
    });
  });

  it("resolves an ABCJS selection by its source offset", () => {
    expect(eventForSourceOffsets(events, [24])).toBe(events[1]);
    expect(eventForSourceOffsets(events, [999])).toBeUndefined();
  });
});
