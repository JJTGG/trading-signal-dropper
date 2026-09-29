export function ema(values: number[], period: number): number[] {
  if (period <= 0) {
    throw new Error("EMA period must be greater than zero.");
  }

  if (values.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  let previousEma =
    values
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

  result.push(previousEma);

  for (let i = period; i < values.length; i += 1) {
    const currentValue = values[i];

    if (currentValue === undefined) {
      throw new Error("Unexpected missing value.");
    }

    const currentEma =
      (currentValue - previousEma) * multiplier + previousEma;

    result.push(currentEma);
    previousEma = currentEma;
  }

  return result;
}