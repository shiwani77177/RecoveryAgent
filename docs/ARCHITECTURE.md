# Architecture

> **RecoveryAgent** — AI-powered revenue recovery for Razorpay  
> Razorpay AI Buildathon · Track 03: AI Revenue Recovery

---

## Design Principle

**"The LLM proposes, deterministic gated code disposes."**

The AI agent diagnoses failures and recommends interventions. But it never
touches money directly. Every action passes through a deterministic guardrail
layer that enforces spend caps, idempotency, rate limits, and stopping rules.
Every decision — approved or blocked — is recorded in an append-only audit trail.

---

## System Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RAZORPAY WEBHOOKS                            │
│              payment.failed · subscription.pending                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ HMAC-SHA256 verified
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     WEBHOOK RECEIVER                                │
│  WebhookController → WebhookService                                │
│  Validates signature · parses event · creates RecoveryCase          │
│  Sets trulyRecoverable ground truth · writes first AuditLog entry   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ case.status = DETECTED
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   RECOVERY ORCHESTRATOR                             │
│  State machine: DETECTED → DIAGNOSING → EXECUTING → outcome        │
│  @Scheduled every 30s + manual trigger via REST                     │
│  Manages backoff, retry scheduling (Redis), stopping rules          │
└──────────┬───────────────────────┬───────────────────────────────────┘
           │                       │
           ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────────────────────┐
│   DIAGNOSIS AGENT   │  │            GUARDRAIL SERVICE                │
│                     │  │                                             │
│  GeminiDiagnosisAgent  │  Runs BEFORE every intervention:            │
│  (Google Gemini API)│  │  ✓ Daily spend cap (₹10,00,000)            │
│         │           │  │  ✓ Idempotency (Redis — no double-execute) │
│         ▼           │  │  ✓ Customer contact rate limit (3/day)     │
│  Rule-based fallback│  │  ✓ Stopping rules (max 4 attempts)        │
│  (when Gemini fails)│  │                                             │
│                     │  │  If ANY check fails → block + log reason   │
│  Returns: Diagnosis │  │  If ALL pass → proceed to executor         │
│  - rootCause        │  └─────────────────────────────────────────────┘
│  - recommendedAction│
│  - channel          │
│  - confidence (0-1) │           ▼
│  - rationale        │
└─────────────────────┘  ┌─────────────────────────────────────────────┐
                         │         INTERVENTION EXECUTOR               │
                         │                                             │
                         │  SMART_RETRY    → Razorpay retry (simulated)│
                         │  PAYMENT_LINK   → Razorpay API (REAL call)  │
                         │  DUNNING_MESSAGE→ SMS/WhatsApp (simulated)  │
                         │  ALT_METHOD     → Alt payment (simulated)   │
                         │  ESCALATE       → Human review (no exec)    │
                         │  ABANDON        → Give up (no exec)         │
                         └──────────────────┬──────────────────────────┘
                                            │
                         ┌──────────────────┴──────────────────────────┐
                         │            OUTCOME                          │
                         │                                             │
                         │  SUCCESS → RECOVERED (money back)           │
                         │  FAILURE → WAITING (retry with backoff)     │
                         │  MAX_ATTEMPTS → ABANDONED                   │
                         │  LOW_CONFIDENCE → ESCALATED                 │
                         └──────────────────┬──────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    APPEND-ONLY AUDIT LOG                            │
│  Every decision recorded: actor, action, reason, amount, timestamp  │
│  Never deleted. Never modified. Full traceability.                  │
│  Actors: AGENT (AI) · SYSTEM (guardrails/executor) · HUMAN         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## State Machine

```
DETECTED ──→ DIAGNOSING ──→ EXECUTING ──→ RECOVERED ✅
                 │               │
            (low confidence)  (failed)
                 │               │
                 ▼               ▼
             ESCALATED ⚠️    WAITING ──→ backoff expires ──→ DIAGNOSING
                                │
                          (max 4 attempts)
                                │
                                ▼
                           ABANDONED ❌
```

---

## Tech Stack

