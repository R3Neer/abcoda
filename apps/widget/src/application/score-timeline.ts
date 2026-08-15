export interface ScoreTimingEvent {
  readonly timeMs: number;
  readonly x: number;
  readonly endX?: number;
  readonly width?: number;
  readonly y: number;
  readonly height: number;
  readonly line: number;
  readonly measure: number;
  readonly sourceOffsets: readonly number[];
}

export interface ScoreTimeline {
  readonly events: readonly ScoreTimingEvent[];
  readonly totalDurationMs: number;
}

export interface CursorMotion {
  readonly x: number;
  readonly durationMs: number;
  readonly wrapsLine: boolean;
}

export function matchingTimingEvent(
  events: readonly ScoreTimingEvent[],
  callback: { readonly timeMs: number; readonly sourceOffsets: readonly number[]; readonly line?: number; readonly x?: number },
): ScoreTimingEvent | undefined {
  const offsets = new Set(callback.sourceOffsets);
  if (offsets.size > 0) {
    const matches = events.filter((candidate) =>
      candidate.sourceOffsets.some((offset) => offsets.has(offset)),
    );
    if (matches.length > 0) return nearestByTime(matches, callback.timeMs);
  }

  const timingMatches = events.filter((candidate) => Math.abs(candidate.timeMs - callback.timeMs) <= 2);
  if (timingMatches.length === 0) return undefined;
  const lineMatches = callback.line === undefined
    ? timingMatches
    : timingMatches.filter((candidate) => candidate.line === callback.line);
  const candidates = lineMatches.length > 0 ? lineMatches : timingMatches;
  if (callback.x === undefined) return candidates[0];
  return [...candidates].sort((a, b) => Math.abs(a.x - callback.x!) - Math.abs(b.x - callback.x!))[0];
}

export function firstEventInMeasure(
  events: readonly ScoreTimingEvent[],
  measure: number,
): ScoreTimingEvent | undefined {
  return events.find((event) => event.measure === measure);
}

export function eventProgress(
  event: ScoreTimingEvent,
  totalDurationMs: number,
): number {
  return totalDurationMs > 0 ? clamp(event.timeMs / totalDurationMs) : 0;
}

export function cursorMotionFrom(
  events: readonly ScoreTimingEvent[],
  current: ScoreTimingEvent,
  totalDurationMs?: number,
): CursorMotion | undefined {
  const index = events.findIndex((event) => event === current || samePosition(event, current));
  const next = index < 0
    ? undefined
    : events.slice(index + 1).find((event) => event.timeMs > current.timeMs);
  if (!next) {
    const durationMs = (totalDurationMs ?? current.timeMs) - current.timeMs;
    if (durationMs <= 0 || current.endX === undefined || current.endX <= current.x) return undefined;
    return { x: current.endX, durationMs, wrapsLine: false };
  }
  const durationMs = next.timeMs - current.timeMs;
  if (durationMs <= 0) return undefined;
  const wrapsLine = next.line !== current.line || next.y !== current.y;
  const currentEnd = current.endX ?? current.x + (current.width ?? 12);
  const x = wrapsLine ? Math.min(currentEnd, current.x + 32) : next.x;
  return x > current.x ? { x, durationMs, wrapsLine } : undefined;
}

export function eventForSourceOffsets(
  events: readonly ScoreTimingEvent[],
  sourceOffsets: readonly number[],
): ScoreTimingEvent | undefined {
  const offsets = new Set(sourceOffsets);
  return offsets.size === 0
    ? undefined
    : events.find((event) => event.sourceOffsets.some((offset) => offsets.has(offset)));
}

export function measureAtPoint(
  events: readonly ScoreTimingEvent[],
  x: number,
  y: number,
): number | undefined {
  const lines = new Map<number, { top: number; bottom: number; events: ScoreTimingEvent[] }>();
  for (const event of events) {
    const line = lines.get(event.line) ?? { top: event.y, bottom: event.y + event.height, events: [] };
    line.top = Math.min(line.top, event.y);
    line.bottom = Math.max(line.bottom, event.y + event.height);
    line.events.push(event);
    lines.set(event.line, line);
  }
  const line = [...lines.values()]
    .filter((candidate) => y >= candidate.top - 8 && y <= candidate.bottom + 8)
    .sort((a, b) => Math.abs(y - (a.top + a.bottom) / 2) - Math.abs(y - (b.top + b.bottom) / 2))[0];
  if (!line) return undefined;

  const starts = new Map<number, number>();
  for (const event of line.events) {
    starts.set(event.measure, Math.min(starts.get(event.measure) ?? event.x, event.x));
  }
  const ordered = [...starts].sort((a, b) => a[1] - b[1]);
  return [...ordered].reverse().find(([, left]) => x >= left)?.[0] ?? ordered[0]?.[0];
}

export function eventAtPoint(
  events: readonly ScoreTimingEvent[],
  x: number,
  y: number,
): ScoreTimingEvent | undefined {
  const line = eventsForPoint(events, y);
  if (!line) return undefined;
  return [...line].sort((left, right) => {
    const distance = horizontalDistance(left, x) - horizontalDistance(right, x);
    return distance !== 0 ? distance : Math.abs(left.x - x) - Math.abs(right.x - x);
  })[0];
}

export function firstTimingEvent(events: readonly ScoreTimingEvent[]): ScoreTimingEvent | undefined {
  return events[0];
}

function eventsForPoint(
  events: readonly ScoreTimingEvent[],
  y: number,
): readonly ScoreTimingEvent[] | undefined {
  const lines = new Map<number, { top: number; bottom: number; events: ScoreTimingEvent[] }>();
  for (const event of events) {
    const line = lines.get(event.line) ?? { top: event.y, bottom: event.y + event.height, events: [] };
    line.top = Math.min(line.top, event.y);
    line.bottom = Math.max(line.bottom, event.y + event.height);
    line.events.push(event);
    lines.set(event.line, line);
  }
  return [...lines.values()]
    .filter((candidate) => y >= candidate.top - 8 && y <= candidate.bottom + 8)
    .sort((a, b) => Math.abs(y - (a.top + a.bottom) / 2) - Math.abs(y - (b.top + b.bottom) / 2))[0]
    ?.events;
}

function horizontalDistance(event: ScoreTimingEvent, x: number): number {
  const right = event.endX ?? event.x + (event.width ?? 12);
  if (x < event.x) return event.x - x;
  return x > right ? x - right : 0;
}

function nearestByTime(events: readonly ScoreTimingEvent[], timeMs: number): ScoreTimingEvent {
  return [...events].sort((a, b) => Math.abs(a.timeMs - timeMs) - Math.abs(b.timeMs - timeMs))[0]!;
}

function samePosition(left: ScoreTimingEvent, right: ScoreTimingEvent): boolean {
  return left.timeMs === right.timeMs && left.x === right.x && left.line === right.line;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
