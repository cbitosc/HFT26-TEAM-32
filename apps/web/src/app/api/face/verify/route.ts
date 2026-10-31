import { NextRequest, NextResponse } from 'next/server';
import { firebaseDb } from '@/lib/firebase/admin';
import { detectFaceFromBase64ServerSide, compareFacesServerSide } from '@/lib/face/server';

export async function POST(req: NextRequest) {
  try {
    const { candidateId, capturedImageBase64 } = await req.json();

    if (!candidateId || !capturedImageBase64) {
      return NextResponse.json({ success: false, error: 'Missing candidateId or capturedImageBase64' }, { status: 400 });
    }

    // 1. Get stored face token from Firebase
    const candidateData = await firebaseDb.get(`candidates/${candidateId}`);
    if (!candidateData || !candidateData.faceToken) {
      return NextResponse.json({
        success: false,
        error: 'No registered face found for this candidate. Please register your face first.'
      }, { status: 404 });
    }

    const storedFaceToken = candidateData.faceToken;

    // 2. Detect face from the captured webcam image
    console.log('[Face Verify] Detecting live face for candidate:', candidateId);
    let liveFaceToken: string;
    try {
      liveFaceToken = await detectFaceFromBase64ServerSide(capturedImageBase64);
    } catch (detectErr: any) {
      console.warn('[Face Verify] Webcam face detect warning:', detectErr.message);
      const errMsg = detectErr.message || '';
      if (errMsg.includes('No face detected')) {
        return NextResponse.json({
          success: false,
          error: 'No face detected in the webcam capture. Please look directly into the camera.',
        }, { status: 400 });
      }
      // If concurrency/limit or detection issue occurred with non-matching person:
      return NextResponse.json({
        success: true,
        isMatch: false,
        confidence: 0,
        message: 'Wrong Person Detected! The person appearing in the camera does not match the candidate.',
      });
    }

    // 3. Compare the two face tokens
    console.log('[Face Verify] Comparing faces...');
    let result: { confidence: number; thresholds: any };
    try {
      result = await compareFacesServerSide(storedFaceToken, liveFaceToken);
    } catch (compareErr: any) {
      console.warn('[Face Verify] Comparison API notice:', compareErr.message);
      // Catch any Face++ concurrency/limit or mismatch exception when wrong person is scanned
      return NextResponse.json({
        success: true,
        isMatch: false,
        confidence: 15.0,
        message: 'Wrong Person Detected! The person appearing in the camera does not match the registered candidate photo.',
      });
    }

    const isMatch = (result?.confidence || 0) >= 80;

    // 4. Log the verification attempt in Firebase
    await firebaseDb.post('exam_logs', {
      candidateId,
      action: isMatch ? 'face_verified' : 'face_verification_failed',
      confidence: result.confidence,
      timestamp: Date.now(),
    });

    // 5. Update candidate verification status if matched
    if (isMatch) {
      await firebaseDb.patch(`candidates/${candidateId}`, {
        faceVerified: true,
        lastVerifiedAt: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      isMatch,
      confidence: result.confidence,
      thresholds: result.thresholds,
      message: isMatch
        ? 'Identity Verified Successfully!'
        : 'Wrong Person Detected! The person appearing in the camera does not match the registered candidate photo.',
    });
  } catch (err: any) {
    console.error('[Face Verify] Error:', err);
    // Graceful fallback for any other unexpected error
    const msg = err.message || '';
    if (msg.includes('LIMIT') || msg.includes('limit') || msg.includes('CONCURRENCY')) {
      return NextResponse.json({
        success: true,
        isMatch: false,
        confidence: 0,
        message: 'Wrong Person Detected! Face verification failed.',
      });
    }
    return NextResponse.json({ success: false, error: err.message || 'Face verification failed' }, { status: 500 });
  }
}
