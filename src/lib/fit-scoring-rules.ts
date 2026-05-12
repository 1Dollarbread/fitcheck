/**
 * Scoring rules for FitCheck vision analysis.
 * The model must score each rule within 0..maxPoints and only count real worn garments.
 */
export type FitScoringRule = {
  id: string;
  label: string;
  maxPoints: number;
  /** Shown to the model — what “good” vs “weak” means for this dimension */
  guidance: string;
};

export const FIT_SCORING_RULES: FitScoringRule[] = [
  {
    id: "color_harmony",
    label: "Color harmony",
    maxPoints: 12,
    guidance:
      "Good: colors across visible clothing feel coordinated (neutrals, analogous, complementary, or intentional streetwear contrast). Weak: random unrelated hues with no focal palette.",
  },
  {
    id: "silhouette_balance",
    label: "Silhouette balance",
    maxPoints: 12,
    guidance:
      "Good: top/bottom volumes look intentional (e.g. slim + relaxed is styled, not accidental). Weak: proportions that fight each other with no clear intent.",
  },
  {
    id: "layering_cohesion",
    label: "Layering cohesion",
    maxPoints: 10,
    guidance:
      "Good: if multiple layers exist, they stack cleanly and read as one outfit. Weak: bulky chaos or layers that clash in weight/length.",
  },
  {
    id: "footwear_fit",
    label: "Footwear fit",
    maxPoints: 10,
    guidance:
      "Good: shoes match the outfit’s vibe and color story (casual vs dressy is consistent). Weak: footwear feels like an afterthought or wrong formality.",
  },
  {
    id: "accessory_discipline",
    label: "Accessory discipline",
    maxPoints: 8,
    guidance:
      "Good: accessories (bag, belt, hat, jewelry) add clarity without noise. Weak: clutter, or non-accessory objects mistaken as style pieces.",
  },
  {
    id: "contrast_readability",
    label: "Outfit readability",
    maxPoints: 10,
    guidance:
      "Good: the outfit reads clearly at a glance; figure separates from background enough to judge clothing. Weak: muddy contrast or unreadable layers.",
  },
  {
    id: "occasion_coherence",
    label: "Occasion coherence",
    maxPoints: 10,
    guidance:
      "Good: pieces feel like one occasion (sporty, casual, smart-casual, etc.). Weak: jarring mix (e.g. gym shorts with formal blazer) unless clearly fashion-forward.",
  },
  {
    id: "polish_finish",
    label: "Polish & finish",
    maxPoints: 8,
    guidance:
      "Good: intentional tuck/drape, clean lines, looks considered. Weak: sloppy defaults that look accidental rather than aesthetic.",
  },
];

export const FIT_OVERALL_MAX = FIT_SCORING_RULES.reduce(
  (sum, r) => sum + r.maxPoints,
  0,
);

export function rulesPromptBlock(): string {
  return FIT_SCORING_RULES.map(
    (r) =>
      `- id "${r.id}" (${r.label}, max ${r.maxPoints}): ${r.guidance}`,
  ).join("\n");
}

export const NO_OUTFIT_FALLBACK_MESSAGES = [
  "The closet sent a search party. It came back empty-handed.",
  "That’s a bold fit — if the fit was “invisible man chic.” Try again with actual clothes in frame.",
  "We ran the pixels through Fashion NASA. It found sky, floor, vibes… but no shirt.",
  "Schrodinger’s outfit: simultaneously fire and not there. Spoiler: not there won.",
  "Nice scenery. The shirt called — it’s still in the drawer.",
  "Zero drip detected. The shoes are in witness protection.",
  "This photo slays… the dress code, by not showing one.",
];
