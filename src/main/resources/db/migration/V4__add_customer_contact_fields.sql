ALTER TABLE recovery_case
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

COMMENT ON COLUMN recovery_case.customer_email IS 'Customer email from webhook — used for payment link delivery';
COMMENT ON COLUMN recovery_case.customer_phone IS 'Customer phone from webhook — used for SMS/WhatsApp delivery';

