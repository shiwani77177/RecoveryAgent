package com.example.recovery_agent.webhook;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.audit.AuditService;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.domain.enums.CaseStatus;
import com.example.recovery_agent.domain.enums.CaseType;
import com.example.recovery_agent.repository.RecoveryCaseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final String HMAC_SHA256 = "HmacSHA256";

    private final String razorpaySecret;
    private final RecoveryCaseRepository caseRepo;
    private final AuditService audit;
    private final ObjectMapper mapper = new ObjectMapper();

    public WebhookService(
            @Qualifier("razorpayWebhookSecret") String razorpaySecret,
            RecoveryCaseRepository caseRepo,
            AuditService audit) {
        this.razorpaySecret = razorpaySecret;
        this.caseRepo = caseRepo;
        this.audit = audit;
    }

    public boolean handle(String rawBody, String razorpaySignature) {
        if (razorpaySignature == null || !isSignatureValid(rawBody, razorpaySignature)) {
            log.warn("Webhook signature validation FAILED — dropping request.");
            return false;
        }
        return processPayload(rawBody);
    }

    public boolean handleWithoutSignatureCheck(String rawBody) {
        log.warn("Processing webhook WITHOUT signature check — test mode only!");
        return processPayload(rawBody);
    }

    private boolean isSignatureValid(String rawBody, String receivedSignature) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec keySpec = new SecretKeySpec(
                    razorpaySecret.getBytes(StandardCharsets.UTF_8),
                    HMAC_SHA256);
            mac.init(keySpec);

            byte[] hash = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String computedSignature = HexFormat.of().formatHex(hash);
            boolean valid = computedSignature.equals(receivedSignature);

            if (valid) {
                log.debug("Signature verification PASSED — webhook is genuine");
            } else {
                log.warn("Signature mismatch: computed={}, received={}",
                        computedSignature.substring(0, 10) + "...",
                        receivedSignature.substring(0, 10) + "...");
            }
            return valid;

        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("Signature computation failed", e);
            return false;
        }
    }

    private boolean processPayload(String rawBody) {
        try {
            JsonNode root = mapper.readTree(rawBody);
            String event = root.path("event").asText("unknown");

            log.info("Processing Razorpay event: {}", event);

            switch (event) {
                case "payment.failed"       -> handlePaymentFailed(root);
                case "subscription.pending" -> handleSubscriptionFailed(root);
                default -> {
                    log.debug("Event '{}' not relevant — ignoring", event);
                    return true;
                }
            }
            return true;

        } catch (Exception e) {
            log.error("Error processing webhook payload", e);
            return false;
        }
    }

    private void handlePaymentFailed(JsonNode root) {
        JsonNode payment = root.path("payload").path("payment").path("entity");

        String paymentId  = payment.path("id").asText("unknown");
        String merchantId = payment.path("merchant_id").asText("unknown");
        String errorCode  = payment.path("error_code").asText("payment_failed");
        String errorDesc  = payment.path("error_description").asText("Payment failed");
        String currency   = payment.path("currency").asText("INR");

        // ── Extract customer contact info from webhook payload ──
        String customerEmail = payment.path("email").asText(null);
        String customerPhone = payment.path("contact").asText(null);

        // Customer ID: try customer_id first, fall back to email or phone
        String customerId = payment.path("customer_id").asText("");
        if (customerId.isEmpty()) {
            customerId = customerEmail != null ? customerEmail
                    : (customerPhone != null ? customerPhone : "unknown_customer");
        }

        long amountPaise = payment.path("amount").asLong(0);
        BigDecimal amount = BigDecimal.valueOf(amountPaise)
                .divide(BigDecimal.valueOf(100));

        RecoveryCase recoveryCase = new RecoveryCase();
        recoveryCase.setType(CaseType.FAILED_PAYMENT);
        recoveryCase.setMerchantId(merchantId);
        recoveryCase.setCustomerId(customerId);
        recoveryCase.setAmount(amount);
        recoveryCase.setCurrency(currency);
        recoveryCase.setStatus(CaseStatus.DETECTED);
        recoveryCase.setRiskReason(errorCode);
        recoveryCase.setTrulyRecoverable(isSoftFailure(errorCode));

        // ── NEW: Save real customer contact info ──
        recoveryCase.setCustomerEmail(customerEmail);
        recoveryCase.setCustomerPhone(customerPhone);

        RecoveryCase saved = caseRepo.save(recoveryCase);

        log.info("✅ Case [{}] created — payment={} ₹{} email={} phone={} error={}",
                saved.getId(), paymentId, amount, customerEmail, customerPhone, errorCode);

        audit.log(saved, Actor.SYSTEM, "CASE_DETECTED",
                "payment.failed for " + paymentId
                        + " | error: " + errorCode
                        + " | reason: " + errorDesc
                        + " | email: " + (customerEmail != null ? customerEmail : "N/A")
                        + " | phone: " + (customerPhone != null ? customerPhone : "N/A"),
                false, amount, root.toString(), null);
    }

    private void handleSubscriptionFailed(JsonNode root) {
        JsonNode subscription = root.path("payload").path("subscription").path("entity");
        JsonNode payment = root.path("payload").path("payment").path("entity");

        String subscriptionId = subscription.path("id").asText("unknown");
        String merchantId     = subscription.path("merchant_id").asText("unknown");
        String customerId     = subscription.path("customer_id").asText("unknown");

        // ── Extract customer contact for subscriptions too ──
        String customerEmail = payment.path("email").asText(
                subscription.path("email").asText(null));
        String customerPhone = payment.path("contact").asText(
                subscription.path("contact").asText(null));

        long amountPaise = payment.path("amount").asLong(0);
        BigDecimal amount = BigDecimal.valueOf(amountPaise)
                .divide(BigDecimal.valueOf(100));

        String errorCode = payment.path("error_code").asText("subscription_charge_failed");

        RecoveryCase recoveryCase = new RecoveryCase();
        recoveryCase.setType(CaseType.FAILED_SUBSCRIPTION);
        recoveryCase.setMerchantId(merchantId);
        recoveryCase.setCustomerId(customerId);
        recoveryCase.setAmount(amount);
        recoveryCase.setCurrency("INR");
        recoveryCase.setStatus(CaseStatus.DETECTED);
        recoveryCase.setRiskReason(errorCode);
        recoveryCase.setTrulyRecoverable(true);
        recoveryCase.setCustomerEmail(customerEmail);
        recoveryCase.setCustomerPhone(customerPhone);

        RecoveryCase saved = caseRepo.save(recoveryCase);

        log.info("✅ Case [{}] created — subscription={} ₹{} email={} phone={} error={}",
                saved.getId(), subscriptionId, amount, customerEmail, customerPhone, errorCode);

        audit.log(saved, Actor.SYSTEM, "CASE_DETECTED",
                "subscription.pending for " + subscriptionId
                        + " | error: " + errorCode
                        + " | email: " + (customerEmail != null ? customerEmail : "N/A")
                        + " | phone: " + (customerPhone != null ? customerPhone : "N/A"),
                false, amount, root.toString(), null);
    }

    private boolean isSoftFailure(String errorCode) {
        return switch (errorCode) {
            case "payment_risk_check_failed",
                 "debit_instrument_blocked",
                 "fraud_decline",
                 "lost_or_stolen_card"          -> false;
            default                             -> true;
        };
    }
}

