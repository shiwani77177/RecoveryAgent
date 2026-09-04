# Security & Guardrails

> How RecoveryAgent keeps AI-driven payment recovery safe, bounded, and auditable.

---

## Core Security Principle

**No AI model directly executes payment operations.**

The system enforces a strict separation:

- The **AI agent** (GeminiDiagnosisAgent) outputs a `Diagnosis` record — a recommendation
- The **GuardrailService** validates whether the recommendation is safe to execute
- The **InterventionExecutor** performs the actual action only after guardrails pass
- The **AuditService** records every step — including blocked actions and their reasons

This is the "LLM proposes, deterministic gated code disposes" architecture.

---

## Guardrail Checks (GuardrailService.java)

Three checks run **before** every intervention. If ANY fails, the action is blocked,
the case returns to WAITING, and the reason is logged to the audit trail.

### 1. Daily Spend Cap

```java
private static final BigDecimal DAILY_SPEND_CAP = new BigDecimal("10000000");
```

Tracks total ₹ of recovery actions executed today via Redis key `spend:daily:YYYY-MM-DD`.
If the next action would exceed the cap, it's blocked. Prevents a runaway agent
from burning through unlimited money.

**Redis key:** `spend:daily:2026-09-02` → `"49500"` (₹49,500 spent today)

### 2. Idempotency (No Double-Execute)

```
Redis key: recovery:{caseId}:attempt:{N}
TTL: 48 hours
```

Before executing attempt N for a case, the guardrail checks if the Redis key exists.
If it does, this exact attempt was already executed — skip it. This prevents
double-charges if the orchestrator is triggered twice (by scheduler + manual API call).

### 3. Customer Contact Rate Limit

```
Redis key: contacts:{customerId}:YYYY-MM-DD
Max: 3 messages per customer per day
```

Prevents customer harassment. If a customer has already received 3 messages today
(via SMS, WhatsApp, or email), no further contact actions are executed. Silent
retries (SMART_RETRY with null channel) are not counted.

---

## Webhook Security

### HMAC-SHA256 Signature Verification

Every incoming Razorpay webhook is verified using HMAC-SHA256:

```java
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(webhookSecret.getBytes(), "HmacSHA256"));
String expectedSignature = Hex.encodeHexString(mac.doFinal(payload.getBytes()));
return expectedSignature.equals(actualSignature);
```

- Webhook secret is stored in environment variables (never in code)
- Invalid signatures are rejected with 401
- `/test` endpoint skips verification for development only

---

## Stopping Rules (StoppingRules.java)

Deterministic rules that prevent infinite retry loops:

| Rule                 | Value                  | Purpose                                             |
| -------------------- | ---------------------- | --------------------------------------------------- |
| MAX_ATTEMPTS         | 4                      | No case gets more than 4 recovery attempts          |
| CONFIDENCE_THRESHOLD | 0.6                    | Agent confidence below 60% → escalate to human      |
| BACKOFF_SECONDS      | [0, 1800, 7200, 86400] | Exponential backoff: immediate → 30min → 2hr → 24hr |

These rules are enforced by the orchestrator before and after diagnosis.
The AI cannot override them.

---

## Audit Trail Properties

The `audit_log` table is the system's source of truth:

| Property              | Implementation                                                             |
| --------------------- | -------------------------------------------------------------------------- |
| **Append-only**       | INSERT only — no UPDATE or DELETE operations on audit_log                  |
| **Single write path** | All actors (AGENT, SYSTEM, HUMAN) write through `AuditService.log()`       |
| **Money-flagged**     | Every entry with financial impact has `money_action=true` and `amount` set |
| **Actor-tagged**      | Every entry identifies who made the decision (AGENT, SYSTEM, or HUMAN)     |
| **Timestamped**       | `created_at` is set automatically by the database                          |
| **Filterable**        | Frontend supports filtering by actor, action type, money-only, and search  |

### Audit Actions Logged

| Action                 | Actor  | When                                    |
| ---------------------- | ------ | --------------------------------------- |
| CASE_DETECTED          | SYSTEM | Webhook received and case created       |
| DIAGNOSED              | AGENT  | AI agent returned a diagnosis           |
| GUARDRAIL_BLOCKED      | SYSTEM | Guardrail check failed — action blocked |
| INTERVENTION_SUCCEEDED | SYSTEM | Recovery action succeeded               |
| INTERVENTION_FAILED    | SYSTEM | Recovery action failed                  |
| RETRY_SCHEDULED        | SYSTEM | Case scheduled for retry with backoff   |
| ESCALATED              | SYSTEM | Case handed to human review             |
| ABANDONED              | SYSTEM | Max attempts reached, case given up     |

---

## Environment Variable Security

| Variable            | Purpose                        | Stored in           |
| ------------------- | ------------------------------ | ------------------- |
| RAZORPAY_KEY_ID     | Razorpay API key               | `.env` (gitignored) |
| RAZORPAY_KEY_SECRET | Webhook HMAC secret            | `.env` (gitignored) |
| GEMINI_API_KEY      | Google Gemini for AI diagnosis | `.env` (gitignored) |
| DB_PASSWORD         | PostgreSQL password            | `.env` (gitignored) |

- `.env` is in `.gitignore` — never committed to Git
- `.env.example` is committed with placeholder values
- Docker Compose reads `.env` and passes variables to containers
- Application reads them via Spring's `@Value("${...}")` injection

---

## Accepted Limitations (Stated Honestly)

1. **No authentication on the API** — the REST endpoints are open. In production,
   add Spring Security with JWT authentication.

2. **Single-instance deployment** — Redis-based guardrails assume one app instance.
   Multi-instance deployment would need distributed locking (Redisson/Redis Cluster).

3. **No HTTPS in Docker** — local development uses HTTP. Production deployment
   should use a reverse proxy (nginx) with TLS certificates.

4. **Test mode only** — Razorpay test keys (`rzp_test_*`) are used. The system
   refuses to run with live keys as a safety measure. Payment link creation is
   real (creates actual test-mode links) but no real money ever moves.

5. **No PII encryption** — customer IDs are stored in plaintext. Production
   systems should encrypt PII at rest using AES-256.
