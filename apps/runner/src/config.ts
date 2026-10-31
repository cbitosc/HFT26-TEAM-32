import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(5050),
  HOST: z.string().default('0.0.0.0'),
  RUNNER_HMAC_SECRET: z.string().default('c8f6e4a2b91d4e7a9b0c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3'),
  RUNNER_EXEC_TIMEOUT_MS: z.coerce.number().default(6000),
  RUNNER_MEMORY_LIMIT_MB: z.coerce.number().default(256),
  RUNNER_CPU_QUOTA_MICROS: z.coerce.number().default(100000),
  RUNNER_PIDS_LIMIT: z.coerce.number().default(64),
  RUNNER_USE_GVISOR: z.coerce.boolean().default(false),
  MAX_OUTPUT_BYTES: z.coerce.number().default(100 * 1024), // 100 KB max output
  DOCKER_PYTHON_IMAGE: z.string().default('proctor-python-sandbox:latest'),
  DOCKER_NODE_IMAGE: z.string().default('proctor-node-sandbox:latest')
});

export type RunnerConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): RunnerConfig {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid configuration for runner:', result.error.format());
    throw new Error('Runner configuration error');
  }
  return result.data;
}

export const runnerConfig = loadConfig();

