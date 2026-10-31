const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY || '';
const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL_GENERATOR || 'deepseek-ai/DeepSeek-V4-Pro';

export async function callFeatherless(prompt: string, maxTokens = 2500): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);

  try {
    const res = await fetch('https://api.featherless.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FEATHERLESS_API_KEY}`,
      },
      body: JSON.stringify({
        model: FEATHERLESS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Featherless HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Featherless');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function askAI(prompt: string, maxTokens = 2500): Promise<string> {
  console.log(`[AI] Generating via Featherless (${FEATHERLESS_MODEL})...`);
  return await callFeatherless(prompt, maxTokens);
}

function cleanAndParseJson(str: string): any {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/[\{\[][\s\S]*[\}\]]/);
  if (match) {
    let candidate = match[0];
    candidate = candidate.replace(/,\s*([\]\}])/g, '$1');
    try {
      return JSON.parse(candidate);
    } catch {}

    // Replace unescaped control characters inside strings
    candidate = candidate.replace(/[\u0000-\u001F]+/g, ' ');
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  throw new Error('Failed to parse AI response as JSON');
}

function extractPortfolioHeuristic(rawText: string): any {
  const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const nameMatch = rawText.match(/(?:^|\n)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  const githubMatch = rawText.match(/https?:\/\/github\.com\/[a-zA-Z0-9_-]+/);

  const knownLangs = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'PHP', 'Ruby', 'SQL', 'HTML', 'CSS'];
  const foundLangs = knownLangs.filter((l) => new RegExp(`\\b${l}\\b`, 'i').test(rawText));

  return {
    candidate: {
      name: nameMatch ? nameMatch[1].trim() : 'Candidate',
      email: emailMatch ? emailMatch[0] : 'candidate@assessment.com',
      phone: '',
      experienceLevel: 'junior',
      githubUrl: githubMatch ? githubMatch[0] : '',
      linkedinUrl: '',
    },
    primaryDomain: 'web',
    techStack: {
      languages: foundLangs.length > 0 ? foundLangs : ['JavaScript', 'Python'],
      frameworks: ['React', 'Next.js', 'Node.js'],
      databases: ['PostgreSQL', 'MongoDB'],
      tools: ['Git', 'Docker'],
    },
    projects: [
      {
        title: 'Core Portfolio Application',
        description: 'Comprehensive software solution showcasing fullstack design, API integrations, and robust data management.',
        techStack: foundLangs.length > 0 ? foundLangs : ['JavaScript', 'HTML', 'CSS'],
        highlights: ['Designed modular responsive components', 'Implemented end-to-end data pipeline'],
      },
    ],
    skills: foundLangs.length > 0 ? foundLangs : ['Web Development', 'Algorithms', 'API Design'],
    education: { degree: 'Bachelor of Technology / Computer Science', institution: 'University', year: '2024' },
    experience: [],
  };
}

export async function parsePortfolioToJSON(rawText: string): Promise<any> {
  const sanitizedText = rawText.substring(0, 3000);

  const prompt = `You are a resume/portfolio parser. Extract structured data from the following resume/portfolio text and return ONLY a valid JSON object (no markdown, no code fences, no explanation).

The JSON must have this exact structure:
{
  "candidate": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number or empty string",
    "experienceLevel": "student|junior|mid|senior",
    "githubUrl": "github url or empty string",
    "linkedinUrl": "linkedin url or empty string"
  },
  "primaryDomain": "web|ml|security|backend|fullstack|mobile|devops|data",
  "techStack": {
    "languages": ["list of programming languages"],
    "frameworks": ["list of frameworks"],
    "databases": ["list of databases"],
    "tools": ["list of tools/platforms"]
  },
  "projects": [
    {
      "title": "Project Name",
      "description": "Brief description",
      "techStack": ["technologies used"],
      "highlights": ["key achievements"]
    }
  ],
  "skills": ["skill1", "skill2"],
  "education": {
    "degree": "Degree name",
    "institution": "University/College",
    "year": "graduation year or expected"
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "time period",
      "description": "what they did"
    }
  ]
}

If a field cannot be determined from the text, use reasonable defaults or empty values. Never omit any field.

RESUME/PORTFOLIO TEXT:
${sanitizedText}

Return ONLY the JSON object:`;

  try {
    const response = await askAI(prompt, 1500);
    return cleanAndParseJson(response);
  } catch (err: any) {
    console.warn('[AI] JSON parse warning, falling back to heuristic parser:', err?.message);
    return extractPortfolioHeuristic(rawText);
  }
}

