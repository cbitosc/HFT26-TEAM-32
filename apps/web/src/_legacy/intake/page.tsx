'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SAMPLE_PORTFOLIOS, parseAndValidatePortfolio } from '@proctor-forge/shared';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Shield } from 'lucide-react';

export default function PortfolioIntakePage() {
  const router = useRouter();
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(SAMPLE_PORTFOLIOS.web_fullstack_ts, null, 2)
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoadSample = (key: string) => {
    const sample = SAMPLE_PORTFOLIOS[key];
    if (sample) {
      setJsonInput(JSON.stringify(sample, null, 2));
      setValidationErrors([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setValidationErrors(['Portfolio JSON file exceeds maximum allowed size of 200KB']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      const res = parseAndValidatePortfolio(content);
      if (!res.success) {
        setValidationErrors(res.errors);
      } else {
        setValidationErrors([]);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    const res = parseAndValidatePortfolio(jsonInput);
    if (!res.success) {
      setValidationErrors(res.errors);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      const resp = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonInput
      });

      const data = await resp.json();
      if (data.success && data.assessmentId) {
        router.push(`/exam/${data.assessmentId}`);
      } else {
        setValidationErrors(data.errors || [data.error || 'Failed to start assessment pipeline']);
      }
    } catch (err: any) {
      setValidationErrors([`Submission error: ${err.message}`]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 1: Portfolio Intake & Profile Calibration</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Upload Candidate Portfolio JSON
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Proctor-Forge analyzes your tech stack and claimed DSA topics to generate a tailored 3-tier assessment with isolated sandboxes.
          </p>
        </div>

        {/* PII Notice Box */}
        <div className="mb-6 p-4 rounded-lg bg-card border border-blue-500/20 flex items-start space-x-3 text-xs text-slate-300">
          <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Privacy & Fairness Assurance: </span>
            Candidate personal information (name, email, githubUrl) is strictly redacted before sending prompts to LLM models. Only technical domains, projects, and skills are used for scenario grounding.
          </div>
        </div>

        {/* Sample Portfolios Quick-Load Bar */}
        <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-3">
            Load Pre-Configured Sample Portfolio:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleLoadSample('web_fullstack_ts')}
              className="text-xs text-left px-3 py-2 rounded-lg bg-background border border-border hover:border-blue-500/50 hover:bg-slate-800 transition text-slate-300 font-medium"
            >
              🌐 Web: Fullstack TS (Mid)
            </button>
            <button
              onClick={() => handleLoadSample('backend_python_fastapi')}
              className="text-xs text-left px-3 py-2 rounded-lg bg-background border border-border hover:border-blue-500/50 hover:bg-slate-800 transition text-slate-300 font-medium"
            >
              ⚙️ Backend: Python (Senior)
            </button>
            <button
              onClick={() => handleLoadSample('ml_engineer_nlp')}
              className="text-xs text-left px-3 py-2 rounded-lg bg-background border border-border hover:border-blue-500/50 hover:bg-slate-800 transition text-slate-300 font-medium"
            >
              🧠 ML: Data & Models (Senior)
            </button>
            <button
              onClick={() => handleLoadSample('security_appsec_analyst')}
              className="text-xs text-left px-3 py-2 rounded-lg bg-background border border-border hover:border-blue-500/50 hover:bg-slate-800 transition text-slate-300 font-medium"
            >
              🛡️ Security: AppSec (Mid)
            </button>
          </div>
        </div>

        {/* Editor & File Upload */}
        <div className="grid grid-cols-1 gap-6">
          <div className="rounded-xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                JSON Portfolio Specification
              </label>
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1.5 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .json File</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setValidationErrors([]);
              }}
              rows={18}
              className="w-full font-mono text-xs p-4 rounded-lg bg-background border border-border focus:border-blue-500 focus:outline-none text-slate-200 leading-relaxed resize-y"
              placeholder="Paste your JSON portfolio here..."
            />

            {/* Validation Errors Display */}
            {validationErrors.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
                <div className="flex items-center space-x-2 font-bold mb-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Validation Errors Detected:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-slate-500">
                Max file size: 200KB &bull; Strict Zod schema verification &bull; Prototype pollution defense
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Validating & Generating...' : 'Generate Validated Assessment'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

