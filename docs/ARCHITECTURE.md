# PROCTOR-FORGE: Architectural Blueprint

## 1. System Component Architecture

```mermaid
graph TD
    Client["Candidate Browser (Next.js 14 + Monaco IDE)"]
    Recruiter["Recruiter Dashboard (Cohort Analytics)"]
    Gateway["Next.js Route Handlers (API Gateway)"]
    Featherless["Featherless AI (Llama 3.1 70B & 8B)"]
    Runner["Runner Microservice (Fastify + Dockerode)"]
    Sandbox["Ephemeral Docker Sandbox (--network none)"]
    Firestore[("Firebase Firestore (Public & Server-Only)")]
    Auth["Firebase Auth (Custom Claims RBAC)"]

    Client -->|HTTPS / SSE| Gateway
    Recruiter -->|HTTPS| Gateway
    Gateway -->|JWT / ID Token| Auth
    Gateway -->|HMAC-Signed Request| Runner
    Runner -->|Spawn & Monitor| Sandbox
    Gateway -->|Structured Output| Featherless
    Gateway -->|Document State / Hash Chain| Firestore
```

## 2. Assessment Generation Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Candidate
    participant Intake as Portfolio Intake
    participant Orch as Pipeline Orchestrator
    participant LLM as Featherless AI
    participant Gate as Validation Gate
    participant Runner as Docker Runner
    participant DB as Firestore

    Candidate->>Intake: Upload/Paste Portfolio JSON
    Intake->>Orch: Submit Portfolio
    Orch->>LLM: Stage A: Analyze Profile & Claims
    LLM-->>Orch: Candidate Profile (Languages, Frameworks, Themes)
    Note over Orch: Deterministic Post-Filter bounds DSA topics strictly to claimed topics
    loop For Each Tier (Novice, Adept, Master)
        Orch->>LLM: Stage B: Generate TaskSpec (Starter, Reference, Tests, Hint Ladder)
        LLM-->>Orch: Raw TaskSpec JSON
        Orch->>Gate: Stage C: Validation Gate
        Gate->>Runner: 1. Test Reference Solution (Must Pass 100%)
        Gate->>Runner: 2. Test Starter Code (Must Fail Target Tests)
        Gate->>Runner: 3. Run Mutation Testing (Kill >= 70%)
        alt Passes Validation Gate
            Gate-->>Orch: Validation Report (Passed)
        else Validation Failed (Max 3 Retries)
            Orch->>Gate: Fallback to Hand-Verified Task Bank
        end
    end
    Orch->>DB: Stage D: Split Server-Only Secrets & Candidate-Visible Tasks
    Orch-->>Candidate: Assessment Ready (Redirect to Monaco IDE)
```

## 3. Guarded AI Assistant Architecture (Defense in Depth)

```mermaid
flowchart TD
    UserMsg["Candidate User Message"] --> InFirewall{"Input Firewall Inspection"}
    InFirewall -->|Jailbreak / Prompt Injection / Solution Demand| Refusal["Refuse Request + Log Extraction Attempt Telemetry"]
    InFirewall -->|Valid Conceptual Question| ContextBuilder["Context Minimization Builder"]
    
    ContextBuilder --> ContextData["Context: Problem + Current Code + Sanitized Test Names + Unlocked Hint ONLY"]
    Note over ContextData: Reference Solution & Hidden Tests are STRICTLY EXCLUDED
    
    ContextData --> LLMCall["Featherless AI (Technical Mentor Persona)"]
    LLMCall --> OutFirewall{"Output Firewall Inspection"}
    
    OutFirewall -->|Canary Token Detected| CannedFallback["Block Leak + Canned Fallback"]
    OutFirewall -->|Code Line Limit Exceeded| CannedFallback
    OutFirewall -->|N-Gram Match with Reference Solution| CannedFallback
    OutFirewall -->|Clean Guidance| StreamClient["Sentence-Buffered SSE Stream to Candidate"]
```

## 4. Hardened Sandbox Isolation Boundary

```mermaid
graph LR
    subgraph Host VM
        RunnerService["Fastify Runner Service"]
        subgraph Ephemeral Container
            direction TB
            User["User: sandboxuser (UID 1001)"]
            Net["Network: NONE"]
            FS["Read-Only Root Filesystem"]
            Tmpfs["Mounted /tmp (tmpfs: 64MB)"]
            Limits["Pids: 64 | RAM: 256MB | CPU: 1.0 core"]
            Seccomp["Seccomp: Banned ptrace, bpf, reboot, mount"]
            Harness["Nonce-Delimited Test Harness Channel"]
        end
    end
    RunnerService -->|Mount Scratch| Ephemeral Container
```

