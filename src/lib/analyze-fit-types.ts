export type DetectedGarment = {
  category: string;
  label: string;
  colorDescription: string;
};

export type RuleScoreRow = {
  ruleId: string;
  score: number;
  maxScore: number;
  shortFeedback: string;
};

export type FitAnalysisResponse = {
  clothingDetected: boolean;
  noClothingMessage?: string;
  detectedItems: DetectedGarment[];
  ruleScores: RuleScoreRow[];
  overallScore: number;
  overallMax: number;
  overallComment: string;
  /** True when no cloud AI key was used and results are simulated. */
  demoMode?: boolean;
};
