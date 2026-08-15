import {
  cursorMotionFrom,
  eventAtPoint,
  eventProgress,
  firstTimingEvent,
  firstEventInMeasure,
  matchingTimingEvent,
  type CursorMotion,
  type ScoreTimeline,
  type ScoreTimingEvent,
} from "./score-timeline";

export interface CursorView {
  show(event: ScoreTimingEvent, motion?: CursorMotion): void;
  hide(): void;
}

export interface PlaybackTimingCallback {
  readonly timeMs: number;
  readonly sourceOffsets: readonly number[];
  readonly line?: number;
  readonly x?: number;
}

export class ScoreCursorController {
  private timeline: ScoreTimeline = { events: [], totalDurationMs: 0 };
  private playing = false;
  private selected: ScoreTimingEvent | undefined;
  private ignoreMismatchedCallbacksUntil = 0;

  constructor(private readonly view: CursorView) {}

  setTimeline(timeline: ScoreTimeline): void {
    this.timeline = timeline;
    this.selected = firstTimingEvent(timeline.events);
    if (this.selected) this.view.show(this.selected);
    else this.view.hide();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing && this.selected) this.view.show(this.selected);
  }

  onPlaybackEvent(callback: PlaybackTimingCallback): void {
    if (!this.playing) return;
    const event = matchingTimingEvent(this.timeline.events, callback);
    if (!event) return;
    if (
      Date.now() < this.ignoreMismatchedCallbacksUntil
      && this.selected
      && !sameTimingEvent(event, this.selected)
    ) return;
    this.ignoreMismatchedCallbacksUntil = 0;
    this.selected = event;
    this.view.show(event, cursorMotionFrom(this.timeline.events, event));
  }

  seekMeasure(measure: number): number | undefined {
    const event = firstEventInMeasure(this.timeline.events, measure);
    if (!event) return undefined;
    this.selected = event;
    this.ignoreMismatchedCallbacksUntil = Date.now() + 150;
    this.view.show(event);
    return eventProgress(event, this.timeline.totalDurationMs);
  }

  seekPoint(x: number, y: number): number | undefined {
    const event = eventAtPoint(this.timeline.events, x, y);
    if (!event) return undefined;
    this.selected = event;
    this.ignoreMismatchedCallbacksUntil = Date.now() + 150;
    this.view.show(event);
    return eventProgress(event, this.timeline.totalDurationMs);
  }

  rewind(): void {
    this.selected = firstTimingEvent(this.timeline.events);
    if (this.selected) this.view.show(this.selected);
    else this.view.hide();
  }
}

function sameTimingEvent(left: ScoreTimingEvent, right: ScoreTimingEvent): boolean {
  if (left === right) return true;
  if (left.timeMs === right.timeMs && left.line === right.line && left.x === right.x) return true;
  const offsets = new Set(left.sourceOffsets);
  return right.sourceOffsets.some((offset) => offsets.has(offset));
}
