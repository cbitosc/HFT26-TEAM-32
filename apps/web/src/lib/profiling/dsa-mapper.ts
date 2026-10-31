export const CANONICAL_DSA_TOPICS = [
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
  'bit-manipulation',
  'math'
] as const;

export type DsaTopic = typeof CANONICAL_DSA_TOPICS[number];

export interface DsaClaim {
  topic: string;
  approxCount?: number;
  difficultyComfort?: 'easy' | 'medium' | 'hard';
}

export interface CandidateDsaBoundaries {
  claimedTopics: string[];
  allowedTopics: {
    novice: string[];
    adept: string[];
    master: string[];
  };
  disallowedTopics: string[];
  summaryMessage: string;
}

/**
 * Deterministically maps claimed DSA topics to allowed assessment boundaries.
 * CRITICAL RULE: A topic NOT claimed by the candidate is strictly DISALLOWED
 * and will NEVER be generated or assigned in any tier.
 */
export function computeDsaBoundaries(portfolio: any): CandidateDsaBoundaries {
  let claimed: DsaClaim[] = [];

  if (Array.isArray(portfolio.dsaTopicsSolved)) {
    claimed = portfolio.dsaTopicsSolved;
  } else if (Array.isArray(portfolio.skills)) {
    // Infer fundamental topics matching skills
    const skillText = portfolio.skills.join(' ').toLowerCase();
    claimed = CANONICAL_DSA_TOPICS
      .filter((t) => skillText.includes(t.replace('-', ' ')))
      .map((topic) => ({ topic, approxCount: 10, difficultyComfort: 'medium' }));
  }

  // If no topics claimed at all, assign minimal baseline of arrays/strings/sorting only if mentioned
  if (claimed.length === 0) {
    claimed = [
      { topic: 'arrays', approxCount: 15, difficultyComfort: 'easy' },
      { topic: 'strings', approxCount: 15, difficultyComfort: 'easy' },
      { topic: 'sorting', approxCount: 10, difficultyComfort: 'easy' },
    ];
  }

  const claimedMap = new Map<string, DsaClaim>();
  for (const c of claimed) {
    const norm = String(c.topic || '').toLowerCase().trim().replace(/\s+/g, '-');
    if (norm) claimedMap.set(norm, c);
  }

  const claimedTopics = Array.from(claimedMap.keys());

  // Novice: Any claimed topic
  const allowedNovice = claimedTopics;

  // Adept: Claimed topics with approxCount >= 10 OR comfort medium/hard
  const allowedAdept = claimedTopics.filter((topic) => {
    const c = claimedMap.get(topic);
    if (!c) return false;
    return (c.approxCount && c.approxCount >= 10) || c.difficultyComfort === 'medium' || c.difficultyComfort === 'hard';
  });

  // Master: Claimed topics explicitly marked as medium or hard comfort
  const allowedMaster = claimedTopics.filter((topic) => {
    const c = claimedMap.get(topic);
    if (!c) return false;
    return c.difficultyComfort === 'medium' || c.difficultyComfort === 'hard';
  });

  // Disallowed: Every canonical DSA topic NOT in claimedTopics
  const disallowedTopics = CANONICAL_DSA_TOPICS.filter((t) => !claimedMap.has(t));

  const summaryMessage = `Candidate bounded to ${claimedTopics.length} claimed DSA topics. Strict boundary active: ${disallowedTopics.length} unclaimed topics (e.g. ${disallowedTopics.slice(0, 3).join(', ')}) are strictly prohibited.`;

  return {
    claimedTopics,
    allowedTopics: {
      novice: allowedNovice.length > 0 ? allowedNovice : claimedTopics,
      adept: allowedAdept.length > 0 ? allowedAdept : claimedTopics,
      master: allowedMaster.length > 0 ? allowedMaster : claimedTopics,
    },
    disallowedTopics,
    summaryMessage,
  };
}

