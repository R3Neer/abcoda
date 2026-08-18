export const SCORE_VISUAL_BUFFER_PX = 8;

/**
 * Converts SVG visual overflow into real layout space. The small threshold
 * avoids reserving pixels for sub-pixel rounding noise.
 */
export function scoreVisualClearance(
  svgBottom: number,
  visualBottom: number,
  bufferPx: number = SCORE_VISUAL_BUFFER_PX,
): number {
  if (!Number.isFinite(svgBottom) || !Number.isFinite(visualBottom)) return 0;
  const overflow = Math.max(0, visualBottom - svgBottom);
  return overflow > 0.5 ? Math.ceil(overflow + Math.max(0, bufferPx)) : 0;
}
