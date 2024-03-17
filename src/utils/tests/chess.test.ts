import { expect, test } from "vitest";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";

test("NAGs are consistent", () => {
  for (const k of Object.keys(ANNOTATION_INFO)) {
    if (k === "") continue;
    const nag = ANNOTATION_INFO[k as Annotation].nag!;
    expect(NAG_INFO.get(`$${nag}`)).toBe(k);
  }
});
