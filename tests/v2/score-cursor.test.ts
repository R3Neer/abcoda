import { describe, expect, it, vi } from "vitest";
import {
  ScoreCursorController,
  type CursorView,
} from "../../apps/widget/src/application/score-cursor";
import type { ScoreTimeline } from "../../apps/widget/src/application/score-timeline";

const timeline: ScoreTimeline = {
  totalDurationMs: 4000,
  events: [
    { timeMs: 0, x: 20, y: 10, height: 50, line: 0, measure: 0, sourceOffsets: [10] },
    { timeMs: 1000, x: 70, y: 10, height: 50, line: 0, measure: 0, sourceOffsets: [15] },
    { timeMs: 2000, x: 120, y: 10, height: 50, line: 0, measure: 1, sourceOffsets: [20] },
  ],
};

describe("ScoreCursorController", () => {
  it("ignores callbacks while paused and follows matched playback events", () => {
    const show = vi.fn();
    const view: CursorView = { show, hide: vi.fn() };
    const cursor = new ScoreCursorController(view);
    cursor.setTimeline(timeline);
    cursor.onPlaybackEvent({ timeMs: 0, sourceOffsets: [10] });
    expect(show).not.toHaveBeenCalled();

    cursor.setPlaying(true);
    cursor.onPlaybackEvent({ timeMs: 1, sourceOffsets: [10] });
    expect(show).toHaveBeenCalledWith(timeline.events[0], {
      x: 70,
      durationMs: 1000,
      wrapsLine: false,
    });
  });

  it("seeks to the clicked note instead of the start of its measure", () => {
    const show = vi.fn();
    const view: CursorView = { show, hide: vi.fn() };
    const cursor = new ScoreCursorController(view);
    cursor.setTimeline(timeline);
    expect(cursor.seekMeasure(1)).toBe(0.5);
    expect(cursor.seekMeasure(99)).toBeUndefined();
    expect(cursor.seekPoint(72, 35)).toBe(0.25);
    expect(show).toHaveBeenLastCalledWith(timeline.events[1]);
  });
});
