import { describe, it, expect } from 'vitest';
import { computeTaskGrade, computeOverallAssessmentGrade } from '../src/scoring/grading-engine.js';
import { TestResultItem } from '../src/schemas/runner.js';

describe('Deterministic Grading Engine', () => {
  it('correctly calculates partial credit and category weights for a task', () => {
    const testResults: TestResultItem[] = [
      { id: 't1', name: 'visible test 1', passed: true, durationMs: 15, category: 'correctness', weight: 1 },
      { id: 't2', name: 'visible test 2', passed: false, durationMs: 20, category: 'correctness', weight: 1 },
      { id: 't3', name: 'edge test 1', passed: false, durationMs: 10, category: 'edge', weight: 1 },
      { id: 't4', name: 'perf test 1', passed: true, durationMs: 45, category: 'performance', weight: 2 }
    ];

    const grade = computeTaskGrade({
      tier: 'adept',
      domain: 'web',
      testResults,
      elapsedSeconds: 600,
      allocatedBudgetSeconds: 1200
    });

    expect(grade.taskCorrectnessScore).toBeGreaterThan(40);
    expect(grade.allTestsPassed).toBe(false);
    expect(grade.categoryBreakdown.correctness.passed).toBe(1);
    expect(grade.categoryBreakdown.edge.passed).toBe(0);
    expect(grade.categoryBreakdown.performance.passed).toBe(1);
    expect(grade.timeBonusPoints).toBe(0); // Under 80% correctness threshold
  });

  it('awards time bonus when correctness >= 80% and completed under budget', () => {
    const testResults: TestResultItem[] = [
      { id: 't1', name: 'test 1', passed: true, durationMs: 10, category: 'correctness', weight: 1 },
      { id: 't2', name: 'test 2', passed: true, durationMs: 10, category: 'correctness', weight: 1 },
      { id: 't3', name: 'test 3', passed: true, durationMs: 10, category: 'edge', weight: 1 },
      { id: 't4', name: 'test 4', passed: true, durationMs: 10, category: 'performance', weight: 1 }
    ];

    const grade = computeTaskGrade({
      tier: 'novice',
      domain: 'backend',
      testResults,
      elapsedSeconds: 300,
      allocatedBudgetSeconds: 900 // 600s saved (66.6% saved)
    });

    expect(grade.taskCorrectnessScore).toBe(100);
    expect(grade.allTestsPassed).toBe(true);
    expect(grade.timeBonusPoints).toBeGreaterThan(3.0);
    expect(grade.timeBonusPoints).toBeLessThanOrEqual(5.0);
  });

  it('computes 80/20 overall score deterministically (Golden Test)', () => {
    const noviceGrade = computeTaskGrade({
      tier: 'novice',
      domain: 'web',
      testResults: [{ id: '1', name: 't1', passed: true, durationMs: 5, category: 'correctness', weight: 1 }],
      elapsedSeconds: 500,
      allocatedBudgetSeconds: 900
    });

    const adeptGrade = computeTaskGrade({
      tier: 'adept',
      domain: 'web',
      testResults: [
        { id: '1', name: 't1', passed: true, durationMs: 5, category: 'correctness', weight: 1 },
        { id: '2', name: 't2', passed: true, durationMs: 5, category: 'edge', weight: 1 }
      ],
      elapsedSeconds: 800,
      allocatedBudgetSeconds: 1200
    });

    const masterGrade = computeTaskGrade({
      tier: 'master',
      domain: 'web',
      testResults: [
        { id: '1', name: 't1', passed: true, durationMs: 5, category: 'correctness', weight: 1 },
        { id: '2', name: 't2', passed: false, durationMs: 5, category: 'performance', weight: 1 }
      ],
      elapsedSeconds: 1400,
      allocatedBudgetSeconds: 1500
    });

    const aiEfficiencyScore = 18.5; // Out of 20

    const overall = computeOverallAssessmentGrade({
      noviceGrade,
      adeptGrade,
      masterGrade,
      aiEfficiencyScore
    });

    // Novice: 100 * 0.20 = 20
    // Adept: 100 * 0.35 = 35
    // Master: ~50 * 0.45 = 22.5
    // Total weighted correctness ~ 77.5
    // Correctness portion (80% max) = 77.5 * 0.8 = 62
    // AI portion = 18.5
    // Final score = ~80.5 + time bonus
    expect(overall.scoreComposition.correctnessPortion).toBeGreaterThan(55);
    expect(overall.scoreComposition.aiEfficiencyPortion).toBe(18.5);
    expect(overall.finalScore).toBeGreaterThanOrEqual(70);
    expect(overall.outcomeBand).toBe('Strong Hire');
  });
});

