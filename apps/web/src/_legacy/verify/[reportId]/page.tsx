'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, CheckCircle2, XCircle, Lock, Hash, Calendar, Award } from 'lucide-react';
import { ComprehensiveReport } from '@proctor-forge/shared';

export default function PublicVerifyPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ComprehensiveReport | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verify() {
      try {
        const resp = await fetch(`/api/report/${reportId}`);
        const data = await resp.json();
        if (data.success) {
          setReport(data.report);
          setIsVerified(data.cryptographicallyVerified);
        }
      } catch (e) {
        console.error('Verification query failed:', e);
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-slate-400 text-sm">
        Verifying Cryptographic Digital Signature...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-16 px-6 text-slate-100 flex flex-col items-center">
      <div className="max-w-2xl w-full p-8 rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            PF
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Proctor-Forge Credential Verifier</h1>
            <p className="text-xs text-slate-400">Cryptographic audit & public verification registry</p>
          </div>
        </div>

        {report && isVerified ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-cyber-green/10 border border-cyber-green/30 flex items-center space-x-3 text-cyber-green">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Verified Authentic Assessment</div>
                <div className="text-xs text-cyber-green/80">Digital signature matches server authority key. Hash chain intact.</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-background border border-border">
                <div className="text-slate-400">Candidate Name</div>
                <div className="font-bold text-white text-sm mt-0.5">{report.candidate.name}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-background border border-border">
                <div className="text-slate-400">Final Evaluated Score</div>
                <div className="font-bold text-white text-sm mt-0.5">{report.finalScore} / 100 ({report.outcomeBand})</div>
              </div>

              <div className="p-3.5 rounded-lg bg-background border border-border">
                <div className="text-slate-400">Technical Domain</div>
                <div className="font-bold text-white uppercase text-sm mt-0.5">{report.candidate.domain}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-background border border-border">
                <div className="text-slate-400">Grading Engine Version</div>
                <div className="font-bold text-white font-mono text-sm mt-0.5">v{report.gradingVersion}</div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background border border-border text-xs font-mono break-all space-y-2">
              <div className="text-slate-400 flex items-center space-x-1 font-sans font-semibold">
                <Hash className="w-3.5 h-3.5" />
                <span>HMAC-SHA256 Digital Signature:</span>
              </div>
              <div className="text-blue-400 text-[11px]">{report.signature}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-cyber-red/10 border border-cyber-red/30 flex items-center space-x-3 text-cyber-red">
            <XCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <div className="font-bold text-sm">Signature Verification Failed</div>
              <div className="text-xs text-cyber-red/80">This report payload has been modified or was not issued by Proctor-Forge.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

