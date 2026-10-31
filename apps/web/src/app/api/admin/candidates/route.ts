import { NextResponse } from 'next/server';
import { firebaseDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const candidates = await firebaseDb.getAllCandidates();
    return NextResponse.json({
      success: true,
      candidates: candidates || []
    });
  } catch (err: any) {
    console.error('Fetch candidates error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to fetch candidates',
      candidates: []
    }, { status: 500 });
  }
}

