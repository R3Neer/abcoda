import type ABCJS from "abcjs";

export type VisibleTimingEvent = ABCJS.NoteTimingEvent & {
  left: number;
  top: number;
  height: number;
  line: number;
  measureNumber: number;
};

export function timingEventsForTune(
  tune: ABCJS.TuneObject,
  bpm: number,
): ABCJS.NoteTimingEvent[] {
  const setTiming = tune.setTiming as unknown as (
    this: ABCJS.TuneObject,
    bpm?: number,
    measuresOfDelay?: number,
  ) => ABCJS.NoteTimingEvent[];
  return setTiming.call(tune, bpm, 0);
}

export function visibleTimingEvents(events: ABCJS.NoteTimingEvent[]): VisibleTimingEvent[] {
  return events.filter((event): event is VisibleTimingEvent =>
    event.type === "event" &&
    typeof event.left === "number" &&
    typeof event.top === "number" &&
    typeof event.height === "number" &&
    typeof event.line === "number" &&
    typeof event.measureNumber === "number",
  );
}

export function totalMeasureFromClasses(classes: string, fallback: number): number {
  const total = classes.match(/(?:^|\s)abcjs-mm(\d+)(?:\s|$)/);
  if (total) return Number(total[1]);
  const local = classes.match(/(?:^|\s)abcjs-m(\d+)(?:\s|$)/);
  return local ? Number(local[1]) : fallback;
}

export function firstEventInMeasure(
  events: VisibleTimingEvent[],
  measureNumber: number,
): VisibleTimingEvent | undefined {
  return events.find((event) => event.measureNumber === measureNumber);
}

export function eventProgress(
  event: VisibleTimingEvent,
  events: VisibleTimingEvent[],
  totalMilliseconds = events.at(-1)?.milliseconds ?? 0,
): number {
  const end = totalMilliseconds;
  return end > 0 ? Math.max(0, Math.min(1, event.milliseconds / end)) : 0;
}

export function nextCursorEvent(
  events: VisibleTimingEvent[],
  current: VisibleTimingEvent,
): VisibleTimingEvent | undefined {
  const index = events.findIndex((event) => event === current || (
    event.milliseconds === current.milliseconds &&
    event.left === current.left &&
    event.line === current.line
  ));
  return index < 0 ? undefined : events.slice(index + 1).find((event) => event.milliseconds > current.milliseconds);
}

export type CursorMotion = {
  x: number;
  duration: number;
  wrapsLine: boolean;
};

export function cursorMotionFrom(
  events: VisibleTimingEvent[],
  current: VisibleTimingEvent,
): CursorMotion | undefined {
  const next = nextCursorEvent(events, current);
  if (!next) return undefined;

  const duration = next.milliseconds - current.milliseconds;
  if (duration <= 0) return undefined;
  const wrapsLine = next.line !== current.line || next.top !== current.top;
  const lineRight = events
    .filter((event) => event.line === current.line && event.top === current.top)
    .reduce(
      (right, event) => Math.max(right, event.endX ?? event.left + (event.width ?? 0)),
      current.endX ?? current.left + (current.width ?? 12),
    );
  const x = wrapsLine ? lineRight : next.left;
  return x > current.left ? { x, duration, wrapsLine } : undefined;
}

export function measureAtPoint(
  events: VisibleTimingEvent[],
  x: number,
  y: number,
): number | undefined {
  const lines = new Map<number, { top: number; bottom: number; events: VisibleTimingEvent[] }>();
  events.forEach((event) => {
    const line = lines.get(event.line) ?? { top: event.top, bottom: event.top + event.height, events: [] };
    line.top = Math.min(line.top, event.top);
    line.bottom = Math.max(line.bottom, event.top + event.height);
    line.events.push(event);
    lines.set(event.line, line);
  });
  const line = [...lines.values()]
    .filter((candidate) => y >= candidate.top - 8 && y <= candidate.bottom + 8)
    .sort((a, b) => Math.abs(y - (a.top + a.bottom) / 2) - Math.abs(y - (b.top + b.bottom) / 2))[0];
  if (!line) return undefined;

  const starts = new Map<number, number>();
  line.events.forEach((event) => starts.set(
    event.measureNumber,
    Math.min(starts.get(event.measureNumber) ?? event.left, event.left),
  ));
  const ordered = [...starts.entries()].sort((a, b) => a[1] - b[1]);
  return [...ordered].reverse().find(([, left]) => x >= left)?.[0] ?? ordered[0]?.[0];
}
