import { TaskSpec } from '@proctor-forge/shared';

export const WEB_TASKS: TaskSpec[] = [
  // 1. NOVICE Variant A (Web)
  {
    id: 'web_novice_a',
    tier: 'novice',
    domain: 'web',
    language: 'javascript',
    framework: 'react',
    dsaTopics: ['arrays', 'strings'],
    title: 'Sanitize & Deduplicate Tag Selector',
    scenario: 'E-commerce product tagging interface allowing users to input comma-separated tags.',
    problemStatement: `Implement \`parseAndCleanTags(rawInput)\`. It accepts a comma-separated string of user tags and must:
1. Trim whitespace from each tag.
2. Convert all tags to lowercase.
3. Remove empty tags.
4. Deduplicate tags while preserving the original first-occurrence order.
5. Return an array of clean strings.`,
    constraints: ['Input length up to 1,000 characters', 'Preserve first occurrence order'],
    acceptanceCriteria: ['Returns empty array for empty/whitespace input', 'Removes duplicates case-insensitively'],
    files: [
      {
        path: 'tagParser.js',
        content: `function parseAndCleanTags(rawInput) {
  // BUG: Does not handle empty tags and case deduplication properly
  if (!rawInput) return [];
  return rawInput.split(',');
}

module.exports = { parseAndCleanTags };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'tagParser.js',
        content: `function parseAndCleanTags(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const parts = rawInput.split(',');
  const seen = new Set();
  const result = [];
  for (const part of parts) {
    const cleaned = part.trim().toLowerCase();
    if (cleaned.length > 0 && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

module.exports = { parseAndCleanTags };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_basic', name: 'Basic Tag Separation', weight: 1, category: 'correctness' },
        { id: 'test_trim_case', name: 'Trim and Lowercase Normalization', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_dedup_order', name: 'Deduplication with First Occurrence Order', weight: 1, category: 'edge' },
        { id: 'test_empty_commas', name: 'Consecutive Empty Commas Handling', weight: 1, category: 'edge' },
        { id: 'test_empty_input', name: 'Empty and Null Input Handling', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'tagParser.test.js',
        content: `const { parseAndCleanTags } = require('./tagParser');

async function runSuite() {
  const results = [];
  
  // Test 1: Basic
  try {
    const res = parseAndCleanTags('react,nextjs,tailwind');
    const passed = JSON.stringify(res) === JSON.stringify(['react', 'nextjs', 'tailwind']);
    results.push({ id: 'test_basic', name: 'Basic Tag Separation', passed, durationMs: 2, category: 'correctness', weight: 1 });
  } catch (err) {
    results.push({ id: 'test_basic', name: 'Basic Tag Separation', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: err.message });
  }

  // Test 2: Trim & Case
  try {
    const res = parseAndCleanTags('  React  , NextJS  ');
    const passed = JSON.stringify(res) === JSON.stringify(['react', 'nextjs']);
    results.push({ id: 'test_trim_case', name: 'Trim and Lowercase Normalization', passed, durationMs: 2, category: 'correctness', weight: 1 });
  } catch (err) {
    results.push({ id: 'test_trim_case', name: 'Trim and Lowercase Normalization', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: err.message });
  }

  // Hidden 1: Dedup
  try {
    const res = parseAndCleanTags('web, Web, WEB, backend, web');
    const passed = JSON.stringify(res) === JSON.stringify(['web', 'backend']);
    results.push({ id: 'test_dedup_order', name: 'Deduplication with First Occurrence Order', passed, durationMs: 2, category: 'edge', weight: 1 });
  } catch (err) {
    results.push({ id: 'test_dedup_order', name: 'Deduplication with First Occurrence Order', passed: false, durationMs: 2, category: 'edge', weight: 1, error: err.message });
  }

  // Hidden 2: Empty commas
  try {
    const res = parseAndCleanTags(',,, ,  ,');
    const passed = Array.isArray(res) && res.length === 0;
    results.push({ id: 'test_empty_commas', name: 'Consecutive Empty Commas Handling', passed, durationMs: 2, category: 'edge', weight: 1 });
  } catch (err) {
    results.push({ id: 'test_empty_commas', name: 'Consecutive Empty Commas Handling', passed: false, durationMs: 2, category: 'edge', weight: 1, error: err.message });
  }

  // Hidden 3: Empty and Null Input
  try {
    const resEmpty = parseAndCleanTags('');
    const resNull = parseAndCleanTags(null);
    const passed = Array.isArray(resEmpty) && resEmpty.length === 0 && Array.isArray(resNull) && resNull.length === 0;
    results.push({ id: 'test_empty_input', name: 'Empty and Null Input Handling', passed, durationMs: 2, category: 'edge', weight: 1 });
  } catch (err) {
    results.push({ id: 'test_empty_input', name: 'Empty and Null Input Handling', passed: false, durationMs: 2, category: 'edge', weight: 1, error: err.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Think about using a Set data structure to keep track of strings you have already encountered.',
      level2: 'Iterate through the split tokens, call .trim().toLowerCase(), and check if the length is greater than 0.',
      level3: 'Notice that rawInput might contain multiple adjacent commas like ",,,", which produce empty strings when split.',
      level4: 'Loop over tokens: if cleaned.length > 0 and not seen.has(cleaned), seen.add(cleaned) and push to results array.'
    },
    seed: 101
  },

  // 2. NOVICE Variant B (Web)
  {
    id: 'web_novice_b',
    tier: 'novice',
    domain: 'web',
    language: 'javascript',
    framework: 'vanilla',
    dsaTopics: ['strings', 'hashing'],
    title: 'URL Query Parameter Builder',
    scenario: 'Analytics SDK generating canonical tracking URLs with sorted query parameters.',
    problemStatement: `Implement \`buildQueryString(params)\`. Given an object of key-value pairs:
1. Ignore keys with values that are \`null\` or \`undefined\`.
2. Format booleans and numbers as strings.
3. Sort the query parameter keys alphabetically.
4. Encode keys and values with \`encodeURIComponent\`.
5. Join with \`&\`. If no valid parameters exist, return an empty string.`,
    constraints: ['Sorted alphabetical key order', 'Handles special characters safely'],
    acceptanceCriteria: ['Keys are strictly ascending', 'Null/undefined omitted'],
    files: [
      {
        path: 'queryBuilder.js',
        content: `function buildQueryString(params) {
  // BUG: Does not sort keys or filter nulls
  return Object.entries(params).map(([k, v]) => \`\${k}=\${v}\`).join('&');
}

module.exports = { buildQueryString };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'queryBuilder.js',
        content: `function buildQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  const keys = Object.keys(params).sort();
  const pairs = [];
  for (const k of keys) {
    const v = params[k];
    if (v !== null && v !== undefined) {
      pairs.push(\`\${encodeURIComponent(k)}=\${encodeURIComponent(String(v))}\`);
    }
  }
  return pairs.join('&');
}

module.exports = { buildQueryString };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_basic_query', name: 'Basic Parameters', weight: 1, category: 'correctness' },
        { id: 'test_null_filtering', name: 'Ignore Null/Undefined', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_alphabetical_order', name: 'Strict Alphabetical Ordering', weight: 1, category: 'edge' },
        { id: 'test_url_encoding', name: 'Special Character URI Encoding', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'queryBuilder.test.js',
        content: `const { buildQueryString } = require('./queryBuilder');

async function runSuite() {
  const results = [];
  try {
    const res = buildQueryString({ b: '2', a: '1' });
    results.push({ id: 'test_basic_query', name: 'Basic Parameters', passed: res.includes('a=1') && res.includes('b=2'), durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_basic_query', name: 'Basic Parameters', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const res = buildQueryString({ valid: 'yes', skip: null, skip2: undefined });
    results.push({ id: 'test_null_filtering', name: 'Ignore Null/Undefined', passed: res === 'valid=yes', durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_null_filtering', name: 'Ignore Null/Undefined', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const res = buildQueryString({ z: 1, m: 2, a: 3 });
    results.push({ id: 'test_alphabetical_order', name: 'Strict Alphabetical Ordering', passed: res === 'a=3&m=2&z=1', durationMs: 2, category: 'edge', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_alphabetical_order', name: 'Strict Alphabetical Ordering', passed: false, durationMs: 2, category: 'edge', weight: 1, error: e.message });
  }

  try {
    const res = buildQueryString({ 'q param': 'hello world & more' });
    results.push({ id: 'test_url_encoding', name: 'Special Character URI Encoding', passed: res === 'q%20param=hello%20world%20%26%20more', durationMs: 2, category: 'edge', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_url_encoding', name: 'Special Character URI Encoding', passed: false, durationMs: 2, category: 'edge', weight: 1, error: e.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Sort keys prior to generating key-value pairs.',
      level2: 'Use Object.keys(params).sort() to guarantee deterministic order.',
      level3: 'Be sure to filter out null and undefined values using strict inequality.',
      level4: 'Iterate sorted keys, encode each key and String(val) with encodeURIComponent, join with "&".'
    },
    seed: 102
  },

  // 3. ADEPT Variant A (Web)
  {
    id: 'web_adept_a',
    tier: 'adept',
    domain: 'web',
    language: 'javascript',
    framework: 'express',
    dsaTopics: ['sliding-window', 'hashing'],
    title: 'Sliding-Window IP Rate Limiter Middleware',
    scenario: 'API Gateway middleware that enforces sliding-window request throttling across multi-tier clients.',
    problemStatement: `Implement a multi-file RateLimiter class in \`rateLimiter.js\` used by \`middleware.js\`.
Requirements:
1. Track client requests within a rolling time window (\`windowMs\`).
2. If requests from an IP in the current window exceed \`maxRequests\`, reject with status \`429\` and return remaining reset time.
3. Automatically expire timestamps older than \`now - windowMs\` to prevent memory leaks.
4. Support an \`isAllowed(ip, currentTime)\` method returning \`{ allowed: boolean, remaining: number, resetMs: number }\`.`,
    constraints: ['Must clean up stale window timestamps', 'O(1) amortized check per request'],
    acceptanceCriteria: ['Bursts exceeding limit are blocked', 'Tokens replenish as time slides forward'],
    files: [
      {
        path: 'rateLimiter.js',
        content: `class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();
  }

  isAllowed(ip, currentTime = Date.now()) {
    // BUG: Missing sliding window cleanup and window reset logic
    const count = (this.hits.get(ip) || 0) + 1;
    this.hits.set(ip, count);
    return {
      allowed: count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - count),
      resetMs: this.windowMs
    };
  }
}

module.exports = { RateLimiter };
`,
        editable: true
      },
      {
        path: 'middleware.js',
        content: `const { RateLimiter } = require('./rateLimiter');

function createRateLimitMiddleware(limiter) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.ip || '127.0.0.1';
    const decision = limiter.isAllowed(ip, Date.now());
    if (!decision.allowed) {
      res.statusCode = 429;
      res.headers = { 'Retry-After': Math.ceil(decision.resetMs / 1000) };
      res.body = { error: 'Too Many Requests' };
      return;
    }
    next();
  };
}

module.exports = { createRateLimitMiddleware };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'rateLimiter.js',
        content: `class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clientTimestamps = new Map();
  }

  isAllowed(ip, currentTime = Date.now()) {
    let timestamps = this.clientTimestamps.get(ip);
    if (!timestamps) {
      timestamps = [];
      this.clientTimestamps.set(ip, timestamps);
    }

    const cutoff = currentTime - this.windowMs;
    // Sliding window cleanup: filter out timestamps older than cutoff
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length < this.maxRequests) {
      timestamps.push(currentTime);
      const earliest = timestamps[0];
      const resetMs = Math.max(0, this.windowMs - (currentTime - earliest));
      return {
        allowed: true,
        remaining: this.maxRequests - timestamps.length,
        resetMs
      };
    } else {
      const earliest = timestamps[0];
      const resetMs = Math.max(0, this.windowMs - (currentTime - earliest));
      return {
        allowed: false,
        remaining: 0,
        resetMs
      };
    }
  }
}

module.exports = { RateLimiter };
`,
        editable: true
      },
      {
        path: 'middleware.js',
        content: `const { RateLimiter } = require('./rateLimiter');

function createRateLimitMiddleware(limiter) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.ip || '127.0.0.1';
    const decision = limiter.isAllowed(ip, Date.now());
    if (!decision.allowed) {
      res.statusCode = 429;
      res.headers = { 'Retry-After': Math.ceil(decision.resetMs / 1000) };
      res.body = { error: 'Too Many Requests' };
      return;
    }
    next();
  };
}

module.exports = { createRateLimitMiddleware };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_under_limit', name: 'Permit Requests Under Threshold', weight: 1, category: 'correctness' },
        { id: 'test_block_overflow', name: 'Block Requests Exceeding Threshold', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_window_sliding', name: 'Window Slides and Evicts Expired Hits', weight: 2, category: 'edge' },
        { id: 'test_multi_ip_isolation', name: 'Multiple IP Address Isolation', weight: 1, category: 'correctness' }
      ]
    },
    testFiles: [
      {
        path: 'rateLimiter.test.js',
        content: `const { RateLimiter } = require('./rateLimiter');

async function runSuite() {
  const results = [];
  
  // Test 1: Under limit
  try {
    const limiter = new RateLimiter(1000, 3);
    const r1 = limiter.isAllowed('ip-1', 100);
    const r2 = limiter.isAllowed('ip-1', 200);
    results.push({
      id: 'test_under_limit',
      name: 'Permit Requests Under Threshold',
      passed: r1.allowed && r2.allowed && r2.remaining === 1,
      durationMs: 2,
      category: 'correctness',
      weight: 1
    });
  } catch (e) {
    results.push({ id: 'test_under_limit', name: 'Permit Requests Under Threshold', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  // Test 2: Block overflow
  try {
    const limiter = new RateLimiter(1000, 2);
    limiter.isAllowed('ip-2', 100);
    limiter.isAllowed('ip-2', 200);
    const r3 = limiter.isAllowed('ip-2', 300);
    results.push({
      id: 'test_block_overflow',
      name: 'Block Requests Exceeding Threshold',
      passed: !r3.allowed && r3.remaining === 0,
      durationMs: 2,
      category: 'correctness',
      weight: 1
    });
  } catch (e) {
    results.push({ id: 'test_block_overflow', name: 'Block Requests Exceeding Threshold', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  // Hidden 1: Sliding window eviction
  try {
    const limiter = new RateLimiter(1000, 2);
    limiter.isAllowed('ip-3', 100);
    limiter.isAllowed('ip-3', 200);
    // Over limit at t=300
    const blocked = limiter.isAllowed('ip-3', 300);
    // At t=1150, the first request at 100 has expired (cutoff is 150)
    const allowedLater = limiter.isAllowed('ip-3', 1150);
    results.push({
      id: 'test_window_sliding',
      name: 'Window Slides and Evicts Expired Hits',
      passed: !blocked.allowed && allowedLater.allowed,
      durationMs: 2,
      category: 'edge',
      weight: 2
    });
  } catch (e) {
    results.push({ id: 'test_window_sliding', name: 'Window Slides and Evicts Expired Hits', passed: false, durationMs: 2, category: 'edge', weight: 2, error: e.message });
  }

  // Hidden 2: Multi IP isolation
  try {
    const limiter = new RateLimiter(1000, 1);
    limiter.isAllowed('ip-a', 100);
    const ipBResult = limiter.isAllowed('ip-b', 100);
    results.push({
      id: 'test_multi_ip_isolation',
      name: 'Multiple IP Address Isolation',
      passed: ipBResult.allowed,
      durationMs: 2,
      category: 'correctness',
      weight: 1
    });
  } catch (e) {
    results.push({ id: 'test_multi_ip_isolation', name: 'Multiple IP Address Isolation', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Maintain a list of request timestamps for each IP address instead of a simple integer counter.',
      level2: 'When a new request arrives, calculate cutoff = currentTime - windowMs and remove all timestamps older than cutoff.',
      level3: 'A FIFO queue or array of ascending timestamps allows you to pop/shift elements while timestamps[0] <= cutoff.',
      level4: 'Store clientTimestamps Map<string, number[]>. Shift while array[0] <= cutoff. If array.length < maxRequests, push and allow.'
    },
    seed: 103
  },

  // 4. ADEPT Variant B (Web)
  {
    id: 'web_adept_b',
    tier: 'adept',
    domain: 'web',
    language: 'javascript',
    framework: 'vanilla',
    dsaTopics: ['stack', 'strings'],
    title: 'Nested HTML Tag Validator & Auto-Closer',
    scenario: 'Rich text markdown-to-HTML parser preventing malformed DOM trees in frontend editors.',
    problemStatement: `Implement \`validateAndFixHtml(htmlString)\` in \`htmlValidator.js\`.
1. Detect opening tags \`<tag>\` and closing tags \`</tag>\`. Ignore self-closing tags like \`<img ... />\` and \`<br/>\`.
2. Use a Stack to verify that nested tags close in strict LIFO order.
3. If tags are properly balanced, return \`{ valid: true, fixedHtml: htmlString }\`.
4. If closing tags are missing at the end, append missing closing tags in reverse order.
5. If invalidly interleaved closing tags appear (e.g. \`<b><i></b></i>\`), return \`{ valid: false, error: 'Mismatched closing tag' }\`.`,
    constraints: ['Strict LIFO nesting verification', 'Handles arbitrary tag names'],
    acceptanceCriteria: ['Auto-closes unclosed tags', 'Rejects interleaved mismatched tags'],
    files: [
      {
        path: 'htmlValidator.js',
        content: `function validateAndFixHtml(html) {
  // BUG: Naive regex check without proper stack state
  return { valid: true, fixedHtml: html };
}

module.exports = { validateAndFixHtml };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'htmlValidator.js',
        content: `function validateAndFixHtml(html) {
  if (typeof html !== 'string') return { valid: false, error: 'Input must be string' };
  
  const tagRegex = /<(\\/)?([a-zA-Z0-9]+)([^>]*)>/g;
  const stack = [];
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();
    const rest = match[3] || '';

    // Ignore self-closing tags
    if (rest.trim().endsWith('/')) {
      continue;
    }

    if (!isClosing) {
      stack.push(tagName);
    } else {
      if (stack.length === 0) {
        return { valid: false, error: \`Unexpected closing tag </\${tagName}>\` };
      }
      const top = stack.pop();
      if (top !== tagName) {
        return { valid: false, error: 'Mismatched closing tag' };
      }
    }
  }

  if (stack.length === 0) {
    return { valid: true, fixedHtml: html };
  }

  // Auto-close remaining tags
  let fixed = html;
  while (stack.length > 0) {
    const unclosed = stack.pop();
    fixed += \`</\${unclosed}>\`;
  }

  return { valid: true, fixedHtml: fixed };
}

module.exports = { validateAndFixHtml };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_balanced', name: 'Properly Balanced HTML', weight: 1, category: 'correctness' },
        { id: 'test_auto_close', name: 'Auto-Close Missing End Tags', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_mismatched', name: 'Detect Interleaved Mismatch', weight: 1, category: 'edge' },
        { id: 'test_self_closing', name: 'Ignore Self-Closing Tags', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'htmlValidator.test.js',
        content: `const { validateAndFixHtml } = require('./htmlValidator');

async function runSuite() {
  const results = [];
  try {
    const res = validateAndFixHtml('<div><p>Hello</p></div>');
    results.push({ id: 'test_balanced', name: 'Properly Balanced HTML', passed: res.valid && res.fixedHtml === '<div><p>Hello</p></div>', durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_balanced', name: 'Properly Balanced HTML', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const res = validateAndFixHtml('<div><span>Text');
    results.push({ id: 'test_auto_close', name: 'Auto-Close Missing End Tags', passed: res.valid && res.fixedHtml === '<div><span>Text</span></div>', durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_auto_close', name: 'Auto-Close Missing End Tags', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const res = validateAndFixHtml('<b><i>mismatched</b></i>');
    results.push({ id: 'test_mismatched', name: 'Detect Interleaved Mismatch', passed: !res.valid && res.error === 'Mismatched closing tag', durationMs: 2, category: 'edge', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_mismatched', name: 'Detect Interleaved Mismatch', passed: false, durationMs: 2, category: 'edge', weight: 1, error: e.message });
  }

  try {
    const res = validateAndFixHtml('<div><img src="test.png" /></div>');
    results.push({ id: 'test_self_closing', name: 'Ignore Self-Closing Tags', passed: res.valid, durationMs: 2, category: 'edge', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_self_closing', name: 'Ignore Self-Closing Tags', passed: false, durationMs: 2, category: 'edge', weight: 1, error: e.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'A Stack is the classic data structure for matching nested brackets or HTML tags.',
      level2: 'Push tag names when you see an opening tag; pop and compare when you see a closing tag.',
      level3: 'If the tag has a trailing slash before >, it is self-closing and should not be pushed to the stack.',
      level4: 'At the end of string, if stack is not empty, pop remaining items and append </tagName> to string.'
    },
    seed: 104
  },

  // 5. MASTER Variant A (Web)
  {
    id: 'web_master_a',
    tier: 'master',
    domain: 'web',
    language: 'javascript',
    framework: 'vanilla',
    dsaTopics: ['trees', 'dfs', 'hashing'],
    title: 'High-Performance Virtual DOM Diffing Engine',
    scenario: 'Core frontend rendering framework calculating minimal patch mutations between hierarchical component trees.',
    problemStatement: `Implement \`diffVNodes(oldTree, newTree)\` in \`vdomDiff.js\` with optimal O(N) complexity.
Given two virtual DOM trees with nodes of format: \`{ key, tag, props: {}, children: [] }\`.
Generate a minimal patch instruction list:
- \`{ type: 'CREATE', node: newTree }\` if oldTree is null
- \`{ type: 'REMOVE', key }\` if newTree is null
- \`{ type: 'REPLACE', key, node: newTree }\` if tag or key differs
- \`{ type: 'UPDATE_PROPS', key, propsDiff: { key: newVal | null } }\` if props changed
- Keyed reconciliation for \`children\`: detect reordered, inserted, or removed children using their \`key\` attributes in linear time.`,
    constraints: ['Max recursion depth 100', 'Linear time O(N) keyed lookup'],
    acceptanceCriteria: ['Generates minimal DOM patch operations', 'Keyed children diff handles reordering'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [100, 200, 400],
        maxGrowthRatio: 2.4
      }
    },
    files: [
      {
        path: 'vdomDiff.js',
        content: `function diffVNodes(oldTree, newTree) {
  // BUG: Naive replacement of entire subtree
  if (!oldTree) return [{ type: 'CREATE', node: newTree }];
  if (!newTree) return [{ type: 'REMOVE', key: oldTree.key }];
  return [{ type: 'REPLACE', key: oldTree.key, node: newTree }];
}

module.exports = { diffVNodes };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'vdomDiff.js',
        content: `function diffVNodes(oldTree, newTree) {
  const patches = [];

  function walk(oldNode, newNode) {
    if (!oldNode && !newNode) return;
    if (!oldNode) {
      patches.push({ type: 'CREATE', node: newNode });
      return;
    }
    if (!newNode) {
      patches.push({ type: 'REMOVE', key: oldNode.key });
      return;
    }
    if (oldNode.tag !== newNode.tag || oldNode.key !== newNode.key) {
      patches.push({ type: 'REPLACE', key: oldNode.key, node: newNode });
      return;
    }

    // Props diffing
    const propsDiff = {};
    const oldProps = oldNode.props || {};
    const newProps = newNode.props || {};
    let hasPropsDiff = false;

    for (const [k, v] of Object.entries(newProps)) {
      if (oldProps[k] !== v) {
        propsDiff[k] = v;
        hasPropsDiff = true;
      }
    }
    for (const k of Object.keys(oldProps)) {
      if (!(k in newProps)) {
        propsDiff[k] = null;
        hasPropsDiff = true;
      }
    }
    if (hasPropsDiff) {
      patches.push({ type: 'UPDATE_PROPS', key: oldNode.key, propsDiff });
    }

    // Keyed children diff
    const oldChildren = oldNode.children || [];
    const newChildren = newNode.children || [];
    const oldKeyMap = new Map();
    for (const child of oldChildren) {
      if (child.key) oldKeyMap.set(child.key, child);
    }

    for (const newChild of newChildren) {
      if (newChild.key && oldKeyMap.has(newChild.key)) {
        walk(oldKeyMap.get(newChild.key), newChild);
      } else {
        patches.push({ type: 'CREATE', node: newChild });
      }
    }

    const newKeySet = new Set(newChildren.map(c => c.key).filter(Boolean));
    for (const oldChild of oldChildren) {
      if (oldChild.key && !newKeySet.has(oldChild.key)) {
        patches.push({ type: 'REMOVE', key: oldChild.key });
      }
    }
  }

  walk(oldTree, newTree);
  return patches;
}

module.exports = { diffVNodes };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_create_remove', name: 'Create and Remove Root Nodes', weight: 1, category: 'correctness' },
        { id: 'test_props_diff', name: 'Incremental Props Update', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_keyed_reconciliation', name: 'Keyed Children Reconciliation', weight: 2, category: 'edge' },
        { id: 'test_perf_large_tree', name: 'Performance On Large Virtual DOM Trees', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'vdomDiff.test.js',
        content: `const { diffVNodes } = require('./vdomDiff');

async function runSuite() {
  const results = [];
  try {
    const patches = diffVNodes(null, { key: 'r1', tag: 'div', props: {}, children: [] });
    results.push({ id: 'test_create_remove', name: 'Create and Remove Root Nodes', passed: patches.length === 1 && patches[0].type === 'CREATE', durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_create_remove', name: 'Create and Remove Root Nodes', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const oldNode = { key: 'a', tag: 'button', props: { disabled: false, color: 'blue' } };
    const newNode = { key: 'a', tag: 'button', props: { disabled: true } };
    const patches = diffVNodes(oldNode, newNode);
    const hasPropPatch = patches.some(p => p.type === 'UPDATE_PROPS' && p.propsDiff.disabled === true && p.propsDiff.color === null);
    results.push({ id: 'test_props_diff', name: 'Incremental Props Update', passed: hasPropPatch, durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_props_diff', name: 'Incremental Props Update', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const oldTree = {
      key: 'root', tag: 'ul', children: [
        { key: 'c1', tag: 'li' },
        { key: 'c2', tag: 'li' }
      ]
    };
    const newTree = {
      key: 'root', tag: 'ul', children: [
        { key: 'c2', tag: 'li' },
        { key: 'c3', tag: 'li' }
      ]
    };
    const patches = diffVNodes(oldTree, newTree);
    const removedC1 = patches.some(p => p.type === 'REMOVE' && p.key === 'c1');
    const createdC3 = patches.some(p => p.type === 'CREATE' && p.node.key === 'c3');
    results.push({ id: 'test_keyed_reconciliation', name: 'Keyed Children Reconciliation', passed: removedC1 && createdC3, durationMs: 2, category: 'edge', weight: 2 });
  } catch (e) {
    results.push({ id: 'test_keyed_reconciliation', name: 'Keyed Children Reconciliation', passed: false, durationMs: 2, category: 'edge', weight: 2, error: e.message });
  }

  try {
    const start = Date.now();
    const genChildren = (n) => Array.from({ length: n }, (_, i) => ({ key: 'k_' + i, tag: 'span', props: { idx: i } }));
    const t1 = { key: 'root', tag: 'div', children: genChildren(300) };
    const t2 = { key: 'root', tag: 'div', children: genChildren(300).reverse() };
    diffVNodes(t1, t2);
    const duration = Date.now() - start;
    results.push({ id: 'test_perf_large_tree', name: 'Performance On Large Virtual DOM Trees', passed: duration < 250, durationMs: duration, category: 'performance', weight: 2 });
  } catch (e) {
    results.push({ id: 'test_perf_large_tree', name: 'Performance On Large Virtual DOM Trees', passed: false, durationMs: 2, category: 'performance', weight: 2, error: e.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Avoid re-creating the entire node when only properties or children order change.',
      level2: 'Store old children in a Map keyed by node.key for O(1) matching against new children.',
      level3: 'Traverse properties: any key in newProps differing from oldProps is an update; any key in oldProps not in newProps is set to null.',
      level4: 'Recursive walk: walk(oldNode, newNode). Map old keys. Iterate new children, if key exists walk matching old, else CREATE patch. Find unvisited old keys and issue REMOVE.'
    },
    seed: 105
  },

  // 6. MASTER Variant B (Web)
  {
    id: 'web_master_b',
    tier: 'master',
    domain: 'web',
    language: 'javascript',
    framework: 'vanilla',
    dsaTopics: ['dp', 'arrays'],
    title: 'Text Diffing & Patch Reconstructor',
    scenario: 'Collaborative code editor diff engine calculating shortest edit script using Myers / LCS dynamic programming.',
    problemStatement: `Implement \`computeLcsDiff(linesA, linesB)\` in \`diffEngine.js\`.
Compute line-by-line diff using Longest Common Subsequence (LCS):
1. Return array of edit operations: \`{ op: 'EQUAL' | 'INSERT' | 'DELETE', text: string }\`.
2. Must minimize total number of INSERT and DELETE operations.
3. Must operate within strict memory and execution time limits on sequences up to 500 lines.`,
    constraints: ['O(N*M) time and space bounded by DP table optimization'],
    acceptanceCriteria: ['Reconstructs target text identically', 'Identifies exact common lines'],
    performanceBudget: {
      maxRuntimeMs: 350,
      complexityProbe: {
        inputSizes: [100, 200, 400],
        maxGrowthRatio: 2.5
      }
    },
    files: [
      {
        path: 'diffEngine.js',
        content: `function computeLcsDiff(linesA, linesB) {
  // BUG: Naive full replacement
  const edits = [];
  for (const l of linesA) edits.push({ op: 'DELETE', text: l });
  for (const l of linesB) edits.push({ op: 'INSERT', text: l });
  return edits;
}

module.exports = { computeLcsDiff };
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'diffEngine.js',
        content: `function computeLcsDiff(linesA, linesB) {
  const m = linesA.length;
  const n = linesB.length;
  // DP table for LCS length
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i][j + 1], dp[i + 1][j]);
      }
    }
  }

  // Backtrack to reconstruct edits
  const edits = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      edits.push({ op: 'EQUAL', text: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ op: 'INSERT', text: linesB[j - 1] });
      j--;
    } else if (i > 0) {
      edits.push({ op: 'DELETE', text: linesA[i - 1] });
      i--;
    }
  }

  edits.reverse();
  return edits;
}

module.exports = { computeLcsDiff };
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_identical', name: 'Identical Text Produces All Equal', weight: 1, category: 'correctness' },
        { id: 'test_simple_insert_del', name: 'Single Line Insertion and Deletion', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_mixed_diff', name: 'Interleaved Changes and Edits', weight: 2, category: 'edge' },
        { id: 'test_perf_diff', name: 'Scalability On 200+ Lines', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'diffEngine.test.js',
        content: `const { computeLcsDiff } = require('./diffEngine');

async function runSuite() {
  const results = [];
  try {
    const edits = computeLcsDiff(['a', 'b', 'c'], ['a', 'b', 'c']);
    results.push({ id: 'test_identical', name: 'Identical Text Produces All Equal', passed: edits.length === 3 && edits.every(e => e.op === 'EQUAL'), durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_identical', name: 'Identical Text Produces All Equal', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const edits = computeLcsDiff(['a', 'b'], ['a', 'c', 'b']);
    const hasInsertC = edits.some(e => e.op === 'INSERT' && e.text === 'c');
    results.push({ id: 'test_simple_insert_del', name: 'Single Line Insertion and Deletion', passed: hasInsertC && edits.length === 3, durationMs: 2, category: 'correctness', weight: 1 });
  } catch (e) {
    results.push({ id: 'test_simple_insert_del', name: 'Single Line Insertion and Deletion', passed: false, durationMs: 2, category: 'correctness', weight: 1, error: e.message });
  }

  try {
    const lA = ['header', 'old_title', 'content', 'footer'];
    const lB = ['header', 'new_title', 'content', 'extra', 'footer'];
    const edits = computeLcsDiff(lA, lB);
    const equalCount = edits.filter(e => e.op === 'EQUAL').length;
    results.push({ id: 'test_mixed_diff', name: 'Interleaved Changes and Edits', passed: equalCount === 3, durationMs: 2, category: 'edge', weight: 2 });
  } catch (e) {
    results.push({ id: 'test_mixed_diff', name: 'Interleaved Changes and Edits', passed: false, durationMs: 2, category: 'edge', weight: 2, error: e.message });
  }

  try {
    const start = Date.now();
    const lA = Array.from({ length: 150 }, (_, i) => 'line_' + i);
    const lB = Array.from({ length: 150 }, (_, i) => (i % 5 === 0 ? 'modified_' + i : 'line_' + i));
    computeLcsDiff(lA, lB);
    const duration = Date.now() - start;
    results.push({ id: 'test_perf_diff', name: 'Scalability On 200+ Lines', passed: duration < 250, durationMs: duration, category: 'performance', weight: 2 });
  } catch (e) {
    results.push({ id: 'test_perf_diff', name: 'Scalability On 200+ Lines', passed: false, durationMs: 2, category: 'performance', weight: 2, error: e.message });
  }

  return results;
}

module.exports = { runSuite };
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Classic Longest Common Subsequence (LCS) dynamic programming algorithm.',
      level2: 'Construct an (M+1) x (N+1) table where dp[i+1][j+1] = dp[i][j] + 1 if elements match.',
      level3: 'Backtrack from dp[M][N] to dp[0][0] to construct the sequence of edits.',
      level4: 'When lines match -> EQUAL. If dp[i][j-1] >= dp[i-1][j] -> INSERT linesB[j-1]. Otherwise -> DELETE linesA[i-1]. Reverse edits at end.'
    },
    seed: 106
  }
];

