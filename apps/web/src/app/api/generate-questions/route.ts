import { NextRequest, NextResponse } from 'next/server';
import { generateQuestionsBatch } from '@/lib/ai/ai-client';
import { firebaseDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, portfolio } = body;

    if (!candidateId || !portfolio) {
      return NextResponse.json({ success: false, error: 'Missing candidateId or portfolio data' }, { status: 400 });
    }

    // Generate INITIAL batch of 20 questions (Phase 1: Beginner, Q1-20)
    console.log(`[Generate] Generating Phase 1 (Q1-20) for candidate ${candidateId}...`);
    const phase1Questions = await generateQuestionsBatch(portfolio, 1);

    // Prepare client-safe questions (without correct answers)
    const clientQuestions = phase1Questions.map((q: any) => ({
      id: q.id,
      phase: q.phase,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      topic: q.topic,
      isProjectQuestion: q.isProjectQuestion || false,
    }));

    // Save full questions (with answers) to Firebase
    await firebaseDb.saveCandidateQuestions(candidateId, phase1Questions);
    
    // Update candidate status in Firebase
    await firebaseDb.patch(`candidates/${candidateId}`, {
      status: 'phase_1_ready',
      questionsGeneratedAt: Date.now(),
      totalQuestions: phase1Questions.length,
      targetTotal: 60,
      phase1Ready: true,
      phase2Ready: false,
      phase3Ready: false,
      portfolio,
    });

    console.log(`[Generate] Phase 1 ready (${phase1Questions.length} questions) for ${candidateId}`);

    return NextResponse.json({
      success: true,
      candidateId,
      questions: clientQuestions,
      currentPhase: 1,
      totalLoaded: clientQuestions.length,
      targetTotal: 60,
      phases: {
        beginner: clientQuestions.length,
        intermediate: 0,
        advanced: 0,
      }
    });

  } catch (err: any) {
    console.error('Initial question generation error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to generate initial questions'
    }, { status: 500 });
  }
}
