import { TaskSpec } from '@proctor-forge/shared';

export const BACKEND_TASKS: TaskSpec[] = [
  // 1. NOVICE Variant A (Backend)
  {
    id: 'backend_novice_a',
    tier: 'novice',
    domain: 'backend',
    language: 'python',
    framework: 'fastapi',
    dsaTopics: ['hashing', 'arrays'],
    title: 'In-Memory TTL Cache with Expiration',
    scenario: 'High-speed caching layer for REST API endpoints storing serialized database entities with TTL.',
    problemStatement: `Implement \`TTLCache\` in \`cache.py\`.
Methods required:
1. \`set(key: str, value: any, ttl_seconds: float) -> None\`: store value with future expiration timestamp.
2. \`get(key: str) -> any\`: return stored value if active. If expired or non-existent, return \`None\` and purge key.
3. \`clean_expired() -> int\`: iterate and remove all currently expired keys, returning total count purged.`,
    constraints: ['Expired keys must not be returned', 'Time measured in seconds'],
    acceptanceCriteria: ['Returns None for expired keys', 'clean_expired purges all stale entries'],
    files: [
      {
        path: 'cache.py',
        content: `import time

class TTLCache:
    def __init__(self):
        self.store = {}

    def set(self, key: str, value: any, ttl_seconds: float) -> None:
        # BUG: Stores value without expiry tracking
        self.store[key] = value

    def get(self, key: str) -> any:
        return self.store.get(key)

    def clean_expired(self) -> int:
        return 0
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'cache.py',
        content: `import time

class TTLCache:
    def __init__(self):
        self.store = {}

    def set(self, key: str, value: any, ttl_seconds: float) -> None:
        expiry = time.time() + ttl_seconds
        self.store[key] = (value, expiry)

    def get(self, key: str) -> any:
        if key not in self.store:
            return None
        val, expiry = self.store[key]
        if time.time() >= expiry:
            del self.store[key]
            return None
        return val

    def clean_expired(self) -> int:
        now = time.time()
        expired_keys = [k for k, (_, exp) in self.store.items() if now >= exp]
        for k in expired_keys:
            del self.store[k]
        return len(expired_keys)
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_basic_set_get', name: 'Basic Set and Get', weight: 1, category: 'correctness' },
        { id: 'test_expiration', name: 'Key Expiration Retrieval', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_clean_expired', name: 'Active Purge of Expired Keys', weight: 1, category: 'edge' },
        { id: 'test_nonexistent', name: 'Nonexistent Key Handling', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_cache.py',
        content: `import unittest
import time
from cache import TTLCache

class TestTTLCache(unittest.TestCase):
    def test_basic_set_get(self):
        cache = TTLCache()
        cache.set("k1", "v1", 10.0)
        self.assertEqual(cache.get("k1"), "v1")

    def test_expiration(self):
        cache = TTLCache()
        cache.set("k_fast", "temp", 0.05)
        time.sleep(0.08)
        self.assertIsNone(cache.get("k_fast"))

    def test_clean_expired(self):
        cache = TTLCache()
        cache.set("k_stale1", "1", 0.02)
        cache.set("k_stale2", "2", 0.02)
        cache.set("k_fresh", "3", 10.0)
        time.sleep(0.05)
        purged = cache.clean_expired()
        self.assertEqual(purged, 2)
        self.assertEqual(cache.get("k_fresh"), "3")

    def test_nonexistent(self):
        cache = TTLCache()
        self.assertIsNone(cache.get("does_not_exist"))

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Store both the value and the calculated expiry timestamp in your storage dictionary.',
      level2: 'Calculate expiry as: time.time() + ttl_seconds.',
      level3: 'In get(key), compare time.time() against the stored expiry before returning.',
      level4: 'In clean_expired, find all keys where time.time() >= exp, delete them from self.store, and return count.'
    },
    seed: 201
  },

  // 2. NOVICE Variant B (Backend)
  {
    id: 'backend_novice_b',
    tier: 'novice',
    domain: 'backend',
    language: 'python',
    framework: 'fastapi',
    dsaTopics: ['strings', 'hashing'],
    title: 'Idempotency Key Request Deduplicator',
    scenario: 'Payment processing gateway preventing duplicate credit card transactions across retried HTTP calls.',
    problemStatement: `Implement \`IdempotencyManager\` in \`idempotency.py\`.
Methods required:
1. \`register_request(idempotency_key: str, payload_hash: str) -> tuple[bool, str]\`:
   - If key unseen: record it and return \`(True, "ACCEPTED")\`.
   - If key seen with same payload_hash: return \`(False, "DUPLICATE")\`.
   - If key seen with DIFFERENT payload_hash: return \`(False, "CONFLICT_PAYLOAD_MISMATCH")\`.
2. \`record_response(idempotency_key: str, response_data: dict) -> bool\`: attach response data.
3. \`get_cached_response(idempotency_key: str) -> dict | None\`: retrieve saved response.`,
    constraints: ['Atomic idempotency tracking', 'Payload mismatch detection'],
    acceptanceCriteria: ['Rejects duplicate payloads safely', 'Flags mismatched payloads with conflict'],
    files: [
      {
        path: 'idempotency.py',
        content: `class IdempotencyManager:
    def __init__(self):
        self.records = {}

    def register_request(self, idempotency_key: str, payload_hash: str) -> tuple[bool, str]:
        # BUG: Accepts all requests unconditionally
        return (True, "ACCEPTED")

    def record_response(self, idempotency_key: str, response_data: dict) -> bool:
        return False

    def get_cached_response(self, idempotency_key: str) -> dict | None:
        return None
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'idempotency.py',
        content: `class IdempotencyManager:
    def __init__(self):
        self.records = {}

    def register_request(self, idempotency_key: str, payload_hash: str) -> tuple[bool, str]:
        if idempotency_key in self.records:
            existing = self.records[idempotency_key]
            if existing['hash'] == payload_hash:
                return (False, "DUPLICATE")
            else:
                return (False, "CONFLICT_PAYLOAD_MISMATCH")
        
        self.records[idempotency_key] = {
            'hash': payload_hash,
            'response': None
        }
        return (True, "ACCEPTED")

    def record_response(self, idempotency_key: str, response_data: dict) -> bool:
        if idempotency_key in self.records:
            self.records[idempotency_key]['response'] = response_data
            return True
        return False

    def get_cached_response(self, idempotency_key: str) -> dict | None:
        if idempotency_key in self.records:
            return self.records[idempotency_key]['response']
        return None
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_accept_new', name: 'Accept New Idempotency Key', weight: 1, category: 'correctness' },
        { id: 'test_duplicate_same_hash', name: 'Detect Exact Duplicate Request', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_payload_mismatch', name: 'Reject Key With Different Payload Hash', weight: 1, category: 'edge' },
        { id: 'test_response_retrieval', name: 'Cached Response Recording and Retrieval', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_idempotency.py',
        content: `import unittest
from idempotency import IdempotencyManager

class TestIdempotency(unittest.TestCase):
    def test_accept_new(self):
        mgr = IdempotencyManager()
        ok, msg = mgr.register_request("k1", "hash_abc")
        self.assertTrue(ok)
        self.assertEqual(msg, "ACCEPTED")

    def test_duplicate_same_hash(self):
        mgr = IdempotencyManager()
        mgr.register_request("k2", "hash_abc")
        ok, msg = mgr.register_request("k2", "hash_abc")
        self.assertFalse(ok)
        self.assertEqual(msg, "DUPLICATE")

    def test_payload_mismatch(self):
        mgr = IdempotencyManager()
        mgr.register_request("k3", "hash_abc")
        ok, msg = mgr.register_request("k3", "hash_xyz")
        self.assertFalse(ok)
        self.assertEqual(msg, "CONFLICT_PAYLOAD_MISMATCH")

    def test_response_retrieval(self):
        mgr = IdempotencyManager()
        mgr.register_request("k4", "hash_abc")
        self.assertTrue(mgr.record_response("k4", {"status": "paid", "amount": 100}))
        self.assertFalse(mgr.record_response("non_existent", {"status": "fail"}))
        cached = mgr.get_cached_response("k4")
        self.assertEqual(cached, {"status": "paid", "amount": 100})
        self.assertIsNone(mgr.get_cached_response("non_existent"))

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Maintain an internal dictionary mapping idempotency keys to records containing the payload hash and response.',
      level2: 'When register_request is called, check if the key already exists.',
      level3: 'If it exists, check whether existing["hash"] == payload_hash to return DUPLICATE or CONFLICT_PAYLOAD_MISMATCH.',
      level4: 'Store { "hash": payload_hash, "response": None } on accept. In record_response, update response and return True.'
    },
    seed: 202
  },

  // 3. ADEPT Variant A (Backend)
  {
    id: 'backend_adept_a',
    tier: 'adept',
    domain: 'backend',
    language: 'python',
    framework: 'celery',
    dsaTopics: ['heaps', 'queue'],
    title: 'Priority Job Dispatcher with Concurrency Throttle',
    scenario: 'Asynchronous background task processing engine executing high-priority user jobs ahead of batch jobs.',
    problemStatement: `Implement \`PriorityJobDispatcher\` in \`dispatcher.py\`.
Requirements:
1. Jobs have: \`job_id: str\`, \`priority: int\` (higher number = higher priority), \`payload: any\`.
2. \`submit_job(job_id, priority, payload) -> bool\`: push to priority queue.
3. \`poll_next_job() -> dict | None\`: retrieve and mark job active. Highest priority first; tie-break by submission arrival order.
4. Concurrency control: if active running jobs reach \`max_concurrency\`, \`poll_next_job\` must return \`None\` until a job completes.
5. \`complete_job(job_id) -> bool\`: remove from active set and decrement active counter.`,
    constraints: ['Max concurrency strictly enforced', 'O(log N) push and pop using heapq'],
    acceptanceCriteria: ['Higher priority dispatched before lower priority', 'Arrival order preserved on equal priority'],
    files: [
      {
        path: 'dispatcher.py',
        content: `import heapq

class PriorityJobDispatcher:
    def __init__(self, max_concurrency: int = 3):
        self.max_concurrency = max_concurrency
        self.queue = []
        self.active_jobs = set()

    def submit_job(self, job_id: str, priority: int, payload: any) -> bool:
        # BUG: Missing arrival tie-breaker and min-heap inversion
        heapq.heappush(self.queue, (priority, job_id, payload))
        return True

    def poll_next_job(self) -> dict | None:
        if not self.queue:
            return None
        pri, jid, payload = heapq.heappop(self.queue)
        return {"job_id": jid, "priority": pri, "payload": payload}

    def complete_job(self, job_id: str) -> bool:
        return True
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'dispatcher.py',
        content: `import heapq

class PriorityJobDispatcher:
    def __init__(self, max_concurrency: int = 3):
        self.max_concurrency = max_concurrency
        self.queue = []
        self.active_jobs = set()
        self.sequence = 0

    def submit_job(self, job_id: str, priority: int, payload: any) -> bool:
        self.sequence += 1
        # Python heapq is a min-heap; invert priority (-priority) so max priority comes first.
        # sequence acts as tie-breaker preserving FIFO arrival order.
        heapq.heappush(self.queue, (-priority, self.sequence, job_id, priority, payload))
        return True

    def poll_next_job(self) -> dict | None:
        if len(self.active_jobs) >= self.max_concurrency:
            return None
        if not self.queue:
            return None
        _, _, jid, pri, payload = heapq.heappop(self.queue)
        self.active_jobs.add(jid)
        return {"job_id": jid, "priority": pri, "payload": payload}

    def complete_job(self, job_id: str) -> bool:
        if job_id in self.active_jobs:
            self.active_jobs.remove(job_id)
            return True
        return False
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_priority_order', name: 'Higher Priority Dispatched First', weight: 1, category: 'correctness' },
        { id: 'test_concurrency_limit', name: 'Max Concurrency Limit Throttling', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_fifo_tie_break', name: 'FIFO Tie-Breaking on Equal Priority', weight: 2, category: 'edge' },
        { id: 'test_complete_unlocks', name: 'Job Completion Unlocks Polling', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_dispatcher.py',
        content: `import unittest
from dispatcher import PriorityJobDispatcher

class TestDispatcher(unittest.TestCase):
    def test_priority_order(self):
        disp = PriorityJobDispatcher(max_concurrency=5)
        disp.submit_job("j_low", 1, "data1")
        disp.submit_job("j_high", 10, "data2")
        job = disp.poll_next_job()
        self.assertEqual(job["job_id"], "j_high")

    def test_concurrency_limit(self):
        disp = PriorityJobDispatcher(max_concurrency=2)
        disp.submit_job("j1", 5, "p1")
        disp.submit_job("j2", 5, "p2")
        disp.submit_job("j3", 5, "p3")
        self.assertIsNotNone(disp.poll_next_job())
        self.assertIsNotNone(disp.poll_next_job())
        # Reached limit 2
        self.assertIsNone(disp.poll_next_job())

    def test_fifo_tie_break(self):
        disp = PriorityJobDispatcher(max_concurrency=5)
        disp.submit_job("first", 5, "a")
        disp.submit_job("second", 5, "b")
        disp.submit_job("third", 5, "c")
        self.assertEqual(disp.poll_next_job()["job_id"], "first")
        self.assertEqual(disp.poll_next_job()["job_id"], "second")
        self.assertEqual(disp.poll_next_job()["job_id"], "third")

    def test_complete_unlocks(self):
        disp = PriorityJobDispatcher(max_concurrency=1)
        disp.submit_job("j1", 5, "a")
        disp.submit_job("j2", 5, "b")
        j1 = disp.poll_next_job()
        self.assertIsNone(disp.poll_next_job())
        self.assertTrue(disp.complete_job(j1["job_id"]))
        self.assertFalse(disp.complete_job("non_existent"))
        j2 = disp.poll_next_job()
        self.assertEqual(j2["job_id"], "j2")

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Python heapq implements a min-heap by default. Use negative priorities to simulate max-heap.',
      level2: 'When two items have the same priority, Python compares the next tuple element.',
      level3: 'Keep an auto-incrementing integer sequence counter as the second tuple element to break ties in FIFO order.',
      level4: 'In poll_next_job: check len(self.active_jobs) >= max_concurrency. If so, return None. Otherwise pop, add to active_jobs.'
    },
    seed: 203
  },

  // 4. ADEPT Variant B (Backend)
  {
    id: 'backend_adept_b',
    tier: 'adept',
    domain: 'backend',
    language: 'python',
    framework: 'fastapi',
    dsaTopics: ['sliding-window', 'stack'],
    title: 'Fault-Tolerant Circuit Breaker State Machine',
    scenario: 'Microservices resiliency mechanism protecting down-stream payment processors from cascading outages.',
    problemStatement: `Implement \`CircuitBreaker\` in \`circuit_breaker.py\`.
States: \`CLOSED\`, \`OPEN\`, \`HALF_OPEN\`.
Requirements:
1. In \`CLOSED\`:
   - Track failure rate over a rolling window of \`window_size\` requests.
   - If failures in current window reach \`failure_threshold\`, transition immediately to \`OPEN\`.
2. In \`OPEN\`:
   - Reject all executions with \`CircuitOpenError\` until \`recovery_timeout_seconds\` has elapsed.
   - Once timeout elapses, transition to \`HALF_OPEN\`.
3. In \`HALF_OPEN\`:
   - Allow a single probe request.
   - If probe succeeds, reset failure counts and transition to \`CLOSED\`.
   - If probe fails, transition back to \`OPEN\`.`,
    constraints: ['Thread-safe timestamps', 'Clean state transitions'],
    acceptanceCriteria: ['Rejects calls while OPEN', 'Transitions to HALF_OPEN after cooldown'],
    files: [
      {
        path: 'circuit_breaker.py',
        content: `class CircuitOpenError(Exception):
    pass

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout_seconds: float = 1.0, window_size: int = 5):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.window_size = window_size
        self.state = "CLOSED"

    def record_success(self) -> None:
        pass

    def record_failure(self) -> None:
        pass

    def can_execute(self, current_time: float) -> bool:
        # BUG: Never trips open
        return True
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'circuit_breaker.py',
        content: `class CircuitOpenError(Exception):
    pass

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout_seconds: float = 1.0, window_size: int = 5):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.window_size = window_size
        self.state = "CLOSED"
        self.window = [] # list of booleans: True = success, False = failure
        self.opened_at = 0.0

    def can_execute(self, current_time: float) -> bool:
        if self.state == "CLOSED":
            return True
        elif self.state == "OPEN":
            if current_time - self.opened_at >= self.recovery_timeout_seconds:
                self.state = "HALF_OPEN"
                return True
            return False
        elif self.state == "HALF_OPEN":
            return True
        return False

    def record_success(self) -> None:
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.window.clear()
        elif self.state == "CLOSED":
            self.window.append(True)
            if len(self.window) > self.window_size:
                self.window.pop(0)

    def record_failure(self, current_time: float = 0.0) -> None:
        if self.state == "HALF_OPEN":
            self.state = "OPEN"
            self.opened_at = current_time
        elif self.state == "CLOSED":
            self.window.append(False)
            if len(self.window) > self.window_size:
                self.window.pop(0)
            failures = self.window.count(False)
            if failures >= self.failure_threshold:
                self.state = "OPEN"
                self.opened_at = current_time
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_normal_closed', name: 'Normal Operation in CLOSED State', weight: 1, category: 'correctness' },
        { id: 'test_trip_to_open', name: 'Trip to OPEN on Consecutive Failures', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_recovery_half_open', name: 'Cooldown Transitions to HALF_OPEN', weight: 2, category: 'edge' },
        { id: 'test_half_open_recovery', name: 'Probe Success Restores CLOSED State', weight: 1, category: 'edge' }
      ]
    },
    testFiles: [
      {
        path: 'test_circuit_breaker.py',
        content: `import unittest
from circuit_breaker import CircuitBreaker

class TestCircuitBreaker(unittest.TestCase):
    def test_normal_closed(self):
        cb = CircuitBreaker()
        self.assertTrue(cb.can_execute(100.0))
        cb.record_success()
        self.assertEqual(cb.state, "CLOSED")

    def test_trip_to_open(self):
        cb = CircuitBreaker(failure_threshold=2)
        cb.record_failure(100.0)
        cb.record_failure(100.5)
        self.assertEqual(cb.state, "OPEN")
        self.assertFalse(cb.can_execute(101.0))

    def test_recovery_half_open(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout_seconds=2.0)
        cb.record_failure(100.0)
        self.assertEqual(cb.state, "OPEN")
        # Still open at 101.0
        self.assertFalse(cb.can_execute(101.0))
        # Recovers at 102.5
        self.assertTrue(cb.can_execute(102.5))
        self.assertEqual(cb.state, "HALF_OPEN")

    def test_half_open_recovery(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout_seconds=1.0)
        cb.record_failure(100.0)
        cb.can_execute(102.0) # Moves to HALF_OPEN
        cb.record_success()
        self.assertEqual(cb.state, "CLOSED")
        self.assertTrue(cb.can_execute(103.0))

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Maintain state attribute holding "CLOSED", "OPEN", or "HALF_OPEN".',
      level2: 'When recording failures in CLOSED state, check if failure count in window reaches failure_threshold.',
      level3: 'When in OPEN, compare current_time - self.opened_at >= recovery_timeout_seconds.',
      level4: 'In record_success while HALF_OPEN: transition state = "CLOSED" and clear window.'
    },
    seed: 204
  },

  // 5. MASTER Variant A (Backend)
  {
    id: 'backend_master_a',
    tier: 'master',
    domain: 'backend',
    language: 'python',
    framework: 'fastapi',
    dsaTopics: ['graphs', 'bfs', 'hashing'],
    title: 'Database Deadlock Detector & Transaction Wait-For Graph',
    scenario: 'High-concurrency relational transaction manager analyzing lock dependency graphs for deadlocks.',
    problemStatement: `Implement \`DeadlockDetector\` in \`deadlock_detector.py\` with Tarjan's or cycle-finding algorithm.
Requirements:
1. Maintain a dynamic Wait-For directed graph: \`add_wait(txn_a, txn_b)\` indicates \`txn_a\` waits for \`txn_b\`.
2. \`remove_wait(txn_a, txn_b)\`: remove wait edge when lock is granted or transaction aborts.
3. \`detect_deadlock() -> list[str] | None\`: detect if any directed cycle exists in O(V + E) time.
   - If a cycle exists, return the list of transaction IDs involved in the cycle.
   - If no cycle exists, return \`None\`.
4. \`pick_victim(cycle: list[str], priorities: dict[str, int]) -> str\`: pick transaction with lowest priority to abort.`,
    constraints: ['Cycle detection in O(V + E)', 'Handles disconnected components'],
    acceptanceCriteria: ['Detects simple and complex cycle topologies', 'Returns None when graph is a DAG'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [100, 200, 400],
        maxGrowthRatio: 2.3
      }
    },
    files: [
      {
        path: 'deadlock_detector.py',
        content: `class DeadlockDetector:
    def __init__(self):
        self.graph = {}

    def add_wait(self, waiter: str, holder: str) -> None:
        if waiter not in self.graph:
            self.graph[waiter] = set()
        self.graph[waiter].add(holder)

    def remove_wait(self, waiter: str, holder: str) -> None:
        if waiter in self.graph and holder in self.graph[waiter]:
            self.graph[waiter].remove(holder)

    def detect_deadlock(self) -> list[str] | None:
        # BUG: Stub always returns None
        return None

    def pick_victim(self, cycle: list[str], priorities: dict[str, int]) -> str:
        return cycle[0] if cycle else ""
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'deadlock_detector.py',
        content: `class DeadlockDetector:
    def __init__(self):
        self.graph = {}

    def add_wait(self, waiter: str, holder: str) -> None:
        if waiter not in self.graph:
            self.graph[waiter] = set()
        self.graph[waiter].add(holder)

    def remove_wait(self, waiter: str, holder: str) -> None:
        if waiter in self.graph and holder in self.graph[waiter]:
            self.graph[waiter].remove(holder)

    def detect_deadlock(self) -> list[str] | None:
        visited = {} # node -> 0: unvisited, 1: visiting, 2: visited
        parent = {}
        all_nodes = set(self.graph.keys())
        for targets in self.graph.values():
            all_nodes.update(targets)

        for node in all_nodes:
            visited[node] = 0

        def dfs(u):
            visited[u] = 1
            for v in self.graph.get(u, []):
                if visited.get(v, 0) == 1:
                    # Found cycle! Reconstruct cycle
                    cycle = [v, u]
                    curr = u
                    while curr in parent and parent[curr] != v:
                        curr = parent[curr]
                        cycle.append(curr)
                    return cycle[::-1]
                elif visited.get(v, 0) == 0:
                    parent[v] = u
                    res = dfs(v)
                    if res:
                        return res
            visited[u] = 2
            return None

        for n in all_nodes:
            if visited[n] == 0:
                cycle = dfs(n)
                if cycle:
                    return cycle
        return None

    def pick_victim(self, cycle: list[str], priorities: dict[str, int]) -> str:
        if not cycle:
            return ""
        # Victim is transaction with lowest priority score
        return min(cycle, key=lambda txn: priorities.get(txn, 0))
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_no_cycle_dag', name: 'No Cycle in Acyclic Dependency Graph', weight: 1, category: 'correctness' },
        { id: 'test_simple_two_node_cycle', name: 'Detect 2-Node Mutual Deadlock', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_complex_multinode_cycle', name: 'Detect Multi-Node Deadlock Cycle', weight: 2, category: 'edge' },
        { id: 'test_pick_victim', name: 'Accurately Pick Lowest Priority Victim', weight: 1, category: 'correctness' },
        { id: 'test_perf_large_graph', name: 'Scalability On 200 Node Graph', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'test_deadlock.py',
        content: `import unittest
import time
from deadlock_detector import DeadlockDetector

class TestDeadlock(unittest.TestCase):
    def test_no_cycle_dag(self):
        d = DeadlockDetector()
        d.add_wait("T1", "T2")
        d.add_wait("T2", "T3")
        self.assertIsNone(d.detect_deadlock())

    def test_simple_two_node_cycle(self):
        d = DeadlockDetector()
        d.add_wait("T1", "T2")
        d.add_wait("T2", "T1")
        cycle = d.detect_deadlock()
        self.assertIsNotNone(cycle)
        self.assertTrue("T1" in cycle and "T2" in cycle)

    def test_complex_multinode_cycle(self):
        d = DeadlockDetector()
        d.add_wait("T1", "T2")
        d.add_wait("T2", "T3")
        d.add_wait("T3", "T4")
        d.add_wait("T4", "T2") # Cycle T2->T3->T4->T2
        cycle = d.detect_deadlock()
        self.assertIsNotNone(cycle)
        self.assertTrue("T2" in cycle and "T3" in cycle and "T4" in cycle)

    def test_pick_victim(self):
        d = DeadlockDetector()
        priorities = {"T1": 100, "T2": 20, "T3": 50}
        victim = d.pick_victim(["T1", "T2", "T3"], priorities)
        self.assertEqual(victim, "T2")

    def test_perf_large_graph(self):
        d = DeadlockDetector()
        for i in range(150):
            d.add_wait(f"T_{i}", f"T_{i+1}")
        start = time.time()
        self.assertIsNone(d.detect_deadlock())
        d.add_wait("T_149", "T_0") # add cycle
        self.assertIsNotNone(d.detect_deadlock())
        duration_ms = (time.time() - start) * 1000
        self.assertLess(duration_ms, 250)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Deadlock detection in wait-for graphs maps directly to cycle detection in a directed graph.',
      level2: 'Use Depth-First Search (DFS) with 3 colors: 0=unvisited, 1=currently in recursion stack, 2=fully explored.',
      level3: 'If DFS encounters a neighbor node with state 1 (currently in recursion stack), a directed cycle is confirmed.',
      level4: 'Track parent pointers to reconstruct the cycle path when the back-edge is hit.'
    },
    seed: 205
  },

  // 6. MASTER Variant B (Backend)
  {
    id: 'backend_master_b',
    tier: 'master',
    domain: 'backend',
    language: 'python',
    framework: 'fastapi',
    dsaTopics: ['binary-search', 'arrays', 'sorting'],
    title: 'Range Query Index with Inverted Log Segments',
    scenario: 'Time-series metrics database querying timestamp ranges across immutably sorted log chunks.',
    problemStatement: `Implement \`LogSegmentIndex\` in \`log_index.py\`.
Requirements:
1. \`add_entry(timestamp: int, record_id: str, value: float) -> None\`.
2. Entries are stored in sorted order by timestamp.
3. \`query_range(start_ts: int, end_ts: int) -> list[tuple[int, str, float]]\`:
   - Use binary search (\`bisect_left\` / \`bisect_right\`) to locate slice bounds in O(log N) time.
   - Return all entries where \`start_ts <= timestamp <= end_ts\`.
4. \`aggregate_stats(start_ts: int, end_ts: int) -> dict\`:
   - Calculate \`count\`, \`min\`, \`max\`, and \`mean\` of \`value\` over the range.
   - If no records match, return \`{"count": 0, "min": None, "max": None, "mean": None}\`.`,
    constraints: ['Binary search for slice lookup in O(log N)', 'Entries sorted upon ingestion'],
    acceptanceCriteria: ['Retrieves exact range inclusive', 'Computes aggregates accurately'],
    performanceBudget: {
      maxRuntimeMs: 300,
      complexityProbe: {
        inputSizes: [1000, 2000, 4000],
        maxGrowthRatio: 2.2
      }
    },
    files: [
      {
        path: 'log_index.py',
        content: `class LogSegmentIndex:
    def __init__(self):
        self.entries = []

    def add_entry(self, timestamp: int, record_id: str, value: float) -> None:
        self.entries.append((timestamp, record_id, value))

    def query_range(self, start_ts: int, end_ts: int) -> list[tuple[int, str, float]]:
        # BUG: Full linear scan without binary search
        return [e for e in self.entries if start_ts <= e[0] <= end_ts]

    def aggregate_stats(self, start_ts: int, end_ts: int) -> dict:
        return {"count": 0, "min": None, "max": None, "mean": None}
`,
        editable: true
      }
    ],
    referenceSolution: [
      {
        path: 'log_index.py',
        content: `import bisect

class LogSegmentIndex:
    def __init__(self):
        self.timestamps = []
        self.entries = []

    def add_entry(self, timestamp: int, record_id: str, value: float) -> None:
        idx = bisect.bisect_right(self.timestamps, timestamp)
        self.timestamps.insert(idx, timestamp)
        self.entries.insert(idx, (timestamp, record_id, value))

    def query_range(self, start_ts: int, end_ts: int) -> list[tuple[int, str, float]]:
        left_idx = bisect.bisect_left(self.timestamps, start_ts)
        right_idx = bisect.bisect_right(self.timestamps, end_ts)
        return self.entries[left_idx:right_idx]

    def aggregate_stats(self, start_ts: int, end_ts: int) -> dict:
        matched = self.query_range(start_ts, end_ts)
        if not matched:
            return {"count": 0, "min": None, "max": None, "mean": None}
        vals = [e[2] for e in matched]
        return {
            "count": len(vals),
            "min": min(vals),
            "max": max(vals),
            "mean": sum(vals) / len(vals)
        }
`,
        editable: true
      }
    ],
    tests: {
      visible: [
        { id: 'test_insert_query', name: 'Insert and Query In-Range Entries', weight: 1, category: 'correctness' },
        { id: 'test_empty_range', name: 'Empty Range Query Handling', weight: 1, category: 'correctness' }
      ],
      hidden: [
        { id: 'test_aggregate_stats', name: 'Accurate Aggregation (Min, Max, Mean)', weight: 2, category: 'edge' },
        { id: 'test_perf_range_query', name: 'Logarithmic Slice Extraction on 5000+ Items', weight: 2, category: 'performance' }
      ]
    },
    testFiles: [
      {
        path: 'test_log_index.py',
        content: `import unittest
import time
from log_index import LogSegmentIndex

class TestLogIndex(unittest.TestCase):
    def test_insert_query(self):
        idx = LogSegmentIndex()
        idx.add_entry(100, "r1", 10.5)
        idx.add_entry(200, "r2", 20.0)
        idx.add_entry(150, "r3", 15.0)
        res = idx.query_range(120, 210)
        self.assertEqual(len(res), 2)
        self.assertEqual(res[0][0], 150)
        self.assertEqual(res[1][0], 200)

    def test_empty_range(self):
        idx = LogSegmentIndex()
        idx.add_entry(100, "r1", 1.0)
        self.assertEqual(idx.query_range(200, 300), [])

    def test_aggregate_stats(self):
        idx = LogSegmentIndex()
        idx.add_entry(10, "r1", 10.0)
        idx.add_entry(20, "r2", 20.0)
        idx.add_entry(30, "r3", 30.0)
        stats = idx.aggregate_stats(15, 35)
        self.assertEqual(stats["count"], 2)
        self.assertEqual(stats["min"], 20.0)
        self.assertEqual(stats["max"], 30.0)
        self.assertEqual(stats["mean"], 25.0)

    def test_perf_range_query(self):
        idx = LogSegmentIndex()
        for i in range(2000):
            idx.add_entry(i * 10, f"id_{i}", float(i))
        start = time.time()
        for _ in range(50):
            res = idx.query_range(500, 5000)
            self.assertEqual(len(res), 451)
        duration_ms = (time.time() - start) * 1000
        self.assertLess(duration_ms, 250)

if __name__ == '__main__':
    unittest.main()
`,
        editable: false
      }
    ],
    hintLadder: {
      level1: 'Maintain a parallel sorted array of timestamps or sorted tuples.',
      level2: 'Use bisect.bisect_left for start_ts and bisect.bisect_right for end_ts.',
      level3: 'Slicing self.entries[left_idx:right_idx] takes advantage of binary search in O(log N).',
      level4: 'In aggregate_stats, extract values list, and return count, min, max, sum/len.'
    },
    seed: 206
  }
];

