'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Clock,
  Sparkles,
  Cpu,
  BarChart3,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { ComprehensiveReport } from '@proctor-forge/shared';

export default function CandidateReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<ComprehensiveReport | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch(`/api/report/${reportId}`);
        const data = await res.json();
        if (data.success && data.report) {
          setReport(data.report);
          setIsVerified(data.cryptographicallyVerified);
        }
      } catch (e) {
        console.error('Failed to load report:', e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-slate-400 text-sm">
        <Sparkles className="w-5 h-5 animate-spin mr-2 text-blue-500" />
        <span>Loading Tamper-Evident Report...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Report Not Found</h2>
        <p className="text-slate-400 text-sm mb-4">No report matched ID: {reportId}</p>
        <Link href="/" className="px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold">
          Return Home
        </Link>
      </div>
    );
  }

  const outcomeColors = {
    'Strong Hire': 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',
    'Hire': 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    'Borderline': 'text-cyber-amber border-cyber-amber/40 bg-cyber-amber/10',
    'Not yet': 'text-cyber-red border-cyber-red/40 bg-cyber-red/10'
  };

  return (
    <div className="min-h-screen bg-background py-10 px-6 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
              <span>PROCTOR-FORGE REPORT</span>
              <span>&bull;</span>
              <span className="font-mono">Grading Engine v{report.gradingVersion}</span>
              <span>&bull;</span>
              <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {report.candidate.name}
            </h1>
            <div className="text-xs text-slate-400 mt-1">
              {report.candidate.domain.toUpperCase()} Domain Assessment &bull; {report.candidate.experienceLevel.toUpperCase()} Calibration
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs">
              <ShieldCheck className={`w-4 h-4 ${isVerified ? 'text-cyber-green' : 'text-red-400'}`} />
              <span className="font-medium">{isVerified ? 'Cryptographically Signed' : 'Signature Unverified'}</span>
            </div>
            <Link
              href={`/verify/${report.id}`}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600/30"
            >
              <span>Public Verify Page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Final Composite Score */}
          <div className="p-5 rounded-xl bg-card border border-border relative overflow-hidden">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Overall Score</span>
              <button onClick={() => setShowFormulaModal(true)} title="Explain how this was calculated">
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            </div>
            <div className="text-4xl font-black text-white">{report.finalScore} <span className="text-sm font-normal text-slate-400">/ 100</span></div>
            <div className={`mt-3 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${outcomeColors[report.outcomeBand]}`}>
              {report.outcomeBand}
            </div>
          </div>

          {/* Correctness Portion (80%) */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Code Correctness (80%)
            </div>
            <div className="text-3xl font-bold text-white">{report.scoreComposition.correctnessPortion} <span className="text-sm font-normal text-slate-400">/ 80</span></div>
            <div className="text-xs text-slate-500 mt-2">
              Time bonus: +{report.scoreComposition.timeBonusPortion} pts
            </div>
          </div>

          {/* AI Usage Efficiency (20%) */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              AI Efficiency (20%)
            </div>
            <div className="text-3xl font-bold text-cyber-blue">{report.scoreComposition.aiEfficiencyPortion} <span className="text-sm font-normal text-slate-400">/ 20</span></div>
            <div className="text-xs text-slate-500 mt-2">
              {report.aiEfficiency.appliedIndependenceRule ? 'Independence Rule (85%)' : 'Interaction Logs Scored'}
            </div>
          </div>

          {/* Integrity Risk Index */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Integrity Risk
            </div>
            <div className={`text-3xl font-bold ${report.integrityRiskIndex.riskBand === 'LOW' ? 'text-cyber-green' : report.integrityRiskIndex.riskBand === 'MEDIUM' ? 'text-cyber-amber' : 'text-cyber-red'}`}>
              {report.integrityRiskIndex.riskBand}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Risk Score: {report.integrityRiskIndex.totalScore} / 100 &bull; Chain {report.integrityRiskIndex.hashChainValid ? 'Intact' : 'Broken'}
            </div>
          </div>
        </div>

        {/* Task-by-Task Performance Table */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-base font-bold text-white mb-4">Task-Wise Performance Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-3">Tier</th>
                  <th className="pb-3">Task Title</th>
                  <th className="pb-3">DSA Topics</th>
                  <th className="pb-3">Tests Passed</th>
                  <th className="pb-3">Pass Rate</th>
                  <th className="pb-3">Mutation Kill Rate</th>
                  <th className="pb-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-slate-300">
                {report.taskReports.map((t) => (
                  <tr key={t.taskId} className="hover:bg-slate-800/20">
                    <td className="py-3 font-semibold uppercase text-blue-400">{t.tier}</td>
                    <td className="py-3 font-medium text-white">{t.title}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.dsaTopics.map((top) => (
                          <span key={top} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
                            {top}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      {t.visibleTestsPassed + t.hiddenTestsPassed} / {t.totalVisibleTests + t.totalHiddenTests}
                    </td>
                    <td className="py-3 font-semibold text-white">{Math.round(t.passRatePercent)}%</td>
                    <td className="py-3 text-slate-400">
                      {Math.round(t.validationSummary.mutationKillRate * 100)}%
                    </td>
                    <td className="py-3 text-right font-bold text-white">{t.finalTaskScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Claim Verification Index (CVI) Radar/List */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Claim Verification Index (CVI)</h2>
            <span className="text-xs text-slate-400">Cross-referenced against portfolio claims</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.claimVerificationIndex.map((c, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-background border border-border flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{c.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      c.demonstratedStatus === 'Verified'
                        ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30'
                        : c.demonstratedStatus === 'Partially Verified'
                        ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {c.demonstratedStatus}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Claimed: {c.claimedLevel}</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">{c.evidence}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Efficiency Breakdown */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-base font-bold text-white mb-2">AI Usage Efficiency Evidence (20 Pts)</h2>
          <div className="text-xs text-slate-400 mb-4">
            Computed deterministically from candidate interaction and testing rhythm logs.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-background border border-border text-center">
              <div className="text-xs text-slate-400">Progress/Hint</div>
              <div className="text-lg font-bold text-white">{report.aiEfficiency.progressPerHintScore}%</div>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border text-center">
              <div className="text-xs text-slate-400">Testing Rhythm</div>
              <div className="text-lg font-bold text-white">{report.aiEfficiency.testingRhythmScore}%</div>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border text-center">
              <div className="text-xs text-slate-400">Independence</div>
              <div className="text-lg font-bold text-white">{report.aiEfficiency.independenceScore}%</div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <div className="text-xs font-bold uppercase text-slate-400 mb-1">Interaction Evidence Log:</div>
            {report.aiEfficiency.evidenceRows.map((row, idx) => (
              <div key={idx} className="text-xs text-slate-300 font-mono bg-background/50 p-2 rounded">
                &bull; {row}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formula Modal ("How was this computed?") */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">How Scores Are Deterministically Computed</h3>
            <div className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <p>
                <strong>Final Score = 80% &times; Correctness + 20% &times; AI Efficiency + Time Bonus</strong>
              </p>
              <p>
                <strong>Correctness Portion:</strong> Novice tasks contribute 20%, Adept tasks contribute 35%, and Master tasks contribute 45%. Test weights are divided into categories: Correctness 60%, Edge 15%, Performance 15%, Security 10%.
              </p>
              <p>
                <strong>AI Usage Efficiency:</strong> Progress-per-hint (35%), testing cadence (25%), independence before asking (15%), hint discipline (10%), integrity hygiene (10%), hint economy (5%).
              </p>
              <p>
                <strong>No LLM Scoring:</strong> An LLM is strictly forbidden from assigning points.
              </p>
            </div>
            <button
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2 rounded bg-blue-600 text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