/**
 * Generates a single phase batch of exactly 20 questions:
 * Phase 1: Questions 1-20 (Beginner)
 * Phase 2: Questions 21-40 (Intermediate)
 * Phase 3: Questions 41-60 (Advanced)
 */
export async function generateQuestionsBatch(
  portfolioData: any,
  phase: 1 | 2 | 3,
  scannedGithubRepos?: Array<{ name: string; description: string }>
): Promise<any[]> {
  const candidateName = portfolioData.candidate?.name || 'Candidate';
  const skills = portfolioData.skills?.join(', ') || 'general programming';
  const languages = portfolioData.techStack?.languages?.join(', ') || 'general';
  const frameworks = portfolioData.techStack?.frameworks?.join(', ') || 'none specified';
  const declaredProjects = portfolioData.projects?.map((p: any) => `${p.title}: ${p.description} (${p.techStack?.join(', ') || ''})`).join('; ') || 'portfolio project';
  const githubProjectsText = scannedGithubRepos && scannedGithubRepos.length > 0
    ? scannedGithubRepos.map((r) => `GitHub Repo: ${r.name} (${r.description})`).join('; ')
    : declaredProjects;
  const domain = portfolioData.primaryDomain || 'web';
  const experience = portfolioData.candidate?.experienceLevel || 'student';

  const startId = (phase - 1) * 20 + 1;
  const endId = phase * 20;
  const diffName = phase === 1 ? 'BEGINNER' : phase === 2 ? 'INTERMEDIATE' : 'ADVANCED';
  const diffSlug = phase === 1 ? 'beginner' : phase === 2 ? 'intermediate' : 'advanced';

  const phaseInstruction = phase === 1
    ? `Phase 1 - MCQs: 20 Multiple-Choice Questions assessing core concepts. CRITICAL REQUIREMENT: Include at least 5 questions (e.g. Q4, Q8, Q12, Q16, Q20) that directly query the candidate about their specific GitHub repositories and projects: [${githubProjectsText}]. Ask about architecture, dependencies, error handling, and component design in their actual projects.`
    : phase === 2
    ? 'Phase 2 - INTERMEDIATE: Medium-difficulty questions on frameworks, debugging, asynchronous patterns, and API design.'
    : 'Phase 3 - ADVANCED: High-difficulty questions evaluating system architecture, scalability, security vulnerabilities, and performance optimization.';

  const prompt = `You are an elite technical interviewer. Generate EXACTLY 20 multiple-choice questions for ${diffName} level (Question IDs ${startId} to ${endId}).

CANDIDATE PROFILE:
- Name: ${candidateName}
- Experience Level: ${experience}
- Domain: ${domain}
- Programming Languages: ${languages}
- Frameworks: ${frameworks}
- Skills: ${skills}
- GitHub Repositories & Projects: ${githubProjectsText}

SPECIFIC PHASE REQUIREMENT:
${phaseInstruction}

Each question MUST have exactly 4 options (A, B, C, D) with exactly one correct answer.

Return ONLY a valid JSON array of 20 objects. No markdown, no code fences.
Format for each question:
{
  "id": ${startId},
  "phase": ${phase},
  "difficulty": "${diffSlug}",
  "question": "Clear, concise technical question?",
  "options": {
    "A": "Option text",
    "B": "Option text",
    "C": "Option text",
    "D": "Option text"
  },
  "correctAnswer": "A",
  "topic": "topic name",
  "isProjectQuestion": false
}

Output ONLY the JSON array starting with [ and ending with ]:`;

  let rawQuestions: any[] = [];
  try {
    const response = await askAI(prompt, 1800);
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      rawQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } catch {
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (match) {
        rawQuestions = JSON.parse(match[0]);
      }
    }
  } catch (err: any) {
    console.warn(`[AI] Batch generation warning for Phase ${phase}:`, err?.message);
  }

  // Normalize to guarantee exactly 20 valid questions for this phase
  const primaryLang = portfolioData.techStack?.languages?.[0] || 'Core Tech';
  const primaryProject = portfolioData.projects?.[0]?.title || 'Featured Project';
  const normalized: any[] = [];

  for (let i = startId; i <= endId; i++) {
    const existing = rawQuestions.find((q: any) => q.id === i) || rawQuestions[i - startId];

    if (existing && existing.question && existing.options && typeof existing.options === 'object') {
      normalized.push({
        id: i,
        phase,
        difficulty: diffSlug,
        question: existing.question,
        options: {
          A: existing.options.A || 'Option A',
          B: existing.options.B || 'Option B',
          C: existing.options.C || 'Option C',
          D: existing.options.D || 'Option D',
        },
        correctAnswer: ['A', 'B', 'C', 'D'].includes(existing.correctAnswer) ? existing.correctAnswer : 'A',
        topic: existing.topic || (i % 4 === 0 ? `Project: ${primaryProject}` : domain),
        isProjectQuestion: existing.isProjectQuestion || i % 4 === 0,
      });
    } else {
      // Deterministic fallback question ensuring no gaps
      const isProj = i % 4 === 0;
      normalized.push({
        id: i,
        phase,
        difficulty: diffSlug,
        question: isProj
          ? `In ${primaryProject}, what was a key technical consideration regarding ${diffSlug}-level state management and stability?`
          : `For ${diffSlug} level development in ${primaryLang}, which approach provides the most robust error handling and maintainability?`,
        options: {
          A: isProj ? 'Structured modular interfaces with decoupled service layers' : 'Explicit type validation and structured exception propagation',
          B: isProj ? 'Direct tightly-coupled global mutation states' : 'Silently swallowing uncaught exceptions in worker threads',
          C: isProj ? 'Blocking synchronous network calls on UI thread' : 'Global mutable variable reassignment across boundaries',
          D: isProj ? 'Hardcoded static credentials within component templates' : 'Unbounded background retry recursion without backoff',
        },
        correctAnswer: 'A',
        topic: isProj ? `Project: ${primaryProject}` : `${primaryLang} Patterns`,
        isProjectQuestion: isProj,
      });
    }
  }

  return normalized;
}

