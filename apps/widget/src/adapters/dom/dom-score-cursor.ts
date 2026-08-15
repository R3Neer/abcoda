import type { CursorView } from "../../application/score-cursor";
import type { CursorMotion, ScoreTimingEvent } from "../../application/score-timeline";

export class DomScoreCursor implements CursorView {
  private readonly cursor: HTMLDivElement;
  private wrapFadeTimer: ReturnType<typeof setTimeout> | undefined;
  private motionGeneration = 0;

  constructor(private readonly scoreTarget: HTMLElement) {
    this.cursor = document.createElement("div");
    this.cursor.className = "score-cursor";
    this.cursor.hidden = true;
    this.cursor.setAttribute("aria-hidden", "true");
    this.scoreTarget.appendChild(this.cursor);
  }

  show(event: ScoreTimingEvent, motion?: CursorMotion): void {
    const generation = ++this.motionGeneration;
    if (this.wrapFadeTimer) clearTimeout(this.wrapFadeTimer);
    this.wrapFadeTimer = undefined;
    if (!this.cursor.isConnected) this.scoreTarget.appendChild(this.cursor);
    const position = this.toCssPosition(event.x, event.y, event.height);
    if (!position) return;
    this.cursor.hidden = false;
    this.cursor.style.transition = "opacity 80ms ease-out";
    this.cursor.classList.remove("is-wrapping");
    this.cursor.style.left = `${position.x}px`;
    this.cursor.style.top = `${position.y}px`;
    this.cursor.style.height = `${position.height}px`;
    if (!motion) return;
    const target = this.toCssPosition(motion.x, event.y, event.height);
    if (!target) return;
    requestAnimationFrame(() => {
      if (generation !== this.motionGeneration) return;
      this.cursor.style.transition = `left ${motion.durationMs}ms linear, opacity 80ms ease-out`;
      this.cursor.style.left = `${target.x}px`;
      if (motion.wrapsLine) {
        this.wrapFadeTimer = setTimeout(() => {
          this.cursor.classList.add("is-wrapping");
          this.wrapFadeTimer = undefined;
        }, motion.durationMs * 0.82);
      }
    });
  }

  hide(): void {
    this.motionGeneration += 1;
    if (this.wrapFadeTimer) clearTimeout(this.wrapFadeTimer);
    this.wrapFadeTimer = undefined;
    this.cursor.hidden = true;
    this.cursor.classList.remove("is-wrapping");
    this.cursor.style.transition = "opacity 80ms ease-out";
  }

  private toCssPosition(x: number, y: number, height: number): { x: number; y: number; height: number } | undefined {
    const svg = this.scoreTarget.querySelector("svg");
    if (!svg) return undefined;
    const scoreRect = this.scoreTarget.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const scaleX = svgRect.width / (viewBox.width || svgRect.width || 1);
    const scaleY = svgRect.height / (viewBox.height || svgRect.height || 1);
    return {
      x: svgRect.left - scoreRect.left + (x - viewBox.x) * scaleX,
      y: svgRect.top - scoreRect.top + (y - viewBox.y) * scaleY,
      height: height * scaleY,
    };
  }

}
