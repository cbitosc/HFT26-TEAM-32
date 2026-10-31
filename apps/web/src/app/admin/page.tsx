'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface CandidateRecord {
  id: string;
  createdAt?: number;
  completedAt?: number;
  status?: string;
  photoURL?: string;
  faceToken?: string;
  faceVerified?: boolean;
  portfolio?: {
    candidate?: {
      name?: string;
      email?: string;
      phone?: string;
      experienceLevel?: string;
      githubUrl?: string;
      linkedinUrl?: string;
    };
    primaryDomain?: string;
    techStack?: {
      languages?: string[];
      frameworks?: string[];
      databases?: string[];
      tools?: string[];
    };
    projects?: Array<{
      title: string;
      description: string;
      techStack?: string[];
    }>;
    skills?: string[];
  };
  scores?: {
    totalQuestions: number;
    totalCorrect: number;
    percentage: number;
    grade: string;
    phaseScores?: {
      beginner: { correct: number; total: number; percentage: number };
      intermediate: { correct: number; total: number; percentage: number };
      advanced: { correct: number; total: number; percentage: number };
    };
    details?: Array<{
      questionId: number;
      phase: number;
      topic: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      isProjectQuestion: boolean;
    }>;
  };
  totalQuestions?: number;
}

export default function AdminDashboardPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/candidates');
      const data = await res.json();
      if (data.success && Array.isArray(data.candidates)) {
        // Sort newest first
        const sorted = data.candidates.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        setCandidates(sorted);
      } else {
        setError(data.error || 'Failed to fetch candidate records');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const completedCount = candidates.filter((c) => c.status === 'completed' && c.scores).length;
  const avgScore =
    completedCount > 0
      ? Math.round(
          candidates
            .filter((c) => c.scores)
            .reduce((acc, c) => acc + (c.scores?.percentage || 0), 0) / completedCount
        )
      : 0;

  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase();
    const name = c.portfolio?.candidate?.name?.toLowerCase() || '';
    const email = c.portfolio?.candidate?.email?.toLowerCase() || '';
    const domain = c.portfolio?.primaryDomain?.toLowerCase() || '';
    const id = c.id.toLowerCase();
    return name.includes(q) || email.includes(q) || domain.includes(q) || id.includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                PROCTOR-FORGE <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">ADMIN PANEL</span>
              </h1>
              <p className="text-xs text-slate-400">Firebase Realtime DB: cybercbit-default-rtdb</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCandidates}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
            >
              🔄 Refresh
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 transition flex items-center gap-1.5"
            >
              <span>+</span> New Assessment
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-6 flex-1 flex flex-col gap-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Portfolios Uploaded</span>
            <div className="text-3xl font-black text-white mt-1">{candidates.length}</div>
            <p className="text-xs text-slate-400 mt-1">Processed by AI</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assessments Completed</span>
            <div className="text-3xl font-black text-emerald-400 mt-1">{completedCount}</div>
            <p className="text-xs text-slate-400 mt-1">Graded deterministically</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Candidate Score</span>
            <div className="text-3xl font-black text-cyan-400 mt-1">{avgScore}%</div>
            <p className="text-xs text-slate-400 mt-1">Across 3 assessment phases</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Engine Status</span>
            <div className="text-base font-bold text-violet-400 mt-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Featherless (DeepSeek-V4-Pro)
            </div>
            <p className="text-xs text-slate-400 mt-1">25 Credits Active</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search by name, email, domain or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-white">{filteredCandidates.length}</span> of {candidates.length} candidates
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center text-slate-400">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading candidates from Firebase...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-400">
              <p className="font-semibold mb-2">Error connecting to Firebase:</p>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                onClick={fetchCandidates}
                className="mt-4 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-base font-semibold text-slate-300 mb-1">No candidate records yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Upload a portfolio on the home page to run an assessment and see marks appear here live.
              </p>
              <Link
                href="/"
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition"
              >
                Upload First Portfolio
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">Candidate</th>
                    <th className="py-4 px-6">Domain / Stack</th>
                    <th className="py-4 px-6 text-center">Phase 1 (Beg.)</th>
                    <th className="py-4 px-6 text-center">Phase 2 (Int.)</th>
                    <th className="py-4 px-6 text-center">Phase 3 (Adv.)</th>
                    <th className="py-4 px-6 text-center">Total Score</th>
                    <th className="py-4 px-6 text-center">Grade</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCandidates.map((cand) => {
                    const candidateInfo = cand.portfolio?.candidate;
                    const name = candidateInfo?.name || 'Unnamed Candidate';
                    const email = candidateInfo?.email || 'No email provided';
                    const domain = cand.portfolio?.primaryDomain || 'General';
                    const languages = cand.portfolio?.techStack?.languages?.slice(0, 3).join(', ') || 'N/A';
                    const scores = cand.scores;
                    const isCompleted = cand.status === 'completed' && scores;

                    return (
                      <tr key={cand.id} className="hover:bg-slate-800/30 transition">
                        {/* Candidate */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {cand.photoURL ? (
                              <img
                                src={cand.photoURL}
                                alt={name}
                                className="w-10 h-10 rounded-full object-cover border border-violet-500/40 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                                👤
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{name}</span>
                                {cand.faceVerified ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    ✓ Face Verified
                                  </span>
                                ) : cand.faceToken ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    📷 Face Stored
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">{email}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {cand.id.slice(0, 18)}...</div>
                            </div>
                          </div>
                        </td>

                        {/* Domain / Stack */}
                        <td className="py-4 px-6">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1">
                            {domain.toUpperCase()}
                          </span>
                          <div className="text-xs text-slate-400 truncate max-w-xs">{languages}</div>
                        </td>

                        {/* Phase 1 */}
                        <td className="py-4 px-6 text-center">
                          {isCompleted && scores?.phaseScores?.beginner ? (
                            <div className="font-mono text-xs">
                              <span className="font-bold text-emerald-400">
                                {scores.phaseScores.beginner.correct}
                              </span>
                              <span className="text-slate-500">/{scores.phaseScores.beginner.total}</span>
                              <div className="text-[10px] text-slate-400">
                                {scores.phaseScores.beginner.percentage}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* Phase 2 */}
                        <td className="py-4 px-6 text-center">
                          {isCompleted && scores?.phaseScores?.intermediate ? (
                            <div className="font-mono text-xs">
                              <span className="font-bold text-cyan-400">
                                {scores.phaseScores.intermediate.correct}
                              </span>
                              <span className="text-slate-500">/{scores.phaseScores.intermediate.total}</span>
                              <div className="text-[10px] text-slate-400">
                                {scores.phaseScores.intermediate.percentage}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* Phase 3 */}
                        <td className="py-4 px-6 text-center">
                          {isCompleted && scores?.phaseScores?.advanced ? (
                            <div className="font-mono text-xs">
                              <span className="font-bold text-violet-400">
                                {scores.phaseScores.advanced.correct}
                              </span>
                              <span className="text-slate-500">/{scores.phaseScores.advanced.total}</span>
                              <div className="text-[10px] text-slate-400">
                                {scores.phaseScores.advanced.percentage}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* Total Score */}
                        <td className="py-4 px-6 text-center">
                          {isCompleted ? (
                            <div>
                              <div className="text-base font-bold text-white font-mono">
                                {scores.totalCorrect}{' '}
                                <span className="text-xs text-slate-500">/ {scores.totalQuestions}</span>
                              </div>
                              <div className="text-xs text-cyan-400 font-semibold">{scores.percentage}%</div>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pending Exam
                            </span>
                          )}
                        </td>

                        {/* Grade */}
                        <td className="py-4 px-6 text-center">
                          {isCompleted ? (
                            <span
                              className={`inline-block px-3 py-1 rounded-xl font-mono font-black text-sm ${
                                scores.grade.startsWith('A')
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : scores.grade === 'B'
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : scores.grade === 'C'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {scores.grade}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setSelectedCandidate(cand)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          >
                            Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
            <button
              onClick={() => setSelectedCandidate(null)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm transition"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedCandidate.portfolio?.candidate?.name || 'Candidate Details'}
            </h2>
            <p className="text-xs text-slate-400 font-mono mb-6">
              ID: {selectedCandidate.id} | Email: {selectedCandidate.portfolio?.candidate?.email || 'N/A'}
            </p>

            {/* Performance Summary */}
            {selectedCandidate.scores ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 p-4 rounded-2xl text-center border border-slate-700/60">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Total Correct</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">
                      {selectedCandidate.scores.totalCorrect} / {selectedCandidate.scores.totalQuestions}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl text-center border border-slate-700/60">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Percentage</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                      {selectedCandidate.scores.percentage}%
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl text-center border border-slate-700/60">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Grade</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                      {selectedCandidate.scores.grade}
                    </div>
                  </div>
                </div>

                {/* Portfolio Projects Scanned */}
                {selectedCandidate.portfolio?.projects && selectedCandidate.portfolio.projects.length > 0 && (
                  <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                      Projects Extracted & Tested
                    </h3>
                    <div className="space-y-2">
                      {selectedCandidate.portfolio.projects.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                          <span className="font-bold text-white">{p.title}</span>
                          <p className="text-slate-400 mt-0.5">{p.description}</p>
                          {p.techStack && (
                            <span className="text-[10px] text-cyan-400 font-mono mt-1 block">
                              Stack: {p.techStack.join(', ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Breakdown List */}
                {selectedCandidate.scores.details && selectedCandidate.scores.details.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                      Question Response Log ({selectedCandidate.scores.details.length} Items)
                    </h3>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
                      {selectedCandidate.scores.details.map((d, i) => (
                        <div
                          key={i}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            d.isCorrect
                              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                              : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                          }`}
                        >
                          <div>
                            <span className="font-bold">Q{d.questionId}</span> ({d.topic})
                            {d.isProjectQuestion && <span className="ml-1 text-amber-400">★ Project Q</span>}
                          </div>
                          <div className="flex gap-3">
                            <span>Ans: <strong>{d.userAnswer}</strong></span>
                            <span>Key: <strong>{d.correctAnswer}</strong></span>
                            <span>{d.isCorrect ? '✅' : '❌'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-800/30 rounded-2xl">
                <p className="font-medium text-slate-300">Exam not yet submitted</p>
                <p className="text-xs text-slate-500 mt-1">Candidate has questions generated but hasn&apos;t finished the assessment.</p>
                <Link
                  href={`/exam/${selectedCandidate.id}`}
                  className="mt-4 inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold"
                >
                  Open Exam View →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

