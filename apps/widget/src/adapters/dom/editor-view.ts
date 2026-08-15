import type { DraftSessionState } from "../../application/draft-session";
import { createTransposeControl } from "../../components/transpose-control";
import { requiredElement, requiredInside } from "./dom-elements";
import type { DraftActions } from "./dom-widget-actions";

export class EditorView {
  private readonly editor: HTMLDetailsElement;
  private readonly editorState: HTMLOutputElement;
  private readonly draftInput: HTMLTextAreaElement;
  private readonly draftDiagnostics: HTMLElement;
  private readonly versionHistory: HTMLElement;
  private readonly versionPicker: HTMLDetailsElement;
  private readonly beginCommitButton: HTMLButtonElement;
  private readonly commitForm: HTMLFormElement;
  private readonly commitMessage: HTMLInputElement;
  private readonly submitCommitButton: HTMLButtonElement;
  private readonly cancelCommitButton: HTMLButtonElement;
  private readonly copyDraftButton: HTMLButtonElement;
  private readonly copyIcon: SVGElement;
  private readonly copiedIcon: SVGElement;
  private readonly copyStatus: HTMLOutputElement;
  private readonly globalTranspose: HTMLElement;
  private copyResetTimer: ReturnType<typeof setTimeout> | undefined;
  private draftStatus: DraftSessionState["status"] = "unavailable";

  constructor(private readonly documentObject: Document) {
    this.editor = requiredElement(this.documentObject, "editor");
    this.editorState = requiredElement(this.documentObject, "editor-state");
    this.draftInput = requiredElement(this.documentObject, "abc-draft");
    this.draftDiagnostics = requiredElement(this.documentObject, "draft-diagnostics");
    this.versionHistory = requiredElement(this.documentObject, "version-history");
    this.versionPicker = requiredElement(this.documentObject, "version-picker");
    this.beginCommitButton = requiredElement(this.documentObject, "begin-commit");
    this.commitForm = requiredElement(this.documentObject, "commit-form");
    this.commitMessage = requiredElement(this.documentObject, "commit-message");
    this.submitCommitButton = requiredElement(this.documentObject, "submit-commit");
    this.cancelCommitButton = requiredElement(this.documentObject, "cancel-commit");
    this.copyDraftButton = requiredElement(this.documentObject, "copy-draft");
    this.copyIcon = requiredInside(this.copyDraftButton, ".copy-icon");
    this.copiedIcon = requiredInside(this.copyDraftButton, ".copied-icon");
    this.copyStatus = requiredElement(this.documentObject, "copy-status");
    this.globalTranspose = requiredElement(this.documentObject, "global-transpose");
  }

