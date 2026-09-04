CREATE TABLE app_user (
    id           BIGSERIAL PRIMARY KEY,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    full_name    VARCHAR(255),
    upi_id       VARCHAR(100),
    bank_account VARCHAR(20),
    ifsc_code    VARCHAR(11),
    setup_done   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_email ON app_user(email);

