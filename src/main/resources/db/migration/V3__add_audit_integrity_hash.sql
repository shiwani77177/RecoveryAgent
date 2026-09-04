ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(64);

-- Index for fast hash lookups during verification
CREATE INDEX IF NOT EXISTS idx_audit_hash ON audit_log(integrity_hash);

COMMENT ON COLUMN audit_log.integrity_hash IS
    'SHA-256(id::text || case_id::text || actor || action || reason || created_at::text) — tamper evidence';

