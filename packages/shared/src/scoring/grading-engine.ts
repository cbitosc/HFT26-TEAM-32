import {
  GRADING_VERSION,
  TIER_WEIGHTS,
  OVERALL_SCORE_SPLIT,
  CATEGORY_WEIGHTS_DEFAULT,
  CATEGORY_WEIGHTS_SECURITY_DOMAIN,
  ASSESSMENT_CONFIG
} from '../constants/defaults.js';
import { TaskTier, TestCategory } from '../schemas/task.js';
import { TestResultItem } from '../schemas/runner.js';

export interface RawTaskGradeInput {
  tier: TaskTier;
  domain: string;
  testResults: TestResultItem[];
  elapsedSeconds: number;
  allocatedBudgetSeconds: number;
}

export interface TaskGradeOutput {
  tier: TaskTier;
  taskCorrectnessScore: number; // 0..100
  timeBonusPoints: number;      // 0..5
  totalTaskScore: number;       // 0..105 (before tier weighting)
  categoryBreakdown: Record<string, {
    passed: number;
    total: number;
    weightEarned: number;
    weightPossible: number;
  }>;
  allTestsPassed: boolean;
  totalWeightEarned: number;
  totalWeightPossible: number;
}

export function computeTaskGrade(input: RawTaskGradeInput): TaskGradeOutput {
  const { tier, domain, testResults, elapsedSeconds, allocatedBudgetSeconds } = input;

  if (!testResults || testResults.length === 0) {
    return {
      tier,
      taskCorrectnessScore: 0,
      timeBonusPoints: 0,
      totalTaskScore: 0,
      categoryBreakdown: {},
      allTestsPassed: false,
      totalWeightEarned: 0,
      totalWeightPossible: 0
    };
  }

  const isSecurity = domain.toLowerCase() === 'security';
  const categoryMultipliers: Record<TestCategory, number> = isSecurity
    ? CATEGORY_WEIGHTS_SECURITY_DOMAIN
    : CATEGORY_WEIGHTS_DEFAULT;

  const categoryStats: Record<string, {
    passedCount: number;
    totalCount: number;
    earnedWeighted: number;
    totalWeighted: number;
  }> = {};

  for (const test of testResults) {
    const cat = test.category;
    if (!categoryStats[cat]) {
      categoryStats[cat] = { passedCount: 0, totalCount: 0, earnedWeighted: 0, totalWeighted: 0 };
    }
    const weight = test.weight || 1;
    categoryStats[cat]!.totalCount += 1;
    categoryStats[cat]!.totalWeighted += weight;
    if (test.passed) {
      categoryStats[cat]!.passedCount += 1;
      categoryStats[cat]!.earnedWeighted += weight;
    }
  }

  // Calculate normalized category scores according to predefined distribution
  let totalNormalizedScore = 0;
  let activeWeightSum = 0;

  for (const [cat, stats] of Object.entries(categoryStats)) {
    const catMultiplier = categoryMultipliers[cat as TestCategory] ?? 0.25;
    activeWeightSum += catMultiplier;
    if (stats.totalWeighted > 0) {
      const catRatio = stats.earnedWeighted / stats.totalWeighted;
      totalNormalizedScore += catRatio * catMultiplier;
    }
  }

  const rawCorrectnessScore = activeWeightSum > 0
    ? (totalNormalizedScore / activeWeightSum) * 100
    : 0;

  const boundedCorrectnessScore = Math.max(0, Math.min(100, Math.round(rawCorrectnessScore * 100) / 100));

  // Time bonus is only unlocked if at least 80% tests are passed and finished faster than budget
  let timeBonusPoints = 0;
  if (boundedCorrectnessScore >= 80 && elapsedSeconds < allocatedBudgetSeconds) {
    const timeSavedRatio = (allocatedBudgetSeconds - elapsedSeconds) / allocatedBudgetSeconds;
    timeBonusPoints = Math.round(timeSavedRatio * ASSESSMENT_CONFIG.maxTimeBonusPoints * 100) / 100;
    timeBonusPoints = Math.max(0, Math.min(ASSESSMENT_CONFIG.maxTimeBonusPoints, timeBonusPoints));
  }

  const breakdown: Record<string, { passed: number; total: number; weightEarned: number; weightPossible: number }> = {};
  for (const [cat, stats] of Object.entries(categoryStats)) {
    breakdown[cat] = {
      passed: stats.passedCount,
      total: stats.totalCount,
      weightEarned: Math.round(stats.earnedWeighted * 100) / 100,
      weightPossible: Math.round(stats.totalWeighted * 100) / 100
    };
  }

  const allPassed = testResults.every((t) => t.passed);
  const totalWeightEarned = testResults.filter((t) => t.passed).reduce((acc, t) => acc + (t.weight || 1), 0);
  const totalWeightPossible = testResults.reduce((acc, t) => acc + (t.weight || 1), 0);

  return {
    tier,
    taskCorrectnessScore: boundedCorrectnessScore,
    timeBonusPoints,
    totalTaskScore: Math.min(100, boundedCorrectnessScore + timeBonusPoints),
    categoryBreakdown: breakdown,
    allTestsPassed: allPassed,
    totalWeightEarned,
    totalWeightPossible
  };
}

