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

function sourcePositions(event: ABCJS.NoteTimingEvent): number[] {
  return [event.startChar, ...(event.startCharArray ?? [])]
    .filter((position): position is number => typeof position === "number");
}

export function matchingCursorEvent(
  events: VisibleTimingEvent[],
  callbackEvent: ABCJS.NoteTimingEvent,
): VisibleTimingEvent | undefined {
  const callbackPositions = new Set(sourcePositions(callbackEvent));
  if (callbackPositions.size > 0) {
    const sourceMatches = events.filter((candidate) =>
      sourcePositions(candidate).some((position) => callbackPositions.has(position)),
    );
    if (sourceMatches.length > 0) return [...sourceMatches].sort(
      (a, b) => Math.abs(a.milliseconds - callbackEvent.milliseconds)
        - Math.abs(b.milliseconds - callbackEvent.milliseconds),
    )[0];
  }

  const timingMatches = events.filter(
    (candidate) => Math.abs(candidate.milliseconds - callbackEvent.milliseconds) <= 2,
  );
  if (timingMatches.length === 0) return undefined;
  const sameLine = typeof callbackEvent.line === "number"
    ? timingMatches.filter((candidate) => candidate.line === callbackEvent.line)
    : timingMatches;
  const candidates = sameLine.length > 0 ? sameLine : timingMatches;
  if (typeof callbackEvent.left !== "number") return candidates[0];
  return [...candidates].sort(
    (a, b) => Math.abs(a.left - callbackEvent.left!) - Math.abs(b.left - callbackEvent.left!),
  )[0];
}

export function cursorPlaybackActive(state: { playing: boolean; busy: boolean }): boolean {
  return state.playing && !state.busy;
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

export type ScoreBounds = { x: number; y: number; width: number; height: number };

export function expandedScoreBounds(
  viewport: ScoreBounds,
  content: ScoreBounds,
  maximumOverflow = { horizontal: 56, vertical: 72 },
): ScoreBounds {
  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;
  const contentRight = content.x + content.width;
  const contentBottom = content.y + content.height;
  const left = Math.min(maximumOverflow.horizontal, Math.max(0, viewport.x - content.x + 4));
  const right = Math.min(maximumOverflow.horizontal, Math.max(0, contentRight - viewportRight + 4));
  const top = Math.min(maximumOverflow.vertical, Math.max(0, viewport.y - content.y + 4));
  const bottom = Math.min(maximumOverflow.vertical, Math.max(0, contentBottom - viewportBottom + 4));
  return {
    x: viewport.x - left,
    y: viewport.y - top,
    width: viewport.width + left + right,
    height: viewport.height + top + bottom,
  };
}

export function clampCursorX(x: number, viewport: Pick<ScoreBounds, "x" | "width">): number {
  return Math.max(viewport.x + 2, Math.min(viewport.x + viewport.width - 2, x));
}

export function cursorMotionFrom(
  events: VisibleTimingEvent[],
  current: VisibleTimingEvent,
): CursorMotion | undefined {
  const next = nextCursorEvent(events, current);
  if (!next) return undefined;

  const duration = next.milliseconds - current.milliseconds;
  if (duration <= 0) return undefined;
  const wrapsLine = next.line !== current.line || next.top !== current.top;
  // A wrapped system is not one enormous horizontal interval. Sweeping to the
  // furthest engraving bound makes the cursor race when a chord symbol or
  // voice label protrudes outside the nominal SVG viewport. Move only across
  // the current glyph, fade, and let the next timed event place it on the new
  // system.
  const currentEnd = current.endX ?? current.left + (current.width ?? 12);
  const x = wrapsLine ? Math.min(currentEnd, current.left + 32) : next.left;
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
