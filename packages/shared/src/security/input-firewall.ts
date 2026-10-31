export interface FirewallScanResult {
  blocked: boolean;
  reason?: string;
  category?: 'prompt_injection' | 'system_prompt_leak' | 'solution_exfiltration' | 'obfuscation' | 'code_generation_demand';
  sanitizedText?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /dan\s+mode/i,
  /jailbreak/i,
  /system\s+override/i,
  /forget\s+(all\s+)?rules/i,
  /act\s+as\s+(an\s+)?unrestricted/i,
  /pretend\s+you\s+have\s+no\s+limits/i
];

const LEAK_PATTERNS = [
  /print\s+(your\s+)?(system\s+prompt|instructions|initial\s+prompt)/i,
  /show\s+(me\s+)?(your\s+)?(exact\s+)?(system\s+message|system\s+prompt|instructions)/i,
  /what\s+are\s+your\s+(exact\s+)?instructions/i,
  /output\s+the\s+text\s+above/i,
  /repeat\s+(everything|the\s+words)\s+above/i,
  /reveal\s+hidden\s+tests/i,
  /show\s+hidden\s+test/i,
  /\bhidden\s+test(s|\s+cases)?\b/i
];

const SOLUTION_DEMAND_PATTERNS = [
  /(give|provide|show|write)\s+(me\s+)?(the\s+)?(full|entire|complete)\s+solution/i,
  /write\s+(the\s+)?code\s+for\s+me/i,
  /solve\s+(this\s+problem|this|the\s+problem)\s+(for\s+me)?/i,
  /give\s+me\s+the\s+working\s+code/i,
  /just\s+fix\s+my\s+code/i,
  /paste\s+the\s+answer/i
];

const OBFUSCATION_PATTERNS = [
  /^[A-Za-z0-9+/=]{40,}$/, // Raw Base64 block
  /eval\(atob\(/i,
  /fromhex\(/i,
  /rot13/i
];

export function inspectAssistantInput(userInput: string): FirewallScanResult {
  if (!userInput || typeof userInput !== 'string') {
    return { blocked: true, reason: 'Empty input received' };
  }

  const trimmed = userInput.trim();

  // 1. Prompt Injection Checks
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        category: 'prompt_injection',
        reason: 'Prompt injection pattern detected'
      };
    }
  }

  // 2. System Prompt / Hidden test leak checks
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        category: 'system_prompt_leak',
        reason: 'Attempted exfiltration of system prompt or test suite'
      };
    }
  }

  // 3. Demands for complete code solutions
  for (const pattern of SOLUTION_DEMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        category: 'solution_exfiltration',
        reason: 'Direct solution requests violate examination protocol'
      };
    }
  }

  // 4. Obfuscation detection
  for (const pattern of OBFUSCATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        category: 'obfuscation',
        reason: 'Obfuscated or encoded payload detected'
      };
    }
  }

  return {
    blocked: false,
    sanitizedText: trimmed
  };
}

export interface OutputFirewallParams {
  responseContent: string;
  referenceSolutionSnippets: string[];
  canaryTokens: string[];
  unlockedHintLevel: number;
}

export function inspectAssistantOutput(params: OutputFirewallParams): FirewallScanResult {
  const { responseContent, referenceSolutionSnippets, canaryTokens, unlockedHintLevel } = params;

  // 1. Canary Token Check (Did the model leak system prompt canary?)
  for (const canary of canaryTokens) {
    if (canary && responseContent.includes(canary)) {
      return {
        blocked: true,
        category: 'system_prompt_leak',
        reason: 'CRITICAL: Model output contained canary token from system prompt'
      };
    }
  }

  // 2. Code Block Line Cap Enforcement
  // L1..L3 = zero code lines allowed (conceptual only)
  // L4 = max 6 lines of structural pseudo-code only
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = responseContent.match(codeBlockRegex);

  if (matches) {
    if (unlockedHintLevel < 4) {
      return {
        blocked: true,
        category: 'code_generation_demand',
        reason: `Code blocks are forbidden at Hint Level ${unlockedHintLevel} (conceptual guidance only)`
      };
    }

    for (const block of matches) {
      const lines = block.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > 8) {
        return {
          blocked: true,
          category: 'code_generation_demand',
          reason: 'Assistant response contained excessive code lines (exceeds L4 pseudo-outline limit)'
        };
      }
    }
  }

  // 3. N-gram / Reference Solution Similarity
  // Extract 5-word shingles from response and compare against reference solution
  const responseWords = responseContent.toLowerCase().replace(/[^a-z0-9_]/g, ' ').split(/\s+/).filter(Boolean);
  const responseShingles = new Set<string>();
  for (let i = 0; i <= responseWords.length - 5; i++) {
    responseShingles.add(responseWords.slice(i, i + 5).join(' '));
  }

  for (const snippet of referenceSolutionSnippets) {
    const snippetWords = snippet.toLowerCase().replace(/[^a-z0-9_]/g, ' ').split(/\s+/).filter(Boolean);
    let overlapCount = 0;
    for (let i = 0; i <= snippetWords.length - 5; i++) {
      const shingle = snippetWords.slice(i, i + 5).join(' ');
      if (responseShingles.has(shingle)) {
        overlapCount++;
      }
    }

    if (snippetWords.length >= 10 && overlapCount >= 4) {
      return {
        blocked: true,
        category: 'solution_exfiltration',
        reason: 'Model output contains verbatim code segments matching reference solution'
      };
    }
  }

  return { blocked: false };
}

