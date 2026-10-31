import { NextRequest, NextResponse } from 'next/server';
import { parseAndValidatePortfolio } from '@proctor-forge/shared';
import { AssessmentPipelineOrchestrator } from '@/lib/pipeline/orchestrator';
import { collections } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const validation = parseAndValidatePortfolio(rawBody);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        errors: validation.errors
      }, { status: 400 });
    }

    const portfolio = validation.data;
    const assessmentId = `asm_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const candidateId = `cand_${randomBytes(6).toString('hex')}`;

    // Create assessment record in Firestore
    const assessmentDoc = {
      id: assessmentId,
      candidateId,
      orgId: 'default-org',
      portfolio,
      status: 'created',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      serverDeadline: null,
      durationMinutes: 60,
      activeTaskId: null,
      taskIds: [],
      isDemoMode: false,
      extraTimeMultiplier: 1.0,
      activeSessionToken: null,
      leaseExpiresAt: null
    };

    await collections.assessments().doc(assessmentId).set(assessmentDoc);

    // Initialize pipeline orchestrator
    const orchestrator = new AssessmentPipelineOrchestrator(
      assessmentId,
      portfolio,
      async (stage, percent, message) => {
        await collections.pipelineStates().doc(assessmentId).set({
          assessmentId,
          stage,
          percent,
          message,
          updatedAt: Date.now()
        }, { merge: true });
      }
    );

    // Execute pipeline (Stages A -> B -> C -> D)
    const result = await orchestrator.runPipeline();

    // Update assessment with candidate visible tasks and taskIds
    const taskIds = result.tasks.map((t) => t.id);
    await collections.assessments().doc(assessmentId).update({
      status: 'ready',
      taskIds,
      candidateProfile: result.profile,
      tasks: result.tasks
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      taskIds,
      candidateProfile: result.profile,
      tasks: result.tasks
    });
  } catch (err: any) {
    console.error('Pipeline route error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal pipeline execution error'
    }, { status: 500 });
  }
}

