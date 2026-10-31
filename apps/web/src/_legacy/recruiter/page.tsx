'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  BarChart2,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  ArrowUpDown
} from 'lucide-react';

interface CandidateEntry {
  id: string;
  name: string;
  email: string;
  domain: string;
  score: number;
  outcomeBand: 'Strong Hire' | 'Hire' | 'Borderline' | 'Not yet';
  integrityBand: 'LOW' | 'MEDIUM' | 'HIGH';
  aiScore: number;
  reportId: string;
  completedAt: string;
}

const MOCK_COHORT: CandidateEntry[] = [
  {
    id: 'c1',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    domain: 'web',
    score: 92,
    outcomeBand: 'Strong Hire',
    integrityBand: 'LOW',
    aiScore: 18.5,
    reportId: 'rep_sample_101',
    completedAt: '2026-10-30'
  },
  {
    id: 'c2',
    name: 'Marcus Vance',
    email: 'marcus.vance@example.com',
    domain: 'backend',
    score: 88,
    outcomeBand: 'Strong Hire',
    integrityBand: 'LOW',
    aiScore: 17.0,
    reportId: 'rep_sample_102',
    completedAt: '2026-10-30'
  },
  {
    id: 'c3',
    name: 'Dr. Elena Rostova',
    email: 'elena.rostova@example.com',
    domain: 'ml',
    score: 95,
    outcomeBand: 'Strong Hire',
    integrityBand: 'LOW',
    aiScore: 19.0,
    reportId: 'rep_sample_103',
    completedAt: '2026-10-29'
  },
  {
    id: 'c4',
    name: 'Samantha Wright',
    email: 'samantha.wright@example.com',
    domain: 'security',
    score: 84,
    outcomeBand: 'Hire',
    integrityBand: 'LOW',
    aiScore: 16.5,
    reportId: 'rep_sample_104',
    completedAt: '2026-10-29'
  },
  {
    id: 'c5',
    name: 'Jordan Lee',
    email: 'jordan.lee@example.edu',
    domain: 'ml',
    score: 72,
    outcomeBand: 'Hire',
    integrityBand: 'MEDIUM',
    aiScore: 14.0,
    reportId: 'rep_sample_105',
    completedAt: '2026-10-28'
  }
];

export default function RecruiterDashboardPage() {
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCandidates = MOCK_COHORT.filter((c) => {
    const matchesDomain = domainFilter === 'all' || c.domain === domainFilter;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background py-10 px-6 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Recruiter Cohort Intelligence</h1>
            <p className="text-xs text-slate-400 mt-1">
              Audit-ready candidate leaderboards, deterministic test pass rates, and integrity band distributions
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-lg bg-card border border-border text-xs text-slate-300 hover:text-white"
            >
              Candidate Portal
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 w-full sm:w-72 bg-background border border-border rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-xs text-white focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-slate-400">Filter Domain:</span>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="all">All Domains</option>
              <option value="web">Web</option>
              <option value="backend">Backend</option>
              <option value="ml">Machine Learning</option>
              <option value="security">Security</option>
            </select>
          </div>
        </div>

        {/* Cohort Leaderboard Table */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border font-bold text-sm text-white">
            Evaluated Candidates Leaderboard ({filteredCandidates.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-slate-400 uppercase text-[10px] tracking-wider bg-background/50">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">AI Efficiency</th>
                  <th className="py-3 px-4">Integrity Band</th>
                  <th className="py-3 px-4 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-slate-300">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{c.name}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{c.email}</div>
                    </td>
                    <td className="py-3.5 px-4 uppercase text-blue-400 font-medium">{c.domain}</td>
                    <td className="py-3.5 px-4 text-base font-extrabold text-white">{c.score}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {c.outcomeBand}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-cyber-blue font-semibold">{c.aiScore} / 20</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.integrityBand === 'LOW'
                            ? 'bg-cyber-green/10 text-cyber-green'
                            : 'bg-cyber-amber/10 text-cyber-amber'
                        }`}
                      >
                        {c.integrityBand} Risk
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/report/${c.reportId}`}
                        className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

