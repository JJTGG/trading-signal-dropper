import { describe, expect, it } from "vitest";
import { ema } from "../../src/indicators/ema.js";

describe("ema", () => {
  it("calculates an EMA from a value series", () => {
    const result = ema([1, 2, 3, 4, 5], 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(2);
    expect(result[1]).toBeCloseTo(3);
    expect(result[2]).toBeCloseTo(4);
  });

  it("returns an empty array when there is insufficient data", () => {
    expect(ema([1, 2], 3)).toEqual([]);
  });

  it("rejects an invalid period", () => {
    expect(() => ema([1, 2, 3], 0)).toThrow(
      "EMA period must be greater than zero."
    );
  });
});