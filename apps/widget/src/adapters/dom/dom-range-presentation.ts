import type { VoiceRangeAssessment } from "../../application/voice-range";

export function applyVoiceRangePresentation(
  documentObject: Document,
  assessments: readonly VoiceRangeAssessment[],
): void {
  const byVoice = new Map<string, VoiceRangeAssessment>(
    assessments.map((assessment) => [assessment.voiceId, assessment] as const),
  );

  documentObject
    .querySelectorAll<HTMLElement>(".voice-mix-row")
    .forEach((row, index) => {
      const select = row.querySelector<HTMLSelectElement>(".voice-instrument");
      if (!select) return;

      const voiceId = select.getAttribute("data-voice-id");
      if (!voiceId) return;

      const assessment = byVoice.get(voiceId);
      if (!assessment) return;

      row.setAttribute("data-range-status", assessment.status);
      select.setAttribute("data-range-status", assessment.status);

      const warning = row.querySelector<HTMLElement>(".voice-range-warning");
      if (!warning || !assessment.message) {
        select.removeAttribute("aria-describedby");
        select.removeAttribute("title");
        return;
      }

      const warningId = `voice-range-${index}`;
      warning.id = warningId;
      warning.classList.add("sr-only");
      warning.setAttribute("data-range-status", assessment.status);
      select.setAttribute("aria-describedby", warningId);
      select.title = assessment.message;
    });
}
