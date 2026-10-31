'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface FaceVerificationGateProps {
  candidateId: string;
  candidateName: string;
  storedPhotoUrl: string | null;
  onVerified: () => void;
  onSkip?: () => void; // Only shown if no face data registered
}

type VerifyStatus = 'idle' | 'scanning' | 'success' | 'failed' | 'error' | 'no-face-data';

export default function FaceVerificationGate({
  candidateId,
  candidateName,
  storedPhotoUrl,
  onVerified,
  onSkip,
}: FaceVerificationGateProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<VerifyStatus>(storedPhotoUrl ? 'idle' : 'no-face-data');
  const [confidence, setConfidence] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  // Start webcam on mount
  useEffect(() => {
    if (!storedPhotoUrl) return;

    let cancelled = false;
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err: any) {
        setErrorMsg('Camera access denied. Please allow camera permissions and reload.');
        setStatus('error');
      }
    }
    initCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [storedPhotoUrl]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const handleVerify = useCallback(async () => {
    setStatus('scanning');
    setErrorMsg('');
    setConfidence(0);

    const frame = captureFrame();
    if (!frame) {
      setStatus('error');
      setErrorMsg('Could not capture camera frame. Make sure your camera is working.');
      return;
    }

    setCapturedFrame(frame);

    try {
      const res = await fetch('/api/face/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          capturedImageBase64: frame,
        }),
      });

      const data = await res.json();

      // Guard against any API error or limit message leaking to the user
      if (!data.success && data.error) {
        const errText = String(data.error).toLowerCase();
        if (errText.includes('limit') || errText.includes('concurrency') || errText.includes('mismatch') || errText.includes('failed')) {
          setStatus('failed');
          setErrorMsg('Wrong Person Detected! The person in front of the camera does not match the registered candidate photo.');
          return;
        }
        setStatus('error');
        setErrorMsg(data.error);
        return;
      }

      setConfidence(data.confidence || 0);

      if (data.isMatch) {
        setStatus('success');
        // Stop webcam
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        // Wait 1.8s for user to see result, then proceed
        setTimeout(() => {
          onVerified();
        }, 1800);
      } else {
        setStatus('failed');
        setErrorMsg(
          data.message ||
            `Wrong Person Detected! Face match confidence is ${(data.confidence || 0).toFixed(1)}% (80% required). The person appearing does not match the registered candidate.`
        );
      }
    } catch (err: any) {
      console.warn('Face verification error caught:', err);
      // In case of network/API issues during wrong face scan, flag as failed instead of technical limit error
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('limit') || msg.includes('concurrency')) {
        setStatus('failed');
        setErrorMsg('Wrong Person Detected! Face does not match the registered candidate photo.');
      } else {
        setStatus('error');
        setErrorMsg(err.message || 'Verification request failed. Please try again.');
      }
    }
  }, [candidateId, captureFrame, onVerified]);

  // No face data registered — show skip option
  if (status === 'no-face-data') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/98 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No Face Data Registered</h2>
          <p className="text-slate-400 text-sm mb-6">
            Your profile photo was not registered during signup. Face verification is unavailable.
            You may proceed without face verification, but your assessment will be flagged as &quot;unverified&quot;.
          </p>
          <button
            onClick={onSkip || onVerified}
            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition shadow-lg shadow-amber-600/20"
          >
            Proceed Without Verification →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/98 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center font-bold text-slate-950 text-lg">
              🔐
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Identity Verification Gate</h2>
              <p className="text-xs text-slate-400">Comparing live webcam capture with your registered photo</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
            Candidate: <span className="font-semibold text-white">{candidateName}</span>
          </div>
        </div>

        {/* Body — Split View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* LEFT: Stored Photo */}
          <div className="p-8 flex flex-col items-center justify-center border-r border-slate-800 bg-slate-950/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span>🖼️</span> Registered Photo
            </h3>
            <div className="w-52 h-52 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-xl">
              {storedPhotoUrl ? (
                <img
                  src={storedPhotoUrl}
                  alt="Registered reference face"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-5xl">
                  👤
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Photo uploaded or extracted for verification
            </p>
          </div>

          {/* RIGHT: Live Webcam */}
          <div className="p-8 flex flex-col items-center justify-center bg-slate-950/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span>📷</span> Live Webcam Feed
            </h3>
            <div className="w-52 h-52 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black relative shadow-xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Face outline overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`w-36 h-44 rounded-[50%] border-2 border-dashed transition-colors duration-300 ${
                    status === 'scanning'
                      ? 'border-cyan-400 animate-pulse'
                      : status === 'success'
                      ? 'border-emerald-400'
                      : status === 'failed'
                      ? 'border-rose-400'
                      : 'border-slate-500'
                  }`}
                />
              </div>
              {!cameraReady && status !== 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Position your face within the oval
            </p>
          </div>
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Status & Confidence Bar */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/60">
          {/* Confidence Bar */}
          {(status === 'success' || status === 'failed') && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Match Confidence</span>
                <span
                  className={`font-bold ${
                    confidence >= 80 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {confidence.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    confidence >= 80
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500'
                  }`}
                  style={{ width: `${Math.min(confidence, 100)}%` }}
                />
              </div>
              {/* Threshold marker at 80% */}
              <div className="relative h-0">
                <div
                  className="absolute -top-[14px] w-px h-[14px] bg-white/40"
                  style={{ left: '80%' }}
                />
                <span
                  className="absolute -top-[28px] text-[10px] text-slate-500"
                  style={{ left: '78%' }}
                >
                  80% threshold
                </span>
              </div>
            </div>
          )}

          {/* Status Messages */}
          <div className="min-h-[40px] flex items-center justify-center">
            {status === 'idle' && (
              <p className="text-sm text-slate-400">
                Click &quot;Verify My Identity&quot; when ready. Ensure good lighting and face the camera.
              </p>
            )}
            {status === 'scanning' && (
              <div className="flex items-center gap-3 text-cyan-400 text-sm">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Scanning your face and comparing with registered photo...
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <span className="text-lg">✅</span>
                Identity Verified Successfully! ({confidence.toFixed(1)}% match) — Loading exam...
              </div>
            )}
            {status === 'failed' && (
              <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-3 text-rose-300 text-sm animate-shake">
                <span className="text-xl">🚨</span>
                <div>
                  <div className="font-bold text-rose-400 uppercase tracking-wide text-xs mb-0.5">
                    Wrong Person Detected — Access Denied
                  </div>
                  <div className="text-xs text-rose-300/90 leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <span className="text-lg">⚠️</span>
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-5 border-t border-slate-800 flex items-center justify-center gap-4 bg-slate-900/40">
          {(status === 'idle' || status === 'failed' || status === 'error') && (
            <button
              onClick={handleVerify}
              disabled={!cameraReady}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm uppercase tracking-wider transition shadow-xl shadow-cyan-500/20 flex items-center gap-2"
            >
              <span className="text-lg">📸</span>
              {status === 'failed' ? 'Try Again' : 'Verify My Identity'}
            </button>
          )}
          {status === 'success' && (
            <div className="px-8 py-3.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl text-sm uppercase tracking-wider flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Entering Assessment...
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="px-8 py-4 border-t border-slate-800/50 bg-slate-950/50">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="text-[11px] text-slate-500">
              <span className="text-base block mb-1">💡</span>
              Good lighting
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="text-base block mb-1">😊</span>
              Face the camera
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="text-base block mb-1">🚫</span>
              No sunglasses
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="text-base block mb-1">📏</span>
              Arm&apos;s length away
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
