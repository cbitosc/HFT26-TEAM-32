'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { extractPhotoFromResumeFile, extractTextFromPdfClient } from '@/lib/face/resume-parser';

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'text' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // Photo State (Supports direct upload, resume auto-extract, or live webcam snapshot)
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'resume' | 'direct_upload' | 'webcam' | null>(null);
  const [photoExtracting, setPhotoExtracting] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);

  // Automatically attempt to extract photo from resume if user hasn't uploaded one directly
  useEffect(() => {
    if (!selectedFile || photoSource === 'direct_upload' || photoSource === 'webcam') {
      return;
    }

    let isCancelled = false;
    async function processResumePhoto() {
      setPhotoExtracting(true);
      try {
        console.log('[Home] Scanning resume for portrait photo:', selectedFile?.name);
        const photoDataUrl = await extractPhotoFromResumeFile(selectedFile!);
        if (!isCancelled && photoDataUrl && photoSource !== 'direct_upload') {
          console.log('[Home] Extracted photo from resume successfully');
          setReferencePhoto(photoDataUrl);
          setPhotoSource('resume');
        }
      } catch (err) {
        console.warn('[Home] Resume photo extraction:', err);
      } finally {
        if (!isCancelled) setPhotoExtracting(false);
      }
    }

    processResumePhoto();
    return () => {
      isCancelled = true;
    };
  }, [selectedFile, photoSource]);

  // Direct Photo Upload Handler
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferencePhoto(reader.result as string);
      setPhotoSource('direct_upload');
      setError('');
    };
    reader.readAsDataURL(file);
  };

  // Webcam Helpers
  const startWebcam = useCallback(async () => {
    try {
      setIsWebcamActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
        setWebcamReady(true);
      }
    } catch {
      setError('Could not access webcam. Please allow camera permissions.');
      setIsWebcamActive(false);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
    setWebcamReady(false);
  }, []);

  const captureWebcamSnapshot = useCallback(() => {
    const video = webcamVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setReferencePhoto(dataUrl);
    setPhotoSource('webcam');
    stopWebcam();
  }, [stopWebcam]);

  async function handleUpload(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setStatus('Preparing portfolio...');

    try {
      const formData = new FormData();

      if (uploadMethod === 'file') {
        const file = selectedFile || fileInputRef.current?.files?.[0];
        if (!file) {
          setError('Please select a resume file (PDF, TXT, DOC)');
          setLoading(false);
          return;
        }
        formData.append('file', file);

        // Pre-extract PDF text in client to guarantee Netlify serverless never fails
        if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
          setStatus('📄 Reading resume text directly in browser...');
          try {
            const clientExtractedText = await extractTextFromPdfClient(file);
            if (clientExtractedText && clientExtractedText.length > 20) {
              console.log('[Home] Client extracted PDF text length:', clientExtractedText.length);
              formData.append('extractedText', clientExtractedText);
            }
          } catch (e) {
            console.warn('[Home] Client PDF extraction notice:', e);
          }
        }
      } else if (uploadMethod === 'text') {
        if (!textInput.trim()) {
          setError('Please paste your resume text');
          setLoading(false);
          return;
        }
        formData.append('text', textInput);
      } else if (uploadMethod === 'url') {
        if (!urlInput.trim()) {
          setError('Please enter a portfolio or resume URL');
          setLoading(false);
          return;
        }
        formData.append('url', urlInput.trim());
      }

      // Attach Reference Photo (from direct upload, resume, or webcam)
      if (referencePhoto) {
        formData.append('photoBase64', referencePhoto);
      }

      // Upload portfolio, store photo in Cloudinary, register with Face++, and generate assessment
      setStatus('🔍 Analyzing resume, storing photo in Cloudinary & generating assessment...');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Failed to parse resume');
      }

      const { candidateId, portfolio, dsaBoundaries, challenges, photoURL, faceToken } = uploadData;

      // Save complete assessment data to session
      sessionStorage.setItem('assessmentData', JSON.stringify({
        candidateId,
        portfolio,
        dsaBoundaries,
        questions: uploadData.questions,
        challenges: uploadData.challenges,
        photoURL: photoURL || referencePhoto,
        faceToken,
        faceVerified: false,
      }));

      setStatus('✅ Assessment Ready! Launching live face verification gate...');

      setTimeout(() => {
        router.push(`/exam/${candidateId}`);
      }, 600);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950">
      {/* ══════════════════════════════════════════════════════════════════════
          BACKGROUND VIDEO IN LOOP (Hero Background with Cyber Palette)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-85 scale-100 filter saturate-125"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260815_034306_165449ef-7d2e-4e81-850f-1939c5cb442d.mp4"
            type="video/mp4"
          />
        </video>
        {/* Transparent Cinematic Vignette — keeping the background video animation vividly visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_45%,_rgba(4,6,18,0.65)_100%)]" />
      </div>

      {/* Top Navbar */}
      <header className="border-b border-cyan-500/20 backdrop-blur-md bg-[#05081c]/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center font-black text-xl text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                  PROCTOR-FORGE
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest">
                  AI Guarded
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Adaptive Assessment Platform with Live Facial Biometrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="text-xs font-semibold text-cyan-300 hover:text-white transition px-4 py-2 rounded-xl border border-cyan-500/30 hover:border-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center gap-1.5"
            >
              <span>Admin Dashboard</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold tracking-wide mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Biometric Identity Verification Gate Enabled</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-3 tracking-tight">
            Candidate Intake &amp;{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Identity Setup
            </span>
          </h2>
          <p className="text-sm md:text-base text-slate-300/90 max-w-xl mx-auto leading-relaxed">
            Upload your resume and provide a reference portrait. When entering the exam, our live webcam gate validates your face against this photo to authorize access.
          </p>
        </div>

        {/* Upload & Biometric Intake Form */}
        <form
          onSubmit={handleUpload}
          className="backdrop-blur-xl bg-[#060a24]/50 border border-cyan-500/30 rounded-3xl p-7 md:p-9 shadow-[0_0_60px_-15px_rgba(6,182,212,0.25)] space-y-7"
        >
          {/* STEP 1: RESUME UPLOAD */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <label className="text-sm font-bold text-white flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 font-black flex items-center justify-center text-xs shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  1
                </span>
                <span>Upload Resume / Portfolio</span>
              </label>
              <div className="flex gap-1 bg-[#040615]/80 p-1 rounded-xl border border-cyan-500/20 text-xs">
                {(['file', 'text', 'url'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setUploadMethod(method);
                      setError('');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg transition-all font-medium ${
                      uploadMethod === method
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {method === 'file' ? 'PDF File' : method === 'text' ? 'Paste Text' : 'Portfolio URL'}
                  </button>
                ))}
              </div>
            </div>

            {uploadMethod === 'file' && (
              <div>
                {selectedFile ? (
                  <div className="border border-cyan-500/40 bg-cyan-500/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-2xl">
                        📄
                      </div>
                      <div>
                        <div className="font-bold text-cyan-300 text-sm">{selectedFile.name}</div>
                        <div className="text-xs text-slate-400">
                          {(selectedFile.size / 1024).toFixed(1)} KB — Ready to analyze
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (photoSource === 'resume') {
                          setReferencePhoto(null);
                          setPhotoSource(null);
                        }
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-slate-400 hover:text-cyan-300 underline px-2 py-1 transition"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-cyan-400 bg-cyan-500/15 scale-[1.01] shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                        : 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/5 bg-[#05081c]/50'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped) {
                        setSelectedFile(dropped);
                        setError('');
                      }
                    }}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-2xl">
                      📁
                    </div>
                    <p className="text-slate-200 font-semibold text-sm mb-1">
                      Click to browse or drag &amp; drop resume
                    </p>
                    <p className="text-xs text-slate-400">PDF, TXT, DOC, JSON supported</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.json,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          setError('');
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {uploadMethod === 'text' && (
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full h-36 bg-[#05081c]/80 border border-cyan-500/30 rounded-2xl p-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-mono text-xs focus:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                placeholder="Paste your resume content, GitHub projects, or experience summary here..."
              />
            )}

            {uploadMethod === 'url' && (
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full bg-[#05081c]/80 border border-cyan-500/30 rounded-2xl p-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs focus:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                placeholder="https://github.com/yourusername or https://your-portfolio.com"
              />
            )}
          </div>

          {/* STEP 2: VERIFICATION PHOTO SELECTION (Direct Upload / Auto-Extract / Webcam) */}
          <div className="pt-4 border-t border-cyan-500/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-white flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white font-black flex items-center justify-center text-xs shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  2
                </span>
                <span>Face Registration for Verification Gate</span>
              </label>
              <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                Cloudinary + Face++
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Upload a clear passport photo or take a live webcam snapshot. If omitted, photo is auto-extracted from resume.
            </p>

            {/* If a photo is already set */}
            {referencePhoto ? (
              <div className="flex items-center justify-between bg-[#05081c]/90 border border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-400 bg-black shrink-0 shadow-lg">
                    <img src={referencePhoto} alt="Candidate reference face" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        {photoSource === 'direct_upload'
                          ? 'Photo Uploaded Directly'
                          : photoSource === 'resume'
                          ? 'Photo Extracted from Resume'
                          : 'Webcam Snapshot Captured'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Ready for Cloudinary storage &amp; Face++ biometric comparison
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition"
                  >
                    Upload Another
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReferencePhoto(null);
                      setPhotoSource(null);
                      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
                    }}
                    className="px-2 py-1.5 text-rose-400 hover:text-rose-300 text-xs transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : isWebcamActive ? (
              /* Live Webcam Snapshot View */
              <div className="p-4 bg-[#05081c] border border-cyan-500/40 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                  <span>📸 Snap a Live Reference Photo</span>
                  <button type="button" onClick={stopWebcam} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 bg-black aspect-video max-h-48">
                  <video
                    ref={webcamVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-28 h-36 rounded-[50%] border-2 border-dashed border-cyan-400/70" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={captureWebcamSnapshot}
                    disabled={!webcamReady}
                    className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  >
                    📸 Capture Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopWebcam}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Selection Buttons when no photo is set */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    className="p-4 rounded-2xl border border-cyan-500/25 bg-[#05081c]/60 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-left flex items-center gap-3.5 group shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                  >
                    <span className="text-2xl group-hover:scale-110 transition">🖼️</span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Upload Photo File</div>
                      <div className="text-[10px] text-slate-400">JPG, PNG passport portrait</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={startWebcam}
                    className="p-4 rounded-2xl border border-purple-500/25 bg-[#05081c]/60 hover:border-purple-400 hover:bg-purple-500/10 transition-all text-left flex items-center gap-3.5 group shadow-[0_0_15px_rgba(168,85,247,0.05)]"
                  >
                    <span className="text-2xl group-hover:scale-110 transition">📷</span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Capture via Webcam</div>
                      <div className="text-[10px] text-slate-400">Take live camera snapshot</div>
                    </div>
                  </button>
                </div>

                {photoExtracting && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400 py-1">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    Scanning uploaded resume for portrait photo...
                  </div>
                )}
              </div>
            )}

            <input
              ref={photoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFileUpload}
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
              <span className="text-base">❌</span>
              <span>{error}</span>
            </div>
          )}

          {loading && status && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-300 text-xs flex items-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
              <span>{status}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-slate-950 font-black rounded-2xl text-sm uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>🎟️</span>
            <span>{loading ? 'Processing Assessment...' : 'Start Assessment with Face Verification'}</span>
          </button>
        </form>

        <canvas ref={canvasRef} className="hidden" />

        {/* Feature Cards with matching cyber glow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="backdrop-blur-xl bg-[#090d29]/60 border border-cyan-500/20 rounded-2xl p-4 text-center hover:border-cyan-400/40 transition">
            <div className="text-2xl mb-1.5">🖼️ / 📄</div>
            <h3 className="font-bold text-cyan-300 text-xs tracking-wide">Multi-Source Portrait</h3>
            <p className="text-[11px] text-slate-400 mt-1">Upload a photo, snap webcam, or auto-extract directly from resume</p>
          </div>
          <div className="backdrop-blur-xl bg-[#090d29]/60 border border-purple-500/20 rounded-2xl p-4 text-center hover:border-purple-400/40 transition">
            <div className="text-2xl mb-1.5">🔐</div>
            <h3 className="font-bold text-purple-300 text-xs tracking-wide">Face++ Verification Gate</h3>
            <p className="text-[11px] text-slate-400 mt-1">Live webcam scan verified against registered face (≥80% threshold)</p>
          </div>
          <div className="backdrop-blur-xl bg-[#090d29]/60 border border-blue-500/20 rounded-2xl p-4 text-center hover:border-blue-400/40 transition">
            <div className="text-2xl mb-1.5">⚡</div>
            <h3 className="font-bold text-blue-300 text-xs tracking-wide">DeepSeek-V4-Pro</h3>
            <p className="text-[11px] text-slate-400 mt-1">Featherless AI powering adaptive MCQs, coding &amp; guarded proctor</p>
          </div>
        </div>
      </main>
    </div>
  );
}
