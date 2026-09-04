package com.example.recovery_agent.domain.enums;

/** What kind of at-risk revenue we're trying to recover. */
public enum CaseType {
    FAILED_PAYMENT,
    ABANDONED_CHECKOUT,
    FAILED_SUBSCRIPTION,
    OVERDUE_INVOICE
}
