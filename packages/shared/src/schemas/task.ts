import { z } from 'zod';
import { DSA_TOPICS, SUPPORTED_DOMAINS } from './portfolio.js';

export const TASK_TIERS = ['novice', 'adept', 'master'] as const;
export type TaskTier = (typeof TASK_TIERS)[number];

export const SUPPORTED_LANGUAGES = ['python', 'typescript', 'javascript', 'java'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const TEST_CATEGORIES = ['correctness', 'edge', 'performance', 'security'] as const;
export type TestCategory = (typeof TEST_CATEGORIES)[number];

export const TaskFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  editable: z.boolean().default(true)
});
export type TaskFile = z.infer<typeof TaskFileSchema>;

export const TestSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
  category: z.enum(TEST_CATEGORIES),
  description: z.string().optional()
});
export type TestSpec = z.infer<typeof TestSpecSchema>;

export const ComplexityProbeSchema = z.object({
  inputSizes: z.array(z.number().positive()).min(2),
  maxGrowthRatio: z.number().positive().default(2.5) // E.g. O(N) or O(N log N) acceptable ratio for doubling N
});
export type ComplexityProbe = z.infer<typeof ComplexityProbeSchema>;

export const PerformanceBudgetSchema = z.object({
  maxRuntimeMs: z.number().positive(),
  maxOpsCount: z.number().positive().optional(),
  complexityProbe: ComplexityProbeSchema.optional()
});
export type PerformanceBudget = z.infer<typeof PerformanceBudgetSchema>;

export const SecurityCheckSchema = z.object({
  payloadCorpus: z.array(z.string()).optional(),
  forbiddenAstPatterns: z.array(z.string()).optional(),
  requiredDefensivePatterns: z.array(z.string()).optional()
});
export type SecurityCheck = z.infer<typeof SecurityCheckSchema>;

export const HintLadderSchema = z.object({
  level1: z.string().min(10, 'Level 1 must provide conceptual guidance'),
  level2: z.string().min(10, 'Level 2 must provide approach direction'),
  level3: z.string().min(10, 'Level 3 must pinpoint bug area'),
  level4: z.string().min(10, 'Level 4 must provide structural pseudo-outline without code')
});
export type HintLadder = z.infer<typeof HintLadderSchema>;

export const TaskSpecSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(TASK_TIERS),
  domain: z.enum(SUPPORTED_DOMAINS),
  language: z.enum(SUPPORTED_LANGUAGES),
  framework: z.string().default('vanilla'),
  dsaTopics: z.array(z.enum(DSA_TOPICS)).min(1),
  title: z.string().min(3),
  scenario: z.string().min(10),
  problemStatement: z.string().min(20),
  constraints: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  files: z.array(TaskFileSchema).min(1),
  referenceSolution: z.array(TaskFileSchema).min(1),
  tests: z.object({
    visible: z.array(TestSpecSchema).min(1),
    hidden: z.array(TestSpecSchema).min(1)
  }),
  testFiles: z.array(TaskFileSchema).min(1),
  performanceBudget: PerformanceBudgetSchema.optional(),
  securityChecks: SecurityCheckSchema.optional(),
  hintLadder: HintLadderSchema,
  seed: z.number().default(42)
});
export type TaskSpec = z.infer<typeof TaskSpecSchema>;

// Candidate-visible slice of TaskSpec (referenceSolution and hidden tests are stripped)
export interface CandidateVisibleTask {
  id: string;
  tier: TaskTier;
  domain: (typeof SUPPORTED_DOMAINS)[number];
  language: SupportedLanguage;
  framework: string;
  dsaTopics: string[];
  title: string;
  scenario: string;
  problemStatement: string;
  constraints: string[];
  acceptanceCriteria: string[];
  files: TaskFile[];
  visibleTests: TestSpec[];
  hintAvailability: {
    canUseAi: boolean;
    currentUnlockedLevel: number;
    maxLevel: number;
    cooldownSecondsRemaining: number;
  };
}

export const ValidationReportSchema = z.object({
  taskId: z.string(),
  passed: z.boolean(),
  checks: z.object({
    schemaLint: z.boolean(),
    compiles: z.boolean(),
    referencePassesAll: z.boolean(),
    starterFailsTarget: z.boolean(),
    mutationKillRate: z.number().min(0).max(1),
    alternativePasses: z.boolean(),
    commonWrongFails: z.boolean(),
    dsaTopicConformance: z.boolean(),
    antiLeakCheck: z.boolean(),
    timingSanity: z.boolean()
  }),
  details: z.array(z.string()),
  mutationSummary: z.object({
    totalMutants: z.number(),
    killedMutants: z.number(),
    killRate: z.number()
  }).optional()
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

