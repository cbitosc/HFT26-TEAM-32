'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ArrowLeft
} from 'lucide-react';

interface TimelineStep {
  index: number;
  timeFormatted: string;
  type: 'edit' | 'test_run' | 'hint' | 'integrity_anomaly';
  title: string;
  description: string;
  codeSnapshot: string;
}

const MOCK_REPLAY_STEPS: TimelineStep[] = [
  {
    index: 0,
    timeFormatted: '00:00',
    type: 'edit',
    title: 'Initial Starter Code Loaded',
    description: 'Candidate inspected task requirements and file tree.',
    codeSnapshot: `function parseAndCleanTags(rawInput) {\n  // BUG: Does not handle empty tags and case deduplication properly\n  if (!rawInput) return [];\n  return rawInput.split(',');\n}`
  },
  {
    index: 1,
    timeFormatted: '03:15',
    type: 'test_run',
    title: 'First Test Run (1 Passed, 3 Failed)',
    description: 'Basic split passed, but casing and deduplication failed.',
    codeSnapshot: `function parseAndCleanTags(rawInput) {\n  if (!rawInput) return [];\n  return rawInput.split(',').map(s => s.trim().toLowerCase());\n}`
  },
  {
    index: 2,
    timeFormatted: '06:40',
    type: 'hint',
    title: 'Hint Unlocked (Level 1)',
    description: 'Candidate requested conceptual hint: Set data structure guidance.',
    codeSnapshot: `function parseAndCleanTags(rawInput) {\n  if (!rawInput) return [];\n  return rawInput.split(',').map(s => s.trim().toLowerCase());\n}`
  },
  {
    index: 3,
    timeFormatted: '09:20',
    type: 'edit',
    title: 'Breakthrough: Set Deduplication Added',
    description: 'Candidate refactored tag parser using Set and filter.',
    codeSnapshot: `function parseAndCleanTags(rawInput) {\n  if (!rawInput || typeof rawInput !== 'string') return [];\n  const parts = rawInput.split(',');\n  const seen = new Set();\n  const result = [];\n  for (const part of parts) {\n    const cleaned = part.trim().toLowerCase();\n    if (cleaned.length > 0 && !seen.has(cleaned)) {\n      seen.add(cleaned);\n      result.push(cleaned);\n    }\n  }\n  return result;\n}`
  },
  {
    index: 4,
    timeFormatted: '11:05',
    type: 'test_run',
    title: 'Key Moment: All 4 Tests Passed (100%)',
    description: 'Visible and hidden test assertions fully satisfied.',
    codeSnapshot: `function parseAndCleanTags(rawInput) {\n  if (!rawInput || typeof rawInput !== 'string') return [];\n  const parts = rawInput.split(',');\n  const seen = new Set();\n  const result = [];\n  for (const part of parts) {\n    const cleaned = part.trim().toLowerCase();\n    if (cleaned.length > 0 && !seen.has(cleaned)) {\n      seen.add(cleaned);\n      result.push(cleaned);\n    }\n  }\n  return result;\n}`
  }
];

export default function SessionReplayPage() {
  const params = useParams();
  const id = params.id as string;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const step = MOCK_REPLAY_STEPS[currentStepIndex] || MOCK_REPLAY_STEPS[0]!;

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col">
      {/* Top Header */}
      <div className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/recruiter" className="text-slate-400 hover:text-white flex items-center space-x-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Recruiter Portal</span>
          </Link>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Session Replay: {id}</span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="font-mono text-white font-bold">{step.timeFormatted}</span>
        </div>
      </div>

      {/* Main Replay Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Viewer */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] p-4 overflow-hidden border-r border-border">
          <div className="flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>tagParser.js (Snapshot at {step.timeFormatted})</span>
            </div>
          </div>
          <pre className="flex-1 font-mono text-xs text-slate-200 bg-[#141414] p-4 rounded-lg border border-[#2d2d2d] overflow-y-auto leading-relaxed">
            {step.codeSnapshot}
          </pre>
        </div>

        {/* Right: Key Moments & Event Annotation */}
        <div className="w-96 bg-card p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Key Moments Timeline</div>

            <div className="space-y-2">
              {MOCK_REPLAY_STEPS.map((s, idx) => (
                <button
                  key={s.index}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition text-xs flex flex-col space-y-1 ${
                    currentStepIndex === idx
                      ? 'bg-blue-600/20 border-blue-500/50 text-white'
                      : 'bg-background border-border text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{s.title}</span>
                    <span className="font-mono text-[10px] text-blue-400">{s.timeFormatted}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Scrubber Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
              disabled={currentStepIndex === 0}
              className="p-2 rounded bg-background border border-border text-slate-300 disabled:opacity-40"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase flex items-center space-x-1.5"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              onClick={() => setCurrentStepIndex((i) => Math.min(MOCK_REPLAY_STEPS.length - 1, i + 1))}
              disabled={currentStepIndex === MOCK_REPLAY_STEPS.length - 1}
              className="p-2 rounded bg-background border border-border text-slate-300 disabled:opacity-40"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

