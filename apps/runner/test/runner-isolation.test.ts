import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { generateHmacSignature } from '@proctor-forge/shared';
import { runnerConfig } from '../src/config.js';
import { FastifyInstance } from 'fastify';

describe('Runner Sandbox Isolation & Security Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests without HMAC headers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { runId: 'test1' }
    });

    expect(res.statusCode).toBe(401);
  });

  it('intercepts code containing forbidden network imports', async () => {
    const body = {
      runId: 'sec-net-1',
      taskId: 'task-sec',
      language: 'python',
      files: [
        { path: 'solution.py', content: 'import socket\ns = socket.socket()', editable: true }
      ],
      testFiles: [
        { path: 'test_solution.py', content: 'def test_dummy(): assert True', editable: false }
      ],
      timeoutMs: 3000,
      memoryLimitMb: 128,
      runHiddenTests: false
    };

    const ts = Date.now().toString();
    const nonce = 'nonce-sec-net-1';
    const bodyStr = JSON.stringify(body);
    const sig = generateHmacSignature(runnerConfig.RUNNER_HMAC_SECRET, ts, nonce, bodyStr);

    const res = await app.inject({
      method: 'POST',
      url: '/run',
      headers: {
        'x-proctor-signature': sig,
        'x-proctor-timestamp': ts,
        'x-proctor-nonce': nonce,
        'content-type': 'application/json'
      },
      payload: bodyStr
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
    expect(data.securityViolations.length).toBeGreaterThan(0);
    expect(data.securityViolations[0]).toContain('Forbidden import');
  });

  it('safely terminates infinite loops within timeout limit', async () => {
    const body = {
      runId: 'timeout-1',
      taskId: 'task-loop',
      language: 'python',
      files: [
        { path: 'solution.py', content: 'while True: pass', editable: true }
      ],
      testFiles: [
        { path: 'test_solution.py', content: 'import unittest\nfrom solution import *\nclass TestL(unittest.TestCase):\n    def test_run(self): self.assertTrue(True)', editable: false }
      ],
      timeoutMs: 1500, // 1.5s timeout
      memoryLimitMb: 128,
      runHiddenTests: false
    };

    const ts = Date.now().toString();
    const nonce = 'nonce-timeout-1';
    const bodyStr = JSON.stringify(body);
    const sig = generateHmacSignature(runnerConfig.RUNNER_HMAC_SECRET, ts, nonce, bodyStr);

    const startTime = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      headers: {
        'x-proctor-signature': sig,
        'x-proctor-timestamp': ts,
        'x-proctor-nonce': nonce,
        'content-type': 'application/json'
      },
      payload: bodyStr
    });

    const elapsed = Date.now() - startTime;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
    expect(elapsed).toBeLessThan(4000); // Properly contained within timeout margin
  });
});

