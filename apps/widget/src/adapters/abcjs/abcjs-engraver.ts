import ABCJS from "abcjs";
import type { Engraver } from "../../application/score-session";

export class AbcjsEngraver implements Engraver {
  constructor(private readonly target: HTMLElement) {}

  async render(abc: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();

    const availableWidth = this.target.clientWidth;
    const tunes = ABCJS.renderAbc(this.target, abc, {
      responsive: "resize",
      add_classes: true,
      expandToWidest: true,
      staffwidth: availableWidth > 0 ? Math.max(280, availableWidth - 32) : 720,
    });
    signal.throwIfAborted();

    if (tunes.length !== 1) {
      this.clear();
      throw new Error("Expected exactly one engraved tune.");
    }
  }

  clear(): void {
    this.target.replaceChildren();
  }
}
