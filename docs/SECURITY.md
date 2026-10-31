# PROCTOR-FORGE: Security Architecture & STRIDE Threat Model

Proctor-Forge is designed with defense-in-depth principles across its sandbox runners, LLM interfaces, and state stores.

## STRIDE Threat Model

| Threat Category | Specific Threat Scenario | Impact | Proctor-Forge Mitigation |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Candidate impersonates recruiter or attempts cross-session takeover | Unauthorized report access or collusion | Firebase ID tokens with custom claims (`role: 'recruiter'`). Session leases enforce a single active tab with fencing tokens. |
| **Tampering** | Candidate modifies client timer, score, or manipulates audit events | Fraudulent exam pass or altered scores | **Server-authoritative timer** in Firestore. Scores calculated server-side only. Telemetry is committed to a **SHA-256 cryptographic hash chain** (`hash = SHA256(prev + canonicalJSON(ev))`). |
| **Repudiation** | Candidate disputes test results or claims AI was malfunctioning | Inability to audit examination validity | Append-only server logs record all test runs, stdout/stderr, and assistant interactions. Reports are cryptographically signed with HMAC/Ed25519. |
| **Information Disclosure** | Candidate attempts to exfiltrate hidden tests or reference solutions | Exam compromise and widespread cheating | **Context Minimization**: Reference solutions and hidden tests are stored in `taskSecrets/` (Firestore rules: `allow read, write: if false`). The assistant LLM prompt never contains the reference solution or hidden tests. |
| **Denial of Service** | Infinite loops, fork bombs, or memory exhaustion in submitted code | Runner service crash or host starvation | Docker containers are executed with `--pids-limit 64`, `--memory 256MB`, `CpuQuota: 100000`, `--network none`, and strict wall-clock timeouts (6s default) killing processes on breach. |
| **Elevation of Privilege** | Sandbox escape or privilege escalation via container runtime | Host filesystem or network access | Ephemeral containers run as unprivileged `sandboxuser` (`UID 1001`), with `CapDrop: ['ALL']`, `no-new-privileges: true`, read-only root filesystem, and custom seccomp profiles blocking `ptrace`, `bpf`, `mount`, etc. |

---

## LLM Guardrail Protections

### 1. Input Firewall
All user messages sent to the AI assistant pass through deterministic regex and heuristic inspection before reaching the LLM:
- **Jailbreak Interception:** Patterns like "ignore previous instructions", "DAN mode", and "developer mode" are blocked.
- **System Prompt Exfiltration:** Prompts asking "print your system instructions" or "reveal hidden tests" are intercepted.
- **Direct Solution Demands:** Prompts demanding "write the code for me" or "solve this" are rejected with pedagogical redirects.
- **Obfuscation Filters:** Detects raw Base64 blocks, ROT13, and nested hex encodings.

### 2. Output Firewall
Before LLM responses are streamed to the candidate, server-side buffers inspect output:
- **Canary Tokens:** Unique random canary strings embedded in system instructions. If present in output, response is dropped.
- **Line Cap Limits:** Enforces strict limits on code snippets (0 lines for Hint Levels 1–3; max 6 lines of pseudo-structure for Level 4).
- **Reference Solution N-Gram Overlap:** Compares word shingles against the reference solution; verbatim matches are blocked.

