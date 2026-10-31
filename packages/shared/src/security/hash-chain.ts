import { createHash } from 'crypto';
import { TelemetryEvent } from '../schemas/telemetry.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Deterministic canonical JSON serialization
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function computeSha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function createHashChainNode(
  prevHash: string,
  event: {
    id: string;
    assessmentId: string;
    taskId?: string;
    type: string;
    payload: Record<string, any>;
    timestamp: number;
  }
): TelemetryEvent {
  const contentToHash = prevHash + canonicalJson({
    id: event.id,
    assessmentId: event.assessmentId,
    taskId: event.taskId,
    type: event.type,
    payload: event.payload,
    timestamp: event.timestamp
  });

  const hash = computeSha256(contentToHash);

  return {
    ...event,
    type: event.type as any,
    prevHash,
    hash
  };
}

export function verifyHashChain(events: TelemetryEvent[]): { valid: boolean; brokenIndex?: number; error?: string } {
  if (!events || events.length === 0) {
    return { valid: true };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;

    if (ev.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenIndex: i,
        error: `Event [${ev.id}] at index ${i} has invalid prevHash. Expected ${expectedPrevHash}, got ${ev.prevHash}`
      };
    }

    const contentToHash = ev.prevHash + canonicalJson({
      id: ev.id,
      assessmentId: ev.assessmentId,
      taskId: ev.taskId,
      type: ev.type,
      payload: ev.payload,
      timestamp: ev.timestamp
    });

    const computed = computeSha256(contentToHash);
    if (computed !== ev.hash) {
      return {
        valid: false,
        brokenIndex: i,
        error: `Event [${ev.id}] at index ${i} has corrupted content. Recomputed hash ${computed} != recorded hash ${ev.hash}`
      };
    }

    expectedPrevHash = ev.hash;
  }

  return { valid: true };
}

