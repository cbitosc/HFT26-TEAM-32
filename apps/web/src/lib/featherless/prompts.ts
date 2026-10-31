import { Portfolio, CandidateProfile, TaskTier } from '@proctor-forge/shared';

// Redact PII before sending portfolio data to LLM
export function redactPortfolioForLlm(portfolio: Portfolio): any {
  return {
    primaryDomain: portfolio.primaryDomain,
    secondaryDomains: portfolio.secondaryDomains,
    techStack: portfolio.techStack,
    projects: portfolio.projects.map((p) => ({
      title: p.title,
      description: p.description,
      techStack: p.techStack,
      role: p.role,
      highlights: p.highlights
    })),
    skills: portfolio.skills,
    dsaTopicsSolved: portfolio.dsaTopicsSolved,
    experienceLevel: portfolio.candidate.experienceLevel
  };
}

export function buildPortfolioAnalysisPrompt(redactedPortfolio: any) {
  const systemPrompt = `You are a Principal Technical Assessor and Curriculum Architect.
Analyze the candidate's technical portfolio to construct a tailored, calibrated assessment profile.
Rules:
1. Identify their primary language and preferred framework from their projects and tech stack.
2. Formulate 2-3 realistic project-flavored themes inspired by their stated projects.
3. Determine allowed DSA topics for each tier based on their reported comfort levels.
Output MUST strictly be a JSON object conforming to CandidateProfile schema.`;

  const userPrompt = `Candidate Portfolio Data:
${JSON.stringify(redactedPortfolio, null, 2)}

Produce a JSON object with:
- candidateName: "Candidate"
- candidateEmail: "candidate@proctor-forge.internal"
- dominantDomain: string
- primaryLanguage: string ("python" or "javascript" or "typescript")
- preferredFramework: string
- projectThemes: string[]
- allowedDsaTopicsByTier: { novice: string[], adept: string[], master: string[] }
- difficultyCalibration: string
- hasSufficientDsaBreadth: boolean
- notes: string[]`;

  return { systemPrompt, userPrompt };
}

export function buildTaskGenerationPrompt(params: {
  tier: TaskTier;
  profile: CandidateProfile;
  theme: string;
  allowedDsaTopics: string[];
  seed: number;
}) {
  const { tier, profile, theme, allowedDsaTopics, seed } = params;

  const systemPrompt = `You are an elite Software Engineering Assessment Author building a ${tier.toUpperCase()}-tier task.
Target Language: ${profile.primaryLanguage}
Target Framework: ${profile.preferredFramework}
Candidate Domain: ${profile.dominantDomain}
Contextual Scenario Theme: ${theme}
MANDATORY CONSTRAINT: DSA topics MUST be chosen strictly from: ${JSON.stringify(allowedDsaTopics)}.

Requirements per tier:
- NOVICE: Localized bug fix or small single-file utility + Easy DSA.
- ADEPT: Multi-step feature across 2 files + Medium DSA.
- MASTER: Multi-file debugging/extension with algorithmic optimization + Medium/Hard DSA.

Output MUST be a JSON object conforming to TaskSpec schema with:
- id, tier, domain, language, framework, dsaTopics, title, scenario, problemStatement, constraints, acceptanceCriteria
- files: [{path, content, editable: true}] (STARTER code that has the deliberate bug/omission)
- referenceSolution: [{path, content, editable: true}] (WORKING solution passing 100% of tests)
- tests: { visible: [{id, name, weight, category}], hidden: [{id, name, weight, category}] }
- testFiles: [{path, content, editable: false}] (Complete native unit test files)
- hintLadder: { level1, level2, level3, level4 } (L1 conceptual, L2 approach, L3 bug area, L4 pseudo-structure without code)
- seed: ${seed}`;

  const userPrompt = `Generate the complete ${tier.toUpperCase()} task specification now as a strict JSON object.`;

  return { systemPrompt, userPrompt };
}

export function buildAlternativeSolutionPrompt(taskSpec: any) {
  const systemPrompt = `You are an independent Senior Software Engineer.
Given the task specification below, implement:
1. "alternativeSolution": An independent, alternative correct implementation that passes all tests.
2. "commonWrongSolution": A plausible but subtly incorrect implementation (e.g. off-by-one, missed edge case) that SHOULD FAIL the tests.
Output ONLY a JSON object: { "alternativeFiles": [{ "path": string, "content": string }], "wrongFiles": [{ "path": string, "content": string }] }`;

  const userPrompt = `Task Specification:
Title: ${taskSpec.title}
Problem Statement: ${taskSpec.problemStatement}
Files: ${JSON.stringify(taskSpec.files)}
Unit Tests: ${JSON.stringify(taskSpec.testFiles)}`;

  return { systemPrompt, userPrompt };
}

export function buildPortfolioProbePrompt(portfolio: Portfolio) {
  const systemPrompt = `You are a Principal Engineering Reviewer verifying candidate project authenticity.
Generate 5 challenging, technically deep multiple-choice questions regarding architectural trade-offs, invalidation schemes, concurrency safeguards, or schema decisions for the candidate's listed projects.
Rules:
- Questions must be grounded in the candidate's actual projects.
- Exactly 4 options per question.
- Exactly 1 correct option index (0..3).
- Provide a clear, factual justification for why that option is correct.
Output a JSON array: [{ "id": string, "projectTitle": string, "questionText": string, "options": string[], "correctOptionIndex": number, "explanation": string }]`;

  const userPrompt = `Candidate Projects:
${JSON.stringify(portfolio.projects, null, 2)}`;

  return { systemPrompt, userPrompt };
}

