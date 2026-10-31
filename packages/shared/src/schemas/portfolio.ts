import { z } from 'zod';

export const SUPPORTED_DOMAINS = ['web', 'ml', 'security', 'backend'] as const;
export type SupportedDomain = (typeof SUPPORTED_DOMAINS)[number];

export const EXPERIENCE_LEVELS = ['student', 'junior', 'mid', 'senior'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DSA_TOPICS = [
  'arrays',
  'strings',
  'hashing',
  'two-pointers',
  'sliding-window',
  'stack',
  'queue',
  'linked-list',
  'trees',
  'bst',
  'heaps',
  'graphs',
  'bfs',
  'dfs',
  'dp',
  'greedy',
  'binary-search',
  'backtracking',
  'sorting',
  'tries',
  'union-find',
  'recursion',
  'bit-manipulation',
  'math'
] as const;
export type DsaTopic = (typeof DSA_TOPICS)[number];

export const DIFFICULTY_COMFORTS = ['easy', 'medium', 'hard'] as const;
export type DifficultyComfort = (typeof DIFFICULTY_COMFORTS)[number];

// HTML and script tag stripping regex
const STRIP_TAGS_REGEX = /<[^>]*>?/gm;

export function sanitizeString(val: string, maxLen = 2000): string {
  if (typeof val !== 'string') return '';
  const sanitized = val.replace(STRIP_TAGS_REGEX, '').trim();
  return sanitized.length > maxLen ? sanitized.slice(0, maxLen) : sanitized;
}

export const CandidateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).transform((v) => sanitizeString(v, 100)),
  email: z.string().email('Invalid email address').max(120),
  experienceLevel: z.enum(EXPERIENCE_LEVELS, {
    errorMap: () => ({ message: 'Experience level must be student, junior, mid, or senior' })
  }),
  githubUrl: z.string().url('Must be a valid URL').optional().or(z.literal(''))
});

export const ProjectSchema = z.object({
  title: z.string().min(2, 'Project title required').max(120).transform((v) => sanitizeString(v, 120)),
  description: z.string().min(10, 'Project description must be at least 10 characters').max(2000).transform((v) => sanitizeString(v, 2000)),
  techStack: z.array(z.string().min(1).max(50)).min(1, 'At least 1 technology required in project stack'),
  role: z.string().min(2).max(100).transform((v) => sanitizeString(v, 100)),
  highlights: z.array(z.string().max(300).transform((v) => sanitizeString(v, 300))).default([]),
  repoUrl: z.string().url().optional().or(z.literal(''))
});

export const SkillSchema = z.object({
  name: z.string().min(1).max(50).transform((v) => sanitizeString(v, 50)),
  proficiency: z.number().int().min(1).max(5)
});

export const DsaTopicRecordSchema = z.object({
  topic: z.enum(DSA_TOPICS, {
    errorMap: () => ({ message: 'Invalid DSA topic provided' })
  }),
  approxCount: z.number().int().min(0, 'Solved count cannot be negative'),
  difficultyComfort: z.enum(DIFFICULTY_COMFORTS, {
    errorMap: () => ({ message: 'Comfort must be easy, medium, or hard' })
  })
});

export const TechStackSchema = z.object({
  languages: z.array(z.string().min(1).max(40)).min(1, 'At least one primary programming language required'),
  frameworks: z.array(z.string().min(1).max(50)).default([]),
  databases: z.array(z.string().min(1).max(50)).default([]),
  tools: z.array(z.string().min(1).max(50)).default([])
});

export const PortfolioSchema = z.object({
  candidate: CandidateSchema,
  primaryDomain: z.enum(SUPPORTED_DOMAINS, {
    errorMap: () => ({ message: 'Primary domain must be web, ml, security, or backend' })
  }),
  secondaryDomains: z.array(z.enum(SUPPORTED_DOMAINS)).default([]),
  techStack: TechStackSchema,
  projects: z.array(ProjectSchema).min(1, 'At least one project is required to contextualize tasks'),
  skills: z.array(SkillSchema).min(1, 'At least one skill is required'),
  dsaTopicsSolved: z.array(DsaTopicRecordSchema).min(1, 'At least one DSA topic must be reported')
});

export type Candidate = z.infer<typeof CandidateSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type DsaTopicRecord = z.infer<typeof DsaTopicRecordSchema>;
export type TechStack = z.infer<typeof TechStackSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const MAX_PORTFOLIO_SIZE_BYTES = 200 * 1024; // 200 KB

