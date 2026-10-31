import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyHmacSignature } from '@proctor-forge/shared';
import { runnerConfig } from '../config.js';

// Replay-protection cache: maps nonce -> expiration timestamp
const seenNonces = new Map<string, number>();

// Periodic purge of expired nonces (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of seenNonces.entries()) {
    if (now > expiresAt) {
      seenNonces.delete(nonce);
    }
  }
}, 60000).unref();

export async function verifyRunnerHmac(request: FastifyRequest, reply: FastifyReply) {
  const signature = request.headers['x-proctor-signature'] as string;
  const timestamp = request.headers['x-proctor-timestamp'] as string;
  const nonce = request.headers['x-proctor-nonce'] as string;

  if (!signature || !timestamp || !nonce) {
    return reply.status(401).send({
      success: false,
      error: 'Missing required HMAC authentication headers (x-proctor-signature, x-proctor-timestamp, x-proctor-nonce)'
    });
  }

  // Check nonce replay cache
  if (seenNonces.has(nonce)) {
    return reply.status(401).send({
      success: false,
      error: 'Replay attack detected: nonce already consumed'
    });
  }

  const rawBody = typeof request.body === 'string'
    ? request.body
    : JSON.stringify(request.body || {});

  const verification = verifyHmacSignature(
    runnerConfig.RUNNER_HMAC_SECRET,
    timestamp,
    nonce,
    rawBody,
    signature,
    60000 // 60s max allowed skew
  );

  if (!verification.valid) {
    return reply.status(403).send({
      success: false,
      error: `Authentication failed: ${verification.reason}`
    });
  }

  // Register nonce with a 2-minute expiration
  seenNonces.set(nonce, Date.now() + 120000);
}

