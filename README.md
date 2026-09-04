<div align="center">

# ⚡ RecoveryAgent

### AI-Powered Revenue Recovery for Razorpay

**Razorpay AI Buildathon 2026 · Track 03 — AI Revenue Recovery**

_Detect revenue at risk → diagnose the root cause → choose the right intervention → recover the money — with compliant escalation, stopping rules, and a tamper-proof audit trail._

</div>

---

## The Problem

Revenue loss rarely happens in one clean step. A payment degrades, a checkout gets abandoned, a subscription mandate fails, or a B2B invoice goes overdue. Most recovery tools stop at _detecting_ the problem. The hard part — and where the money actually is — is **closing the loop**: diagnosing _why_ it failed, deciding _how_ to intervene, executing that intervention safely, and knowing when to _stop_.

RecoveryAgent is an autonomous agent that does exactly this across four revenue-loss scenarios, and — critically — **measures how much money it recovered that a naive strategy would have missed.**

---

## What Makes This Different

Most "AI recovery" demos report a gross number: _"we recovered ₹X."_ That number is meaningless on its own, because a payment that failed during a 30-second bank outage will succeed on retry whether or not an AI touched it.

RecoveryAgent is built around one design principle:

> **The LLM proposes, deterministic gated code disposes.**

The AI diagnoses and recommends. It never touches money directly. Every action passes through a deterministic guardrail layer (spend caps, idempotency, rate limits, stopping rules) before execution, and every decision — approved or blocked — is written to an append-only, **SHA-256 integrity-verified** audit trail.

Then we prove it works with a rigorous evaluation: agent vs. naive baseline, graded against ground-truth recoverability, reporting the **incremental** money recovered.

---

## Results

Measured across a batch of 100 synthetic cases spanning all four revenue-loss scenarios:

| Metric                                                    | Naive Baseline    | RecoveryAgent | Improvement |
| --------------------------------------------------------- | ----------------- | ------------- | ----------- |
| Recovery rate (of recoverable cases)                      | 35%               | ~69%          | **+98%**    |
| Correctly escalates unrecoverable cases (fraud, disputes) | ✗ retries blindly | ✓ escalates   | —           |
| Wasted effort on fraud/blocked cards                      | High              | Near-zero     | —           |

The baseline retries every failed payment once. The agent beats it by sending payment links instead of retrying expired cards, escalating fraud instead of wasting resources on it, and switching payment rails (card → UPI → WhatsApp) based on the specific failure.

