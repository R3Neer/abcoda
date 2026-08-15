import type { RationalDuration } from "../../domain/src/index";

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

export function rational(numerator: number, denominator = 1): RationalDuration {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    throw new Error("A duration must be a finite integer ratio.");
  }
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator) / divisor,
  };
}

export function addDuration(left: RationalDuration, right: RationalDuration): RationalDuration {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiplyDuration(left: RationalDuration, right: RationalDuration): RationalDuration {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

export function durationFromSuffix(
  defaultLength: RationalDuration,
  suffix: string | undefined,
): RationalDuration {
  if (!suffix) return defaultLength;
  if (/^\d+$/.test(suffix)) return multiplyDuration(defaultLength, rational(Number(suffix)));
  if (/^\d+\/$/.test(suffix)) {
    return multiplyDuration(defaultLength, rational(Number(suffix.slice(0, -1)), 2));
  }
  if (/^\/+$/.test(suffix)) {
    return multiplyDuration(defaultLength, rational(1, 2 ** suffix.length));
  }
  const fraction = /^(\d*)\/(\d+)$/.exec(suffix);
  if (fraction) {
    return multiplyDuration(
      defaultLength,
      rational(Number(fraction[1] || 1), Number(fraction[2])),
    );
  }
  return defaultLength;
}