| Layer          | Technology                           | Why                                           |
|----------------|--------------------------------------|-----------------------------------------------|
| Backend        | Java 21 + Spring Boot 3              | Production fintech standard; type-safe         |
| Database       | PostgreSQL 13 + Flyway migrations    | ACID compliance; schema versioning             |
| Cache/Queue    | Redis 6                              | Idempotency keys, retry scheduling, spend cap  |
| AI Agent       | Google Gemini API + rule fallback     | Diagnosis with graceful degradation            |
| Frontend       | React 18 + Vite + Tailwind + Recharts| Modern SPA with data visualization             |
| Chatbot        | Penny (Gemini-powered, case-aware)   | Contextual Q&A with real case data injection   |
| Payment SDK    | Razorpay Java SDK (test mode)        | Real payment link creation via API             |
| Deployment     | Docker multi-stage build             | One `docker compose up` runs everything        |

---

## Package Structure (32 Java classes)

```
com.example.recovery_agent
├── agent/              # AI diagnosis layer
│   ├── Diagnosis.java              # Diagnosis record (rootCause, action, confidence)
│   ├── DiagnosisAgent.java         # Interface — swappable implementations
│   ├── GeminiDiagnosisAgent.java   # Real AI agent (Gemini + rule fallback)
│   └── StubDiagnosisAgent.java     # Hardcoded agent (dev/testing only)
│
├── api/                # REST controllers
│   ├── CaseController.java         # /api/cases, /api/dashboard, /api/orchestrator
│   ├── EvalController.java         # /api/eval/generate, /api/eval/run
│   └── HealthController.java       # /api/health
│
├── audit/              # Append-only audit trail
│   └── AuditService.java           # Single write path for all audit entries
│
├── chat/               # Penny chatbot
│   ├── ChatController.java         # POST /api/chat
│   ├── ChatRequest.java            # Request DTO
│   ├── ChatResponse.java           # Response DTO
│   └── ChatService.java            # Gemini API with case context injection
│
├── config/             # Spring configuration
│   ├── RazorpayConfig.java         # Razorpay SDK bean
│   └── SchedulingConfig.java       # @EnableScheduling
│
├── domain/             # JPA entities
│   ├── RecoveryCase.java           # Main entity — payment failure case
│   ├── RecoveryAttempt.java        # Individual recovery attempt
│   ├── AuditLog.java               # Append-only audit entry
│   └── enums/                      # Actor, CaseStatus, CaseType, InterventionType, Outcome
│
├── eval/               # Evaluation framework
│   ├── SyntheticDataGenerator.java # Creates 55 test cases
│   └── EvalHarness.java            # Runs agent, grades results, compares baseline
│
├── recovery/           # Core recovery engine
│   ├── RecoveryOrchestrator.java   # State machine + scheduling
│   ├── InterventionExecutor.java   # Executes recovery actions
│   ├── GuardrailService.java       # Spend cap, idempotency, rate limits
│   └── StoppingRules.java          # Max attempts, backoff, confidence threshold
│
├── repository/         # Spring Data JPA
│   ├── RecoveryCaseRepository.java
│   ├── RecoveryAttemptRepository.java
│   └── AuditLogRepository.java
│
└── webhook/            # Razorpay webhook ingestion
    ├── WebhookController.java      # POST /api/webhooks/razorpay
    └── WebhookService.java         # HMAC verification + event parsing
```

---

## Key Design Decisions

1. **AI proposes, guardrails dispose** — the LLM never touches money. Every intervention passes through `GuardrailService.check()` before `InterventionExecutor.execute()`.

2. **Rule-based fallback** — when Gemini is unavailable (rate limited, key expired, API down), the system falls back to a deterministic rule engine that maps error codes to interventions. The system never stops working because the AI is down.

3. **Append-only audit trail** — `AuditLog` entries are INSERT-only. No UPDATE, no DELETE. Every actor (AGENT, SYSTEM, HUMAN) writes through the same `AuditService.log()` method, creating a single, tamper-resistant decision history.

4. **Idempotency via Redis** — each attempt gets a unique Redis key (`recovery:{caseId}:attempt:{N}`) with 48-hour TTL. If the key exists, the attempt is skipped. This prevents double-charges if the orchestrator runs twice.

5. **Exponential backoff** — retry delays: 0s → 30min → 2hr → 24hr. Prevents customer harassment and unnecessary API load.

