import { NextRequest, NextResponse } from 'next/server';
import { GENESIS_HASH, createHashChainNode, TelemetryEventType } from '@proctor-forge/shared';
import { collections } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assessmentId, taskId, type, payload } = body;

    if (!assessmentId || !type) {
      return NextResponse.json({ success: false, error: 'Missing assessmentId or type' }, { status: 400 });
    }

    const eventsRef = collections.assessments().doc(assessmentId).collection('events');

    // Retrieve previous event in chain to get prevHash
    const lastEventSnap = await eventsRef.orderBy('timestamp', 'desc').limit(1).get();
    let prevHash = GENESIS_HASH;

    if (!lastEventSnap.empty) {
      prevHash = lastEventSnap.docs[0]!.data().hash || GENESIS_HASH;
    }

    const eventId = `ev_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const timestamp = Date.now();

    const node = createHashChainNode(prevHash, {
      id: eventId,
      assessmentId,
      taskId,
      type: type as TelemetryEventType,
      payload: payload || {},
      timestamp
    });

    await eventsRef.doc(eventId).set(node);

    return NextResponse.json({
      success: true,
      eventId,
      hash: node.hash
    });
  } catch (err: any) {
    console.error('Telemetry route error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

