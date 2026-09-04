package com.example.recovery_agent.eval;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.audit.AuditService;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.domain.enums.CaseStatus;
import com.example.recovery_agent.domain.enums.CaseType;
import com.example.recovery_agent.repository.AuditLogRepository;
import com.example.recovery_agent.repository.RecoveryAttemptRepository;
import com.example.recovery_agent.repository.RecoveryCaseRepository;


 //Generates 100 synthetic test cases across all 4 revenue loss scenarios:
@Service
public class SyntheticDataGenerator {

    private static final Logger log = LoggerFactory.getLogger(SyntheticDataGenerator.class);

    private final RecoveryCaseRepository caseRepo;
    private final AuditService audit;
    private final AuditLogRepository auditLogRepo;
    private final RecoveryAttemptRepository attemptRepo;

    public SyntheticDataGenerator(RecoveryCaseRepository caseRepo,
                                  AuditService audit,
                                  AuditLogRepository auditLogRepo,
                                  RecoveryAttemptRepository attemptRepo) {
        this.caseRepo = caseRepo;
        this.audit = audit;
        this.auditLogRepo = auditLogRepo;
        this.attemptRepo = attemptRepo;
    }

    @org.springframework.transaction.annotation.Transactional
    public List<RecoveryCase> generateAll() {
        log.info("═══ Generating 100 synthetic test cases across all 4 revenue scenarios ═══");

        // Clean up ALL previous data in the correct order to avoid foreign-key
        // violations. Children (audit_log, recovery_attempt) reference recovery_case,
        // so they MUST be deleted first.
        //
        // This was the cause of the "works first time, 403 after that" bug:
        // the second generate tried to delete recovery_case rows that were still
        // referenced by audit_log/recovery_attempt, throwing a DataIntegrityViolation
        // that the browser surfaced as a 403.
        long before = caseRepo.count();
        if (before > 0) {
            log.info("Clearing {} existing cases and their child records...", before);
            auditLogRepo.deleteAllInBatch();      // delete audit_log first
            attemptRepo.deleteAllInBatch();        // delete recovery_attempt next
            caseRepo.deleteAllInBatch();           // now safe to delete recovery_case
            log.info("Cleared all previous data");
        }

        List<RecoveryCase> all = new ArrayList<>();


        // SCENARIO 1: FAILED CARD PAYMENTS (20 cases)
        // First 3 use YOUR real contact info so you can demo real delivery
        all.add(make(CaseType.FAILED_PAYMENT, "499.00",   "insufficient_funds",                 "cust_card_01", true,  "shiwanisinha77177@gmail.com", "+917717792504"));
        all.add(make(CaseType.FAILED_PAYMENT, "1299.00",  "insufficient_funds",                 "cust_card_02", true,  "shiwanisinha77177@gmail.com", "+917717792504"));
        all.add(make(CaseType.FAILED_PAYMENT, "2799.00",  "card_expired",                       "cust_card_03", true,  "shiwanisinha77177@gmail.com", "+917717792504"));
        all.add(make(CaseType.FAILED_PAYMENT, "799.00",   "card_expired",                       "cust_card_04", true));
        all.add(make(CaseType.FAILED_PAYMENT, "2499.00",  "card_expired",                       "cust_card_05", true));
        all.add(make(CaseType.FAILED_PAYMENT, "599.00",   "bank_downtime",                      "cust_card_06", true));
        all.add(make(CaseType.FAILED_PAYMENT, "899.00",   "bank_technical_error",               "cust_card_07", true));
        all.add(make(CaseType.FAILED_PAYMENT, "349.00",   "authentication_failed",              "cust_card_08", true));
        all.add(make(CaseType.FAILED_PAYMENT, "1599.00",  "authentication_failed",              "cust_card_09", true));
        all.add(make(CaseType.FAILED_PAYMENT, "999.00",   "payment_timed_out",                  "cust_card_10", true));
        all.add(make(CaseType.FAILED_PAYMENT, "449.00",   "incorrect_cvv",                      "cust_card_11", true));
        all.add(make(CaseType.FAILED_PAYMENT, "699.00",   "card_not_enrolled",                  "cust_card_12", true));
        all.add(make(CaseType.FAILED_PAYMENT, "1199.00",  "card_disabled_for_online_payments",  "cust_card_13", true));
        all.add(make(CaseType.FAILED_PAYMENT, "3999.00",  "transaction_limit_exceeded",         "cust_card_14", true));
        all.add(make(CaseType.FAILED_PAYMENT, "549.00",   "card_declined",                      "cust_card_15", true));
        all.add(make(CaseType.FAILED_PAYMENT, "15000.00", "payment_risk_check_failed",          "cust_card_16", false));
        all.add(make(CaseType.FAILED_PAYMENT, "8999.00",  "debit_instrument_blocked",           "cust_card_17", false));
        all.add(make(CaseType.FAILED_PAYMENT, "299.00",   "payment_failed",                     "cust_card_18", true));
        all.add(make(CaseType.FAILED_PAYMENT, "1999.00",  "gateway_technical_error",            "cust_card_19", true));
        all.add(make(CaseType.FAILED_PAYMENT, "12000.00", "fraud_decline",                      "cust_card_20", false));


        // SCENARIO 2: FAILED UPI PAYMENTS (15 cases)
        // Covers: UPI-specific errors, app issues, bank downtime
        all.add(make(CaseType.FAILED_PAYMENT, "399.00",   "upi_provider_downtime",              "cust_upi_01", true));
        all.add(make(CaseType.FAILED_PAYMENT, "599.00",   "upi_wrong_bank_account",             "cust_upi_02", true));
        all.add(make(CaseType.FAILED_PAYMENT, "249.00",   "upi_partner_bank_technical",         "cust_upi_03", true));
        all.add(make(CaseType.FAILED_PAYMENT, "149.00",   "upi_payment_cancelled",              "cust_upi_04", true));
        all.add(make(CaseType.FAILED_PAYMENT, "799.00",   "upi_insufficient_funds",             "cust_upi_05", true));
        all.add(make(CaseType.FAILED_PAYMENT, "25000.00", "upi_limit_exceeded",                 "cust_upi_06", true));
        all.add(make(CaseType.FAILED_PAYMENT, "199.00",   "upi_incorrect_pin",                  "cust_upi_07", true));
        all.add(make(CaseType.FAILED_PAYMENT, "1499.00",  "upi_provider_downtime",              "cust_upi_08", true));
        all.add(make(CaseType.FAILED_PAYMENT, "899.00",   "upi_payment_cancelled",              "cust_upi_09", true));
        all.add(make(CaseType.FAILED_PAYMENT, "349.00",   "upi_partner_bank_technical",         "cust_upi_10", true));
        all.add(make(CaseType.FAILED_PAYMENT, "2199.00",  "upi_limit_exceeded",                 "cust_upi_11", true));
        all.add(make(CaseType.FAILED_PAYMENT, "499.00",   "upi_insufficient_funds",             "cust_upi_12", true));
        all.add(make(CaseType.FAILED_PAYMENT, "699.00",   "upi_wrong_bank_account",             "cust_upi_13", true));
        all.add(make(CaseType.FAILED_PAYMENT, "999.00",   "upi_incorrect_pin",                  "cust_upi_14", true));
        all.add(make(CaseType.FAILED_PAYMENT, "1299.00",  "upi_provider_downtime",              "cust_upi_15", true));


        // SCENARIO 3: ABANDONED CHECKOUTS (25 cases)
        // Problem statement explicitly mentions "checkout abandonment"
        // Covers: payment page drops, OTP hesitation, high-value friction
        all.add(make(CaseType.ABANDONED_CHECKOUT, "499.00",   "dropped_at_payment_page",        "cust_aban_01", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "1299.00",  "dropped_at_payment_page",        "cust_aban_02", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "2999.00",  "dropped_at_otp_screen",          "cust_aban_03", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "8499.00",  "high_value_hesitation",          "cust_aban_04", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "699.00",   "dropped_at_bank_redirect",       "cust_aban_05", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "349.00",   "cart_abandonment",               "cust_aban_06", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "1899.00",  "dropped_at_3ds",                 "cust_aban_07", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "599.00",   "dropped_at_payment_page",        "cust_aban_08", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "4999.00",  "dropped_at_otp_screen",          "cust_aban_09", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "799.00",   "cart_abandonment",               "cust_aban_10", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "199.00",   "dropped_at_payment_page",        "cust_aban_11", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "6999.00",  "high_value_hesitation",          "cust_aban_12", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "12999.00", "high_value_hesitation",          "cust_aban_13", false));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "449.00",   "dropped_at_bank_redirect",       "cust_aban_14", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "899.00",   "dropped_at_3ds",                 "cust_aban_15", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "3499.00",  "dropped_at_otp_screen",          "cust_aban_16", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "249.00",   "cart_abandonment",               "cust_aban_17", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "1599.00",  "dropped_at_payment_page",        "cust_aban_18", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "5499.00",  "high_value_hesitation",          "cust_aban_19", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "999.00",   "dropped_at_bank_redirect",       "cust_aban_20", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "399.00",   "dropped_at_payment_page",        "cust_aban_21", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "2499.00",  "dropped_at_3ds",                 "cust_aban_22", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "749.00",   "cart_abandonment",               "cust_aban_23", true));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "9999.00",  "high_value_hesitation",          "cust_aban_24", false));
        all.add(make(CaseType.ABANDONED_CHECKOUT, "1099.00",  "dropped_at_otp_screen",          "cust_aban_25", true));


        // SCENARIO 4: OVERDUE INVOICES / B2B RECEIVABLES (25 cases)
        // Problem statement: "overdue receivables" — this was under-represented
        // Covers: short overdue, long overdue, disputed, unresponsive, partial pay


        // Short overdue (3–7 days) — high recovery chance, just need a nudge
        all.add(make(CaseType.OVERDUE_INVOICE, "5999.00",  "overdue_3_days",                    "cust_inv_01", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "12999.00", "overdue_5_days",                    "cust_inv_02", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "3200.00",  "overdue_7_days",                    "cust_inv_03", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "8750.00",  "overdue_3_days",                    "cust_inv_04", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "15500.00", "overdue_5_days",                    "cust_inv_05", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "6400.00",  "overdue_7_days",                    "cust_inv_06", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "2800.00",  "overdue_3_days",                    "cust_inv_07", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "9900.00",  "overdue_5_days",                    "cust_inv_08", true));

        // Medium overdue (14–21 days) — moderate recovery, needs firmer outreach
        all.add(make(CaseType.OVERDUE_INVOICE, "22000.00", "overdue_14_days",                   "cust_inv_09", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "7500.00",  "overdue_14_days",                   "cust_inv_10", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "45000.00", "overdue_21_days",                   "cust_inv_11", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "18000.00", "overdue_21_days",                   "cust_inv_12", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "33000.00", "overdue_14_days",                   "cust_inv_13", true));

        // Long overdue (30+ days) — harder to recover, may need escalation
        all.add(make(CaseType.OVERDUE_INVOICE, "75000.00", "overdue_30_days",                   "cust_inv_14", false));
        all.add(make(CaseType.OVERDUE_INVOICE, "28000.00", "overdue_30_days",                   "cust_inv_15", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "92000.00", "overdue_45_days",                   "cust_inv_16", false));
        all.add(make(CaseType.OVERDUE_INVOICE, "55000.00", "overdue_60_days",                   "cust_inv_17", false));

        // Disputed invoices — need human escalation
        all.add(make(CaseType.OVERDUE_INVOICE, "8500.00",  "disputed_invoice",                  "cust_inv_18", false));
        all.add(make(CaseType.OVERDUE_INVOICE, "31000.00", "disputed_invoice",                   "cust_inv_19", false));

        // Unresponsive customers — multiple contacts, no reply
        all.add(make(CaseType.OVERDUE_INVOICE, "4500.00",  "unresponsive_customer",              "cust_inv_20", false));
        all.add(make(CaseType.OVERDUE_INVOICE, "16800.00", "unresponsive_customer",              "cust_inv_21", false));

        // Partial payments — customer paid some, owes the rest
        all.add(make(CaseType.OVERDUE_INVOICE, "3200.00",  "partial_payment_pending",            "cust_inv_22", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "11400.00", "partial_payment_pending",            "cust_inv_23", true));
        all.add(make(CaseType.OVERDUE_INVOICE, "7600.00",  "partial_payment_pending",            "cust_inv_24", true));

        // Promise to pay — customer acknowledged but hasn't paid
        all.add(make(CaseType.OVERDUE_INVOICE, "19500.00", "promise_to_pay_broken",              "cust_inv_25", true));


        // SCENARIO 5: FAILED SUBSCRIPTIONS (15 cases)
        // Covers: mandate failures, renewal failures, multi-attempt sequences
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "299.00",  "mandate_expired",                "cust_sub_01", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "499.00",  "insufficient_funds",             "cust_sub_02", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "999.00",  "card_blocked",                   "cust_sub_03", false));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "199.00",  "charge_failed_attempt_2",        "cust_sub_04", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "599.00",  "charge_failed_attempt_3",        "cust_sub_05", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "1499.00", "charge_failed_attempt_4",        "cust_sub_06", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "799.00",  "bank_downtime",                  "cust_sub_07", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "399.00",  "card_expired",                   "cust_sub_08", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "899.00",  "mandate_revoked",                "cust_sub_09", false));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "249.00",  "insufficient_funds",             "cust_sub_10", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "1299.00", "authentication_failed",          "cust_sub_11", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "699.00",  "mandate_expired",                "cust_sub_12", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "349.00",  "charge_failed_attempt_2",        "cust_sub_13", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "2499.00", "card_expired",                   "cust_sub_14", true));
        all.add(make(CaseType.FAILED_SUBSCRIPTION, "149.00",  "insufficient_funds",             "cust_sub_15", true));

        // Save and audit
        List<RecoveryCase> saved = caseRepo.saveAll(all);

        for (RecoveryCase c : saved) {
            audit.log(c, Actor.SYSTEM, "CASE_DETECTED",
                    "Synthetic case [" + c.getType() + "]: " + c.getRiskReason()
                            + " | amount=₹" + c.getAmount()
                            + " | recoverable=" + c.getTrulyRecoverable(),
                    false, c.getAmount(), null, null);
        }

        // Log breakdown for judges
        long failedPayments   = saved.stream().filter(c -> c.getType() == CaseType.FAILED_PAYMENT).count();
        long abandonedCheckouts = saved.stream().filter(c -> c.getType() == CaseType.ABANDONED_CHECKOUT).count();
        long overdueInvoices  = saved.stream().filter(c -> c.getType() == CaseType.OVERDUE_INVOICE).count();
        long failedSubs       = saved.stream().filter(c -> c.getType() == CaseType.FAILED_SUBSCRIPTION).count();

        log.info("✅ Generated {} synthetic test cases:", saved.size());
        log.info("   • FAILED_PAYMENT:      {} cases (card + UPI)", failedPayments);
        log.info("   • ABANDONED_CHECKOUT:  {} cases", abandonedCheckouts);
        log.info("   • OVERDUE_INVOICE:     {} cases (B2B receivables)", overdueInvoices);
        log.info("   • FAILED_SUBSCRIPTION: {} cases", failedSubs);

        return saved;
    }

    private RecoveryCase make(CaseType type, String amount, String riskReason,
                              String customerId, boolean trulyRecoverable) {
        return make(type, amount, riskReason, customerId, trulyRecoverable, null, null);
    }

    private RecoveryCase make(CaseType type, String amount, String riskReason,
                              String customerId, boolean trulyRecoverable,
                              String customerEmail, String customerPhone) {
        RecoveryCase c = new RecoveryCase();
        c.setType(type);
        c.setMerchantId("merchant_eval");
        c.setCustomerId(customerId);
        c.setAmount(new BigDecimal(amount));
        c.setCurrency("INR");
        c.setStatus(CaseStatus.DETECTED);
        c.setRiskReason(riskReason);
        c.setTrulyRecoverable(trulyRecoverable);
        c.setAttemptCount(0);
        c.setCustomerEmail(customerEmail);
        c.setCustomerPhone(customerPhone);
        return c;
    }
}