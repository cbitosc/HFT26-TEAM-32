import { describe, it, expect } from 'vitest';
import { ALL_BANK_TASKS, findBankTasks } from '../src/index.js';
import { TaskSpecSchema } from '@proctor-forge/shared';

describe('Pre-Authored Task Bank Structure & Coverage', () => {
  it('contains exactly 24 validated tasks (4 domains x 3 tiers x 2 variants)', () => {
    expect(ALL_BANK_TASKS.length).toBe(24);
  });

  it('provides exactly 2 variants for every domain and tier combination', () => {
    const domains = ['web', 'backend', 'ml', 'security'];
    const tiers = ['novice', 'adept', 'master'];

    for (const d of domains) {
      for (const t of tiers) {
        const matching = findBankTasks(d, t);
        expect(matching.length, `Expected 2 tasks for ${d} - ${t}`).toBe(2);
      }
    }
  });

  it('validates that every task strictly adheres to TaskSpecSchema', () => {
    for (const task of ALL_BANK_TASKS) {
      const parsed = TaskSpecSchema.safeParse(task);
      expect(parsed.success, `Task [${task.id}] schema validation error: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('guarantees every task has complete 4-level hint ladders', () => {
    for (const task of ALL_BANK_TASKS) {
      expect(task.hintLadder.level1.length).toBeGreaterThan(15);
      expect(task.hintLadder.level2.length).toBeGreaterThan(15);
      expect(task.hintLadder.level3.length).toBeGreaterThan(15);
      expect(task.hintLadder.level4.length).toBeGreaterThan(15);
    }
  });
});

