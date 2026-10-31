import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, createHashChainNode, verifyHashChain } from '../src/security/hash-chain.js';
import { generateHmacSignature, verifyHmacSignature, signReportPayload, verifyReportSignature } from '../src/security/hmac.js';

describe('Security & Cryptography Modules', () => {
  describe('Hash Chain Audit Log', () => {
    it('creates an immutable, valid hash chain across sequential events', () => {
      const e1 = createHashChainNode(GENESIS_HASH, {
        id: 'ev1',
        assessmentId: 'asm1',
        type: 'tab_focus',
        payload: { screen: 'main' },
        timestamp: 1000
      });

      const e2 = createHashChainNode(e1.hash, {
        id: 'ev2',
        assessmentId: 'asm1',
        type: 'paste',
        payload: { charCount: 45 },
        timestamp: 2000
      });

      const e3 = createHashChainNode(e2.hash, {
        id: 'ev3',
        assessmentId: 'asm1',
        type: 'test_run',
        payload: { passed: 3 },
        timestamp: 3000
      });

      const result = verifyHashChain([e1, e2, e3]);
      expect(result.valid).toBe(true);
    });

    it('detects tampering when an event payload is modified', () => {
      const e1 = createHashChainNode(GENESIS_HASH, {
        id: 'ev1',
        assessmentId: 'asm1',
        type: 'tab_focus',
        payload: { screen: 'main' },
        timestamp: 1000
      });

      const e2 = createHashChainNode(e1.hash, {
        id: 'ev2',
        assessmentId: 'asm1',
        type: 'paste',
        payload: { charCount: 45 },
        timestamp: 2000
      });

      // Attacker attempts to modify payload of e2
      const tamperedE2 = { ...e2, payload: { charCount: 0 } };

      const result = verifyHashChain([e1, tamperedE2]);
      expect(result.valid).toBe(false);
      expect(result.brokenIndex).toBe(1);
    });
  });

  describe('HMAC Authentication & Report Signing', () => {
    const secret = 'super-secret-hmac-key-256-bit-length';

    it('verifies valid timestamped HMAC request headers', () => {
      const ts = Date.now().toString();
      const nonce = 'random-nonce-12345';
      const body = JSON.stringify({ runId: 'run-99', taskId: 'task-1' });

      const sig = generateHmacSignature(secret, ts, nonce, body);
      const res = verifyHmacSignature(secret, ts, nonce, body, sig);
      expect(res.valid).toBe(true);
    });

    it('rejects stale replay requests beyond timestamp skew limit', () => {
      const staleTs = (Date.now() - 120000).toString(); // 2 minutes ago
      const nonce = 'stale-nonce';
      const body = '{}';

      const sig = generateHmacSignature(secret, staleTs, nonce, body);
      const res = verifyHmacSignature(secret, staleTs, nonce, body, sig, 60000); // 60s max skew
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Timestamp skew exceeded');
    });

    it('signs and verifies tamper-evident report payloads', () => {
      const report = { candidateId: 'cand-1', finalScore: 92.5, outcome: 'Strong Hire' };
      const signature = signReportPayload(secret, report);

      expect(verifyReportSignature(secret, report, signature)).toBe(true);
      expect(verifyReportSignature(secret, { ...report, finalScore: 95 }, signature)).toBe(false);
    });
  });
});

