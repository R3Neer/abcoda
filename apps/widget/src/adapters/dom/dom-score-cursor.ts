import type { CursorView } from "../../application/score-cursor";
import type {
  CursorMotion,
  ScoreTimingEvent,
} from "../../application/score-timeline";

const STAFF_CURSOR_PADDING = 6;

interface ActiveCursorMotion {
  readonly motion: CursorMotion;
  readonly startedAt: number;
}

interface CssCursorPosition {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

interface VerticalBounds {
  readonly y: number;
  readonly height: number;
}

export class DomScoreCursor implements CursorView {
  private readonly cursor: HTMLDivElement;
  private wrapFadeTimer: ReturnType<typeof setTimeout> | undefined;
  private motionGeneration = 0;
  private currentEvent: ScoreTimingEvent | undefined;
  private activeMotion: ActiveCursorMotion | undefined;

  constructor(private readonly scoreTarget: HTMLElement) {
    this.cursor = document.createElement("div");
    this.cursor.className = "score-cursor";
    this.cursor.hidden = true;
    this.cursor.setAttribute("aria-hidden", "true");
    this.scoreTarget.appendChild(this.cursor);
  }

  show(event: ScoreTimingEvent, motion?: CursorMotion): void {
    const generation = ++this.motionGeneration;
    this.clearWrapFade();

    this.currentEvent = event;
    this.activeMotion = undefined;

    if (!this.cursor.isConnected) {
      this.scoreTarget.appendChild(this.cursor);
    }

    const position = this.toCssPosition(event, event.x);
    if (!position) return;

    this.cursor.hidden = false;
    this.cursor.style.transition = "opacity 80ms ease-out";
    this.cursor.classList.remove("is-wrapping");

    this.applyPosition(position);

    if (!motion) return;

    const target = this.toCssPosition(event, motion.x);
    if (!target) return;

    this.activeMotion = {
      motion,
      startedAt: performance.now(),
    };

    requestAnimationFrame(() => {
      if (generation !== this.motionGeneration) return;

      this.cursor.style.transition =
        `left ${motion.durationMs}ms linear, opacity 80ms ease-out`;

      this.cursor.style.left = `${target.x}px`;

      this.scheduleWrapFade(motion, 0);
    });
  }

  refreshGeometry(): void {
    const event = this.currentEvent;

    if (!event || this.cursor.hidden) return;

    const generation = ++this.motionGeneration;
    this.clearWrapFade();

    if (!this.cursor.isConnected) {
      this.scoreTarget.appendChild(this.cursor);
    }

    const active = this.activeMotion;
    const now = performance.now();

    const elapsedMs = active
      ? Math.max(
          0,
          Math.min(
            active.motion.durationMs,
            now - active.startedAt,
          ),
        )
      : 0;

    const progress =
      active && active.motion.durationMs > 0
        ? elapsedMs / active.motion.durationMs
        : 0;

    const logicalX = active
      ? event.x +
        (active.motion.x - event.x) * progress
      : event.x;

    const position = this.toCssPosition(event, logicalX);
    if (!position) return;

    this.cursor.style.transition = "none";
    this.cursor.classList.remove("is-wrapping");

    this.applyPosition(position);

    if (!active || elapsedMs >= active.motion.durationMs) {
      this.activeMotion = undefined;
      return;
    }

    const target = this.toCssPosition(
      event,
      active.motion.x,
    );

    if (!target) return;

    const remainingMs =
      active.motion.durationMs - elapsedMs;

    requestAnimationFrame(() => {
      if (generation !== this.motionGeneration) return;

      this.cursor.style.transition =
        `left ${remainingMs}ms linear, opacity 80ms ease-out`;

      this.cursor.style.left = `${target.x}px`;

      this.scheduleWrapFade(
        active.motion,
        elapsedMs,
      );
    });
  }

  hide(): void {
    this.motionGeneration += 1;
    this.clearWrapFade();

    this.currentEvent = undefined;
    this.activeMotion = undefined;

    this.cursor.hidden = true;
    this.cursor.classList.remove("is-wrapping");
    this.cursor.style.transition = "opacity 80ms ease-out";
  }

  private applyPosition(position: CssCursorPosition): void {
    this.cursor.style.left = `${position.x}px`;
    this.cursor.style.top = `${position.y}px`;
    this.cursor.style.height = `${position.height}px`;
  }

  private scheduleWrapFade(
    motion: CursorMotion,
    elapsedMs: number,
  ): void {
    if (!motion.wrapsLine) return;

    const fadeAtMs = motion.durationMs * 0.82;

    if (elapsedMs >= fadeAtMs) {
      this.cursor.classList.add("is-wrapping");
      return;
    }

    this.wrapFadeTimer = setTimeout(() => {
      this.cursor.classList.add("is-wrapping");
      this.wrapFadeTimer = undefined;
    }, fadeAtMs - elapsedMs);
  }

  private clearWrapFade(): void {
    if (this.wrapFadeTimer) {
      clearTimeout(this.wrapFadeTimer);
    }

    this.wrapFadeTimer = undefined;
  }

  private toCssPosition(
    event: ScoreTimingEvent,
    x: number,
  ): CssCursorPosition | undefined {
    const svg =
      this.scoreTarget.querySelector<SVGSVGElement>("svg");

    if (!svg) return undefined;

    const scoreRect =
      this.scoreTarget.getBoundingClientRect();

    const svgRect =
      svg.getBoundingClientRect();

    const viewBox =
      svg.viewBox.baseVal;

    const scaleX =
      svgRect.width /
      (viewBox.width || svgRect.width || 1);

    const scaleY =
      svgRect.height /
      (viewBox.height || svgRect.height || 1);

    const wrapper =
      this.staffWrapper(svg, event.line);

    const horizontalOffset =
      this.staffHorizontalOffset(wrapper);

    const vertical =
      this.staffVerticalBounds(wrapper)
      ?? {
        y: event.y,
        height: event.height,
      };

    return {
      x:
        svgRect.left -
        scoreRect.left +
        (x + horizontalOffset - viewBox.x) * scaleX,

      y:
        svgRect.top -
        scoreRect.top +
        (vertical.y - viewBox.y) * scaleY,

      height:
        vertical.height * scaleY,
    };
  }

  private staffWrapper(
    svg: SVGSVGElement,
    line: number,
  ): SVGGElement | undefined {
    return (
      svg.querySelector<SVGGElement>(
        `.abcjs-staff-wrapper.abcjs-l${line}`,
      )
      ?? undefined
    );
  }

  private staffHorizontalOffset(
    wrapper: SVGGElement | undefined,
  ): number {
    if (!wrapper) return 0;

    const value =
      Number(wrapper.dataset.abcodaCenterX);

    return Number.isFinite(value)
      ? value
      : 0;
  }

  private staffVerticalBounds(
    wrapper: SVGGElement | undefined,
  ): VerticalBounds | undefined {
    if (!wrapper) return undefined;

    const staffs = [
      ...wrapper.querySelectorAll<SVGGraphicsElement>(
        ".abcjs-staff",
      ),
    ];

    if (staffs.length === 0) {
      return undefined;
    }

    const boxes = staffs.map(
      (staff) => staff.getBBox(),
    );

    const top =
      Math.min(...boxes.map((box) => box.y));

    const bottom =
      Math.max(
        ...boxes.map(
          (box) => box.y + box.height,
        ),
      );

    if (!(bottom > top)) {
      return undefined;
    }

    return {
      y: top - STAFF_CURSOR_PADDING,
      height:
        bottom -
        top +
        STAFF_CURSOR_PADDING * 2,
    };
  }
}