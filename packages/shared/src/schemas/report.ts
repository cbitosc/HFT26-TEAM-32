import { z } from 'zod';
import { TASK_TIERS } from './task.js';
import { IntegrityRiskIndexSchema } from './telemetry.js';

export const OUTCOME_BANDS = ['Strong Hire', 'Hire', 'Borderline', 'Not yet'] as const;
export type OutcomeBand = (typeof OUTCOME_BANDS)[number];

export const TaskReportItemSchema = z.object({
  taskId: z.string(),
  tier: z.enum(TASK_TIERS),
  title: z.string(),
  domain: z.string(),
  dsaTopics: z.array(z.string()),
  timeTakenSeconds: z.number(),
  budgetSeconds: z.number(),
  visibleTestsPassed: z.number(),
  totalVisibleTests: z.number(),
  hiddenTestsPassed: z.number(),
  totalHiddenTests: z.number(),
  categoryBreakdown: z.record(z.string(), z.object({
    passed: z.number(),
    total: z.number(),
    weightEarned: z.number()
  })),
  passRatePercent: z.number().min(0).max(100),
  runsCount: z.number(),
  hintsUsedCount: z.number(),
  hintsUsedLevels: z.array(z.number()),
  taskCorrectnessScore: z.number().min(0).max(100),
  timeBonusPoints: z.number().min(0).max(5),
  finalTaskScore: z.number().min(0).max(100),
  validationSummary: z.object({
    referencePassRate: z.number(),
    starterFailRate: z.number(),
    mutationKillRate: z.number()
  })
});
export type TaskReportItem = z.infer<typeof TaskReportItemSchema>;

export const AiEfficiencyBreakdownSchema = z.object({
  progressPerHintScore: z.number().min(0).max(100),
  testingRhythmScore: z.number().min(0).max(100),
  independenceScore: z.number().min(0).max(100),
  hintDisciplineScore: z.number().min(0).max(100),
  integrityHygieneScore: z.number().min(0).max(100),
  hintEconomyScore: z.number().min(0).max(100),
  totalAiScore: z.number().min(0).max(20),
  appliedIndependenceRule: z.boolean(),
  evidenceRows: z.array(z.string())
});
export type AiEfficiencyBreakdown = z.infer<typeof AiEfficiencyBreakdownSchema>;

export const ClaimVerificationItemSchema = z.object({
  claimType: z.enum(['skill', 'project', 'dsaTopic']),
  name: z.string(),
  claimedLevel: z.string(),
  demonstratedStatus: z.enum(['Verified', 'Partially Verified', 'Not Demonstrated']),
  evidence: z.string(),
  confidence: z.number().min(0).max(1)
});
export type ClaimVerificationItem = z.infer<typeof ClaimVerificationItemSchema>;

export const PortfolioProbeQuestionSchema = z.object({
  id: z.string(),
  projectTitle: z.string(),
  questionText: z.string(),
  options: z.array(z.string()).min(2),
  correctOptionIndex: z.number(),
  selectedOptionIndex: z.number().nullable(),
  isCorrect: z.boolean()
});
export type PortfolioProbeQuestion = z.infer<typeof PortfolioProbeQuestionSchema>;

export const PortfolioProbeReportSchema = z.object({
  enabled: z.boolean(),
  totalQuestions: z.number(),
  correctCount: z.number(),
  scorePercent: z.number(),
  questions: z.array(PortfolioProbeQuestionSchema)
});
export type PortfolioProbeReport = z.infer<typeof PortfolioProbeReportSchema>;

export const ComprehensiveReportSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  candidate: z.object({
    name: z.string(),
    email: z.string(),
    experienceLevel: z.string(),
    domain: z.string(),
    techStack: z.array(z.string())
  }),
  gradingVersion: z.string(),
  generatedAt: z.number(),
  finalScore: z.number().min(0).max(100),
  outcomeBand: z.enum(OUTCOME_BANDS),
  scoreComposition: z.object({
    correctnessPortion: z.number().min(0).max(80),
    aiEfficiencyPortion: z.number().min(0).max(20),
    timeBonusPortion: z.number().min(0).max(5)
  }),
  taskReports: z.array(TaskReportItemSchema),
  aiEfficiency: AiEfficiencyBreakdownSchema,
  integrityRiskIndex: IntegrityRiskIndexSchema,
  claimVerificationIndex: z.array(ClaimVerificationItemSchema),
  portfolioProbe: PortfolioProbeReportSchema,
  recommendations: z.array(z.object({
    category: z.string(),
    finding: z.string(),
    suggestedAction: z.string()
  })),
  signature: z.string(),
  verificationUrl: z.string()
});
export type ComprehensiveReport = z.infer<typeof ComprehensiveReportSchema>;

