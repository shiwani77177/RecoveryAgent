@'

# Architectural Decisions & System Design (`decisions.md`)

## 1. System Architecture & Principle

**Core Design Principle:** _"LLM proposes, deterministic gated code disposes."_
The recovery platform separates non-deterministic AI diagnosis from deterministic execution. The AI agent acts purely as an advisor that suggests recovery interventions and root causes, while hardcoded, testable guardrail code evaluates policy constraints and performs state transitions.

```text
Webhook / Event Source
          │
          ▼
Webhook Verification (HMAC-SHA256)
          │
          ▼
Recovery Orchestrator ───► Diagnosis Engine ───► (Gemini AI / Rule Fallback)
          │                                              │
          │                                              ▼
          ├──────────────► Guardrail Service ◄─── Recommended Action
          │                       │
          │                       ├─ Daily Spend Cap
          │                       ├─ Idempotency Check (Redis)
          │                       └─ Contact Rate Limits
          │                       │
          ▼                       ▼
Intervention Executor (Smart Retry / Payment Link / UPI / WhatsApp)
          │
          ▼
Append-Only Audit Log 🔒 (SHA-256 Tamper-Evident)

```

## 2. Key Architecture Decisions & Trade-Offs

| Decision                          | Chosen Approach                                 | Rationale                                                                                                                                                                                | Alternatives Considered                                                                                                                |
| :-------------------------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework & Runtime**           | Java 21 + Spring Boot 3                         | Ensures type safety, robust concurrency management for background orchestration, enterprise-grade transaction handling, and native production readiness.                                 | Python (FastAPI): Faster initial prototyping, but weaker static typing and thread concurrency for high-throughput webhook streams.     |
| **Circuit Breaker / AI Fallback** | Hybrid (Gemini API + Deterministic Rule Engine) | Primary diagnosis uses Gemini AI. If API quota errors or rate limits occur, a circuit breaker trips to instantly route to a deterministic rule-based engine, guaranteeing zero downtime. | Pure LLM: Unreliable under API rate limits/outages. Pure Rule Engine: Missing context awareness for non-standard failure descriptions. |
| **Audit Log Integrity**           | Append-Only Table with SHA-256 Hashes           | Every system action, guardrail validation, and state change produces an immutable audit record containing a cryptographic hash of its payload and previous row state.                    | Standard Relational Log: Susceptible to silent database updates or unauthorized row modification without proof of tampering.           |
| **State & Idempotency**           | PostgreSQL + Redis Key-Value Store              | PostgreSQL maintains persistent case lifecycle states. Redis provides ultra-low latency idempotency locks and sliding-window rate limit checks.                                          | PostgreSQL-only: Slower lock checks for high-frequency webhooks, higher database connection strain under spike traffic.                |

---


## 3. Case Lifecycle State Machine

Each recovery case moves strictly through defined state transitions governed by stopping rules and guardrail execution outcomes.

```text

DETECTED ──► DIAGNOSING ──► EXECUTING ──► RECOVERED ✅
                  │              │
           (low confidence)   (failed)
                  │              │
                  ▼              ▼
              ESCALATED ⚠️    WAITING ──► backoff expires ──► DIAGNOSING
                                 │
                          (max 4 attempts)
                                 │
                                 ▼
                             ABANDONED ❌

```

## 4. Multi-Rail Recovery Strategy

When a transaction or invoice fails, the engine cascades through recovery rails based on error context and previous attempt counts:

- **Rail 1 (Smart Retry):** Executes automated retry against the primary payment method for transient errors (e.g., network timeout, bank service downtime).
- **Rail 2 (Payment Link):** Generates and dispatches a secure Razorpay Payment Link via Email for actionable payment issues (e.g., expired card, insufficient funds).
- **Rail 3 (UPI Deep Link / SMS):** Sends direct UPI deep-link prompts over SMS for high-converting mobile transactions.
- **Rail 4 (WhatsApp Engagement):** Triggers WhatsApp template notifications for abandoned checkouts and high-value overdue invoices requiring high open-rate conversion.
- **Escalation / Halt:** Skips automated rails immediately if fraud patterns are flagged or max contact attempts are exceeded, assigning the case to human operations.

---

## 5. Security & Guardrails

- **Webhook Authentication:** Validates HMAC-SHA256 signatures on all incoming webhooks prior to case ingestion.
- **Idempotency Guarantees:** Enforces key locks (`idempotency:{case_id}:{action}`) in Redis to eliminate duplicate charges or redundant customer notifications.
- **Contact Rate Limiting:** Enforces maximum per-customer communication thresholds over rolling 24-hour windows.
- **Financial Spend Caps:** Implements hard daily limits on automated retry amounts and promotional recovery incentives.
  '@ | Out-File -FilePath "docs\decisions.md" -Encoding utf8