export interface OverallAssessmentGradeInput {
  noviceGrade: TaskGradeOutput;
  adeptGrade: TaskGradeOutput;
  masterGrade: TaskGradeOutput;
  aiEfficiencyScore: number; // 0..20
}

export interface OverallAssessmentGradeOutput {
  gradingVersion: string;
  finalScore: number; // 0..100
  tierScores: {
    novice: number;
    adept: number;
    master: number;
  };
  scoreComposition: {
    correctnessPortion: number; // 0..80
    aiEfficiencyPortion: number; // 0..20
    timeBonusPortion: number;    // 0..5
  };
  outcomeBand: 'Strong Hire' | 'Hire' | 'Borderline' | 'Not yet';
}

export function computeOverallAssessmentGrade(input: OverallAssessmentGradeInput): OverallAssessmentGradeOutput {
  const { noviceGrade, adeptGrade, masterGrade, aiEfficiencyScore } = input;

  const weightedCorrectness =
    noviceGrade.taskCorrectnessScore * TIER_WEIGHTS.novice +
    adeptGrade.taskCorrectnessScore * TIER_WEIGHTS.adept +
    masterGrade.taskCorrectnessScore * TIER_WEIGHTS.master;

  // Correctness portion contributes up to 80 points
  const correctnessPortion = Math.round((weightedCorrectness / 100) * OVERALL_SCORE_SPLIT.correctnessWeight * 100 * 100) / 100;

  // Bounded AI efficiency portion up to 20 points
  const aiEfficiencyPortion = Math.max(0, Math.min(20, Math.round(aiEfficiencyScore * 100) / 100));

  // Time bonus: weighted combination capped at 5 points
  const totalTimeBonus = Math.min(5, Math.round((
    noviceGrade.timeBonusPoints * TIER_WEIGHTS.novice +
    adeptGrade.timeBonusPoints * TIER_WEIGHTS.adept +
    masterGrade.timeBonusPoints * TIER_WEIGHTS.master
  ) * 100) / 100);

  const rawFinalScore = correctnessPortion + aiEfficiencyPortion + totalTimeBonus;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawFinalScore * 100) / 100));

  let outcomeBand: 'Strong Hire' | 'Hire' | 'Borderline' | 'Not yet';
  if (finalScore >= 85) {
    outcomeBand = 'Strong Hire';
  } else if (finalScore >= 70) {
    outcomeBand = 'Hire';
  } else if (finalScore >= 50) {
    outcomeBand = 'Borderline';
  } else {
    outcomeBand = 'Not yet';
  }

  return {
    gradingVersion: GRADING_VERSION,
    finalScore,
    tierScores: {
      novice: noviceGrade.totalTaskScore,
      adept: adeptGrade.totalTaskScore,
      master: masterGrade.totalTaskScore
    },
    scoreComposition: {
      correctnessPortion,
      aiEfficiencyPortion,
      timeBonusPortion: totalTimeBonus
    },
    outcomeBand
  };
}

