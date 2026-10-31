import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RunnerRequestSchema } from '@proctor-forge/shared';
import { verifyRunnerHmac } from '../auth/hmac-auth.js';
import { executeInSandbox } from '../sandbox/docker-pool.js';

export const runRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post('/run', {
    preHandler: verifyRunnerHmac
  }, async (request, reply) => {
    const parseResult = RunnerRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: `Invalid request payload: ${parseResult.error.message}`
      });
    }

    try {
      const response = await executeInSandbox(parseResult.data);
      return reply.status(200).send(response);
    } catch (err: any) {
      request.log.error(err, 'Sandbox execution internal failure');
      return reply.status(500).send({
        runId: parseResult.data.runId,
        taskId: parseResult.data.taskId,
        success: false,
        exitCode: 1,
        executionTimeMs: 0,
        stdout: '',
        stderr: 'Internal runner failure',
        testResults: [],
        error: err.message || 'Unknown runner error'
      });
    }
  });

  server.get('/health', async () => {
    return { status: 'healthy', timestamp: Date.now() };
  });
};

