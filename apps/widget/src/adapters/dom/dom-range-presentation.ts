import type { VoiceRangeAssessment } from "../../application/voice-range";

export function applyVoiceRangePresentation(
  documentObject: Document,
  assessments: readonly VoiceRangeAssessment[],
): void {
  const byVoice = new Map(
    assessments.map((assessment) => [assessment.voiceId, assessment]),
  );

  documentObject
    .querySelectorAll<HTMLElement>(".voice-mix-row")
    .forEach((row, index) => {
      const select = row.querySelector<HTMLSelectElement>(".voice-instrument");
      const voiceId = select?.dataset.voiceId;
      if (!select || !voiceId) return;

      const assessment = byVoice.get(voiceId);
      if (!assessment) return;

      row.dataset.rangeStatus = assessment.status;
      select.dataset.rangeStatus = assessment.status;

      const warning = row.querySelector<HTMLElement>(".voice-range-warning");
      if (!warning || !assessment.message) {
        select.removeAttribute("aria-describedby");
        select.removeAttribute("title");
        return;
      }

      const warningId = `voice-range-${index}`;
      warning.id = warningId;
      warning.classList.add("sr-only");
      warning.dataset.rangeStatus = assessment.status;
      select.setAttribute("aria-describedby", warningId);
      select.title = assessment.message;
    });
}
