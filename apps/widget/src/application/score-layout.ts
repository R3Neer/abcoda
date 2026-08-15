const MIN_STAFF_WIDTH = 280;
const FALLBACK_STAFF_WIDTH = 740;
const CONTAINER_ALLOWANCE = 80;

const DEFAULT_MEASURES_PER_LINE = 4;
const BASE_STAFF_WIDTH = 300;
const WIDTH_PER_MEASURE = 110;

export function scoreStaffWidth(
  availableWidth: number,
  preferredMeasuresPerLine?: number,
): number {
  const measuresPerLine = preferredMeasuresPerLine === undefined
    ? DEFAULT_MEASURES_PER_LINE
    : Math.max(1, Math.min(8, Math.round(preferredMeasuresPerLine)));

  const desiredWidth =
    BASE_STAFF_WIDTH + WIDTH_PER_MEASURE * measuresPerLine;

  const usableWidth = Number.isFinite(availableWidth) && availableWidth > 0
    ? Math.max(MIN_STAFF_WIDTH, availableWidth - CONTAINER_ALLOWANCE)
    : FALLBACK_STAFF_WIDTH;

  return Math.min(desiredWidth, usableWidth);
}