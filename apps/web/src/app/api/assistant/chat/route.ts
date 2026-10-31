import { NextRequest, NextResponse } from 'next/server';
import { askAI } from '@/lib/ai/ai-client';
import { firebaseDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, tier, userMessage, codeSnippet, compilationError } = body;

    // Strict boundary: AI Assistant is disabled for Novice tier
    if (tier === 'novice') {
      return NextResponse.json({
        success: false,
        error: 'Guarded AI Assistant is NOT permitted in the Novice Tier.',
      }, { status: 403 });
    }

    // Safety checks against solution extraction / prompt injections
    const lowerMsg = (userMessage || '').toLowerCase();
    const isJailbreakAttempt = /ignore previous|system prompt|give me the full code|write the solution for me|solve it for me|reference solution/i.test(lowerMsg);

    if (isJailbreakAttempt) {
      return NextResponse.json({
        success: true,
        reply: "I am a Guarded Technical Assistant. I cannot reveal solutions or generate complete code. I can only guide your debugging strategy, clarify specifications, or suggest edge cases to investigate.",
        isGuardedRefusal: true,
      });
    }

    const systemPrompt = `You are a Guarded Technical Interview Assistant on a technical assessment platform.
Your candidate is solving a ${tier?.toUpperCase()} tier challenge.

RULES YOU MUST NEVER BREAK:
1. NEVER output the full working function or direct drop-in code solution.
2. Provide concise, targeted hints (2-4 sentences max).
3. Point out subtle edge cases (e.g. empty inputs, off-by-one indices, time complexity).
4. If an error message is given, explain WHY the error occurs without just giving the fixed code.
5. Keep your tone encouraging and professional.

CURRENT CANDIDATE CODE:
\`\`\`javascript
${(codeSnippet || '').substring(0, 1500)}
\`\`\`

${compilationError ? `LAST ERROR REPORTED: ${compilationError}` : ''}

CANDIDATE QUESTION:
"${userMessage}"

Provide a constructive, guarded hint:`;

    const reply = await askAI(systemPrompt, 600);

    // Deterministic interaction logging in Firebase for AI Efficiency score calculation
    if (candidateId) {
      await firebaseDb.post(`candidates/${candidateId}/assistant_logs`, {
        timestamp: Date.now(),
        tier,
        userMessage,
        assistantReply: reply,
      });
    }

    return NextResponse.json({
      success: true,
      reply,
    });

  } catch (err: any) {
    console.error('Assistant error:', err);
    return NextResponse.json({
      success: true,
      reply: 'Consider verifying how your function handles boundary conditions and check whether all pointers or array indices remain within valid range.',
    });
  }
}

