import type { MantineColor } from "@mantine/core";

export type Annotation =
  | ""
  | "!"
  | "!!"
  | "?"
  | "??"
  | "!?"
  | "?!"
  | "+-"
  | "±"
  | "⩲"
  | "="
  | "∞"
  | "⩱"
  | "∓"
  | "-+"
  | "N"
  | "↑↑"
  | "↑"
  | "→"
  | "⇆"
  | "=∞"
  | "⊕"
  | "∆"
  | "□"
  | "⨀";

export const NAG_INFO = new Map<string, Annotation>([
  ["$1", "!"],
  ["$2", "?"],
  ["$3", "!!"],
  ["$4", "??"],
  ["$5", "!?"],
  ["$6", "?!"],
  ["$7", "□"],
  ["$10", "="],
  ["$13", "∞"],
  ["$14", "⩲"],
  ["$15", "⩱"],
  ["$16", "±"],
  ["$17", "∓"],
  ["$18", "+-"],
  ["$19", "-+"],
  ["$22", "⨀"],
  ["$23", "⨀"],
  ["$32", "↑↑"],
  ["$33", "↑↑"],
  ["$36", "↑"],
  ["$37", "↑"],
  ["$40", "→"],
  ["$41", "→"],
  ["$44", "=∞"],
  ["$45", "=∞"],
  ["$132", "⇆"],
  ["$133", "⇆"],
  ["$138", "⊕"],
  ["$139", "⊕"],
  ["$140", "∆"],
  ["$146", "N"],
]);

type AnnotationInfo = {
  group?: string;
  name: string;
  color?: MantineColor;
  nag: number;
};

export const ANNOTATION_INFO: Record<Annotation, AnnotationInfo> = {
  "": { name: "None", color: "gray", nag: 0 },
  "!!": { group: "basic", name: "Brilliant", color: "cyan", nag: 3 },
  "!": { group: "basic", name: "Good", color: "teal", nag: 1 },
  "!?": { group: "basic", name: "Interesting", color: "lime", nag: 5 },
  "?!": { group: "basic", name: "Dubious", color: "yellow", nag: 6 },
  "?": { group: "basic", name: "Mistake", color: "orange", nag: 2 },
  "??": { group: "basic", name: "Blunder", color: "red", nag: 4 },
  "+-": { group: "advantage", name: "White is winning", nag: 18 },
  "±": { group: "advantage", name: "White has a clear advantage", nag: 16 },
  "⩲": { group: "advantage", name: "White has a slight advantage", nag: 14 },
  "=": { group: "advantage", name: "Equal position", nag: 10 },
  "∞": { group: "advantage", name: "Unclear position", nag: 13 },
  "⩱": { group: "advantage", name: "Black has a slight advantage", nag: 15 },
  "∓": { group: "advantage", name: "Black has a clear advantage", nag: 17 },
  "-+": { group: "advantage", name: "Black is winning", nag: 19 },
  N: { name: "Novelty", nag: 146 },
  "↑↑": { name: "Development", nag: 32 },
  "↑": { name: "Initiative", nag: 36 },
  "→": { name: "Attack", nag: 40 },
  "⇆": { name: "Counterplay", nag: 132 },
  "=∞": { name: "With compensation", nag: 44 },
  "⊕": { name: "Time Trouble", nag: 138 },
  "∆": { name: "With the idea", nag: 140 },
  "□": { name: "Only move", nag: 7 },
  "⨀": { name: "Zugzwang", nag: 22 },
};

export function isBasicAnnotation(
  annotation: string,
): annotation is "!" | "!!" | "?" | "??" | "!?" | "?!" {
  return ["!", "!!", "?", "??", "!?", "?!"].includes(annotation);
}
