import { createHmac, timingSafeEqual } from 'crypto';
import { canonicalJson } from './hash-chain.js';

export function generateHmacSignature(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  const payload = `${timestamp}:${nonce}:${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyHmacSignature(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  maxSkewMs = 60000
): { valid: boolean; reason?: string } {
  const reqTime = parseInt(timestamp, 10);
  if (isNaN(reqTime)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();
  if (Math.abs(now - reqTime) > maxSkewMs) {
    return { valid: false, reason: `Timestamp skew exceeded (${Math.abs(now - reqTime)}ms > ${maxSkewMs}ms)` };
  }

  const expectedSignature = generateHmacSignature(secret, timestamp, nonce, body);
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Cryptographic signature mismatch' };
  }

  return { valid: true };
}

export function signReportPayload(secret: string, reportData: any): string {
  const canonical = canonicalJson(reportData);
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function verifyReportSignature(secret: string, reportData: any, signature: string): boolean {
  const expected = signReportPayload(secret, reportData);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

