import { z } from 'zod';
import { SUPPORTED_LANGUAGES, TEST_CATEGORIES, TaskFileSchema } from './task.js';

export const RunnerRequestSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  language: z.enum(SUPPORTED_LANGUAGES),
  files: z.array(TaskFileSchema).min(1),
  testFiles: z.array(TaskFileSchema).min(1),
  timeoutMs: z.number().int().positive().max(30000).default(6000),
  memoryLimitMb: z.number().int().positive().max(512).default(256),
  runHiddenTests: z.boolean().default(false),
  complexityProbe: z.object({
    enabled: z.boolean().default(false),
    inputSizes: z.array(z.number().positive()).default([]),
    maxGrowthRatio: z.number().positive().default(2.5)
  }).optional()
});
export type RunnerRequest = z.infer<typeof RunnerRequestSchema>;

export const TestResultItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  passed: z.boolean(),
  durationMs: z.number(),
  category: z.enum(TEST_CATEGORIES),
  weight: z.number().default(1),
  error: z.string().optional()
});
export type TestResultItem = z.infer<typeof TestResultItemSchema>;

export const RunnerResponseSchema = z.object({
  runId: z.string(),
  taskId: z.string(),
  success: z.boolean(),
  exitCode: z.number(),
  executionTimeMs: z.number(),
  peakMemoryMb: z.number().optional(),
  stdout: z.string(),
  stderr: z.string(),
  testResults: z.array(TestResultItemSchema),
  complexityResult: z.object({
    passed: z.boolean(),
    inputSizes: z.array(z.number()),
    runtimesMs: z.array(z.number()),
    growthRatio: z.number()
  }).optional(),
  securityViolations: z.array(z.string()).default([]),
  error: z.string().optional()
});
export type RunnerResponse = z.infer<typeof RunnerResponseSchema>;

export interface HmacHeaders {
  'x-proctor-signature': string;
  'x-proctor-timestamp': string;
  'x-proctor-nonce': string;
}

