'use client';

import React, { useState, useRef, useCallback } from 'react';

interface PhotoCaptureProps {
  candidateId: string | null; // null during initial upload, set after candidate creation
  onPhotoRegistered: (photoUrl: string, faceToken: string) => void;
  onSkip: () => void;
}

export default function PhotoCapture({ candidateId, onPhotoRegistered, onSkip }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'select' | 'upload' | 'webcam'>('select');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setWebcamActive(true);
        setMode('webcam');
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  }, []);

  const captureFromWebcam = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    stopWebcam();
    setMode('upload');
  }, [stopWebcam]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setMode('upload');
      setError('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!preview || !candidateId) return;
    setUploading(true);
    setError('');

    try {
      // Step 1: Upload photo to Cloudinary
      setStatus('Uploading photo to cloud storage...');
      const uploadRes = await fetch('/api/face/extract-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: preview }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || 'Photo upload failed');

      // Step 2: Register face with Face++ and store in Firebase
      setStatus('Detecting and registering your face...');
      const registerRes = await fetch('/api/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          photoUrl: uploadData.photoUrl,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerData.success) throw new Error(registerData.error || 'Face registration failed');

      setStatus('✅ Face registered successfully!');
      onPhotoRegistered(registerData.photoUrl, registerData.faceToken);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setStatus('');
    } finally {
      setUploading(false);
    }
  }, [preview, candidateId, onPhotoRegistered]);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xl">
          📸
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Face Registration</h3>
          <p className="text-xs text-slate-400">Required for identity verification during exam</p>
        </div>
      </div>

      {mode === 'select' && !preview && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 mb-4">
            Upload a clear passport-size photo or capture one from your webcam. This will be used to verify your identity before the exam.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 hover:bg-violet-500/5 transition text-center group"
            >
              <span className="text-3xl block mb-2 group-hover:scale-110 transition">🖼️</span>
              <span className="text-sm font-medium text-slate-300">Upload Photo</span>
              <span className="text-[11px] text-slate-500 block mt-1">JPG, PNG, WEBP</span>
            </button>
            <button
              onClick={startWebcam}
              className="p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition text-center group"
            >
              <span className="text-3xl block mb-2 group-hover:scale-110 transition">📷</span>
              <span className="text-sm font-medium text-slate-300">Use Webcam</span>
              <span className="text-[11px] text-slate-500 block mt-1">Capture live</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {mode === 'webcam' && webcamActive && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border-2 border-cyan-500/30 bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-48 rounded-[50%] border-2 border-dashed border-cyan-400/50" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={captureFromWebcam}
              className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition"
            >
              📸 Capture Photo
            </button>
            <button
              onClick={() => { stopWebcam(); setMode('select'); }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-xl">
              <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRegister}
              disabled={uploading || !candidateId}
              className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 disabled:opacity-40 text-white font-bold rounded-xl transition shadow-lg shadow-violet-500/20"
            >
              {uploading ? status || 'Processing...' : '🔐 Register Face'}
            </button>
            <button
              onClick={() => { setPreview(null); setMode('select'); setError(''); }}
              disabled={uploading}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl transition"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          ❌ {error}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-800/50">
        <button
          onClick={onSkip}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Skip face registration (exam will be flagged as unverified)
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
