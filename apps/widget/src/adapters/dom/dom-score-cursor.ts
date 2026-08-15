import type { CursorView } from "../../application/score-cursor";
import type { CursorMotion, ScoreTimingEvent } from "../../application/score-timeline";

export class DomScoreCursor implements CursorView {
  private readonly cursor: HTMLDivElement;

  constructor(private readonly scoreTarget: HTMLElement) {
    this.cursor = document.createElement("div");
    this.cursor.className = "score-cursor";
    this.cursor.hidden = true;
    this.cursor.setAttribute("aria-hidden", "true");
    this.scoreTarget.appendChild(this.cursor);
  }

  show(event: ScoreTimingEvent, motion?: CursorMotion): void {
    if (!this.cursor.isConnected) this.scoreTarget.appendChild(this.cursor);
    const position = this.toCssPosition(event.x, event.y, event.height);
    if (!position) return;
    this.cursor.hidden = false;
    this.cursor.style.transition = "none";
    this.cursor.style.left = `${position.x}px`;
    this.cursor.style.top = `${position.y}px`;
    this.cursor.style.height = `${position.height}px`;
    if (!motion) return;
    const target = this.toCssPosition(motion.x, event.y, event.height);
    if (!target) return;
    requestAnimationFrame(() => {
      this.cursor.style.transition = `left ${motion.durationMs}ms linear`;
      this.cursor.style.left = `${target.x}px`;
    });
  }

  hide(): void {
    this.cursor.hidden = true;
    this.cursor.style.transition = "none";
  }

  bindSeek(
    onPoint: (x: number, y: number) => void,
    onMeasure: (measure: number) => void,
  ): () => void {
    const click = (event: MouseEvent) => {
      const measure = measureFromTarget(event.target);
      if (measure !== undefined) {
        onMeasure(measure);
        return;
      }
      const point = this.toScorePoint(event.clientX, event.clientY);
      if (point) onPoint(point.x, point.y);
    };
    this.scoreTarget.addEventListener("click", click);
    return () => this.scoreTarget.removeEventListener("click", click);
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

  private toScorePoint(clientX: number, clientY: number): { x: number; y: number } | undefined {
    const svg = this.scoreTarget.querySelector("svg");
    if (!svg) return undefined;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    if (rect.width <= 0 || rect.height <= 0) return undefined;
    return {
      x: viewBox.x + (clientX - rect.left) * viewBox.width / rect.width,
      y: viewBox.y + (clientY - rect.top) * viewBox.height / rect.height,
    };
  }
}

function measureFromTarget(target: EventTarget | null): number | undefined {
  const element = target instanceof Element ? target.closest("[class*='abcjs-m']") : null;
  const classes = element?.getAttribute("class") ?? "";
  const global = /(?:^|\s)abcjs-mm(\d+)(?:\s|$)/.exec(classes);
  if (global) return Number(global[1]);
  const local = /(?:^|\s)abcjs-m(\d+)(?:\s|$)/.exec(classes);
  return local ? Number(local[1]) : undefined;
}
