import { CandidateDsaBoundaries } from '../profiling/dsa-mapper';

export interface CodeFile {
  path: string;
  name: string;
  content: string;
  editable: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  category: 'correctness' | 'edge_case' | 'performance';
}

export interface TierChallenge {
  id: string;
  tier: 'novice' | 'adept' | 'master';
  tierLabel: string;
  title: string;
  domain: string;
  language: string;
  dsaTopic: string;
  scenario: string;
  problemStatement: string;
  constraints: string[];
  files: CodeFile[];
  activeFilePath: string;
  referenceSolution: CodeFile[];
  tests: TestCase[];
  aiAssistantAllowed: boolean;
  timeLimitMinutes: number;
}

export function createThreeTierAssessment(portfolio: any, boundaries: CandidateDsaBoundaries): TierChallenge[] {
  const lang = portfolio.techStack?.languages?.[0]?.toLowerCase() || 'javascript';
  const domain = portfolio.primaryDomain || 'web';
  const primaryProject = portfolio.projects?.[0]?.title || 'Core Service Application';

  // Strict DSA topic selection from allowed topics
  const noviceDsa = boundaries.allowedTopics.novice[0] || 'arrays';
  const adeptDsa = boundaries.allowedTopics.adept[1] || boundaries.allowedTopics.adept[0] || 'two-pointers';
  const masterDsa = boundaries.allowedTopics.master[2] || boundaries.allowedTopics.master[0] || 'hashing';

  // 1. NOVICE CHALLENGE (Easy Bug Fix - 1 File - No AI)
  const noviceChallenge: TierChallenge = {
    id: 'tier-novice',
    tier: 'novice',
    tierLabel: 'Tier 1: Novice (Easy)',
    title: `Localized Bug Fix & Boundary Handler (${noviceDsa.toUpperCase()})`,
    domain,
    language: 'javascript',
    dsaTopic: noviceDsa,
    scenario: `In ${primaryProject}, an off-by-one boundary defect in the data normalizer is causing item duplication and failing on empty/single-element inputs.`,
    problemStatement: `### Bug Fixing Objective
You are tasked with fixing a critical bug in the \`sanitizeAndFilter\` function.

#### Current Issue:
1. When passed an array with boundary conditions or duplicate adjacent items, the current code erroneously skips the final element and crashes on empty arrays.
2. It should return a deduplicated, sorted array containing only valid elements without modifying the input array.

#### Requirements:
- Fix the loop condition in \`sanitizeAndFilter(items, threshold)\`.
- Handle \`items = []\` by returning an empty array \`[]\`.
- Filter out items strictly lower than \`threshold\` and remove consecutive duplicates.`,
    constraints: [
      'Time complexity must be O(N)',
      'Do not mutate the original input array',
      'Memory limit: 64MB'
    ],
    files: [
      {
        path: 'solution.js',
        name: 'solution.js',
        editable: true,
        content: `// Buggy starter code: fails on boundary items and empty inputs
function sanitizeAndFilter(items, threshold = 0) {
  if (!items) return null; // Bug: should return []

  const result = [];
  // Bug: starts at 1, skips first item and loop condition <= length causes out-of-bounds
  for (let i = 1; i <= items.length; i++) {
    if (items[i] > threshold) {
      result.push(items[i]);
    }
  }

  // Bug: fails to remove duplicates properly
  return result;
}

module.exports = { sanitizeAndFilter };
`
      }
    ],
    activeFilePath: 'solution.js',
    referenceSolution: [
      {
        path: 'solution.js',
        name: 'solution.js',
        editable: false,
        content: `function sanitizeAndFilter(items, threshold = 0) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const result = [];
  for (let i = 0; i < items.length; i++) {
    const val = items[i];
    if (val >= threshold) {
      if (result.length === 0 || result[result.length - 1] !== val) {
        result.push(val);
      }
    }
  }
  return result;
}

module.exports = { sanitizeAndFilter };`
      }
    ],
    tests: [
      {
        id: 'novice-t1',
        name: 'Handles Empty Array Input',
        description: 'Should return [] when given empty array',
        input: 'sanitizeAndFilter([], 5)',
        expectedOutput: '[]',
        isHidden: false,
        category: 'edge_case'
      },
      {
        id: 'novice-t2',
        name: 'Filters Items Below Threshold',
        description: 'Filters numbers strictly lower than threshold',
        input: 'sanitizeAndFilter([1, 4, 8, 2, 10], 4)',
        expectedOutput: '[4, 8, 10]',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'novice-t3',
        name: 'Removes Adjacent Duplicates',
        description: 'Preserves single instance of consecutive duplicate elements',
        input: 'sanitizeAndFilter([2, 2, 5, 5, 5, 9], 2)',
        expectedOutput: '[2, 5, 9]',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'novice-t4',
        name: 'Preserves First and Last Elements',
        description: 'Checks boundary elements at index 0 and index N-1',
        input: 'sanitizeAndFilter([10, 20, 30], 10)',
        expectedOutput: '[10, 20, 30]',
        isHidden: true,
        category: 'edge_case'
      }
    ],
    aiAssistantAllowed: false, // NO AI for Novice tier
    timeLimitMinutes: 15
  };

  // 2. ADEPT CHALLENGE (Multi-Step Feature Across 2-3 Files - Guarded AI)
  const adeptChallenge: TierChallenge = {
    id: 'tier-adept',
    tier: 'adept',
    tierLabel: 'Tier 2: Adept (Medium)',
    title: `Multi-Step Event Window Rate Limiter (${adeptDsa.toUpperCase()})`,
    domain,
    language: 'javascript',
    dsaTopic: adeptDsa,
    scenario: `In ${primaryProject}, incoming API requests need a sliding-window rate limiter across multiple service files to avoid database connection exhaustion.`,
    problemStatement: `### Feature Development Objective
Implement a thread-safe sliding window rate limiter in \`rateLimiter.js\` coordinated with \`tokenStore.js\`.

#### Requirements:
1. In \`rateLimiter.js\`: Complete \`checkRequestAllowed(clientId, timestampMs, maxRequests, windowMs)\`.
2. Evict timestamps strictly older than \`timestampMs - windowMs\`.
3. If current valid timestamps in the window are less than \`maxRequests\`, record the new timestamp and return \`{ allowed: true, remaining: maxRequests - count }\`.
4. If exceeded, return \`{ allowed: false, remaining: 0, retryAfterMs }\`.
5. Guarded AI assistant is available in the right panel for conceptual guidance and edge-case hints.`,
    constraints: [
      'Sliding window eviction must run in amortized O(1) time',
      'State between different client IDs must remain strictly isolated',
      'Files involved: 2 files'
    ],
    files: [
      {
        path: 'rateLimiter.js',
        name: 'rateLimiter.js',
        editable: true,
        content: `const { TokenStore } = require('./tokenStore');

class SlidingWindowRateLimiter {
  constructor() {
    this.store = new TokenStore();
  }

  isAllowed(clientId, timestampMs, maxRequests, windowMs) {
    // TODO: Implement sliding window logic
    // 1. Fetch timestamps from this.store.get(clientId)
    // 2. Evict expired entries outside (timestampMs - windowMs)
    // 3. Return { allowed: boolean, remaining: number }
    return { allowed: false, remaining: 0 };
  }
}

module.exports = { SlidingWindowRateLimiter };
`
      },
      {
        path: 'tokenStore.js',
        name: 'tokenStore.js',
        editable: true,
        content: `class TokenStore {
  constructor() {
    this.buckets = new Map();
  }

  get(key) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, []);
    }
    return this.buckets.get(key);
  }

  set(key, timestamps) {
    this.buckets.set(key, timestamps);
  }

  clear() {
    this.buckets.clear();
  }
}

module.exports = { TokenStore };
`
      }
    ],
    activeFilePath: 'rateLimiter.js',
    referenceSolution: [
      {
        path: 'rateLimiter.js',
        name: 'rateLimiter.js',
        editable: false,
        content: `const { TokenStore } = require('./tokenStore');

class SlidingWindowRateLimiter {
  constructor() {
    this.store = new TokenStore();
  }

  isAllowed(clientId, timestampMs, maxRequests, windowMs) {
    const list = this.store.get(clientId);
    const windowStart = timestampMs - windowMs;

    // Remove expired timestamps
    while (list.length > 0 && list[0] <= windowStart) {
      list.shift();
    }

    if (list.length < maxRequests) {
      list.push(timestampMs);
      this.store.set(clientId, list);
      return { allowed: true, remaining: maxRequests - list.length };
    }

    const oldest = list[0];
    const retryAfterMs = oldest ? oldest + windowMs - timestampMs : windowMs;
    return { allowed: false, remaining: 0, retryAfterMs };
  }
}

module.exports = { SlidingWindowRateLimiter };`
      }
    ],
    tests: [
      {
        id: 'adept-t1',
        name: 'Allows Requests Under Threshold',
        description: 'First request inside window should be allowed with remaining balance',
        input: 'limiter.isAllowed("user-1", 1000, 3, 10000)',
        expectedOutput: '{"allowed":true,"remaining":2}',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'adept-t2',
        name: 'Blocks When Max Exceeded',
        description: 'Blocks fourth request when maxRequests = 3',
        input: 'limiter.isAllowed("user-1", 1003, 3, 10000)',
        expectedOutput: '{"allowed":false,"remaining":0}',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'adept-t3',
        name: 'Sliding Window Eviction',
        description: 'Permits new requests once previous timestamps age past windowMs',
        input: 'limiter.isAllowed("user-1", 12000, 3, 10000)',
        expectedOutput: '{"allowed":true,"remaining":2}',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'adept-t4',
        name: 'Multi-Tenant Isolation',
        description: 'Ensures user-1 consumption does not block user-2',
        input: 'limiter.isAllowed("user-2", 1001, 3, 10000)',
        expectedOutput: '{"allowed":true,"remaining":2}',
        isHidden: true,
        category: 'edge_case'
      }
    ],
    aiAssistantAllowed: true, // Guarded AI ON
    timeLimitMinutes: 20
  };

  // 3. MASTER CHALLENGE (Multi-File Debugging & Performance Constraint - Guarded AI)
  const masterChallenge: TierChallenge = {
    id: 'tier-master',
    tier: 'master',
    tierLabel: 'Tier 3: Master (Hard)',
    title: `High-Throughput LRU Cache Engine (${masterDsa.toUpperCase()})`,
    domain,
    language: 'javascript',
    dsaTopic: masterDsa,
    scenario: `In ${primaryProject}, the caching subsystem is suffering from O(N) linear search thrashing and memory retention under peak load.`,
    problemStatement: `### Master Level Engineering Challenge
Refactor the cache engine in \`lruCache.js\` and \`doublyLinkedList.js\` to achieve strictly O(1) lookup, insertion, and eviction.

#### Requirements:
1. Implement \`get(key)\`: Returns value if present and marks node as Most Recently Used (MRU). If not present, returns \`-1\`.
2. Implement \`put(key, value)\`: Updates value if present. If key does not exist and capacity is reached, evicts the Least Recently Used (LRU) node.
3. Both operations must execute in strictly **O(1) time complexity** using the Doubly Linked List + Hash Map structure.
4. Pass performance stress test of 50,000 operations within 80ms.`,
    constraints: [
      'get(key) must be strictly O(1)',
      'put(key, value) must be strictly O(1)',
      'Time constraint: 50,000 operations in < 100ms',
      'No external cache libraries allowed'
    ],
    files: [
      {
        path: 'lruCache.js',
        name: 'lruCache.js',
        editable: true,
        content: `const { Node, DoublyLinkedList } = require('./doublyLinkedList');

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this.list = new DoublyLinkedList();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const node = this.map.get(key);
    this.list.moveToHead(node);
    return node.value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      this.list.moveToHead(node);
      return;
    }

    if (this.map.size >= this.capacity) {
      const tail = this.list.removeTail();
      if (tail) this.map.delete(tail.key);
    }

    const newNode = new Node(key, value);
    this.list.addToHead(newNode);
    this.map.set(key, newNode);
  }
}

module.exports = { LRUCache };
`
      },
      {
        path: 'doublyLinkedList.js',
        name: 'doublyLinkedList.js',
        editable: true,
        content: `class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = new Node(0, 0);
    this.tail = new Node(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  addToHead(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  moveToHead(node) {
    this.removeNode(node);
    this.addToHead(node);
  }

  removeTail() {
    if (this.tail.prev === this.head) return null;
    const res = this.tail.prev;
    this.removeNode(res);
    return res;
  }
}

module.exports = { Node, DoublyLinkedList };
`
      }
    ],
    activeFilePath: 'lruCache.js',
    referenceSolution: [
      {
        path: 'lruCache.js',
        name: 'lruCache.js',
        editable: false,
        content: `const { Node, DoublyLinkedList } = require('./doublyLinkedList');

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this.list = new DoublyLinkedList();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const node = this.map.get(key);
    this.list.moveToHead(node);
    return node.value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      this.list.moveToHead(node);
      return;
    }

    if (this.map.size >= this.capacity) {
      const tail = this.list.removeTail();
      if (tail) this.map.delete(tail.key);
    }

    const newNode = new Node(key, value);
    this.list.addToHead(newNode);
    this.map.set(key, newNode);
  }
}

module.exports = { LRUCache };`
      }
    ],
    tests: [
      {
        id: 'master-t1',
        name: 'Basic Put & Get in O(1)',
        description: 'Stores and retrieves key in O(1)',
        input: 'cache.put(1, 100); cache.get(1)',
        expectedOutput: '100',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'master-t2',
        name: 'Evicts LRU Item Upon Capacity Overflow',
        description: 'Evicts oldest untouched item when capacity is 2',
        input: 'cache.put(1, 10); cache.put(2, 20); cache.put(3, 30); cache.get(1)',
        expectedOutput: '-1',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'master-t3',
        name: 'Get Updates Recent Usage State',
        description: 'Retrieving an item prevents it from being evicted next',
        input: 'cache.get(2); cache.put(4, 40); cache.get(2)',
        expectedOutput: '20',
        isHidden: false,
        category: 'correctness'
      },
      {
        id: 'master-t4',
        name: 'High-Throughput Stress Test',
        description: 'Processes 25,000 rapid operations in under 50ms',
        input: 'benchmark(cache, 25000)',
        expectedOutput: 'PASS_FAST',
        isHidden: true,
        category: 'performance'
      }
    ],
    aiAssistantAllowed: true, // Guarded AI ON
    timeLimitMinutes: 25
  };

  return [noviceChallenge, adeptChallenge, masterChallenge];
}

