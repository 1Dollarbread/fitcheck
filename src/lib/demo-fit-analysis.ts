import { createHash } from "crypto";

import type { FitAnalysisResponse } from "@/lib/analyze-fit-types";
import {
  FIT_OVERALL_MAX,
  FIT_SCORING_RULES,
  NO_OUTFIT_FALLBACK_MESSAGES,
} from "@/lib/fit-scoring-rules";

function pickFallbackNoOutfitMessage(): string {
  const i = Math.floor(Math.random() * NO_OUTFIT_FALLBACK_MESSAGES.length);
  return NO_OUTFIT_FALLBACK_MESSAGES[i] ?? "Try again with a real outfit in frame.";
}

function emptyRuleScores(): FitAnalysisResponse["ruleScores"] {
  return FIT_SCORING_RULES.map((r) => ({
    ruleId: r.id,
    score: 0,
    maxScore: r.maxPoints,
    shortFeedback: "—",
  }));
}

/** Deterministic PRNG from 32-bit seed */
function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_PALETTE = [
  "washed navy",
  "warm oatmeal",
  "charcoal melange",
  "off-white",
  "muted olive",
  "soft terracotta",
  "slate gray",
  "cream canvas",
];

/**
 * Offline / zero-API “scan” so the app works without any cloud AI key.
 * Deterministic from image bytes; clearly marked demoMode on the response.
 */
export function generateDemoFitAnalysis(imageBuffer: Buffer): FitAnalysisResponse {
  const digest = createHash("sha256").update(imageBuffer).digest();
  const seed =
    digest.readUInt32BE(0) ^
    digest.readUInt32BE(4) ^
    digest.readUInt32BE(8);
  const rnd = mulberry32(seed >>> 0);

  const clothingDetected = rnd() > 0.24;

  if (!clothingDetected) {
    return {
      clothingDetected: false,
      noClothingMessage: pickFallbackNoOutfitMessage(),
      detectedItems: [],
      ruleScores: emptyRuleScores(),
      overallScore: 0,
      overallMax: FIT_OVERALL_MAX,
      overallComment: "",
      demoMode: true,
    };
  }

  const pickColor = () =>
    DEMO_PALETTE[Math.floor(rnd() * DEMO_PALETTE.length)] ?? "neutral";

  const detectedItems = [
    {
      category: "shirt",
      label: "Top",
      colorDescription: pickColor(),
    },
    {
      category: "pants",
      label: "Bottom",
      colorDescription: pickColor(),
    },
  ];
  if (rnd() > 0.12) {
    detectedItems.push({
      category: "shoes",
      label: "Footwear",
      colorDescription: pickColor(),
    });
  }
  if (rnd() > 0.55) {
    detectedItems.push({
      category: "accessory",
      label: "Accessory",
      colorDescription: pickColor(),
    });
  }

  const ruleScores = FIT_SCORING_RULES.map((rule) => {
    const span = rule.maxPoints + 1;
    const raw = Math.floor(rnd() * span * 0.85) + Math.floor(rnd() * 3);
    const score = Math.max(0, Math.min(rule.maxPoints, raw));
    return {
      ruleId: rule.id,
      score,
      maxScore: rule.maxPoints,
      shortFeedback:
        "Demo estimate — add a Groq or OpenAI key for real vision feedback.",
    };
  });

  const overallScore = ruleScores.reduce((s, r) => s + r.score, 0);

  return {
    clothingDetected: true,
    detectedItems,
    ruleScores,
    overallScore,
    overallMax: FIT_OVERALL_MAX,
    overallComment:
      "Demo mode: this score is simulated from your file (no camera AI ran). Add GROQ_API_KEY for a free real scan in most regions.",
    demoMode: true,
  };
}
