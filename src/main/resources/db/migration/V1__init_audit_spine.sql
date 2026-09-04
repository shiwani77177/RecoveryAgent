CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE recovery_case (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type              VARCHAR(40)   NOT NULL,
    merchant_id       VARCHAR(64)   NOT NULL,
    customer_id       VARCHAR(64)   NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'INR',
    status            VARCHAR(30)   NOT NULL,
    risk_reason       VARCHAR(80),
    recovered_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    attempt_count     INT           NOT NULL DEFAULT 0,
    truly_recoverable BOOLEAN,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ
);

CREATE TABLE recovery_attempt (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id            UUID         NOT NULL REFERENCES recovery_case(id),
    attempt_number     INT          NOT NULL,
    intervention_type  VARCHAR(40)  NOT NULL,
    channel            VARCHAR(20),
    decided_by         VARCHAR(10)  NOT NULL,
    rationale          TEXT,
    outcome            VARCHAR(20)  NOT NULL,
    idempotency_key    VARCHAR(120) UNIQUE,
    executed_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          UUID REFERENCES recovery_case(id),
    attempt_id       UUID REFERENCES recovery_attempt(id),
    actor            VARCHAR(10)  NOT NULL,
    action           VARCHAR(60)  NOT NULL,
    input_snapshot   JSONB,
    output_snapshot  JSONB,
    money_action     BOOLEAN      NOT NULL DEFAULT FALSE,
    amount           NUMERIC(12,2),
    reason           TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes for the queries we know we'll run:
CREATE INDEX idx_case_status  ON recovery_case(status);
CREATE INDEX idx_attempt_case ON recovery_attempt(case_id);
CREATE INDEX idx_audit_case   ON audit_log(case_id);
-- Partial index: "show me every money action ever" stays fast even at scale.
CREATE INDEX idx_audit_money  ON audit_log(money_action) WHERE money_action = TRUE;
