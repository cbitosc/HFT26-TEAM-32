import { NextRequest, NextResponse } from 'next/server';
import { SAMPLE_PORTFOLIOS, GENESIS_HASH, createHashChainNode } from '@proctor-forge/shared';
import { ALL_BANK_TASKS } from '@proctor-forge/task-bank';
import { collections } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const demoAssessmentId = `demo_asm_${Date.now()}`;
    const candidateId = `cand_judge_demo`;
    const portfolio = SAMPLE_PORTFOLIOS.web_fullstack_ts!;

    // Select pre-validated tasks for demo
    const demoTasks = ALL_BANK_TASKS.filter((t) => t.domain === 'web');
    const taskNovice = demoTasks.find((t) => t.tier === 'novice')!;
    const taskAdept = demoTasks.find((t) => t.tier === 'adept')!;
    const taskMaster = demoTasks.find((t) => t.tier === 'master')!;

    const selectedSpecs = [taskNovice, taskAdept, taskMaster];
    const taskIds = selectedSpecs.map((s) => s.id);

    // Save server-only secrets
    for (const spec of selectedSpecs) {
      await collections.taskSecrets().doc(spec.id).set({
        taskId: spec.id,
        tier: spec.tier,
        referenceSolution: spec.referenceSolution,
        hiddenTests: spec.tests.hidden,
        testFiles: spec.testFiles,
        hintLadder: spec.hintLadder,
        validationReport: {
          taskId: spec.id,
          passed: true,
          checks: {
            schemaLint: true,
            compiles: true,
            referencePassesAll: true,
            starterFailsTarget: true,
            mutationKillRate: 0.86,
            alternativePasses: true,
            commonWrongFails: true,
            dsaTopicConformance: true,
            antiLeakCheck: true,
            timingSanity: true
          },
          details: ['Pre-validated Task Bank item loaded for Judge Demo']
        },
        createdAt: Date.now()
      });
    }

    // Candidate visible task slice
    const candidateVisibleTasks = selectedSpecs.map((spec) => ({
      id: spec.id,
      tier: spec.tier,
      domain: spec.domain,
      language: spec.language,
      framework: spec.framework,
      dsaTopics: spec.dsaTopics,
      title: spec.title,
      scenario: spec.scenario,
      problemStatement: spec.problemStatement,
      constraints: spec.constraints,
      acceptanceCriteria: spec.acceptanceCriteria,
      files: spec.files,
      visibleTests: spec.tests.visible,
      hintAvailability: {
        canUseAi: spec.tier !== 'novice',
        currentUnlockedLevel: 1,
        maxLevel: 4,
        cooldownSecondsRemaining: 0
      }
    }));

    // Save assessment document with accelerated 10-minute timer
    await collections.assessments().doc(demoAssessmentId).set({
      id: demoAssessmentId,
      candidateId,
      orgId: 'hackathon-judges',
      portfolio,
      status: 'in_progress',
      createdAt: Date.now(),
      startedAt: Date.now(),
      completedAt: null,
      serverDeadline: Date.now() + 10 * 60 * 1000, // 10 min accelerated timer
      durationMinutes: 10,
      activeTaskId: taskIds[0],
      taskIds,
      isDemoMode: true,
      extraTimeMultiplier: 1.0,
      tasks: candidateVisibleTasks
    });

    // Seed simulated telemetry events into hash chain for the demo replay
    const eventsRef = collections.assessments().doc(demoAssessmentId).collection('events');
    let prevHash = GENESIS_HASH;

    const simulatedEvents = [
      { type: 'fullscreen_enter', payload: {}, delay: 1000 },
      { type: 'tab_focus', payload: { screen: 'editor' }, delay: 2000 },
      { type: 'test_run', payload: { passed: 1, total: 3 }, delay: 15000 },
      { type: 'paste', payload: { charCount: 42, source: 'internal' }, delay: 30000 },
      { type: 'hint_requested', payload: { level: 1 }, delay: 45000 },
      { type: 'test_run', payload: { passed: 3, total: 3 }, delay: 70000 }
    ];

    let t = Date.now() - 100000;
    for (const sim of simulatedEvents) {
      t += sim.delay;
      const evId = `demo_ev_${randomBytes(4).toString('hex')}`;
      const node = createHashChainNode(prevHash, {
        id: evId,
        assessmentId: demoAssessmentId,
        taskId: taskIds[0],
        type: sim.type as any,
        payload: sim.payload,
        timestamp: t
      });
      await eventsRef.doc(evId).set(node);
      prevHash = node.hash;
    }

    return NextResponse.json({
      success: true,
      assessmentId: demoAssessmentId,
      tasks: candidateVisibleTasks
    });
  } catch (err: any) {
    console.error('Judge Demo Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

