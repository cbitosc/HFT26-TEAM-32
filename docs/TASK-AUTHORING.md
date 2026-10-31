# PROCTOR-FORGE: Task Authoring Guide

This guide describes how to author new tasks for the pre-validated Task Bank (`packages/task-bank`).

## Task Specification Structure

Each task is defined as a TypeScript object satisfying `TaskSpec`:

```typescript
export interface TaskSpec {
  id: string;                      // E.g. 'web_adept_a'
  tier: 'novice' | 'adept' | 'master';
  domain: 'web' | 'backend' | 'ml' | 'security';
  language: 'python' | 'javascript' | 'typescript' | 'java';
  framework: string;               // E.g. 'react', 'fastapi', 'flask'
  dsaTopics: string[];             // Strictly bounded to allowed DSA topic list
  title: string;
  scenario: string;                // Contextual scenario
  problemStatement: string;        // Markdown instructions
  constraints: string[];
  acceptanceCriteria: string[];
  files: TaskFile[];               // Starter files (with bug or omission)
  referenceSolution: TaskFile[];   // Working solution passing 100% of tests
  tests: {
    visible: TestSpec[];           // Visible to candidate
    hidden: TestSpec[];            // Evaluated server-side on submit
  };
  testFiles: TaskFile[];           // Unit test files
  hintLadder: HintLadder;          // 4-level hint progression
  performanceBudget?: PerformanceBudget;
  securityChecks?: SecurityCheck;
  seed: number;
}
```

## Validation Gate Checklist

Before a task is released to the Task Bank, run:
```bash
pnpm validate-bank
```

A task passes validation only if:
1. **Reference Solution:** Passes 100% of visible + hidden tests across 3 consecutive runs.
2. **Starter Code:** Fails designated target tests (must not trivially fail all baseline tests).
3. **Mutation Testing:** Test suite kills $\ge 70\%$ of programmatically generated mutants.
4. **Anti-Leak Check:** No 5-word shingles from the reference solution appear in the problem statement.
5. **DSA Conformance:** Declared DSA topics match the algorithmic mechanism in the reference solution.

