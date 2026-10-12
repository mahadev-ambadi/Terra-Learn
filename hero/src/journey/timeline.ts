// The journey's scroll timeline, shared by the WebGL engine and the DOM layers so both agree on
// where every chapter and section sits. `p` is overall scroll progress, 0..1.
//
// The page is a stack of five chapters. Each one after the hero slides up over the one before
// it like a card, at scroll speed, then plays its own scene while it fills the screen.

/** total page height in screens */
export const SCREENS = 14;

/** one screen of scrolling, in p */
export const SCREEN = 1 / (SCREENS - 1);

export const CHAPTERS = ["hero", "underground", "field", "plots", "outro"] as const;
export type ChapterId = (typeof CHAPTERS)[number];

/** when each chapter after the hero starts and finishes sliding in */
const RISE: [number, number][] = [
  [0, 0],
  [0.06, 0.06 + SCREEN],
  [0.55, 0.55 + SCREEN],
  [0.72, 0.72 + SCREEN],
  [0.88, 0.88 + SCREEN],
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** how much of the screen each chapter covers, from the bottom up (hero is always 1) */
export function covers(p: number): number[] {
  return RISE.map(([a, b], i) => (i === 0 ? 1 : clamp01((p - a) / (b - a))));
}

/** 0..1 within [a, b] */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export type Section = {
  id: string;
  chapter: number;
  in: number;
  out: number;
  label: string;
  title: string;
  body: string;
  cta?: { label: string; href: string; place: "mid" | "low" };
};

export const SECTIONS: Section[] = [
  {
    id: "land",
    chapter: 1,
    in: 0.235,
    out: 0.405,
    label: "Your land",
    title: "First, know\nyour ground.",
    body:
      "Drop a pin on a real satellite map and see soil pH, nitrogen, air quality and five years of climate for that exact plot. Every number says whether it is a live reading, an estimate or a gap — nothing is dressed up to look more certain than it is.",
    cta: { label: "Explore your land", href: "/sign-up", place: "mid" },
  },
  {
    id: "advisor",
    chapter: 1,
    in: 0.465,
    out: 0.6,
    label: "Advisor",
    title: "Our advisor\ndials it in\nfurther.",
    body:
      "Ask in your own language. The assistant already knows your soil, your crops and the farmers around you, so it answers with real names and real distances — and nothing it drafts is sent until you tap confirm.",
  },
  {
    id: "field",
    chapter: 2,
    in: 0.635,
    out: 0.765,
    label: "Real-world fields",
    title: "We take it to\nthe field.",
    body:
      "Point your phone at a leaf and the on-device scanner names the plant and the disease, and says so when it isn't sure. Saath links you with neighbours to share equipment, labour and circular-farming loops.",
    cta: { label: "Experience the field", href: "/sign-up", place: "low" },
  },
  {
    id: "sim",
    chapter: 3,
    in: 0.8,
    out: 0.915,
    label: "Simulator",
    title: "Test,\ntest again,\nthen sow.",
    body:
      "Before a seed goes in, the yield simulator runs each candidate crop against your soil, season and climate, then weighs it against live mandi prices and buyer demand nearby — so the choice is made with numbers, not a guess.",
  },
];

/** footer links switch on once the outro card has fully arrived */
export const FOOTER_IN = 0.945;