/**
 * Backward compatibility: returns all 60 or Phase 1
 */
export async function generateQuestions(portfolioData: any): Promise<any[]> {
  // Generate Phase 1 (first 20 questions) fast
  return generateQuestionsBatch(portfolioData, 1);
}

export function gradeAnswers(questions: any[], answers: Record<string, string>) {
  let totalCorrect = 0;
  let phase1Correct = 0;
  let phase2Correct = 0;
  let phase3Correct = 0;
  let phase1Total = 0;
  let phase2Total = 0;
  let phase3Total = 0;
  
  const details: any[] = [];

  for (const q of questions) {
    const userAnswer = answers[String(q.id)];
    const isCorrect = userAnswer === q.correctAnswer;
    
    if (q.phase === 1) { phase1Total++; if (isCorrect) phase1Correct++; }
    else if (q.phase === 2) { phase2Total++; if (isCorrect) phase2Correct++; }
    else { phase3Total++; if (isCorrect) phase3Correct++; }
    
    if (isCorrect) totalCorrect++;
    
    details.push({
      questionId: q.id,
      phase: q.phase,
      topic: q.topic,
      userAnswer: userAnswer || 'not answered',
      correctAnswer: q.correctAnswer,
      isCorrect,
      isProjectQuestion: q.isProjectQuestion || false
    });
  }

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  let grade = 'F';
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else if (percentage >= 50) grade = 'D';

  return {
    totalQuestions,
    totalCorrect,
    percentage,
    grade,
    phaseScores: {
      beginner: { correct: phase1Correct, total: phase1Total, percentage: phase1Total ? Math.round((phase1Correct / phase1Total) * 100) : 0 },
      intermediate: { correct: phase2Correct, total: phase2Total, percentage: phase2Total ? Math.round((phase2Correct / phase2Total) * 100) : 0 },
      advanced: { correct: phase3Correct, total: phase3Total, percentage: phase3Total ? Math.round((phase3Correct / phase3Total) * 100) : 0 },
    },
    details
  };
}
