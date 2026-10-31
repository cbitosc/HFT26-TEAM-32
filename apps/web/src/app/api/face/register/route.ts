import { NextRequest, NextResponse } from 'next/server';
import { firebaseDb } from '@/lib/firebase/admin';
import { detectFaceServerSide } from '@/lib/face/server';

export async function POST(req: NextRequest) {
  try {
    const { candidateId, photoUrl } = await req.json();

    if (!candidateId || !photoUrl) {
      return NextResponse.json({ success: false, error: 'Missing candidateId or photoUrl' }, { status: 400 });
    }

    console.log('[Face Register] Detecting face for candidate:', candidateId);
    const faceToken = await detectFaceServerSide(photoUrl);
    console.log('[Face Register] Face token obtained:', faceToken.slice(0, 12) + '...');

    // Store face data in Firebase under the candidate record
    await firebaseDb.patch(`candidates/${candidateId}`, {
      photoURL: photoUrl,
      faceToken: faceToken,
      faceRegisteredAt: Date.now(),
      faceVerified: false,
    });

    return NextResponse.json({
      success: true,
      faceToken,
      photoUrl,
    });
  } catch (err: any) {
    console.error('[Face Register] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Face registration failed' }, { status: 500 });
  }
}
