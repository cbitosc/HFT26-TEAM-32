import { NextRequest, NextResponse } from 'next/server';
import { generateQuestionsBatch } from '@/lib/ai/ai-client';
import { firebaseDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, phase } = body;

    if (!candidateId || ![2, 3].includes(Number(phase))) {
      return NextResponse.json({ success: false, error: 'Valid candidateId and phase (2 or 3) required' }, { status: 400 });
    }

    const targetPhase = Number(phase) as 2 | 3;

    // 1. Fetch candidate from Firebase
    const candidate = await firebaseDb.get(`candidates/${candidateId}`);
    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }

    const portfolio = candidate.portfolio;
    if (!portfolio) {
      return NextResponse.json({ success: false, error: 'Candidate portfolio missing' }, { status: 400 });
    }

    // 2. Fetch existing questions
    let existingQuestions: any[] = [];
    if (candidate.questions) {
      existingQuestions = Array.isArray(candidate.questions)
        ? candidate.questions
        : Object.values(candidate.questions);
    }

    // 3. Check if this phase was already generated (idempotency)
    const existingForPhase = existingQuestions.filter((q: any) => q.phase === targetPhase);
    if (existingForPhase.length >= 20) {
      console.log(`[Batch] Phase ${targetPhase} already exists for ${candidateId}`);
      const clientQuestions = existingForPhase.map((q: any) => ({
        id: q.id,
        phase: q.phase,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        topic: q.topic,
        isProjectQuestion: q.isProjectQuestion || false,
      }));

      return NextResponse.json({
        success: true,
        candidateId,
        phase: targetPhase,
        newQuestions: clientQuestions,
        totalLoaded: existingQuestions.length,
        isCached: true,
      });
    }

    // 4. Generate next 20 questions in the background
    console.log(`[Batch] Generating Phase ${targetPhase} for ${candidateId} in background...`);
    const newQuestions = await generateQuestionsBatch(portfolio, targetPhase);

    // Filter out any overlap and combine
    const mergedQuestions = [
      ...existingQuestions.filter((q: any) => q.phase !== targetPhase),
      ...newQuestions,
    ].sort((a: any, b: any) => a.id - b.id);

    // 5. Save back to Firebase
    await firebaseDb.saveCandidateQuestions(candidateId, mergedQuestions);

    const updatePatch: any = {
      totalQuestions: mergedQuestions.length,
    };
    if (targetPhase === 2) {
      updatePatch.phase2Ready = true;
      updatePatch.status = 'phase_2_ready';
    } else if (targetPhase === 3) {
      updatePatch.phase3Ready = true;
      updatePatch.status = 'all_60_ready';
    }
    await firebaseDb.patch(`candidates/${candidateId}`, updatePatch);

    console.log(`[Batch] Phase ${targetPhase} generated successfully. Total questions now: ${mergedQuestions.length}`);

    // Client-safe version
    const clientQuestions = newQuestions.map((q: any) => ({
      id: q.id,
      phase: q.phase,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      topic: q.topic,
      isProjectQuestion: q.isProjectQuestion || false,
    }));

    return NextResponse.json({
      success: true,
      candidateId,
      phase: targetPhase,
      newQuestions: clientQuestions,
      totalLoaded: mergedQuestions.length,
      targetTotal: 60,
    });

  } catch (err: any) {
    console.error('Batch generation error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to generate question batch'
    }, { status: 500 });
  }
}

