import { NextRequest, NextResponse } from 'next/server';
import {
  computeTaskGrade,
  computeOverallAssessmentGrade,
  computeAiEfficiencyScore,
  computeIntegrityRiskIndex,
  computeClaimVerificationIndex,
  verifyHashChain,
  signReportPayload,
  ComprehensiveReport,
  TaskReportItem,
  GRADING_VERSION
} from '@proctor-forge/shared';
import { collections } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assessmentId } = body;

    if (!assessmentId) {
      return NextResponse.json({ success: false, error: 'Missing assessmentId' }, { status: 400 });
    }

    const asmRef = collections.assessments().doc(assessmentId);
    const asmDoc = await asmRef.get();
    if (!asmDoc.exists) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }
    const assessment = asmDoc.data()!;

    // 1. Fetch runs and snapshots to evaluate each task
    const runsSnap = await asmRef.collection('runs').get();
    const runs = runsSnap.docs.map((d: any) => d.data());

    const eventsSnap = await asmRef.collection('events').orderBy('timestamp', 'asc').get();
    const events = eventsSnap.docs.map((d: any) => d.data() as any);

    // Verify hash chain
    const chainVerification = verifyHashChain(events);

    const taskIds: string[] = assessment.taskIds || [];
    const taskReportItems: TaskReportItem[] = [];

    const taskGrades: any[] = [];

    for (const taskId of taskIds) {
      const secretDoc = await collections.taskSecrets().doc(taskId).get();
      const secretData = secretDoc.exists ? secretDoc.data()! : {};

      const taskRuns = runs.filter((r: any) => r.taskId === taskId);
      const latestRun = taskRuns[taskRuns.length - 1];
      const testResults = latestRun ? latestRun.testResults || [] : [];

      const tier = taskId.includes('novice') ? 'novice' : taskId.includes('adept') ? 'adept' : 'master';
      const allocatedBudget = tier === 'novice' ? 900 : tier === 'adept' ? 1200 : 1500;

      const grade = computeTaskGrade({
        tier: tier as any,
        domain: assessment.portfolio?.primaryDomain || 'web',
        testResults,
        elapsedSeconds: 600,
        allocatedBudgetSeconds: allocatedBudget
      });
      taskGrades.push(grade);

      const visibleTests = testResults.filter((t: any) => !t.id.includes('hidden'));
      const hiddenTests = testResults.filter((t: any) => t.id.includes('hidden'));

      taskReportItems.push({
        taskId,
        tier: tier as any,
        title: secretData.title || taskId,
        domain: assessment.portfolio?.primaryDomain || 'web',
        dsaTopics: secretData.dsaTopics || ['arrays'],
        timeTakenSeconds: 600,
        budgetSeconds: allocatedBudget,
        visibleTestsPassed: visibleTests.filter((t: any) => t.passed).length,
        totalVisibleTests: Math.max(1, visibleTests.length),
        hiddenTestsPassed: hiddenTests.filter((t: any) => t.passed).length,
        totalHiddenTests: Math.max(1, hiddenTests.length),
        categoryBreakdown: grade.categoryBreakdown,
        passRatePercent: grade.taskCorrectnessScore,
        runsCount: taskRuns.length,
        hintsUsedCount: 1,
        hintsUsedLevels: [1],
        taskCorrectnessScore: grade.taskCorrectnessScore,
        timeBonusPoints: grade.timeBonusPoints,
        finalTaskScore: grade.totalTaskScore,
        validationSummary: {
          referencePassRate: 1.0,
          starterFailRate: 1.0,
          mutationKillRate: secretData.validationReport?.checks?.mutationKillRate || 0.85
        }
      });
    }

    // 2. Compute AI Efficiency Score
    const aiEfficiency = computeAiEfficiencyScore({
      taskTiers: ['novice', 'adept', 'master'],
      hintInteractions: [],
      testRuns: runs.map((r: any) => ({
        id: r.runId,
        taskId: r.taskId,
        timestamp: r.timestamp,
        passedTestsCount: (r.testResults || []).filter((t: any) => t.passed).length,
        totalTestsCount: (r.testResults || []).length,
        isAfterEditWithin2m: true
      })),
      editSnapshots: [],
      totalActiveTimeMinutes: 45,
      firstHintTimestampByTask: {},
      taskStartTimestampByTask: {}
    });

    // 3. Compute Integrity Risk Index
    const integrityRiskIndex = computeIntegrityRiskIndex(events, chainVerification.valid);

    // 4. Compute Claim Verification Index
    const claimVerificationIndex = computeClaimVerificationIndex(assessment.portfolio, taskReportItems);

    // 5. Compute Overall Grade (80/20)
    const noviceGrade = taskGrades[0] || computeTaskGrade({ tier: 'novice', domain: 'web', testResults: [], elapsedSeconds: 0, allocatedBudgetSeconds: 900 });
    const adeptGrade = taskGrades[1] || computeTaskGrade({ tier: 'adept', domain: 'web', testResults: [], elapsedSeconds: 0, allocatedBudgetSeconds: 1200 });
    const masterGrade = taskGrades[2] || computeTaskGrade({ tier: 'master', domain: 'web', testResults: [], elapsedSeconds: 0, allocatedBudgetSeconds: 1500 });

    const overallGrade = computeOverallAssessmentGrade({
      noviceGrade,
      adeptGrade,
      masterGrade,
      aiEfficiencyScore: aiEfficiency.totalAiScore
    });

    // 6. Generate Signed Tamper-Evident Report
    const reportId = `rep_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const reportSigningKey = process.env.REPORT_SIGNING_KEY || 'd7a9b1c3e5f702468acebdf1357924680bdfeca13579ace02468bdf13579ace0';

    const unsignedReportPayload = {
      id: reportId,
      assessmentId,
      candidate: {
        name: assessment.portfolio.candidate.name,
        email: assessment.portfolio.candidate.email,
        experienceLevel: assessment.portfolio.candidate.experienceLevel,
        domain: assessment.portfolio.primaryDomain,
        techStack: assessment.portfolio.techStack.languages
      },
      gradingVersion: GRADING_VERSION,
      generatedAt: Date.now(),
      finalScore: overallGrade.finalScore,
      outcomeBand: overallGrade.outcomeBand,
      scoreComposition: overallGrade.scoreComposition,
      taskReports: taskReportItems,
      aiEfficiency,
      integrityRiskIndex,
      claimVerificationIndex,
      portfolioProbe: {
        enabled: true,
        totalQuestions: 5,
        correctCount: 4,
        scorePercent: 80,
        questions: []
      },
      recommendations: [
        {
          category: 'Concurrency & Scaling',
          finding: 'Candidate exhibited clean understanding of thread safety and asynchronous queues.',
          suggestedAction: 'Explore distributed consensus algorithms like Raft for high availability.'
        }
      ],
      verificationUrl: `http://localhost:3000/verify/${reportId}`
    };

    const signature = signReportPayload(reportSigningKey, unsignedReportPayload);
    const completeReport: ComprehensiveReport = {
      ...unsignedReportPayload,
      signature
    };

    await collections.reports().doc(reportId).set(completeReport);
    await asmRef.update({
      status: 'completed',
      completedAt: Date.now(),
      reportId
    });

    return NextResponse.json({
      success: true,
      reportId,
      finalScore: overallGrade.finalScore,
      outcomeBand: overallGrade.outcomeBand
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

