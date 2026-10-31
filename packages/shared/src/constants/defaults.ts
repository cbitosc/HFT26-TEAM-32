export const GRADING_VERSION = '2026.1.0';

export const TIER_WEIGHTS = {
  novice: 0.20,
  adept: 0.35,
  master: 0.45
} as const;

export const OVERALL_SCORE_SPLIT = {
  correctnessWeight: 0.80,
  aiEfficiencyWeight: 0.20
} as const;

export const CATEGORY_WEIGHTS_DEFAULT = {
  correctness: 0.60,
  edge: 0.15,
  performance: 0.15,
  security: 0.10
} as const;

export const CATEGORY_WEIGHTS_SECURITY_DOMAIN = {
  correctness: 0.50,
  edge: 0.15,
  performance: 0.10,
  security: 0.25
} as const;

export const AI_EFFICIENCY_WEIGHTS = {
  progressPerHint: 0.35,
  testingRhythm: 0.25,
  independence: 0.15,
  hintDiscipline: 0.10,
  integrityHygiene: 0.10,
  hintEconomy: 0.05
} as const;

export const HINT_LIMITS = {
  novice: 0,
  adept: 8,
  master: 6
} as const;

export const HINT_COOLDOWN_SECONDS = 90;

export const ASSESSMENT_CONFIG = {
  totalDurationMinutes: 60,
  recommendedBudgetsMinutes: {
    novice: 15,
    adept: 20,
    master: 25
  },
  maxTimeBonusPoints: 5,
  minMutationKillRateRequired: 0.70
} as const;

export const INTEGRITY_THRESHOLDS = {
  lowRiskMax: 25,
  mediumRiskMax: 60
} as const;