export function parseAndValidatePortfolio(rawJsonString: string): { success: true; data: Portfolio } | { success: false; errors: string[] } {
  if (typeof rawJsonString !== 'string') {
    return { success: false, errors: ['Input must be a valid JSON string'] };
  }
  if (new TextEncoder().encode(rawJsonString).length > MAX_PORTFOLIO_SIZE_BYTES) {
    return { success: false, errors: ['Portfolio file exceeds maximum allowed size of 200KB'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch (err: any) {
    return { success: false, errors: [`Malformed JSON: ${err.message}`] };
  }

  // Prototype pollution safeguard (check own properties, not prototype chain)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, any>;
    if (
      Object.prototype.hasOwnProperty.call(record, '__proto__') ||
      Object.prototype.hasOwnProperty.call(record, 'constructor') ||
      Object.prototype.hasOwnProperty.call(record, 'prototype')
    ) {
      return { success: false, errors: ['Security rejection: prototype pollution keys detected'] };
    }
  }

  const result = PortfolioSchema.safeParse(parsed);
  if (!result.success) {
    const errorMessages = result.error.errors.map(
      (e) => `${e.path.join('.') || 'root'}: ${e.message}`
    );
    return { success: false, errors: errorMessages };
  }

  return { success: true, data: result.data };
}

// 8 Sample Portfolios covering Web, ML, Security, Backend (2 per domain)
export const SAMPLE_PORTFOLIOS: Record<string, Portfolio> = {
  web_fullstack_ts: {
    candidate: {
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      experienceLevel: "mid",
      githubUrl: "https://github.com/alexrivera-demo"
    },
    primaryDomain: "web",
    secondaryDomains: ["backend"],
    techStack: {
      languages: ["TypeScript", "JavaScript"],
      frameworks: ["React", "Next.js", "Express", "Tailwind CSS"],
      databases: ["PostgreSQL", "Redis"],
      tools: ["Git", "Docker", "Vitest"]
    },
    projects: [
      {
        title: "OmniCart E-Commerce Platform",
        description: "Full-stack microservices e-commerce with real-time stock sync, cart reservation, and checkout flow.",
        techStack: ["TypeScript", "Next.js", "Redis", "PostgreSQL"],
        role: "Lead Fullstack Developer",
        highlights: ["Engineered atomic cart checkout with Redis locks", "Built responsive client with Next.js 14 server components"],
        repoUrl: "https://github.com/alexrivera-demo/omnicart"
      }
    ],
    skills: [
      { name: "React", proficiency: 5 },
      { name: "TypeScript", proficiency: 4 },
      { name: "State Management", proficiency: 4 },
      { name: "REST APIs", proficiency: 4 }
    ],
    dsaTopicsSolved: [
      { topic: "arrays", approxCount: 45, difficultyComfort: "hard" },
      { topic: "strings", approxCount: 30, difficultyComfort: "medium" },
      { topic: "hashing", approxCount: 35, difficultyComfort: "hard" },
      { topic: "sliding-window", approxCount: 15, difficultyComfort: "medium" },
      { topic: "two-pointers", approxCount: 20, difficultyComfort: "medium" }
    ]
  },
  web_react_junior: {
    candidate: {
      name: "Chloe Chen",
      email: "chloe.chen@example.com",
      experienceLevel: "junior",
      githubUrl: "https://github.com/chloechen-dev"
    },
    primaryDomain: "web",
    secondaryDomains: [],
    techStack: {
      languages: ["JavaScript", "HTML", "CSS"],
      frameworks: ["React", "Vite", "Tailwind CSS"],
      databases: ["Supabase"],
      tools: ["Git", "npm"]
    },
    projects: [
      {
        title: "TaskFlow Kanban Board",
        description: "Interactive task organizer with drag-and-drop, label filtering, and optimistic state updates.",
        techStack: ["React", "JavaScript", "Tailwind CSS"],
        role: "Frontend Developer",
        highlights: ["Implemented custom drag-and-drop state", "Optimized re-renders using React.memo"],
        repoUrl: "https://github.com/chloechen-dev/taskflow"
      }
    ],
    skills: [
      { name: "React", proficiency: 3 },
      { name: "JavaScript", proficiency: 3 },
      { name: "CSS/UI", proficiency: 4 }
    ],
    dsaTopicsSolved: [
      { topic: "arrays", approxCount: 20, difficultyComfort: "easy" },
      { topic: "strings", approxCount: 20, difficultyComfort: "easy" },
      { topic: "hashing", approxCount: 15, difficultyComfort: "easy" }
    ]
  },
  backend_python_fastapi: {
    candidate: {
      name: "Marcus Vance",
      email: "marcus.vance@example.com",
      experienceLevel: "senior",
      githubUrl: "https://github.com/mvance-eng"
    },
    primaryDomain: "backend",
    secondaryDomains: ["security"],
    techStack: {
      languages: ["Python"],
      frameworks: ["FastAPI", "SQLAlchemy", "Celery"],
      databases: ["PostgreSQL", "Redis"],
      tools: ["Docker", "Kubernetes", "pytest"]
    },
    projects: [
      {
        title: "High-Throughput Order Ingestion Engine",
        description: "Asynchronous backend processing millions of transactions per day with idempotency guarantees and circuit breakers.",
        techStack: ["Python", "FastAPI", "PostgreSQL", "Redis"],
        role: "Principal Backend Architect",
        highlights: ["Designed distributed lock manager to prevent race conditions", "Cut 99th percentile latency by 65%"],
        repoUrl: "https://github.com/mvance-eng/order-engine"
      }
    ],
    skills: [
      { name: "Python", proficiency: 5 },
      { name: "Distributed Systems", proficiency: 5 },
      { name: "Concurrency", proficiency: 4 },
      { name: "Database Optimization", proficiency: 5 }
    ],
    dsaTopicsSolved: [
      { topic: "heaps", approxCount: 25, difficultyComfort: "hard" },
      { topic: "graphs", approxCount: 30, difficultyComfort: "hard" },
      { topic: "bfs", approxCount: 25, difficultyComfort: "hard" },
      { topic: "hashing", approxCount: 50, difficultyComfort: "hard" },
      { topic: "two-pointers", approxCount: 30, difficultyComfort: "medium" }
    ]
  },
  backend_node_microservices: {
    candidate: {
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      experienceLevel: "mid",
      githubUrl: "https://github.com/priyasharma-code"
    },
    primaryDomain: "backend",
    secondaryDomains: ["web"],
    techStack: {
      languages: ["TypeScript", "JavaScript"],
      frameworks: ["Express", "Fastify", "Prisma"],
      databases: ["MongoDB", "Redis"],
      tools: ["Docker", "Jest", "Git"]
    },
    projects: [
      {
        title: "Fleet Telemetry Ingestion Hub",
        description: "Event-driven microservice tracking live GPS coordinates and battery telemetry from 50,000 IoT delivery vehicles.",
        techStack: ["TypeScript", "Fastify", "Redis", "MongoDB"],
        role: "Backend Engineer",
        highlights: ["Built geospatial sliding-window rate limiter", "Created resilient dead-letter queue mechanism"],
        repoUrl: "https://github.com/priyasharma-code/fleet-hub"
      }
    ],
    skills: [
      { name: "Node.js", proficiency: 4 },
      { name: "TypeScript", proficiency: 4 },
      { name: "Rate Limiting", proficiency: 4 },
      { name: "REST APIs", proficiency: 5 }
    ],
    dsaTopicsSolved: [
      { topic: "sliding-window", approxCount: 25, difficultyComfort: "hard" },
      { topic: "queue", approxCount: 30, difficultyComfort: "medium" },
      { topic: "hashing", approxCount: 40, difficultyComfort: "hard" },
      { topic: "arrays", approxCount: 35, difficultyComfort: "medium" }
    ]
  },
  ml_engineer_nlp: {
    candidate: {
      name: "Dr. Elena Rostova",
      email: "elena.rostova@example.com",
      experienceLevel: "senior",
      githubUrl: "https://github.com/erostova-ml"
    },
    primaryDomain: "ml",
    secondaryDomains: ["backend"],
    techStack: {
      languages: ["Python"],
      frameworks: ["PyTorch", "scikit-learn", "HuggingFace", "pandas", "numpy"],
      databases: ["Milvus", "PostgreSQL"],
      tools: ["MLflow", "pytest", "DVC"]
    },
    projects: [
      {
        title: "Legal Document Semantic Retrieval & Cross-Encoder",
        description: "Vector search and re-ranking pipeline ensuring zero train-test data leakage and robust metric calculation.",
        techStack: ["Python", "scikit-learn", "numpy", "pandas"],
        role: "Senior ML Engineer",
        highlights: ["Eliminated statistical data leakage in cross-validation splits", "Vectorized token overlap metrics with 12x speedup"],
        repoUrl: "https://github.com/erostova-ml/legal-search"
      }
    ],
    skills: [
      { name: "Python", proficiency: 5 },
      { name: "Data Pipeline Architecture", proficiency: 5 },
      { name: "numpy/pandas", proficiency: 5 },
      { name: "Model Evaluation", proficiency: 5 }
    ],
    dsaTopicsSolved: [
      { topic: "math", approxCount: 20, difficultyComfort: "hard" },
      { topic: "binary-search", approxCount: 30, difficultyComfort: "hard" },
      { topic: "math", approxCount: 40, difficultyComfort: "hard" },
      { topic: "arrays", approxCount: 50, difficultyComfort: "hard" },
      { topic: "sorting", approxCount: 30, difficultyComfort: "medium" }
    ]
  },
  ml_student_vision: {
    candidate: {
      name: "Jordan Lee",
      email: "jordan.lee@example.edu",
      experienceLevel: "student",
      githubUrl: "https://github.com/jlee-student"
    },
    primaryDomain: "ml",
    secondaryDomains: [],
    techStack: {
      languages: ["Python"],
      frameworks: ["scikit-learn", "numpy", "pandas", "matplotlib"],
      databases: ["SQLite"],
      tools: ["Jupyter", "Git"]
    },
    projects: [
      {
        title: "Predictive Plant Health Classifier",
        description: "Computer vision and tabular pipeline classifying leaf disease features using calibrated Random Forest models.",
        techStack: ["Python", "scikit-learn", "numpy", "pandas"],
        role: "Researcher",
        highlights: ["Achieved 91% F1 score across 12 imbalanced classes", "Benchmarked custom confusion matrix and precision-recall metrics"],
        repoUrl: "https://github.com/jlee-student/plant-health"
      }
    ],
    skills: [
      { name: "Python", proficiency: 3 },
      { name: "scikit-learn", proficiency: 3 },
      { name: "Data Cleaning", proficiency: 4 }
    ],
    dsaTopicsSolved: [
      { topic: "arrays", approxCount: 25, difficultyComfort: "medium" },
      { topic: "sorting", approxCount: 20, difficultyComfort: "easy" },
      { topic: "hashing", approxCount: 15, difficultyComfort: "easy" }
    ]
  },
  security_appsec_analyst: {
    candidate: {
      name: "Samantha Wright",
      email: "samantha.wright@example.com",
      experienceLevel: "mid",
      githubUrl: "https://github.com/swright-sec"
    },
    primaryDomain: "security",
    secondaryDomains: ["backend", "web"],
    techStack: {
      languages: ["Python", "JavaScript"],
      frameworks: ["Express", "FastAPI"],
      databases: ["PostgreSQL"],
      tools: ["Burp Suite", "Semgrep", "pytest", "Docker"]
    },
    projects: [
      {
        title: "Defensive API Gateway & Token Sanitizer",
        description: "Zero-trust reverse proxy protecting legacy microservices from SSRF, SQL Injection, and JWT signature bypass attacks.",
        techStack: ["Python", "JavaScript", "Docker"],
        role: "Application Security Engineer",
        highlights: ["Authored AST-based sanitization rule preventing nested path traversal", "Implemented strict cryptographic JWT validation"],
        repoUrl: "https://github.com/swright-sec/defensive-gateway"
      }
    ],
    skills: [
      { name: "Application Security", proficiency: 5 },
      { name: "JWT & Cryptography", proficiency: 4 },
      { name: "Vulnerability Remediation", proficiency: 5 },
      { name: "Python", proficiency: 4 }
    ],
    dsaTopicsSolved: [
      { topic: "strings", approxCount: 40, difficultyComfort: "hard" },
      { topic: "hashing", approxCount: 35, difficultyComfort: "hard" },
      { topic: "bit-manipulation", approxCount: 20, difficultyComfort: "medium" },
      { topic: "arrays", approxCount: 30, difficultyComfort: "medium" }
    ]
  },
  security_junior_pentester: {
    candidate: {
      name: "Tariq Mansour",
      email: "tariq.mansour@example.com",
      experienceLevel: "junior",
      githubUrl: "https://github.com/tmansour-sec"
    },
    primaryDomain: "security",
    secondaryDomains: ["web"],
    techStack: {
      languages: ["Python"],
      frameworks: ["Flask"],
      databases: ["SQLite"],
      tools: ["OWASP ZAP", "Git", "Wireshark"]
    },
    projects: [
      {
        title: "Web Vulnerability Playground Lab",
        description: "Educational honeypot and deliberate vulnerable lab demonstrating Cross-Site Scripting (XSS) and SQL injection filters.",
        techStack: ["Python", "Flask", "SQLite"],
        role: "Lab Author",
        highlights: ["Created deterministic exploit payload test suite", "Patched reflected XSS with contextual encoding"],
        repoUrl: "https://github.com/tmansour-sec/vuln-lab"
      }
    ],
    skills: [
      { name: "Web Security", proficiency: 3 },
      { name: "Python", proficiency: 3 },
      { name: "SQL Injection Defense", proficiency: 4 }
    ],
    dsaTopicsSolved: [
      { topic: "strings", approxCount: 25, difficultyComfort: "medium" },
      { topic: "hashing", approxCount: 20, difficultyComfort: "easy" },
      { topic: "arrays", approxCount: 20, difficultyComfort: "easy" }
    ]
  }
};

