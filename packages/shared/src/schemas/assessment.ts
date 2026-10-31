import { z } from 'zod';
import { PortfolioSchema } from './portfolio.js';

export const PIPELINE_STAGES = [
  'PORTFOLIO_ANALYSIS',
  'TASK_GENERATION',
  'VALIDATION_GATE',
  'PACKAGING',
  'READY',
  'FAILED'
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STATUSES = ['pending', 'in_progress', 'completed', 'failed'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const CandidateProfileSchema = z.object({
  candidateName: z.string(),
  candidateEmail: z.string(),
  dominantDomain: z.string(),
  primaryLanguage: z.string(),
  preferredFramework: z.string(),
  projectThemes: z.array(z.string()),
  allowedDsaTopicsByTier: z.object({
    novice: z.array(z.string()),
    adept: z.array(z.string()),
    master: z.array(z.string())
  }),
  difficultyCalibration: z.string(),
  hasSufficientDsaBreadth: z.boolean(),
  notes: z.array(z.string()).default([])
});
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const PipelineStageStateSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  status: z.enum(PIPELINE_STATUSES),
  progressPercent: z.number().min(0).max(100),
  message: z.string(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  error: z.string().optional()
});
export type PipelineStageState = z.infer<typeof PipelineStageStateSchema>;

export const PipelineStateSchema = z.object({
  assessmentId: z.string(),
  currentStage: z.enum(PIPELINE_STAGES),
  stages: z.record(z.enum(PIPELINE_STAGES), PipelineStageStateSchema),
  candidateProfile: CandidateProfileSchema.optional(),
  generatedTaskIds: z.array(z.string()).default([]),
  fallbackUsed: z.boolean().default(false),
  updatedAt: z.number()
});
export type PipelineState = z.infer<typeof PipelineStateSchema>;

export const ASSESSMENT_STATUSES = [
  'created',
  'ready',
  'in_progress',
  'completed',
  'timed_out',
  'terminated'
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const AssessmentDocSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  orgId: z.string().default('default-org'),
  portfolio: PortfolioSchema,
  status: z.enum(ASSESSMENT_STATUSES).default('created'),
  createdAt: z.number(),
  startedAt: z.number().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  serverDeadline: z.number().nullable().default(null),
  durationMinutes: z.number().default(60),
  activeTaskId: z.string().nullable().default(null),
  taskIds: z.array(z.string()).default([]),
  isDemoMode: z.boolean().default(false),
  extraTimeMultiplier: z.number().default(1.0),
  activeSessionToken: z.string().nullable().default(null),
  leaseExpiresAt: z.number().nullable().default(null)
});
export type AssessmentDoc = z.infer<typeof AssessmentDocSchema>;