  show(state: DraftSessionState): void {
    this.draftStatus = state.status;
    this.editor.hidden = state.status === "unavailable";
    if (state.status === "unavailable") return;
    if (this.draftInput.value !== state.draft) this.draftInput.value = state.draft;
    this.editorState.value = state.status === "clean"
      ? `Revision ${state.lastGood.revision} saved`
      : state.status === "dirty"
        ? "Saving soon…"
        : state.status === "validating"
          ? "Saving…"
          : "Not applied";
    const busy = state.status === "validating";
    this.updateCommitSubmit();
    this.editor.toggleAttribute("aria-busy", busy);
    this.versionHistory.replaceChildren(...state.history.map((version) => {
      const button = this.documentObject.createElement("button");
      button.type = "button";
      button.dataset.versionId = version.id;
      button.dataset.versionStatus = version.status;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(version.id === state.currentVersionId));
      const marker = this.documentObject.createElement("span");
      marker.className = "version-marker";
      marker.textContent = version.status === "invalid" ? "!" : "✓";
      const label = this.documentObject.createElement("span");
      label.textContent = version.label;
      button.appendChild(marker);
      button.appendChild(label);
      return button;
    }));
    this.draftDiagnostics.replaceChildren(...(
      state.status === "invalid" ? state.diagnostics.map((diagnostic) => {
        const item = this.documentObject.createElement("li");
        const location = diagnostic.range
          ? `Line ${diagnostic.range.start.line}, column ${diagnostic.range.start.column}: `
          : "";
        item.textContent = `${location}${diagnostic.message}`;
        return item;
      }) : []
    ));
  }

  bind(actions: DraftActions): () => void {
    const edit = () => actions.edit(this.draftInput.value);
    const copy = () => { void this.copyDraft(); };
    const restoreVersion = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-version-id]")
        : null;
      if (!button?.dataset.versionId) return;
      actions.restoreVersion(button.dataset.versionId);
      this.versionPicker.open = false;
    };
    let versionCloseTimer: ReturnType<typeof setTimeout> | undefined;
    const openVersions = () => {
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      versionCloseTimer = undefined;
      this.versionPicker.open = true;
    };
    const closeVersions = () => { this.versionPicker.open = false; };
    const scheduleVersionClose = () => {
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      versionCloseTimer = setTimeout(closeVersions, 180);
    };
    const keepVersionsOpen = (event: MouseEvent) => {
      event.preventDefault();
      openVersions();
    };
    const closeVersionsAfterFocus = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !this.versionPicker.contains(next)) closeVersions();
    };
    const beginCommit = () => {
      this.beginCommitButton.hidden = true;
      this.commitForm.hidden = false;
      this.commitMessage.focus();
      this.updateCommitSubmit();
    };
    const updateCommit = () => this.updateCommitSubmit();
    const submitCommit = (event: SubmitEvent) => {
      event.preventDefault();
      if (!actions.commit(this.commitMessage.value)) return;
      this.commitMessage.value = "";
      this.commitForm.hidden = true;
      this.beginCommitButton.hidden = false;
    };
    const closeCommit = () => {
      this.commitMessage.value = "";
      this.commitForm.hidden = true;
      this.beginCommitButton.hidden = false;
      this.beginCommitButton.focus();
    };
    const cancelCommitWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCommit();
    };

    const transposeControl = createTransposeControl(this.documentObject, {
      label: "Transpose score",
      ariaLabel: "score",
      onTranspose: actions.transpose,
    });
    this.globalTranspose.replaceChildren(transposeControl.element);

    this.draftInput.addEventListener("input", edit);
    this.versionHistory.addEventListener("click", restoreVersion);
    this.copyDraftButton.addEventListener("click", copy);
    this.versionPicker.addEventListener("pointerenter", openVersions);
    this.versionPicker.addEventListener("pointerleave", scheduleVersionClose);
    this.versionHistory.addEventListener("pointerenter", openVersions);
    this.versionPicker.addEventListener("focusin", openVersions);
    this.versionPicker.addEventListener("focusout", closeVersionsAfterFocus);
    this.versionPicker.querySelector("summary")?.addEventListener("click", keepVersionsOpen);
    this.beginCommitButton.addEventListener("click", beginCommit);
    this.commitMessage.addEventListener("input", updateCommit);
    this.commitMessage.addEventListener("keydown", cancelCommitWithKeyboard);
    this.commitForm.addEventListener("submit", submitCommit);
    this.cancelCommitButton.addEventListener("click", closeCommit);

    return () => {
      this.draftInput.removeEventListener("input", edit);
      this.versionHistory.removeEventListener("click", restoreVersion);
      this.copyDraftButton.removeEventListener("click", copy);
      this.versionPicker.removeEventListener("pointerenter", openVersions);
      this.versionPicker.removeEventListener("pointerleave", scheduleVersionClose);
      this.versionHistory.removeEventListener("pointerenter", openVersions);
      this.versionPicker.removeEventListener("focusin", openVersions);
      this.versionPicker.removeEventListener("focusout", closeVersionsAfterFocus);
      this.versionPicker.querySelector("summary")?.removeEventListener("click", keepVersionsOpen);
      this.beginCommitButton.removeEventListener("click", beginCommit);
      this.commitMessage.removeEventListener("input", updateCommit);
      this.commitMessage.removeEventListener("keydown", cancelCommitWithKeyboard);
      this.commitForm.removeEventListener("submit", submitCommit);
      this.cancelCommitButton.removeEventListener("click", closeCommit);
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      transposeControl.dispose();
      this.globalTranspose.replaceChildren();
    };
  }

  private updateCommitSubmit(): void {
    const stable = this.draftStatus === "clean" || this.draftStatus === "invalid";
    this.submitCommitButton.disabled = !stable || this.commitMessage.value.trim().length === 0;
  }

  private async copyDraft(): Promise<void> {
    try {
      const clipboard = this.documentObject.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error("Clipboard access is unavailable.");
      await clipboard.writeText(this.draftInput.value);
      this.copyStatus.value = "Copied";
      this.copyDraftButton.disabled = true;
      this.copyDraftButton.setAttribute("aria-label", "Copied");
      this.copyDraftButton.title = "Copied";
      this.copyIcon.toggleAttribute("hidden", true);
      this.copiedIcon.toggleAttribute("hidden", false);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => {
        this.copyResetTimer = undefined;
        this.copyDraftButton.disabled = false;
        this.copyDraftButton.setAttribute("aria-label", "Copy ABC");
        this.copyDraftButton.title = "Copy ABC";
        this.copyIcon.toggleAttribute("hidden", false);
        this.copiedIcon.toggleAttribute("hidden", true);
        this.copyStatus.value = "";
      }, 1400);
    } catch {
      this.copyStatus.value = "Copy failed";
    }
  }
}
