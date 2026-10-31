'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TierChallenge, CodeFile } from '@/lib/challenges/task-factory';
import { CandidateDsaBoundaries } from '@/lib/profiling/dsa-mapper';
import FaceVerificationGate from './FaceVerificationGate';

// Dynamically load Monaco Editor
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400 font-mono text-xs">
      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-2" />
      Initializing Monaco IDE...
    </div>
  ),
});

interface MCQQuestion {
  id: number;
  phase: number;
  difficulty: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer?: string;
  topic?: string;
  isProjectQuestion?: boolean;
}

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AssessmentWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState('Candidate');
  const [dsaBoundaries, setDsaBoundaries] = useState<CandidateDsaBoundaries | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);

  // Active view: Phase 1 (MCQs), Phase 2 (IDE Adept), Phase 3 (IDE Master)
  const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);

  // Phase 1: MCQ State
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});

  // Phase 2 & 3: Coding Challenges State
  const [challenges, setChallenges] = useState<TierChallenge[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, Record<string, string>>>({});
  const [activeFile, setActiveFile] = useState<string>('rateLimiter.js');

  // Test Runner State
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'tests' | 'console'>('tests');
  const [challengeScores, setChallengeScores] = useState<Record<string, { passedTests: number; totalTests: number }>>({});

  // Guarded AI Assistant State
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  // Timer & Submission
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalReport, setFinalReport] = useState<any>(null);

  // 1. Load Assessment Data
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('assessmentData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.questions || parsed.challenges) {
          setQuestions(parsed.questions || []);
          setChallenges(parsed.challenges || []);
          setDsaBoundaries(parsed.dsaBoundaries);
          if (parsed.portfolio?.candidate?.name) {
            setCandidateName(parsed.portfolio.candidate.name);
          }
          if (parsed.photoURL) {
            setStoredPhotoUrl(parsed.photoURL);
          }
          if (parsed.faceVerified) {
            setFaceVerified(true);
          }

          // Initialize file contents
          const filesMap: Record<string, Record<string, string>> = {};
          for (const ch of parsed.challenges || []) {
            filesMap[ch.id] = {};
            for (const f of ch.files) {
              filesMap[ch.id][f.path] = f.content;
            }
          }
          setFileContents(filesMap);
          if (parsed.challenges?.[0]?.files?.[0]) {
            setActiveFile(parsed.challenges[0].files[0].path);
          }
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Session parse error:', e);
    }

    // Fallback: load from Firebase
    fetch('/api/admin/candidates')
      .then((res) => res.json())
      .then((data) => {
        const cand = data.candidates?.find((c: any) => c.id === candidateId);
        if (cand) {
          if (cand.questions) setQuestions(cand.questions);
          if (cand.challenges) setChallenges(cand.challenges);
          if (cand.dsaBoundaries) setDsaBoundaries(cand.dsaBoundaries);
          if (cand.portfolio?.candidate?.name) setCandidateName(cand.portfolio.candidate.name);
          if (cand.photoURL) setStoredPhotoUrl(cand.photoURL);
          if (cand.faceVerified) setFaceVerified(true);

          const filesMap: Record<string, Record<string, string>> = {};
          for (const ch of cand.challenges || []) {
            filesMap[ch.id] = {};
            for (const f of ch.files) {
              filesMap[ch.id][f.path] = f.content;
            }
          }
          setFileContents(filesMap);
          if (cand.challenges?.[0]?.files?.[0]) {
            setActiveFile(cand.challenges[0].files[0].path);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [candidateId]);

  // Timer countdown
  useEffect(() => {
    if (submitted || loading) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, loading]);

  // Current active coding challenge for Phase 2 (Adept) or Phase 3 (Master)
  const currentChallenge = activePhase === 2
    ? (challenges.find((c) => c.tier === 'adept') || challenges[0])
    : (challenges.find((c) => c.tier === 'master') || challenges[1] || challenges[0]);

  // Handle phase change
  const handlePhaseSelect = (phase: 1 | 2 | 3) => {
    setActivePhase(phase);
    setTestResults(null);
    if (phase !== 1) {
      const targetCh = phase === 2
        ? (challenges.find((c) => c.tier === 'adept') || challenges[0])
        : (challenges.find((c) => c.tier === 'master') || challenges[1] || challenges[0]);
      if (targetCh && targetCh.files.length > 0) {
        setActiveFile(targetCh.files[0].path);
      }
    }
  };

  // MCQ Selection handler
  const handleSelectOption = (optKey: string) => {
    const q = questions[currentMcqIndex];
    if (!q || submitted) return;
    setMcqAnswers((prev) => ({
      ...prev,
      [String(q.id)]: optKey,
    }));
  };

  // Code editor change handler
  const handleCodeChange = (newCode: string | undefined) => {
    if (!currentChallenge || newCode === undefined) return;
    setFileContents((prev) => ({
      ...prev,
      [currentChallenge.id]: {
        ...(prev[currentChallenge.id] || {}),
        [activeFile]: newCode,
      },
    }));
  };

  // Run tests in sandboxed VM
  const handleRunTests = async () => {
    if (!currentChallenge || runningTests) return;
    setRunningTests(true);

    const activeFiles = currentChallenge.files.map((f) => ({
      path: f.path,
      content: fileContents[currentChallenge.id]?.[f.path] || f.content,
    }));

    try {
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: currentChallenge.tier,
          files: activeFiles,
          testCases: currentChallenge.tests,
        }),
      });
      const data = await res.json();
      setTestResults(data);
      if (data.success) {
        setChallengeScores((prev) => ({
          ...prev,
          [currentChallenge.id]: {
            passedTests: data.passedTests || 0,
            totalTests: data.totalTests || currentChallenge.tests?.length || 4,
          },
        }));
      }
    } catch (err: any) {
      setTestResults({
        success: false,
        compilationError: err.message,
        testResults: [],
      });
    } finally {
      setRunningTests(false);
    }
  };

  // Guarded AI Assistant
  const handleAskAssistant = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!assistantInput.trim() || assistantLoading || !currentChallenge?.aiAssistantAllowed) return;

    const userMsg = assistantInput.trim();
    setAssistantInput('');
    setAssistantLoading(true);
    setHintCount((c) => c + 1);

    const updatedLogs: AssistantMessage[] = [
      ...assistantMessages,
      { role: 'user', content: userMsg, timestamp: new Date().toLocaleTimeString() },
    ];
    setAssistantMessages(updatedLogs);

    try {
      const curCode = fileContents[currentChallenge.id]?.[activeFile] || '';
      const lastErr = testResults?.compilationError || '';

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          tier: currentChallenge.tier,
          userMessage: userMsg,
          codeSnippet: curCode,
          compilationError: lastErr,
        }),
      });

      const data = await res.json();
      setAssistantMessages([
        ...updatedLogs,
        {
          role: 'assistant',
          content: data.reply || 'Verify boundary handling and ensure variables are properly scoped.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      setAssistantMessages([
        ...updatedLogs,
        {
          role: 'assistant',
          content: 'Examine your loop termination conditions and verify state transitions.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  // Helper to dynamically evaluate challenge tests on submit
  const evaluateChallengeTests = async (ch: TierChallenge): Promise<{ passedTests: number; totalTests: number }> => {
    try {
      const activeFiles = ch.files.map((f) => ({
        path: f.path,
        content: fileContents[ch.id]?.[f.path] || f.content,
      }));
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: ch.tier,
          files: activeFiles,
          testCases: ch.tests,
        }),
      });
      const data = await res.json();
      return {
        passedTests: data.passedTests || 0,
        totalTests: data.totalTests || ch.tests?.length || 4,
      };
    } catch {
      return { passedTests: 0, totalTests: ch.tests?.length || 4 };
    }
  };

  // Final Assessment Submission & 100% Dynamic User-Answer-Based Grading
  const handleSubmitAssessment = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);

    // 1. Grade Phase 1 MCQs dynamically
    let mcqCorrect = 0;
    for (const q of questions) {
      const userAns = mcqAnswers[String(q.id)];
      if (userAns && q.correctAnswer && userAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
        mcqCorrect++;
      }
    }
    const totalMcqs = questions.length || 20;
    const mcqPercentage = totalMcqs > 0 ? Math.round((mcqCorrect / totalMcqs) * 100) : 0;
    // Phase 1 contributes 30 points to the total score
    const mcqPoints = Math.round((mcqCorrect / totalMcqs) * 30);

    // 2. Grade Phase 2 (Adept) and Phase 3 (Master) Coding Challenges dynamically
    const p2Challenge = challenges.find((c) => c.tier === 'adept') || challenges[0];
    const p3Challenge = challenges.find((c) => c.tier === 'master') || challenges[1] || challenges[0];

    let p2Result = challengeScores[p2Challenge?.id];
    let p3Result = challengeScores[p3Challenge?.id];

    // If candidate edited code but didn't click "Run Tests", evaluate now
    if (!p2Result && p2Challenge) {
      p2Result = await evaluateChallengeTests(p2Challenge);
    }
    if (!p3Result && p3Challenge) {
      p3Result = await evaluateChallengeTests(p3Challenge);
    }

    const p2Passed = p2Result?.passedTests || 0;
    const p2Total = p2Result?.totalTests || 4;
    const p3Passed = p3Result?.passedTests || 0;
    const p3Total = p3Result?.totalTests || 4;

    // Phase 2 Adept is worth 25 points; Phase 3 Master is worth 25 points (Total 50 points)
    const phase2Score = Math.round((p2Passed / p2Total) * 25);
    const phase3Score = Math.round((p3Passed / p3Total) * 25);
    const totalCodingScore = phase2Score + phase3Score;

    // AI Efficiency: starts at 20 points, decreases if candidate asked multiple hints
    const aiEfficiency = Math.max(0, 20 - (hintCount * 3));

    // Dynamic Total Score strictly calculated from the candidate's actual performance
    const totalScore = Math.min(100, mcqPoints + totalCodingScore + aiEfficiency);

    const report = {
      candidateName,
      candidateId,
      totalScore,
      mcqResult: `${mcqCorrect} / ${totalMcqs} (${mcqPercentage}%)`,
      codingCorrectness: `${totalCodingScore} / 50 (${p2Passed + p3Passed}/${p2Total + p3Total} tests)`,
      dsaPerformance: `${Math.round((p3Passed / p3Total) * 30)} / 30`,
      aiEfficiency: `${aiEfficiency} / 20`,
      hintsRequested: hintCount,
      timeTakenMinutes: Math.max(1, Math.round((3600 - timeLeft) / 60)),
      dsaBoundaries,
      tierResults: {
        phase1: {
          title: 'Phase 1: MCQs & Project Questions',
          status: `${mcqCorrect}/${totalMcqs} Correct (${mcqPercentage}% - ${mcqPoints}/30 pts)`,
        },
        phase2: {
          title: 'Phase 2: Adept Multi-Step Feature',
          status: `${p2Passed}/${p2Total} tests passed (${phase2Score}/25 pts)`,
        },
        phase3: {
          title: 'Phase 3: Master Performance Engine',
          status: `${p3Passed}/${p3Total} tests passed (${phase3Score}/25 pts)`,
        },
      },
    };

    // Save dynamic scores to Firebase
    try {
      await fetch('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          answers: mcqAnswers,
          report,
        }),
      });
    } catch (e) {
      console.warn('Submit save error:', e);
    }

    setFinalReport(report);
    setSubmitted(true);
    setSubmitting(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Loading Assessment Workspace...</h2>
        <p className="text-slate-400 text-sm mt-2">Setting up Phase 1 MCQs and Phase 2/3 Monaco IDE</p>
      </div>
    );
  }

  // FINAL REPORT VIEW
  if (submitted && finalReport) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-3">
              Assessment Completed & Evaluated
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Candidate Performance & Capability Report</h1>
            <p className="text-slate-400 mt-2">Candidate: {candidateName} | Session: {candidateId}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Score</span>
              <div className="text-4xl font-black text-cyan-400 mt-2">
                {finalReport.totalScore} <span className="text-xl text-slate-500">/ 100</span>
              </div>
              <p className="text-xs text-emerald-400 mt-1">Verified Evaluation</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phase 1: MCQs</span>
              <div className="text-2xl font-black text-white mt-2">{finalReport.mcqResult}</div>
              <p className="text-xs text-slate-400 mt-1">Core & Project Queries</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Coding (50%)</span>
              <div className="text-2xl font-black text-amber-400 mt-2">{finalReport.codingCorrectness}</div>
              <p className="text-xs text-slate-400 mt-1">Monaco IDE Sandbox</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Efficiency (20%)</span>
              <div className="text-2xl font-black text-violet-400 mt-2">{finalReport.aiEfficiency}</div>
              <p className="text-xs text-slate-400 mt-1">{finalReport.hintsRequested} Hints Requested</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/admin')}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-600/30 transition"
            >
              View Admin Dashboard →
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition border border-slate-700"
            >
              Upload New Portfolio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE ASSESSMENT VIEW
  const currentMcq = questions[currentMcqIndex];
  const answeredMcqCount = Object.keys(mcqAnswers).length;

  // FACE VERIFICATION GATE (Blocks access until webcam match >= 80%)
  if (!loading && storedPhotoUrl && !faceVerified) {
    return (
      <FaceVerificationGate
        candidateId={candidateId}
        candidateName={candidateName}
        storedPhotoUrl={storedPhotoUrl}
        onVerified={() => setFaceVerified(true)}
        onSkip={() => setFaceVerified(true)}
      />
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur px-5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center font-bold text-slate-950 text-base">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white leading-none">PROCTOR-FORGE ASSESSMENT</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Candidate: {candidateName}</p>
            </div>
          </div>

          {/* DSA Boundary Pill */}
          {dsaBoundaries && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-400">DSA Scope:</span>
              <span className="font-semibold text-emerald-300 uppercase">
                {dsaBoundaries.claimedTopics.slice(0, 3).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Phase Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/70 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => handlePhaseSelect(1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activePhase === 1 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 1: MCQs ({answeredMcqCount}/20)
          </button>
          <button
            onClick={() => handlePhaseSelect(2)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activePhase === 2 ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 2: Coding (Adept IDE)
          </button>
          <button
            onClick={() => handlePhaseSelect(3)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activePhase === 3 ? 'bg-violet-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 3: Coding (Master IDE)
          </button>
        </div>

        {/* Action Controls & Timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl font-mono text-xs text-cyan-300">
            <span>⏱️</span>
            <span>{formatTime(timeLeft)}</span>
          </div>

          {activePhase !== 1 && (
            <button
              onClick={handleRunTests}
              disabled={runningTests}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              {runningTests ? 'Running...' : '▶ Run Tests'}
            </button>
          )}

          <button
            onClick={handleSubmitAssessment}
            disabled={submitting}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md shadow-rose-600/20"
          >
            {submitting ? 'Submitting...' : 'Finish & Submit'}
          </button>
        </div>
      </header>

      {/* BODY CONTENT: PHASE 1 (MCQs) vs PHASE 2 & 3 (IDE) */}
      {activePhase === 1 ? (
        // ==================== PHASE 1: MCQs VIEW ====================
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-y-auto">
          {/* Left 3 cols: MCQ Question Card */}
          <div className="lg:col-span-3 flex flex-col justify-between">
            {currentMcq ? (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Phase 1: MCQs & Project Review
                    </span>
                    {currentMcq.topic && (
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {currentMcq.topic}
                      </span>
                    )}
                    {currentMcq.isProjectQuestion && (
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        ★ Scanned GitHub Project Question
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Question {currentMcqIndex + 1} of {questions.length}
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-semibold text-white leading-relaxed mb-8">
                  {currentMcq.question}
                </h2>

                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                    const optText = currentMcq.options?.[optKey];
                    const isSelected = mcqAnswers[String(currentMcq.id)] === optKey;

                    return (
                      <div
                        key={optKey}
                        onClick={() => handleSelectOption(optKey)}
                        className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition ${
                            isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {optKey}
                        </div>
                        <span className="text-sm md:text-base pt-0.5 leading-snug">{optText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                Loading questions...
              </div>
            )}

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentMcqIndex((i) => Math.max(0, i - 1))}
                disabled={currentMcqIndex === 0}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-sm font-semibold transition"
              >
                ← Previous
              </button>
              <button
                onClick={() => handlePhaseSelect(2)}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition shadow-md shadow-cyan-600/20"
              >
                Proceed to Phase 2: Coding in IDE →
              </button>
              <button
                onClick={() => setCurrentMcqIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={currentMcqIndex === questions.length - 1}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-sm font-semibold transition"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Right Col: MCQ Palette */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sticky top-20 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Question Palette</h3>
                <span className="text-xs font-mono text-cyan-400">{answeredMcqCount}/20</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentMcqIndex;
                  const isAnswered = mcqAnswers[String(q.id)] !== undefined;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentMcqIndex(idx)}
                      className={`h-9 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center relative ${
                        isCurrent
                          ? 'ring-2 ring-cyan-400 bg-cyan-500 text-slate-950'
                          : isAnswered
                          ? 'bg-emerald-600/80 text-white'
                          : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-600/80" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-cyan-500" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-slate-800" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==================== PHASE 2 & 3: MONACO IDE VIEW ====================
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel: Problem Statement & Guarded AI Assistant (4 cols) */}
          <div className="lg:col-span-4 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
            <div className="border-b border-slate-800 flex items-center px-4 bg-slate-900/60 shrink-0">
              <span className="py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 border-b-2 border-cyan-400 mr-4">
                Problem Description
              </span>
              <span className="py-2.5 text-xs font-medium text-violet-400 flex items-center gap-1">
                🤖 Guarded AI ({hintCount} hints used)
              </span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-5 text-sm">
              <div>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                  activePhase === 2
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                }`}>
                  {activePhase === 2 ? 'Phase 2: Adept (Multi-Step Feature)' : 'Phase 3: Master (Performance Challenge)'}
                </span>
                <h2 className="text-lg font-bold text-white mt-2">{currentChallenge?.title}</h2>
                <p className="text-xs text-cyan-300 font-mono mt-0.5">DSA Domain: {currentChallenge?.dsaTopic}</p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Portfolio Scenario:</span> {currentChallenge?.scenario}
              </div>

              <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-xs leading-relaxed whitespace-pre-line">
                {currentChallenge?.problemStatement}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Constraints</h4>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                  {currentChallenge?.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              {/* Guarded AI Assistant Drawer */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                    🤖 Guarded AI Assistant
                  </h4>
                  <span className="text-[11px] text-slate-400">Hints used: {hintCount}</span>
                </div>

                <div className="space-y-3 max-h-56 overflow-y-auto mb-3 pr-1">
                  {assistantMessages.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                      Ask for conceptual hints, edge-case checks, or debugging strategies. Complete solutions are strictly guarded.
                    </div>
                  ) : (
                    assistantMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-slate-800 text-slate-200 ml-4'
                            : 'bg-violet-950/30 border border-violet-500/20 text-violet-200 mr-4'
                        }`}
                      >
                        <span className="text-[10px] font-bold block opacity-60 mb-1">
                          {msg.role === 'user' ? 'You' : 'Guarded Assistant'} • {msg.timestamp}
                        </span>
                        {msg.content}
                      </div>
                    ))
                  )}
                  {assistantLoading && (
                    <div className="p-3 bg-violet-950/20 rounded-xl text-xs text-violet-300 animate-pulse">
                      Assistant is analyzing your code and drafting guidance...
                    </div>
                  )}
                </div>

                <form onSubmit={handleAskAssistant} className="flex gap-2">
                  <input
                    type="text"
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    placeholder="Ask a hint (e.g. 'Why does my window logic fail?')"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={assistantLoading || !assistantInput.trim()}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Panel: Monaco Editor & Test Results (8 cols) */}
          <div className="lg:col-span-8 flex flex-col overflow-hidden bg-slate-950">
            {/* File Tabs */}
            <div className="h-10 border-b border-slate-800 bg-slate-900/60 flex items-center px-2 gap-1 overflow-x-auto shrink-0">
              {currentChallenge?.files.map((file) => {
                const isSelected = file.path === activeFile;
                return (
                  <button
                    key={file.path}
                    onClick={() => setActiveFile(file.path)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>📄 {file.name}</span>
                    {!file.editable && <span className="text-[10px] text-slate-500 font-sans">(read-only)</span>}
                  </button>
                );
              })}
            </div>

            {/* Monaco Editor Container */}
            <div className="flex-1 min-h-[360px] relative">
              <MonacoEditor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={fileContents[currentChallenge?.id || '']?.[activeFile] || ''}
                onChange={handleCodeChange}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Bottom Panel: Test Runner Results & Output */}
            <div className="h-56 border-t border-slate-800 bg-slate-900/90 flex flex-col shrink-0">
              <div className="h-9 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveBottomTab('tests')}
                    className={`text-xs font-bold uppercase tracking-wider py-2 transition ${
                      activeBottomTab === 'tests' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Test Results {testResults && `(${testResults.passedTests}/${testResults.totalTests} Passed)`}
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('console')}
                    className={`text-xs font-bold uppercase tracking-wider py-2 transition ${
                      activeBottomTab === 'console' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Console Logs
                  </button>
                </div>

                {testResults && (
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                    <span>⏱️ {testResults.executionTimeMs}ms</span>
                    <span>💾 {testResults.memoryUsedKb} KB</span>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                {activeBottomTab === 'tests' ? (
                  <div>
                    {!testResults ? (
                      <div className="text-xs text-slate-500 font-mono py-6 text-center">
                        Click <span className="text-emerald-400 font-bold">"▶ Run Tests"</span> in the top bar to execute test cases against your code.
                      </div>
                    ) : testResults.compilationError ? (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 font-mono text-xs text-rose-300">
                        {testResults.compilationError}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {testResults.testResults?.map((tr: any) => (
                          <div
                            key={tr.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                              tr.passed
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{tr.passed ? '✓' : '✗'}</span>
                              <span className="font-semibold">{tr.name}</span>
                              {tr.isHidden && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">Hidden</span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {tr.passed ? (
                                <span className="text-emerald-400 font-bold">PASS ({tr.executionTimeMs}ms)</span>
                              ) : (
                                <span>Expected: <code className="text-slate-200">{tr.expectedOutput}</code> | Got: <code className="text-rose-300">{tr.actualOutput}</code></span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="font-mono text-xs text-slate-300 space-y-1">
                    {testResults?.consoleOutput && testResults.consoleOutput.length > 0 ? (
                      testResults.consoleOutput.map((line: string, idx: number) => (
                        <div key={idx} className="text-slate-400">&gt; {line}</div>
                      ))
                    ) : (
                      <div className="text-slate-500 italic">No console logs output yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
