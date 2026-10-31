import { AI_EFFICIENCY_WEIGHTS, HINT_LIMITS } from '../constants/defaults.js';
import { AiEfficiencyBreakdown } from '../schemas/report.js';

export interface HintInteractionRecord {
  id: string;
  taskId: string;
  timestamp: number;
  unlockedLevel: number; // 1..4
  testsPassingBefore: number;
  testsPassingAfter5m: number;
  blockedExtraction: boolean;
}

export interface RunRecord {
  id: string;
  taskId: string;
  timestamp: number;
  passedTestsCount: number;
  totalTestsCount: number;
  isAfterEditWithin2m: boolean;
}

export interface EditSnapshotRecord {
  taskId: string;
  timestamp: number;
  diffSize: number;
}

export interface AiEfficiencyCalculationInput {
  taskTiers: ('novice' | 'adept' | 'master')[];
  hintInteractions: HintInteractionRecord[];
  testRuns: RunRecord[];
  editSnapshots: EditSnapshotRecord[];
  totalActiveTimeMinutes: number;
  firstHintTimestampByTask: Record<string, number>;
  taskStartTimestampByTask: Record<string, number>;
}

export function computeAiEfficiencyScore(input: AiEfficiencyCalculationInput): AiEfficiencyBreakdown {
  const {
    hintInteractions,
    testRuns,
    totalActiveTimeMinutes,
    firstHintTimestampByTask,
    taskStartTimestampByTask
  } = input;

  const evidenceRows: string[] = [];

  // Filter interactions for Adept and Master only (Novice has no AI)
  const relevantHints = hintInteractions.filter((h) => h.taskId.includes('adept') || h.taskId.includes('master'));
  const totalBlockedExtractions = hintInteractions.filter((h) => h.blockedExtraction).length;

  // 1. Check Independence Rule (candidate never asked AI)
  if (relevantHints.length === 0) {
    const runsPer10Min = totalActiveTimeMinutes > 0
      ? (testRuns.length / totalActiveTimeMinutes) * 10
      : 0;

    const hasHealthyTesting = runsPer10Min >= 1.0 && runsPer10Min <= 8.0;
    const independenceAiScore = hasHealthyTesting ? 17.0 : 14.0; // 85% of 20 = 17 points

    evidenceRows.push(`Independence Rule Applied: Candidate solved Adept/Master tasks without requesting AI hints.`);
    evidenceRows.push(`Testing cadence: ${runsPer10Min.toFixed(1)} runs per 10 active minutes (${hasHealthyTesting ? 'Healthy cadence confirmed' : 'Sparse/irregular runs'}).`);

    return {
      progressPerHintScore: 85,
      testingRhythmScore: hasHealthyTesting ? 90 : 60,
      independenceScore: 100,
      hintDisciplineScore: 100,
      integrityHygieneScore: totalBlockedExtractions === 0 ? 100 : Math.max(0, 100 - totalBlockedExtractions * 40),
      hintEconomyScore: 100,
      totalAiScore: independenceAiScore,
      appliedIndependenceRule: true,
      evidenceRows
    };
  }

  // 2. Progress-per-Hint (35% weight)
  let totalDeltaTests = 0;
  for (const hint of relevantHints) {
    const delta = Math.max(0, hint.testsPassingAfter5m - hint.testsPassingBefore);
    totalDeltaTests += delta;
    const timeFormatted = new Date(hint.timestamp).toISOString().substring(11, 16);
    evidenceRows.push(`Hint L${hint.unlockedLevel} for [${hint.taskId}] at ${timeFormatted} -> +${delta} tests passing within 5m.`);
  }

  const avgDeltaPerHint = relevantHints.length > 0 ? totalDeltaTests / relevantHints.length : 0;
  // Target benchmark: 1.5 tests improved per hint request
  const progressPerHintRatio = Math.min(1.0, avgDeltaPerHint / 1.5);
  const progressPerHintScore = Math.round(progressPerHintRatio * 100);

  // 3. Testing Frequency & Rhythm (25% weight)
  const activeWindowsOf10Min = Math.max(1, totalActiveTimeMinutes / 10);
  const runsPer10Min = testRuns.length / activeWindowsOf10Min;
  let cadenceScoreRatio = 1.0;
  if (runsPer10Min < 1.0) {
    cadenceScoreRatio = Math.max(0.2, runsPer10Min / 1.0); // Penalize "never runs tests"
  } else if (runsPer10Min > 8.0) {
    cadenceScoreRatio = Math.max(0.3, 1.0 - (runsPer10Min - 8.0) * 0.1); // Penalize "spam running"
  }

  const runsAfterEditCount = testRuns.filter((r) => r.isAfterEditWithin2m).length;
  const testAfterEditRatio = testRuns.length > 0 ? runsAfterEditCount / testRuns.length : 0;
  const rhythmCombined = (cadenceScoreRatio * 0.6) + (Math.min(1.0, testAfterEditRatio * 1.5) * 0.4);
  const testingRhythmScore = Math.round(rhythmCombined * 100);
  evidenceRows.push(`Testing rhythm: ${runsPer10Min.toFixed(1)} runs / 10m. Test-after-edit discipline: ${(testAfterEditRatio * 100).toFixed(0)}%.`);

  // 4. Independence Before Asking (15% weight)
  let independenceAccumulator = 0;
  let evaluatedTasksCount = 0;

  for (const taskId of Object.keys(taskStartTimestampByTask)) {
    if (!taskId.includes('adept') && !taskId.includes('master')) continue;
    evaluatedTasksCount += 1;
    const taskStart = taskStartTimestampByTask[taskId]!;
    const firstHint = firstHintTimestampByTask[taskId];

    if (!firstHint) {
      independenceAccumulator += 1.0; // Never needed hint on this task
    } else {
      const minutesBeforeFirstHint = (firstHint - taskStart) / (1000 * 60);
      const runsBeforeHint = testRuns.filter((r) => r.taskId === taskId && r.timestamp < firstHint).length;
      if (minutesBeforeFirstHint >= 3.0 || runsBeforeHint >= 1) {
        independenceAccumulator += 1.0;
      } else {
        independenceAccumulator += Math.max(0.2, minutesBeforeFirstHint / 3.0);
      }
    }
  }
  const independenceRatio = evaluatedTasksCount > 0 ? independenceAccumulator / evaluatedTasksCount : 1.0;
  const independenceScore = Math.round(independenceRatio * 100);

  // 5. Hint Level Discipline (10% weight)
  // Penalize skipping directly to Level 4 without trying L1-L3 first
  let disciplineViolations = 0;
  const highestLevelSeenByTask: Record<string, number> = {};

  for (const hint of relevantHints) {
    const curHighest = highestLevelSeenByTask[hint.taskId] || 0;
    if (hint.unlockedLevel > curHighest + 1) {
      disciplineViolations += (hint.unlockedLevel - (curHighest + 1));
    }
    if (hint.unlockedLevel > curHighest) {
      highestLevelSeenByTask[hint.taskId] = hint.unlockedLevel;
    }
  }
  const hintDisciplineRatio = Math.max(0, 1.0 - disciplineViolations * 0.25);
  const hintDisciplineScore = Math.round(hintDisciplineRatio * 100);

  // 6. Integrity Hygiene (10% weight)
  // Deduct heavily for prompt injection / jailbreak / system prompt leak attempts
  let integrityHygieneScore = 100;
  if (totalBlockedExtractions > 0) {
    integrityHygieneScore = Math.max(0, 100 - totalBlockedExtractions * 40);
    evidenceRows.push(`ALERT: ${totalBlockedExtractions} prompt injection / jailbreak extraction attempt(s) intercepted by firewall.`);
  }

  // 7. Hint Economy (5% weight)
  const maxAllowedBudget = HINT_LIMITS.adept + HINT_LIMITS.master;
  const usedRatio = relevantHints.length / maxAllowedBudget;
  const hintEconomyRatio = Math.max(0, 1.0 - Math.max(0, usedRatio - 0.75) * 2);
  const hintEconomyScore = Math.round(hintEconomyRatio * 100);

  // Weighted composition into 0..20 scale
  const compositePercentage =
    progressPerHintScore * AI_EFFICIENCY_WEIGHTS.progressPerHint +
    testingRhythmScore * AI_EFFICIENCY_WEIGHTS.testingRhythm +
    independenceScore * AI_EFFICIENCY_WEIGHTS.independence +
    hintDisciplineScore * AI_EFFICIENCY_WEIGHTS.hintDiscipline +
    integrityHygieneScore * AI_EFFICIENCY_WEIGHTS.integrityHygiene +
    hintEconomyScore * AI_EFFICIENCY_WEIGHTS.hintEconomy;

  const totalAiScore = Math.max(0, Math.min(20, Math.round((compositePercentage / 100) * 20 * 100) / 100));

  return {
    progressPerHintScore,
    testingRhythmScore,
    independenceScore,
    hintDisciplineScore,
    integrityHygieneScore,
    hintEconomyScore,
    totalAiScore,
    appliedIndependenceRule: false,
    evidenceRows
  };
}

