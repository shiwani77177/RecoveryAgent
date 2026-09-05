<div align="center">

# ⚡ RecoveryAgent

### AI-Powered Revenue Recovery Platform

**Razorpay AI Buildathon 2026 · Track 03 — AI Revenue Recovery**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-recoverybot--i0cg.onrender.com-violet?style=for-the-badge)](https://recoverybot-i0cg.onrender.com)
[![Track](https://img.shields.io/badge/Track_03-Revenue_Recovery-blue?style=for-the-badge)]()
[![Java](https://img.shields.io/badge/Java-17-orange?style=for-the-badge&logo=openjdk)]()
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)]()

*Detect revenue at risk → Diagnose the root cause → Choose the right intervention → Recover the money*

*With compliant escalation, stopping rules, and a tamper-proof audit trail.*

</div>

---

## 📌 The Problem

Revenue loss rarely happens in one clean step. A payment degrades, a checkout gets abandoned, a subscription mandate fails, or a B2B invoice goes overdue. Most recovery tools stop at *detecting* the problem. The hard part — and where the money actually is — is **closing the loop**: diagnosing *why* it failed, deciding *how* to intervene, executing that intervention safely, and knowing when to *stop*.

RecoveryAgent is an autonomous agent that does exactly this across **four revenue-loss scenarios**, and — critically — **measures how much money it recovered that a naive strategy would have missed.**

---

## 🧠 Core Philosophy

> **The LLM proposes, deterministic gated code disposes.**

The AI diagnoses and recommends. It never touches money directly. Every action passes through a deterministic guardrail layer before execution, and every decision — approved or blocked — is written to an append-only, **SHA-256 integrity-verified** audit trail.

---

## 📊 Results

Measured across a batch of **100 synthetic cases** spanning all four revenue-loss scenarios:

| Metric | Naive Baseline | RecoveryAgent | Improvement |
| --- | --- | --- | --- |
| Recovery Rate | 35% | ~69% | **+98%** |
| Escalates fraud/risk correctly | ✗ retries blindly | ✓ auto-escalates | — |
| Wasted effort on blocked cards | High | Near-zero | — |

---

## ✅ Track Requirements — Fully Met

| The Bar | How RecoveryAgent Meets It |
| --- | --- |
| 🔍 **Detects revenue at risk** | Razorpay webhook receiver (`payment.failed`, `subscription.pending`) + detection across 4 scenarios |
| 🧠 **Determines the right intervention** | Gemini AI diagnosis per error-code + attempt number, with deterministic rule fallback |
| ⚙️ **Executes a bounded workflow** | State machine: `DETECTED → DIAGNOSING → EXECUTING → RECOVERED / ESCALATED / ABANDONED` |
| 💳 **Payment failures + checkout + receivables** | `FAILED_PAYMENT`, `ABANDONED_CHECKOUT`, `OVERDUE_INVOICE`, `FAILED_SUBSCRIPTION` |
| 📈 **Measured money recovered** | Eval harness: agent vs baseline, per-case grading (TP/TN/FP/FN), ₹ recovered |
| 🚨 **Compliant escalation** | Low-confidence + fraud/risk cases → auto-escalate to human |
| 🛑 **Stopping rules** | Max 4 attempts, exponential backoff, terminal `ABANDONED` state |
| 📋 **Audit trail** | Append-only log with SHA-256 per-row integrity hashes + one-click verification |

---

## 🌟 Key Features

### 🔁 Multi-Rail Recovery Chain

When one channel fails, the agent **intelligently escalates** to the next — each with a higher chance of reaching the customer:

```
Rail 1  →  SMART_RETRY      retry the charge on the same rail (temp failures)
Rail 2  →  PAYMENT_LINK     email a fresh Razorpay payment link (card issues)
Rail 3  →  UPI_FALLBACK     switch rails entirely to UPI, delivered via SMS
Rail 4  →  WHATSAPP_LINK    last resort — WhatsApp has ~98% open rate
             ↓ all exhausted
             ABANDONED
```

> 💡 The chain is **intelligent, not blind**: an expired card skips `SMART_RETRY` entirely (retrying an expired card is pointless) and goes straight to a payment link. A fraud flag skips everything and escalates immediately.

---

### 🤖 AI Diagnosis with Graceful Degradation

- **Primary:** Google Gemini (`gemini-3.6-flash`) analyzes each failure and recommends the optimal intervention
- **Circuit Breaker:** When the free tier's 20 daily requests are exhausted, a circuit breaker trips instantly — no wasted retries
- **Fallback:** Deterministic rule engine takes over seamlessly, with a UI banner warning the user
- **Cache:** `ConcurrentHashMap` caches diagnosis results, making repeat evaluations near-instant

---

### 🔐 Security & Compliance

| Feature | Implementation |
| --- | --- |
| 🔑 **HMAC-SHA256 Webhook Verification** | Every incoming Razorpay webhook signature is validated before processing |
| 🛡️ **Guardrails Before Money Moves** | Daily spend cap · Redis-backed idempotency · Per-customer contact rate limit (3/day) |
| 🔒 **JWT Authentication** | BCrypt password hashing · 1-year token expiry · Stateless sessions |
| 🧾 **Tamper-Proof Audit Trail** | `SHA-256(id · caseId · actor · action · reason · createdAt)` per row |
| ✅ **One-Click Integrity Check** | "Verify SHA-256 Integrity" button recomputes all hashes and flags mismatches |

---

### 📈 Evaluation Harness

The evaluation is the heart of the project — it proves the agent adds value, not just claims it.

- **Ground Truth:** Every synthetic case carries a `trulyRecoverable` flag, never visible to the agent at runtime
- **Baseline:** Naive retry-all at ~35% recovery (industry benchmark)
- **Grading:** True Positive · True Negative · False Positive · False Negative
- **Live Streaming:** SSE-powered progress bar shows real-time case-by-case processing
- **Persistent State:** Evaluation progress survives page navigation (React Context)

---

### 💬 Penny — AI Chat Assistant

Built-in conversational assistant powered by Gemini that answers questions about the dashboard, recovery strategies, and system behavior. Gracefully shows a "quota exhausted" card when the API limit is reached.

---

### 🎨 Modern UI/UX

- **Split-screen auth** — Animated gradient orbs + particle canvas on login/register
- **Dark/Light mode** — System-wide theme toggle with localStorage persistence
- **Collapsible sidebar** — 72px collapsed with icon tooltips, 240px expanded
- **Animated dashboard** — Framer Motion spring animations, animated counters, staggered card entrances
- **Real-time eval progress** — SSE streaming with rolling log, persists across navigation

---

## 🏗️ Architecture

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

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Backend** | Spring Boot 4.1.1 · Java 17 · Maven |
| **Frontend** | React 18 · Vite · TailwindCSS · Framer Motion |
| **Database** | PostgreSQL 13 · Flyway migrations |
| **Cache** | Redis (idempotency, rate limiting, backoff) |
| **AI** | Google Gemini (`gemini-3.6-flash`) |
| **Payments** | Razorpay Test Mode APIs (Payment Links) |
| **Auth** | JWT · BCrypt · Stateless sessions |
| **Infra** | Docker Compose · Multi-stage Dockerfile |
| **Deployment** | Render (Web Service + Postgres + Redis) |

---

## 🚀 Quick Start

**Prerequisites:** Docker Desktop

```bash
# 1. Clone
git clone https://github.com/shiwani77177/RecoveryBot.git
cd RecoveryBot

# 2. (Optional) Add your API keys in docker-compose.yml
#    Without them, the app runs fully on the rule-based engine.

# 3. Build and run (app + PostgreSQL + Redis)
docker compose up --build

# 4. Open
#    http://localhost:8080
```

**Then in the app:**

1. 📝 **Register** an account → complete the one-step payout setup
2. 📊 Go to **Metrics** → click **Generate Test Data** (creates 100 cases across 4 scenarios)
3. ▶️ Click **Run Evaluation** → watch the live progress stream
4. 📋 Explore **Dashboard**, **Cases**, and **Audit Log** (try the *Verify SHA-256 Integrity* button)

---

## 🌐 Live Demo

**→ [https://recoverybot-i0cg.onrender.com](https://recoverybot-i0cg.onrender.com)**

> ⚠️ Free-tier hosting — the first load may take ~30 seconds if the service is waking up. Subsequent loads are instant.

---

## 📁 Project Structure

```
RecoveryBot/
├── src/main/java/com/example/recovery_agent/
│   ├── agent/          AI diagnosis (Gemini + rule fallback + circuit breaker)
│   ├── recovery/       Orchestrator · InterventionExecutor · GuardrailService · StoppingRules
│   ├── webhook/        HMAC-SHA256 verified Razorpay webhook receiver
│   ├── audit/          SHA-256 integrity-hashed append-only audit log
│   ├── eval/           Synthetic data generator + evaluation harness (SSE streaming)
│   ├── chat/           Penny AI assistant (Gemini-powered)
│   ├── auth/           JWT authentication (BCrypt + stateless)
│   └── api/            REST controllers + health check
├── frontend/src/
│   ├── pages/          Dashboard · Cases · Metrics · AuditLog · Profile · Login · Register
│   ├── components/     Sidebar · Penny · AuthContext · ThemeContext · EvalContext · StatusBadge
│   └── api/            Axios client with JWT interceptors + timeout management
├── docs/               ARCHITECTURE · EVAL · SECURITY · JUDGE_DEFENSE
├── docker-compose.yml  Full stack: app + PostgreSQL + Redis
├── Dockerfile          Multi-stage: Node (frontend) → Maven (backend) → JRE (runtime)
└── README.md
```

---

## 📚 Documentation

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system design, component flow, data model |
| [`docs/EVAL.md`](docs/EVAL.md) | Evaluation methodology and grading criteria |
| [`docs/SECURITY.md`](docs/SECURITY.md) | HMAC verification, guardrails, audit integrity |
| [`docs/JUDGE_DEFENSE.md`](docs/JUDGE_DEFENSE.md) | Anticipated questions and honest answers |

---

## 💡 Design Decisions

| Decision | Why |
| --- | --- |
| **Rule fallback over pure AI** | Gemini has a 20/day free limit. The agent must work reliably 24/7, not just when quota is available. |
| **Circuit breaker on API quota** | Detects daily exhaustion on the first 429, skips all further AI calls instantly — eval stays fast. |
| **SHA-256 audit hashes** | Financial compliance requires tamper evidence. A one-click verify button proves no row was altered. |
| **Multi-rail over single retry** | A card-expired failure won't fix itself on retry. Switching to UPI or WhatsApp actually reaches the customer. |
| **SSE over polling for eval** | Real-time progress streaming gives judges (and users) confidence the system is working, not hanging. |

---

## ⚠️ Known Limitations (Honest)

- **Gemini free tier**: 20 requests/day. Circuit breaker degrades gracefully, but AI-powered results require quota.
- **Razorpay test mode**: Payment links are created but not settled. Real payment flow requires KYC completion.
- **SMS/WhatsApp delivery**: Simulated in audit log. Production would integrate Twilio or WhatsApp Business API.
- **Single-tenant**: No multi-merchant isolation. All users see the same recovery pipeline (intentional — it's a merchant dashboard, not a consumer app).

---

<div align="center">

### Built with ❤️ for the Razorpay AI Buildathon 2026

**Track 03 — AI Revenue Recovery**

*Detect · Diagnose · Intervene · Recover — safely, measurably, and with a full audit trail.*

[![GitHub](https://img.shields.io/badge/GitHub-shiwani77177/RecoveryBot-181717?style=for-the-badge&logo=github)](https://github.com/shiwani77177/RecoveryBot)
[![Live](https://img.shields.io/badge/Live-recoverybot--i0cg.onrender.com-violet?style=for-the-badge)](https://recoverybot-i0cg.onrender.com)

</div>
