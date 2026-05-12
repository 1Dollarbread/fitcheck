import { NextResponse } from "next/server";

import type { FitAnalysisResponse } from "@/lib/analyze-fit-types";
import { generateDemoFitAnalysis } from "@/lib/demo-fit-analysis";
import {
  FIT_OVERALL_MAX,
  FIT_SCORING_RULES,
  NO_OUTFIT_FALLBACK_MESSAGES,
  rulesPromptBlock,
} from "@/lib/fit-scoring-rules";
import { completeVisionJson } from "@/lib/vision-json-chat";

export const maxDuration = 60;

/** Groq base64 image limit is tight; keep uploads small for all providers. */
const MAX_BYTES = 3 * 1024 * 1024;

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

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

function normalizeAnalysis(raw: unknown): FitAnalysisResponse {
  const obj = raw as Record<string, unknown>;
  let clothingDetected = Boolean(obj.clothingDetected);

  const detectedItemsRaw = Array.isArray(obj.detectedItems)
    ? obj.detectedItems
    : [];
  const detectedItems = detectedItemsRaw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        category: typeof r.category === "string" ? r.category : "other",
        label: typeof r.label === "string" ? r.label : "Item",
        colorDescription:
          typeof r.colorDescription === "string"
            ? r.colorDescription
            : "Unknown",
      };
    })
    .filter((d) => d.label.trim() !== "");

  if (clothingDetected && detectedItems.length === 0) {
    clothingDetected = false;
  }

  const ruleScoresIn = Array.isArray(obj.ruleScores) ? obj.ruleScores : [];
  const merged: FitAnalysisResponse["ruleScores"] = FIT_SCORING_RULES.map(
    (rule) => {
      const found = ruleScoresIn.find(
        (x) => (x as { ruleId?: string }).ruleId === rule.id,
      ) as Record<string, unknown> | undefined;
      let score = typeof found?.score === "number" ? found.score : 0;
      score = Math.max(0, Math.min(rule.maxPoints, Math.round(score)));
      const shortFeedback =
        typeof found?.shortFeedback === "string" && found.shortFeedback.trim()
          ? found.shortFeedback.trim().slice(0, 160)
          : "—";
      return {
        ruleId: rule.id,
        score: clothingDetected ? score : 0,
        maxScore: rule.maxPoints,
        shortFeedback: clothingDetected ? shortFeedback : "—",
      };
    },
  );

  const overallScore = clothingDetected
    ? merged.reduce((s, r) => s + r.score, 0)
    : 0;
  const overallMax = FIT_OVERALL_MAX;

  let overallComment =
    typeof obj.overallComment === "string" ? obj.overallComment.trim() : "";
  if (!clothingDetected) {
    overallComment = "";
  }

  let noClothingMessage =
    typeof obj.noClothingMessage === "string"
      ? obj.noClothingMessage.trim().slice(0, 200)
      : "";
  if (!clothingDetected) {
    if (!noClothingMessage) {
      noClothingMessage = pickFallbackNoOutfitMessage();
    }
  } else {
    noClothingMessage = "";
  }

  return {
    clothingDetected,
    noClothingMessage: clothingDetected ? undefined : noClothingMessage,
    detectedItems: clothingDetected ? detectedItems : [],
    ruleScores: clothingDetected ? merged : emptyRuleScores(),
    overallScore,
    overallMax,
    overallComment: clothingDetected
      ? overallComment || "Solid look — keep experimenting with FitCheck."
      : "",
  };
}

function buildSystemPrompt(): string {
  return `You are FitCheck's outfit vision analyst. You must follow instructions exactly and output only valid JSON.

Hard rules:
- Only score actual wearable garments on a person (or a clear mannequin wearing clothes): tops, bottoms, dresses, skirts, shorts, outerwear, shoes, boots, intentional accessories (belt, bag, hat, jewelry).
- Never label pets, furniture, phones, food, walls, floors, vehicles, bare skin alone, trees, or random objects as "shirt", "pants", or shoes.
- If you cannot confidently identify at least one real clothing item worn in the photo, set clothingDetected to false. Do not invent clothes.
- When clothingDetected is false: detectedItems must be [], all rule scores 0, overallComment empty string, and set noClothingMessage to one short witty line (max ~120 chars) poking fun gently — dry humor, not mean.
- When clothingDetected is true: fill detectedItems with 1–6 entries with realistic colors (e.g. "navy twill", "off-white canvas"). For each rule id listed, return score (integer 0..maxPoints) and shortFeedback (max ~20 words).
- Score using the rubric: higher = better match to the rule's "good" description. Be honest; avoid giving near-max scores unless the photo clearly earns it.

Rule rubric (ids and max points — you must include every ruleId exactly once in ruleScores):
${rulesPromptBlock()}`;
}

function buildUserPrompt(): string {
  return `Analyze this image for outfit scoring. overallMax must be ${FIT_OVERALL_MAX}. overallScore must equal the sum of all ruleScores.score values.

Return JSON with this exact shape:
{
  "clothingDetected": boolean,
  "noClothingMessage": string or empty string,
  "detectedItems": [{ "category": string, "label": string, "colorDescription": string }],
  "ruleScores": [{ "ruleId": string, "score": number, "maxScore": number, "shortFeedback": string }],
  "overallComment": string
}

Use only these ruleIds: ${FIT_SCORING_RULES.map((r) => `"${r.id}"`).join(", ")}.
For each ruleScores entry, maxScore must match the rubric max for that id.`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const raw = formData.get("file");
    if (!raw || !(raw instanceof Blob)) {
      return NextResponse.json(
        { error: "Image file is required." },
        { status: 400 },
      );
    }
    if (raw.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (max about 3 MB for vision APIs)." },
        { status: 400 },
      );
    }

    const mime = raw.type || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are allowed." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await raw.arrayBuffer());

    const forceDemo = process.env.FITCHECK_USE_DEMO === "1";
    if (forceDemo) {
      return NextResponse.json(generateDemoFitAnalysis(buffer));
    }

    const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
    const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());

    if (!hasGroq && !hasOpenai) {
      return NextResponse.json(generateDemoFitAnalysis(buffer));
    }

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;

    const system = buildSystemPrompt();
    const userText = buildUserPrompt();

    let text: string;
    try {
      const out = await completeVisionJson({ system, userText, dataUrl });
      text = out.text;
    } catch (err) {
      console.error("Vision provider error:", err);
      const message = err instanceof Error ? err.message : "Vision request failed";
      return NextResponse.json(
        { error: message },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(text));
    } catch {
      return NextResponse.json(
        { error: "Could not parse model response." },
        { status: 502 },
      );
    }

    const normalized = normalizeAnalysis(parsed);
    return NextResponse.json(normalized as FitAnalysisResponse);
  } catch (error) {
    console.error("analyze-fit error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
