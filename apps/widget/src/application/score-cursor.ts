import {
  cursorMotionFrom,
  eventProgress,
  firstEventInMeasure,
  matchingTimingEvent,
  measureAtPoint,
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

  constructor(private readonly view: CursorView) {}

  setTimeline(timeline: ScoreTimeline): void {
    this.timeline = timeline;
    this.view.hide();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) this.view.hide();
  }

  onPlaybackEvent(callback: PlaybackTimingCallback): void {
    if (!this.playing) return;
    const event = matchingTimingEvent(this.timeline.events, callback);
    if (!event) return;
    this.view.show(event, cursorMotionFrom(this.timeline.events, event));
  }

  seekMeasure(measure: number): number | undefined {
    const event = firstEventInMeasure(this.timeline.events, measure);
    if (!event) return undefined;
    this.view.show(event);
    return eventProgress(event, this.timeline.totalDurationMs);
  }

  seekPoint(x: number, y: number): number | undefined {
    const measure = measureAtPoint(this.timeline.events, x, y);
    return measure === undefined ? undefined : this.seekMeasure(measure);
  }

  rewind(): void {
    this.view.hide();
  }
}