_Numbers vary with live AI availability; see [Evaluation](#evaluation) and the AI-quota note below._

---

## How It Maps to the Track Requirements

| The bar                                                           | How RecoveryAgent meets it                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Detects revenue at risk**                                       | Razorpay webhook receiver (`payment.failed`, `subscription.pending`) + case detection across 4 scenarios |
| **Determines the right intervention**                             | Gemini-powered diagnosis per error-code and attempt number, with a deterministic rule fallback           |
| **Executes a bounded workflow**                                   | State machine `DETECTED → DIAGNOSING → EXECUTING → RECOVERED/ESCALATED/ABANDONED`, capped at 4 attempts  |
| **Payment failures + checkout abandonment + overdue receivables** | `FAILED_PAYMENT`, `ABANDONED_CHECKOUT`, `OVERDUE_INVOICE`, `FAILED_SUBSCRIPTION` all handled             |
| **Measured money recovered across a batch**                       | Evaluation harness: agent vs. baseline, per-case grading, ₹ recovered, % improvement                     |
| **Compliant escalation**                                          | Low-confidence and fraud/risk cases auto-escalate to a human                                             |
| **Stopping rules**                                                | Max 4 attempts, exponential backoff, terminal `ABANDONED` state                                          |
| **Audit trail**                                                   | Append-only audit log with SHA-256 per-row integrity hashes and a one-click verification endpoint        |

---

## Multi-Rail Recovery

When one channel fails, the agent escalates to the next — each with a higher chance of reaching the customer:

```
Attempt 1  →  SMART_RETRY      retry the charge on the same rail (temp failures)
Attempt 2  →  PAYMENT_LINK     email a fresh Razorpay payment link (card issues)
Attempt 3  →  UPI_FALLBACK     switch rails to UPI, delivered via SMS
Attempt 4  →  WHATSAPP_LINK    last resort — WhatsApp has ~98% open rate
              ↓ all exhausted
              ABANDONED
```

The chain is **intelligent, not blind**: an expired card skips `SMART_RETRY` entirely (retrying an expired card is pointless) and goes straight to a payment link; a fraud flag skips everything and escalates immediately.

---

## Architecture

```
        Razorpay Webhooks  ──HMAC-SHA256──►  Webhook Receiver
        payment.failed                        creates RecoveryCase
        subscription.pending                  (status = DETECTED)
                                                     │
                                                     ▼
                                          Recovery Orchestrator
                              state machine · @Scheduled 30s · backoff · stopping rules
                                       │                        │
                          ┌────────────┘                        └───────────┐
                          ▼                                                  ▼
                  Diagnosis Agent                                   Guardrail Service
             Gemini API + rule fallback                    runs BEFORE every money action:
             + quota circuit breaker                       · daily spend cap
                                                           · idempotency (Redis)
                                                           · contact rate limit (3/day)
                                                                          │
                                                                          ▼
                                                            Intervention Executor
                                                    4 rails · real Razorpay Payment Link API
                                                                          │
                                                                          ▼
                                                     Append-only Audit Log (SHA-256 verified)
```

**Stack:** Spring Boot 3 (Java 17) · PostgreSQL · Redis · React + Vite + TailwindCSS · Google Gemini · Docker Compose.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

---

## Quick Start

**Prerequisites:** Docker Desktop.

```bash
# 1. Clone
git clone <your-repo-url>
cd RecoveryBot

# 2. (Optional) add your Gemini + Razorpay keys
#    Without them the app still runs fully on the rule-based engine.
#    Set GEMINI_API_KEY and RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in docker-compose.yml

# 3. Build and run everything (app + PostgreSQL + Redis)
docker compose up --build

# 4. Open the app
#    http://localhost:8080
```

Then, in the app:

1. **Register** an account and complete the one-step payout setup.
2. Go to **Metrics → Generate Test Data** (creates 100 cases across all 4 scenarios).
3. Click **Run Evaluation** and watch the live progress stream.
4. Explore the **Dashboard**, **Cases**, and **Audit Log** (try the _Verify SHA-256 Integrity_ button).

---

## Evaluation

The evaluation is the heart of the project — it's how we prove the agent adds value rather than just claiming it.

- **Ground truth:** every synthetic case carries a `trulyRecoverable` flag, never visible to the agent at runtime.
- **Baseline:** naive retry-all, ~35% recovery (industry benchmark).
- **Grading:** each case is scored as True Positive (correct recovery), True Negative (correct escalation of fraud/disputes), False Negative (missed revenue), or False Positive (wasted effort).
- **Output:** recovery rate, incremental improvement over baseline, ₹ recovered, and a per-case breakdown table.

Full methodology in [`docs/EVAL.md`](docs/EVAL.md).

### A note on AI quota

The free Gemini tier allows 20 requests/day. When that's exhausted, the agent **degrades gracefully** to its deterministic rule engine — the workflow keeps running, and the Metrics page shows a clear banner explaining that results reflect rule-based fallback rather than full AI. A circuit breaker detects daily-quota exhaustion and skips further AI calls automatically, so runs stay fast. When quota resets, full AI diagnosis resumes with no code change.

---

## Compliance, Safety & Audit

- **HMAC-SHA256 webhook verification** — every incoming webhook signature is validated before processing.
- **Guardrails before money moves** — daily spend cap, Redis-backed idempotency (no double-charges), per-customer contact rate limit.
- **Stopping rules** — bounded at 4 attempts with exponential backoff; exhausted cases are abandoned, not retried forever.
- **Tamper-proof audit** — every audit row carries a `SHA-256(id · caseId · actor · action · reason · createdAt)` hash. The _Verify Integrity_ endpoint recomputes all hashes and flags any mismatch.

Details in [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Project Structure

```
RecoveryBot/
├── src/main/java/com/example/recovery_agent/
│   ├── agent/          Diagnosis (Gemini + rule fallback + circuit breaker)
│   ├── recovery/       Orchestrator, InterventionExecutor, GuardrailService, StoppingRules
│   ├── webhook/        HMAC-verified Razorpay webhook receiver
│   ├── audit/          SHA-256 integrity-hashed audit log
│   ├── eval/           Synthetic data generator + evaluation harness
│   ├── auth/           JWT authentication
│   └── api/            REST controllers
├── frontend/           React + Vite + Tailwind dashboard
├── docs/               ARCHITECTURE · EVAL · SECURITY · JUDGE_DEFENSE
├── docker-compose.yml
└── README.md
```

---

## Documentation

| Doc                                              | What's inside                                  |
| ------------------------------------------------ | ---------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)   | Full system design, component flow, data model |
| [`docs/EVAL.md`](docs/EVAL.md)                   | Evaluation methodology and grading criteria    |
| [`docs/SECURITY.md`](docs/SECURITY.md)           | HMAC verification, guardrails, audit integrity |
| [`docs/JUDGE_DEFENSE.md`](docs/JUDGE_DEFENSE.md) | Anticipated questions and honest answers       |

---

<div align="center">

**Built for the Razorpay AI Buildathon 2026 · Track 03**

_Detect · Diagnose · Intervene · Recover — safely, measurably, and with a full audit trail._

</div>
