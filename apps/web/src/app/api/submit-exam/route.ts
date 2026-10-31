import { NextRequest, NextResponse } from 'next/server';
import { gradeAnswers } from '@/lib/ai/ai-client';
import { firebaseDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, answers } = body;

    if (!candidateId || !answers) {
      return NextResponse.json({ success: false, error: 'Missing candidateId or answers' }, { status: 400 });
    }

    // Fetch stored questions with correct answers from Firebase
    const questions = await firebaseDb.get(`candidates/${candidateId}/questions`);
    
    if (!questions) {
      return NextResponse.json({ success: false, error: 'Questions not found for this candidate' }, { status: 404 });
    }

    // Convert questions object to array if needed
    const questionsArray = Array.isArray(questions) ? questions : Object.values(questions);

    // Grade answers deterministically
    const scores = gradeAnswers(questionsArray, answers);

    // Save to Firebase
    await firebaseDb.saveCandidateAnswers(candidateId, answers, scores, body.report);

    return NextResponse.json({
      success: true,
      candidateId,
      scores,
    });

  } catch (err: any) {
    console.error('Submit exam error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to grade exam'
    }, { status: 500 });
  }
}
