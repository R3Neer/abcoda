import type ABCJS from "abcjs";
import type { ScoreTimeline, ScoreTimingEvent } from "../../application/score-timeline";

export function timelineForTune(tune: ABCJS.TuneObject, bpm: number): ScoreTimeline {
  const setTiming = tune.setTiming as unknown as (
    this: ABCJS.TuneObject,
    bpm?: number,
    measuresOfDelay?: number,
  ) => ABCJS.NoteTimingEvent[];
  const raw = setTiming.call(tune, bpm, 0);
  return {
    events: raw.flatMap(toTimingEvent),
    totalDurationMs: Math.max(0, ...raw.map((event) => event.milliseconds)),
  };
}

export function callbackTiming(event: ABCJS.NoteTimingEvent): {
  readonly timeMs: number;
  readonly sourceOffsets: readonly number[];
  readonly line?: number;
  readonly x?: number;
} {
  return {
    timeMs: event.milliseconds,
    sourceOffsets: sourceOffsets(event),
    ...(typeof event.line === "number" ? { line: event.line } : {}),
    ...(typeof event.left === "number" ? { x: event.left } : {}),
  };
}

function toTimingEvent(event: ABCJS.NoteTimingEvent): ScoreTimingEvent[] {
  if (
    event.type !== "event"
    || typeof event.left !== "number"
    || typeof event.top !== "number"
    || typeof event.height !== "number"
    || typeof event.line !== "number"
    || typeof event.measureNumber !== "number"
  ) return [];
  return [{
    timeMs: event.milliseconds,
    x: event.left,
    ...(typeof event.endX === "number" ? { endX: event.endX } : {}),
    ...(typeof event.width === "number" ? { width: event.width } : {}),
    y: event.top,
    height: event.height,
    line: event.line,
    measure: event.measureNumber,
    sourceOffsets: sourceOffsets(event),
  }];
}

function sourceOffsets(event: ABCJS.NoteTimingEvent): number[] {
  return [event.startChar, ...(event.startCharArray ?? [])]
    .filter((position): position is number => typeof position === "number");
}
