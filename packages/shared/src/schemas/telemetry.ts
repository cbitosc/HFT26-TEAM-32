import { z } from 'zod';

export const TELEMETRY_EVENT_TYPES = [
  'fullscreen_enter',
  'fullscreen_exit',
  'tab_blur',
  'tab_focus',
  'window_resize',
  'devtools_open',
  'paste',
  'copy',
  'cut',
  'keystroke_cadence',
  'teleport_code',
  'multi_monitor_detected',
  'webcam_presence',
  'session_takeover_attempt',
  'extraction_attempt',
  'test_run',
  'hint_requested',
  'file_reset',
  'snapshot_saved'
] as const;
export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export const TelemetryEventSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  taskId: z.string().optional(),
  type: z.enum(TELEMETRY_EVENT_TYPES),
  payload: z.record(z.any()),
  timestamp: z.number(),
  prevHash: z.string(),
  hash: z.string()
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export const KeystrokeDynamicsSummarySchema = z.object({
  activeDurationMs: z.number(),
  keyPressCount: z.number(),
  averageIntervalMs: z.number(),
  intervalVariance: z.number(),
  burstRatio: z.number(),
  isHumanLike: z.boolean()
});
export type KeystrokeDynamicsSummary = z.infer<typeof KeystrokeDynamicsSummarySchema>;

export const IntegritySignalSchema = z.object({
  name: z.string(),
  weight: z.number(),
  rawScore: z.number().min(0).max(100),
  weightedContribution: z.number(),
  description: z.string(),
  evidenceCount: z.number(),
  evidenceDetails: z.array(z.string()).default([])
});
export type IntegritySignal = z.infer<typeof IntegritySignalSchema>;

export const IntegrityRiskIndexSchema = z.object({
  totalScore: z.number().min(0).max(100),
  riskBand: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  signals: z.array(IntegritySignalSchema),
  hashChainValid: z.boolean(),
  totalEventsAnalyzed: z.number(),
  keyAnomalies: z.array(z.string())
});
export type IntegrityRiskIndex = z.infer<typeof IntegrityRiskIndexSchema>;

