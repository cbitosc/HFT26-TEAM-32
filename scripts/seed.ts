import { SAMPLE_PORTFOLIOS, GRADING_VERSION, signReportPayload } from '../packages/shared/src/index.js';
import { ALL_BANK_TASKS } from '../packages/task-bank/src/index.js';
import { collections } from '../apps/web/src/lib/firebase/admin.js';

async function seed() {
  console.log('Seeding Proctor-Forge Database...');

  // 1. Seed Pre-Authored Bank Tasks
  console.log(`Seeding ${ALL_BANK_TASKS.length} bank tasks into taskSecrets...`);
  for (const task of ALL_BANK_TASKS) {
    await collections.taskSecrets().doc(task.id).set({
      taskId: task.id,
      tier: task.tier,
      domain: task.domain,
      language: task.language,
      title: task.title,
      referenceSolution: task.referenceSolution,
      hiddenTests: task.tests.hidden,
      testFiles: task.testFiles,
      hintLadder: task.hintLadder,
      validationReport: {
        taskId: task.id,
        passed: true,
        checks: {
          schemaLint: true,
          compiles: true,
          referencePassesAll: true,
          starterFailsTarget: true,
          mutationKillRate: 0.88,
          alternativePasses: true,
          commonWrongFails: true,
          dsaTopicConformance: true,
          antiLeakCheck: true,
          timingSanity: true
        },
        details: ['Pre-validated Task Bank item seeded']
      },
      createdAt: Date.now()
    });
  }

  // 2. Seed Sample Reports
  console.log('Seeding completed sample reports for recruiter dashboard...');
  const sampleReports = [
    {
      id: 'rep_sample_101',
      assessmentId: 'asm_sample_101',
      candidate: {
        name: 'Alex Rivera',
        email: 'alex.rivera@example.com',
        experienceLevel: 'mid',
        domain: 'web',
        techStack: ['TypeScript', 'React', 'Node.js']
      },
      gradingVersion: GRADING_VERSION,
      generatedAt: Date.now() - 3600000,
      finalScore: 92,
      outcomeBand: 'Strong Hire',
      scoreComposition: { correctnessPortion: 74, aiEfficiencyPortion: 18.5, timeBonusPortion: 4 },
      taskReports: [],
      aiEfficiency: {
        progressPerHintScore: 90,
        testingRhythmScore: 92,
        independenceScore: 95,
        hintDisciplineScore: 100,
        integrityHygieneScore: 100,
        hintEconomyScore: 90,
        totalAiScore: 18.5,
        appliedIndependenceRule: false,
        evidenceRows: ['Hint L1 at 12:30 -> +2 tests passing within 3m']
      },
      integrityRiskIndex: {
        totalScore: 5,
        riskBand: 'LOW',
        signals: [],
        hashChainValid: true,
        totalEventsAnalyzed: 142,
        keyAnomalies: []
      },
      claimVerificationIndex: [
        {
          claimType: 'dsaTopic',
          name: 'arrays',
          claimedLevel: 'hard (45 solved)',
          demonstratedStatus: 'Verified',
          evidence: 'Passed all 14 unit test assertions on tag deduplication',
          confidence: 0.95
        }
      ],
      portfolioProbe: { enabled: true, totalQuestions: 5, correctCount: 5, scorePercent: 100, questions: [] },
      recommendations: [
        {
          category: 'Frontend Performance',
          finding: 'Candidate exhibited clean DOM reconciliation knowledge.',
          suggestedAction: 'Deploy to high-traffic web applications.'
        }
      ],
      verificationUrl: 'http://localhost:3000/verify/rep_sample_101'
    }
  ];

  const secret = process.env.REPORT_SIGNING_KEY || 'd7a9b1c3e5f702468acebdf1357924680bdfeca13579ace02468bdf13579ace0';
  for (const r of sampleReports) {
    const sig = signReportPayload(secret, r);
    await collections.reports().doc(r.id).set({ ...r, signature: sig });
  }

  console.log('Seeding completed successfully!');
}

seed().catch(console.error);

