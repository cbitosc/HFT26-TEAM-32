import { describe, it, expect } from 'vitest';
import { computeAiEfficiencyScore } from '../src/scoring/ai-efficiency.js';

describe('Deterministic AI Efficiency Scoring Engine', () => {
  it('applies the Independence Rule if the candidate never asked for AI on Adept/Master', () => {
    const res = computeAiEfficiencyScore({
      taskTiers: ['novice', 'adept', 'master'],
      hintInteractions: [],
      testRuns: [
        { id: 'r1', taskId: 'task_adept', timestamp: 1000, passedTestsCount: 2, totalTestsCount: 5, isAfterEditWithin2m: true },
        { id: 'r2', taskId: 'task_adept', timestamp: 50000, passedTestsCount: 5, totalTestsCount: 5, isAfterEditWithin2m: true },
        { id: 'r3', taskId: 'task_master', timestamp: 100000, passedTestsCount: 4, totalTestsCount: 6, isAfterEditWithin2m: true }
      ],
      editSnapshots: [],
      totalActiveTimeMinutes: 15,
      firstHintTimestampByTask: {},
      taskStartTimestampByTask: { task_adept: 0, task_master: 60000 }
    });

    expect(res.appliedIndependenceRule).toBe(true);
    expect(res.totalAiScore).toBe(17.0); // 85% of 20 points
    expect(res.evidenceRows[0]).toContain('Independence Rule Applied');
  });

  it('rewards progress per hint when tests increase after hint unlock', () => {
    const res = computeAiEfficiencyScore({
      taskTiers: ['novice', 'adept', 'master'],
      hintInteractions: [
        {
          id: 'h1',
          taskId: 'task_adept',
          timestamp: 10000,
          unlockedLevel: 1,
          testsPassingBefore: 1,
          testsPassingAfter5m: 3, // +2 tests passing!
          blockedExtraction: false
        }
      ],
      testRuns: [
        { id: 'r1', taskId: 'task_adept', timestamp: 5000, passedTestsCount: 1, totalTestsCount: 4, isAfterEditWithin2m: true },
        { id: 'r2', taskId: 'task_adept', timestamp: 15000, passedTestsCount: 3, totalTestsCount: 4, isAfterEditWithin2m: true }
      ],
      editSnapshots: [],
      totalActiveTimeMinutes: 20,
      firstHintTimestampByTask: { task_adept: 10000 },
      taskStartTimestampByTask: { task_adept: 0 }
    });

    expect(res.progressPerHintScore).toBe(100);
    expect(res.totalAiScore).toBeGreaterThan(15.0);
    expect(res.evidenceRows.some((row) => row.includes('+2 tests passing'))).toBe(true);
  });

  it('penalizes candidates heavily for prompt extraction / jailbreak attempts', () => {
    const res = computeAiEfficiencyScore({
      taskTiers: ['novice', 'adept', 'master'],
      hintInteractions: [
        {
          id: 'h1',
          taskId: 'task_master',
          timestamp: 10000,
          unlockedLevel: 1,
          testsPassingBefore: 1,
          testsPassingAfter5m: 1,
          blockedExtraction: true // Extraction attempt!
        }
      ],
      testRuns: [],
      editSnapshots: [],
      totalActiveTimeMinutes: 30,
      firstHintTimestampByTask: { task_master: 10000 },
      taskStartTimestampByTask: { task_master: 0 }
    });

    expect(res.integrityHygieneScore).toBeLessThan(70);
    expect(res.evidenceRows.some((row) => row.includes('ALERT: 1 prompt injection'))).toBe(true);
  });
});

