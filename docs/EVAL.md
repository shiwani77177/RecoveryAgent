# Evaluation Methodology

> How we measure whether the AI agent actually adds value.

---

## The Problem with "Recovered" Dashboards

Most recovery tools report gross recovery numbers — "we recovered ₹X." But they
don't answer the real question: **how much of that money would have come back
anyway?** A payment that fails due to a 30-second bank outage will succeed on
retry regardless of whether an AI touched it.

RecoveryAgent addresses this with a structured evaluation framework.

---

## Evaluation Design

### Synthetic Test Corpus

55 carefully designed test cases spanning 6 failure categories:

| Group | Count | Type                 | Examples                                                                                          |
| ----- | ----- | -------------------- | ------------------------------------------------------------------------------------------------- |
| A     | 18    | Failed card payments | insufficient_funds, card_expired, bank_downtime, authentication_failed, payment_risk_check_failed |
| B     | 7     | Failed UPI payments  | upi_provider_downtime, upi_cancelled, upi_limit_exceeded                                          |
| C     | 12    | Abandoned checkouts  | dropped_at_payment_page, dropped_at_otp_screen, high_value_hesitation                             |
| D     | 8     | Failed subscriptions | mandate_expired, card_blocked, charge_failed_attempt_2/3/4                                        |
| E     | 5     | Overdue invoices     | forgot_3_days, forgot_7_days, disputed, unresponsive, partial_payment                             |
| F     | 5     | Edge cases           | max_attempts_hit, immediate_escalate, unknown_error_code                                          |

Each case carries a **`trulyRecoverable`** flag — the ground truth set by us, never
visible to the agent at runtime. This is what the eval grades against.

- **48 cases** are truly recoverable (the customer CAN pay if approached correctly)
- **7 cases** are truly unrecoverable (fraud, blocked cards, disputes — should NOT be retried)

### Baseline: Naive Retry-All

The baseline represents the simplest possible strategy: **retry every failed
payment once, with no diagnosis.** Industry data suggests this recovers
approximately **35%** of recoverable payments.

The agent should beat this by being smarter — sending payment links instead of
retrying expired cards, escalating fraud instead of wasting resources, choosing
the right channel (SMS vs email vs WhatsApp) based on the failure type.

---

## Grading Criteria

Each case is graded by comparing the agent's final decision against the ground truth:

| Agent Decision | Truly Recoverable? | Grade             | Meaning                                                     |
| -------------- | ------------------ | ----------------- | ----------------------------------------------------------- |
| RECOVERED      | Yes                | ✅ TRUE POSITIVE  | Correct recovery — revenue saved                            |
| ESCALATED      | No                 | ✅ TRUE NEGATIVE  | Correct escalation — avoided wasting resources on fraud     |
| ESCALATED      | Yes                | ❌ FALSE NEGATIVE | Missed revenue — agent gave up on a recoverable case        |
| RECOVERED      | No                 | ⚠️ FALSE POSITIVE | Wasted effort — recovered an unrecoverable case (edge case) |
| WAITING        | —                  | ⏳ PENDING        | Case needs more orchestrator runs to complete               |

---

## How to Run the Evaluation

```bash
# Step 1: Start the system
docker compose up --build

# Step 2: Generate 55 synthetic test cases
curl -X POST http://localhost:8080/api/eval/generate

# Step 3: Run the evaluation (processes all cases, grades them)
curl -X POST http://localhost:8080/api/eval/run
```

The `/api/eval/run` endpoint returns a full JSON report with:

- Agent recovery rate vs baseline
- Improvement percentage
- False escalation count
- Per-case breakdown with grades

The **Metrics page** (`/metrics` in the UI) visualizes these results as a bar chart
comparing the agent's recovery rate against the baseline.

---

## Evaluation Metrics Reported

| Metric                     | Description                                         |
| -------------------------- | --------------------------------------------------- |
| Agent Recovery Rate (%)    | Cases correctly recovered ÷ total recoverable cases |
| Baseline Recovery Rate (%) | Fixed at 35% (naive retry-all strategy)             |
| Improvement (%)            | Percentage improvement of agent over baseline       |
| False Escalations          | Recoverable cases the agent incorrectly escalated   |
| False Recoveries           | Unrecoverable cases the agent incorrectly recovered |
| Total At Risk (₹)          | Sum of all case amounts                             |
| Agent Recovered (₹)        | Sum of amounts the agent successfully recovered     |

---

## Methodology Notes (Honest)

1. **Simulated outcomes** — The InterventionExecutor uses probabilistic simulation
   for most actions (SMART_RETRY, DUNNING_MESSAGE, ALT_METHOD) because Razorpay
   test mode doesn't support real payment retries or SMS delivery. PAYMENT_LINK
   uses the real Razorpay API. All simulated actions are labeled in the audit trail.

2. **Non-deterministic results** — Because `Math.random()` drives simulated outcomes,
   recovery rates vary between runs. Run the eval 3 times and average for stable numbers.

3. **Rule fallback included** — When the Gemini API is unavailable (rate limited or
   key expired), the agent falls back to deterministic rules. The eval grades
   the final outcome regardless of whether AI or rules made the decision.
   The audit trail records which path was used for transparency.

4. **Ground truth is manually assigned** — We set `trulyRecoverable` based on
   domain knowledge (e.g., insufficient_funds = recoverable, fraud = not).
   In production, this would be determined by actual payment outcomes over time.
