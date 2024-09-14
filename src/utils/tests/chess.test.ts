import { expect, test } from "vitest";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import { hasMorePriority } from "../chess";

test("NAGs are consistent", () => {
  for (const k of Object.keys(ANNOTATION_INFO)) {
    if (k === "") continue;
    const nag = ANNOTATION_INFO[k as Annotation].nag!;
    expect(NAG_INFO.get(`$${nag}`)).toBe(k);
  }
});

test("priority comparison", () => {
  expect(hasMorePriority([0, 0], [0])).toBe(false);
  expect(hasMorePriority([0], [0, 0])).toBe(true);
  expect(hasMorePriority([0], [1])).toBe(true);
  expect(hasMorePriority([1], [0])).toBe(false);
  expect(hasMorePriority([0, 0], [0, 1])).toBe(true);
  expect(hasMorePriority([0, 1], [0, 0])).toBe(false);
  expect(hasMorePriority([0, 1], [0, 2])).toBe(true);
  expect(hasMorePriority([0, 2], [0, 1])).toBe(false);
});
