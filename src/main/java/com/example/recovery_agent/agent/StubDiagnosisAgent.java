package com.example.recovery_agent.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.InterventionType;

public class StubDiagnosisAgent implements DiagnosisAgent {

    private static final Logger log = LoggerFactory.getLogger(StubDiagnosisAgent.class);

    @Override
    public Diagnosis diagnose(RecoveryCase recoveryCase) {
        String errorCode = recoveryCase.getRiskReason();
        log.info("STUB agent diagnosing case [{}] — error: {}", recoveryCase.getId(), errorCode);

        // Return a hardcoded diagnosis
        return switch (errorCode != null ? errorCode : "unknown") {

            // Soft failures:retrying 

            case "insufficient_funds" -> new Diagnosis(
                    "Customer had insufficient funds at time of payment.",
                    InterventionType.DUNNING_MESSAGE,
                    "SMS",
                    0.75,
                    "Insufficient funds is usually temporary. Sending a reminder "
                            + "SMS to prompt the customer to retry when funds are available."
            );

            case "card_expired" -> new Diagnosis(
                    "Customer's card has expired and needs to be updated.",
                    InterventionType.PAYMENT_LINK,
                    "EMAIL",
                    0.85,
                    "Card expiry requires the customer to enter new card details. "
                            + "Sending a payment link via email so they can pay with a new card."
            );

            case "bank_downtime", "gateway_technical_error", "bank_technical_error" -> new Diagnosis(
                    "Payment failed due to temporary bank/gateway issue.",
                    InterventionType.SMART_RETRY,
                    null,
                    0.90,
                    "Bank downtime is transient. The same payment should succeed "
                            + "when retried after a short delay. No customer action needed."
            );

            case "authentication_failed", "payment_timed_out" -> new Diagnosis(
                    "Customer failed 3DS authentication or payment timed out.",
                    InterventionType.SMART_RETRY,
                    "SMS",
                    0.70,
                    "Authentication failure or timeout is usually a one-time issue. "
                            + "Retrying with an SMS reminder to complete OTP promptly."
            );

            case "incorrect_cvv", "card_not_enrolled",
                 "card_disabled_for_online_payments" -> new Diagnosis(
                    "Customer's card has a configuration issue.",
                    InterventionType.PAYMENT_LINK,
                    "WHATSAPP",
                    0.80,
                    "Card configuration issues require the customer to use a different "
                            + "card or enable online payments. Sending a payment link via WhatsApp."
            );

            case "transaction_limit_exceeded", "upi_limit_exceeded" -> new Diagnosis(
                    "Payment amount exceeds the customer's transaction limit.",
                    InterventionType.ALT_METHOD,
                    "SMS",
                    0.75,
                    "Transaction limit exceeded. Suggesting an alternative payment "
                            + "method (UPI/netbanking/different card) that may have a higher limit."
            );

            case "subscription_charge_failed" -> new Diagnosis(
                    "Recurring subscription charge failed.",
                    InterventionType.PAYMENT_LINK,
                    "EMAIL",
                    0.80,
                    "Subscription charge failed — likely card expired or mandate issue. "
                            + "Sending a payment link to update payment method and resume subscription."
            );

            // Hard failures:don't waste attempts

            case "payment_risk_check_failed" -> new Diagnosis(
                    "Payment was declined by bank's risk/fraud check.",
                    InterventionType.ESCALATE,
                    null,
                    0.95,
                    "Risk check failure indicates potential fraud flagging by the bank. "
                            + "This should NOT be retried — escalating to human review."
            );

            case "debit_instrument_blocked", "lost_or_stolen_card",
                 "fraud_decline" -> new Diagnosis(
                    "Payment instrument is permanently blocked or flagged.",
                    InterventionType.ESCALATE,
                    null,
                    0.95,
                    "Card is blocked, lost, stolen, or fraud-flagged. Retrying would "
                            + "waste attempts and potentially trigger security alerts. Escalating."
            );

            // ── Unknown: try once with low confidence ──

            default -> new Diagnosis(
                    "Unknown failure reason: " + errorCode,
                    InterventionType.SMART_RETRY,
                    null,
                    0.50,
                    "Unrecognized error code '" + errorCode + "'. Attempting one smart "
                            + "retry with low confidence. Will escalate if this doesn't resolve."
            );
        };
    }
}


