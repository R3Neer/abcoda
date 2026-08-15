import type { ScorePresentationDto, ScoreSnapshotDto } from "@abcoda/contracts";
import type { HostPresentationContext } from "../../application/host-bridge";
import type { ScoreSessionState } from "../../application/score-session";
import { requiredElement } from "./dom-elements";

export class WidgetShellView {
  private readonly status: HTMLOutputElement;
  private readonly scoreTitle: HTMLElement;
  private readonly error: HTMLElement;

  constructor(private readonly documentObject: Document) {
    this.status = requiredElement(this.documentObject, "status");
    this.scoreTitle = requiredElement(this.documentObject, "score-title");
    this.error = requiredElement(this.documentObject, "error");
  }

  showPresentation(
    presentation: ScorePresentationDto | undefined,
    snapshot: ScoreSnapshotDto,
  ): void {
    this.scoreTitle.textContent = presentation?.title ?? snapshot.document.title ?? "ABCoda";
  }

  showScore(state: ScoreSessionState): void {
    this.documentObject.body.dataset.state = state.status;
    this.error.hidden = true;
    if (state.status === "booting") this.status.value = "Booting";
    if (state.status === "loading") this.status.value = `Rendering revision ${state.revision}`;
    if (state.status === "ready") this.status.value = `Revision ${state.snapshot.revision} ready`;
    if (state.status === "invalid" || state.status === "failed") {
      this.status.value = state.status === "invalid" ? "Invalid result" : "Render failed";
      this.showError(state.message);
    }
  }

  applyHostContext(context: HostPresentationContext): void {
    const root = this.documentObject.documentElement;
    if (context.theme) root.dataset.theme = context.theme;
    if (context.displayMode) root.dataset.displayMode = context.displayMode;
    const safeArea = context.safeAreaInsets;
    if (safeArea) {
      root.style.setProperty("--host-safe-top", `${safeArea.top}px`);
      root.style.setProperty("--host-safe-right", `${safeArea.right}px`);
      root.style.setProperty("--host-safe-bottom", `${safeArea.bottom}px`);
      root.style.setProperty("--host-safe-left", `${safeArea.left}px`);
    }
  }

  showError(message: string): void {
    this.error.textContent = message;
    this.error.hidden = false;
  }
}
