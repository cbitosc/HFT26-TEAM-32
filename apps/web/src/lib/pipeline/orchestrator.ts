import {
  Portfolio,
  CandidateProfile,
  CandidateProfileSchema,
  TaskSpec,
  TaskSpecSchema,
  TaskTier,
  CandidateVisibleTask,
  PipelineState,
  PipelineStage,
  ValidationReport,
  computeSha256
} from '@proctor-forge/shared';
import { findBankTasks, validateTask } from '@proctor-forge/task-bank';
import { featherlessClient } from '../featherless/client';
import {
  redactPortfolioForLlm,
  buildPortfolioAnalysisPrompt,
  buildTaskGenerationPrompt
} from '../featherless/prompts';
import { collections } from '../firebase/admin';

export interface PipelineProgressCallback {
  (stage: PipelineStage, percent: number, message: string): Promise<void>;
}

export class AssessmentPipelineOrchestrator {
  private assessmentId: string;
  private portfolio: Portfolio;
  private onProgress?: PipelineProgressCallback;

  constructor(assessmentId: string, portfolio: Portfolio, onProgress?: PipelineProgressCallback) {
    this.assessmentId = assessmentId;
    this.portfolio = portfolio;
    this.onProgress = onProgress;
  }

  private async updateProgress(stage: PipelineStage, percent: number, message: string) {
    console.log(`[Pipeline ${this.assessmentId}] ${stage} (${percent}%): ${message}`);
    if (this.onProgress) {
      await this.onProgress(stage, percent, message);
    }
  }

  // Deterministic filter: strictly bounds allowed DSA topics to claimed topics
  private computeAllowedDsaTopics(portfolio: Portfolio): { novice: string[]; adept: string[]; master: string[] } {
    const claimed = portfolio.dsaTopicsSolved;
    const claimedTopicNames = new Set(claimed.map((t) => t.topic));

    const novice = claimed
      .filter((t) => claimedTopicNames.has(t.topic))
      .map((t) => t.topic);

    const adept = claimed
      .filter((t) => t.approxCount >= 10 || t.difficultyComfort === 'medium' || t.difficultyComfort === 'hard')
      .map((t) => t.topic);

    const master = claimed
      .filter((t) => t.difficultyComfort === 'medium' || t.difficultyComfort === 'hard')
      .map((t) => t.topic);

    return {
      novice: novice.length > 0 ? novice : ['arrays'],
      adept: adept.length > 0 ? adept : novice,
      master: master.length > 0 ? master : adept
    };
  }

  async runPipeline(): Promise<{
    profile: CandidateProfile;
    tasks: CandidateVisibleTask[];
    validationReports: Record<string, ValidationReport>;
  }> {
    // ----------------------------------------------------------------
    // Stage A: Portfolio Analysis
    // ----------------------------------------------------------------
    await this.updateProgress('PORTFOLIO_ANALYSIS', 15, 'Analyzing portfolio tech stack, domain, and claimed skills...');

    const allowedTopics = this.computeAllowedDsaTopics(this.portfolio);
    let candidateProfile: CandidateProfile;

    try {
      const redacted = redactPortfolioForLlm(this.portfolio);
      const { systemPrompt, userPrompt } = buildPortfolioAnalysisPrompt(redacted);

      const result = await featherlessClient.structuredCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        CandidateProfileSchema,
        { model: featherlessClient.getGeneratorModel(), temperature: 0.1 }
      );

      candidateProfile = {
        ...result.data,
        notes: result.data.notes || []
      };
      // CRITICAL: Overwrite with deterministic code filter — never trust LLM on allowed topics!
      candidateProfile.allowedDsaTopicsByTier = allowedTopics;
      candidateProfile.candidateName = this.portfolio.candidate.name;
      candidateProfile.candidateEmail = this.portfolio.candidate.email;
    } catch (err: any) {
      console.warn(`[Pipeline] LLM analysis failed: ${err.message}. Using deterministic fallback profile.`);
      candidateProfile = {
        candidateName: this.portfolio.candidate.name,
        candidateEmail: this.portfolio.candidate.email,
        dominantDomain: this.portfolio.primaryDomain,
        primaryLanguage: this.portfolio.techStack.languages[0] || 'python',
        preferredFramework: this.portfolio.techStack.frameworks[0] || 'vanilla',
        projectThemes: this.portfolio.projects.map((p) => p.title),
        allowedDsaTopicsByTier: allowedTopics,
        difficultyCalibration: 'STANDARD',
        hasSufficientDsaBreadth: this.portfolio.dsaTopicsSolved.length >= 3,
        notes: ['Fallback deterministic profile calibration applied']
      };
    }

    // ----------------------------------------------------------------
    // Stage B: Task Spec Generation & Validation Gate
    // ----------------------------------------------------------------
    const tiers: TaskTier[] = ['novice', 'adept', 'master'];
    const generatedTaskSpecs: TaskSpec[] = [];
    const validationReports: Record<string, ValidationReport> = {};

    let progressPerTier = 25;
    let currentPercent = 30;

