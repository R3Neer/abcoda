import {
  cursorMotionFrom,
  eventAtPoint,
  eventForSourceOffsets,
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
  private tempoRatio = 1;
  private selected: ScoreTimingEvent | undefined;
  private ignoreMismatchedCallbacksUntil = 0;

  constructor(private readonly view: CursorView) {}

  setTempoRatio(ratio: number): void {
    this.tempoRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }

  setTimeline(timeline: ScoreTimeline, preserveSelection = false): void {
    const sourceOffsets = preserveSelection ? this.selected?.sourceOffsets : undefined;
    this.timeline = timeline;
    this.selected = sourceOffsets
      ? eventForSourceOffsets(timeline.events, sourceOffsets) ?? firstTimingEvent(timeline.events)
      : firstTimingEvent(timeline.events);
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
    const motion = cursorMotionFrom(
      this.timeline.events,
      event,
      this.timeline.totalDurationMs,
    );
    this.view.show(
      event,
      motion
        ? { ...motion, durationMs: motion.durationMs / this.tempoRatio }
        : undefined,
    );
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

  seekSourceOffsets(sourceOffsets: readonly number[]): number | undefined {
    const event = eventForSourceOffsets(this.timeline.events, sourceOffsets);
    if (!event) return undefined;
    this.selected = event;
    this.ignoreMismatchedCallbacksUntil = Date.now() + 150;
    this.view.show(event);
    return eventProgress(event, this.timeline.totalDurationMs);
  }

  playbackFinished(looping: boolean): void {
    if (!looping) this.rewind();
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
