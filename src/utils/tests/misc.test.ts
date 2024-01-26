import { expect, test } from "vitest";
import { isPrefix } from "../misc";

test("should return true if the first array is a prefix of the second array", () => {
  expect(isPrefix([1, 2], [1, 2, 3])).toBe(true);
  expect(isPrefix([], [1, 2, 3])).toBe(true);
  expect(isPrefix([0, 0], [1, 0])).toBe(false);
  expect(isPrefix([1, 2], [1, 2])).toBe(true);
});