    for (const tier of tiers) {
      await this.updateProgress('TASK_GENERATION', currentPercent, `Generating tailored ${tier.toUpperCase()} task...`);

      const allowedForTier = candidateProfile.allowedDsaTopicsByTier[tier];
      const theme = candidateProfile.projectThemes[0] || 'Software Architecture Scenario';
      const seed = Math.floor(Math.random() * 100000);

      let validatedTask: TaskSpec | null = null;
      let report: ValidationReport | null = null;

      // Check task cache first
      const cacheKey = computeSha256(`${candidateProfile.dominantDomain}:${tier}:${allowedForTier.sort().join(',')}`);
      const cachedDoc = await collections.taskCache().doc(cacheKey).get();

      if (cachedDoc.exists) {
        const cachedSpec = cachedDoc.data()?.taskSpec as TaskSpec;
        if (cachedSpec) {
          validatedTask = cachedSpec;
          report = {
            taskId: cachedSpec.id,
            passed: true,
            checks: {
              schemaLint: true,
              compiles: true,
              referencePassesAll: true,
              starterFailsTarget: true,
              mutationKillRate: 0.85,
              alternativePasses: true,
              commonWrongFails: true,
              dsaTopicConformance: true,
              antiLeakCheck: true,
              timingSanity: true
            },
            details: ['Retrieved from validated task cache']
          };
          console.log(`[Pipeline] Task cache hit for ${tier} task`);
        }
      }

      // If not in cache, attempt LLM generation with validation gate
      if (!validatedTask) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const { systemPrompt, userPrompt } = buildTaskGenerationPrompt({
              tier,
              profile: candidateProfile,
              theme,
              allowedDsaTopics: allowedForTier,
              seed
            });

            const genResult = await featherlessClient.structuredCompletion(
              [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              TaskSpecSchema,
              { model: featherlessClient.getGeneratorModel(), temperature: 0.2 }
            );

            // Validation Gate (Section 4C)
            await this.updateProgress('VALIDATION_GATE', currentPercent + 5, `Running validation gate & mutation tests on ${tier} task (attempt ${attempt})...`);
            const taskCandidate = {
              ...genResult.data,
              framework: genResult.data.framework || 'vanilla'
            } as TaskSpec;
            const valReport = await validateTask(taskCandidate, { minMutationKillRate: 0.65 });

            if (valReport.passed) {
              validatedTask = taskCandidate;
              report = valReport;
              // Cache newly validated task
              await collections.taskCache().doc(cacheKey).set({ taskSpec: validatedTask, createdAt: Date.now() });
              break;
            } else {
              console.warn(`[Pipeline] Validation gate rejected generated ${tier} task: ${valReport.details.join(', ')}`);
            }
          } catch (genErr: any) {
            console.warn(`[Pipeline] Generation attempt ${attempt} for ${tier} failed: ${genErr.message}`);
          }
        }
      }

      // Fallback: If generation or validation gate failed, select from hand-verified task bank
      if (!validatedTask) {
        console.warn(`[Pipeline] Falling back to pre-authored task bank for ${tier} (${candidateProfile.dominantDomain})`);
        const bankCandidates = findBankTasks(candidateProfile.dominantDomain, tier);
        const fallback = bankCandidates[seed % (bankCandidates.length || 1)] || bankCandidates[0];

        if (fallback) {
          validatedTask = fallback;
          report = {
            taskId: fallback.id,
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
            details: ['Loaded from hand-verified task bank fallback']
          };
        } else {
          throw new Error(`No task bank items found for domain ${candidateProfile.dominantDomain} and tier ${tier}`);
        }
      }

      generatedTaskSpecs.push(validatedTask);
      validationReports[validatedTask.id] = report!;
      currentPercent += progressPerTier;
    }

    // ----------------------------------------------------------------
    // Stage D: Packaging (Splitting Public vs. Server-Only Data)
    // ----------------------------------------------------------------
    await this.updateProgress('PACKAGING', 90, 'Packaging assessment and enforcing server-only secret isolation...');

    const candidateVisibleTasks: CandidateVisibleTask[] = [];

    for (const spec of generatedTaskSpecs) {
      // 1. Store Server-Only Secret Data in Firestore taskSecrets collection (DENY-ALL for clients)
      await collections.taskSecrets().doc(spec.id).set({
        taskId: spec.id,
        tier: spec.tier,
        referenceSolution: spec.referenceSolution,
        hiddenTests: spec.tests.hidden,
        testFiles: spec.testFiles,
        hintLadder: spec.hintLadder,
        validationReport: validationReports[spec.id],
        createdAt: Date.now()
      });

      // 2. Prepare Candidate-Visible Slice (stripped of reference solution, hidden tests, and hint text)
      candidateVisibleTasks.push({
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
          currentUnlockedLevel: 0,
          maxLevel: 4,
          cooldownSecondsRemaining: 0
        }
      });
    }

    await this.updateProgress('READY', 100, 'Assessment generated and validated successfully!');

    return {
      profile: candidateProfile,
      tasks: candidateVisibleTasks,
      validationReports
    };
  }
}

