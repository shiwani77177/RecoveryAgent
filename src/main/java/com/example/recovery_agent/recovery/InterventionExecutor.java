package com.example.recovery_agent.recovery;

import java.math.BigDecimal;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.agent.Diagnosis;
import com.example.recovery_agent.domain.enums.InterventionType;
import com.razorpay.PaymentLink;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;

@Service
public class InterventionExecutor {

    private static final Logger log = LoggerFactory.getLogger(InterventionExecutor.class);

    private final RazorpayClient razorpayClient;

    public InterventionExecutor(RazorpayClient razorpayClient) {
        this.razorpayClient = razorpayClient;
    }

    /**
     * Execute the recommended intervention.
     *
     * @param customerEmail  real email from webhook (nullable — falls back to simulation)
     * @param customerPhone  real phone from webhook (nullable — falls back to simulation)
     */
    public ExecutionResult execute(
            String caseId,
            BigDecimal amount,
            String currency,
            String customerId,
            String customerEmail,
            String customerPhone,
            Diagnosis diagnosis) {

        InterventionType action = diagnosis.recommendedAction();
        String channel = diagnosis.channel();

        log.info("Executing {} via {} for case [{}] — ₹{} | email={} phone={}",
                action, channel, caseId, amount, customerEmail, customerPhone);

        try {
            return switch (action) {
                case SMART_RETRY     -> executeSmartRetry(caseId, amount);
                case PAYMENT_LINK    -> executePaymentLink(caseId, amount, currency,
                                            customerId, customerEmail, customerPhone, channel);
                case UPI_FALLBACK    -> executeUpiFallback(caseId, amount, currency,
                                            customerId, customerEmail, customerPhone);
                case WHATSAPP_LINK   -> executeWhatsAppLink(caseId, amount, currency,
                                            customerId, customerPhone);
                case DUNNING_MESSAGE -> executeDunningMessage(caseId, amount,
                                            customerId, customerEmail, customerPhone, channel);
                case ALT_METHOD      -> executeAltMethod(caseId, amount,
                                            customerId, customerEmail, channel);
                case ESCALATE        -> ExecutionResult.skipped("ESCALATE — no execution needed");
                case ABANDON         -> ExecutionResult.skipped("ABANDON — no execution needed");
            };
        } catch (Exception e) {
            log.error("Execution failed for case [{}]: {}", caseId, e.getMessage());
            return ExecutionResult.failure("Execution error: " + e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RAIL 1: SMART_RETRY — retry same payment method
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executeSmartRetry(String caseId, BigDecimal amount) {
        log.info("⚡ RAIL 1 — SMART_RETRY for case [{}]", caseId);
        boolean success = Math.random() < 0.65;
        if (success) {
            return ExecutionResult.success(
                    "Rail 1 (SMART_RETRY) succeeded — ₹" + amount + " recovered. "
                    + "(Simulated — production calls Razorpay Payment Retry API)");
        }
        return ExecutionResult.failure(
                "Rail 1 (SMART_RETRY) failed — bank still declining. "
                + "Escalating to Rail 2 on next attempt.");
    }

    // ═══════════════════════════════════════════════════════════════
    // RAIL 2: PAYMENT_LINK — send payment link via email
    // Uses REAL Razorpay Payment Link API + REAL customer email
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executePaymentLink(
            String caseId, BigDecimal amount, String currency,
            String customerId, String customerEmail, String customerPhone,
            String channel) {

        log.info("📧 RAIL 2 — PAYMENT_LINK for case [{}]", caseId);

        try {
            int amountPaise = amount.multiply(BigDecimal.valueOf(100)).intValue();

            JSONObject linkRequest = new JSONObject();
            linkRequest.put("amount", amountPaise);
            linkRequest.put("currency", currency != null ? currency : "INR");
            linkRequest.put("description", "Recovery payment for case " + caseId.substring(0, 8));
            linkRequest.put("reference_id", "recovery_" + caseId.substring(0, 8));
            linkRequest.put("expire_by", System.currentTimeMillis() / 1000 + 86400);

            // ── Use REAL customer info if available ──
            JSONObject customer = new JSONObject();
            customer.put("name", customerId != null ? customerId : "Customer");
            if (customerEmail != null && !customerEmail.isBlank()) {
                customer.put("email", customerEmail);
            }
            if (customerPhone != null && !customerPhone.isBlank()) {
                customer.put("contact", customerPhone);
            }
            linkRequest.put("customer", customer);

            // ── Notify on real channels ──
            JSONObject notify = new JSONObject();
            boolean hasEmail = customerEmail != null && !customerEmail.isBlank();
            boolean hasSms   = customerPhone != null && !customerPhone.isBlank();
            notify.put("email", hasEmail);
            notify.put("sms", hasSms && !hasEmail); // SMS only if no email
            linkRequest.put("notify", notify);

            PaymentLink paymentLink = razorpayClient.paymentLink.create(linkRequest);
            String linkId  = paymentLink.get("id");
            String linkUrl = paymentLink.get("short_url");

            String deliveredTo = hasEmail ? customerEmail : (hasSms ? customerPhone : "N/A");

            log.info("✅ Payment link created: {} → {} → delivered to {}", linkId, linkUrl, deliveredTo);
            return ExecutionResult.success(
                    "Rail 2 (PAYMENT_LINK) — link created ID: " + linkId
                    + " | URL: " + linkUrl
                    + " | Amount: ₹" + amount
                    + " | Delivered to: " + deliveredTo
                    + " | Expires in 24h");

        } catch (RazorpayException e) {
            log.warn("Razorpay API error — simulating: {}", e.getMessage());
            boolean success = Math.random() < 0.70;
            String target = customerEmail != null ? customerEmail : customerId;
            if (success) {
                return ExecutionResult.success(
                        "Rail 2 (PAYMENT_LINK) sent to " + target
                        + " for ₹" + amount
                        + " (simulated — Razorpay: " + e.getMessage() + ")");
            }
            return ExecutionResult.failure(
                    "Rail 2 (PAYMENT_LINK) failed — escalating to Rail 3.");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RAIL 3: UPI_FALLBACK — switch from card to UPI via SMS
    // Uses REAL Razorpay UPI link + REAL customer phone
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executeUpiFallback(
            String caseId, BigDecimal amount, String currency,
            String customerId, String customerEmail, String customerPhone) {

        log.info("📱 RAIL 3 — UPI_FALLBACK for case [{}]", caseId);

        try {
            int amountPaise = amount.multiply(BigDecimal.valueOf(100)).intValue();

            JSONObject linkRequest = new JSONObject();
            linkRequest.put("amount", amountPaise);
            linkRequest.put("currency", currency != null ? currency : "INR");
            linkRequest.put("description", "UPI recovery for case " + caseId.substring(0, 8));
            linkRequest.put("reference_id", "upi_" + caseId.substring(0, 8));
            linkRequest.put("upi_link", true);
            linkRequest.put("expire_by", System.currentTimeMillis() / 1000 + 86400);

            // ── Use REAL customer contact ──
            JSONObject customer = new JSONObject();
            customer.put("name", customerId != null ? customerId : "Customer");
            if (customerEmail != null && !customerEmail.isBlank()) {
                customer.put("email", customerEmail);
            }
            if (customerPhone != null && !customerPhone.isBlank()) {
                customer.put("contact", customerPhone);
            }
            linkRequest.put("customer", customer);

            // UPI links work best via SMS
            JSONObject notify = new JSONObject();
            boolean hasSms = customerPhone != null && !customerPhone.isBlank();
            notify.put("sms", hasSms);
            notify.put("email", !hasSms && customerEmail != null);
            linkRequest.put("notify", notify);

            PaymentLink paymentLink = razorpayClient.paymentLink.create(linkRequest);
            String linkId  = paymentLink.get("id");
            String linkUrl = paymentLink.get("short_url");

            String deliveredTo = hasSms ? customerPhone
                    : (customerEmail != null ? customerEmail : "N/A");

            log.info("✅ UPI link: {} → {} → delivered to {}", linkId, linkUrl, deliveredTo);
            return ExecutionResult.success(
                    "Rail 3 (UPI_FALLBACK) — UPI link ID: " + linkId
                    + " | URL: " + linkUrl
                    + " | Amount: ₹" + amount
                    + " | Delivered to: " + deliveredTo
                    + " | Rail switch: card → UPI | Expires in 24h");

        } catch (RazorpayException e) {
            log.warn("Razorpay UPI error — simulating: {}", e.getMessage());
            boolean success = Math.random() < 0.60;
            String target = customerPhone != null ? customerPhone : customerId;
            if (success) {
                return ExecutionResult.success(
                        "Rail 3 (UPI_FALLBACK) — UPI link sent to " + target
                        + " for ₹" + amount
                        + " (simulated — Razorpay: " + e.getMessage() + ")");
            }
            return ExecutionResult.failure(
                    "Rail 3 (UPI_FALLBACK) — no payment. Escalating to Rail 4.");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RAIL 4: WHATSAPP_LINK — last resort, highest open rate (~98%)
    // Uses customer phone for WhatsApp delivery
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executeWhatsAppLink(
            String caseId, BigDecimal amount, String currency,
            String customerId, String customerPhone) {

        log.info("💬 RAIL 4 — WHATSAPP_LINK for case [{}]", caseId);

        String target = customerPhone != null ? customerPhone : customerId;

        String message = "Hi! 🙏 Your payment of ₹" + amount
                + " couldn't go through. Tap to pay → "
                + "https://rzp.io/recovery/" + caseId.substring(0, 8)
                + " (expires in 24h)";

        log.info("WhatsApp → {}: {}", target, message);

        // In production: WhatsApp Business API or Twilio WhatsApp
        // For hackathon: simulated with realistic success rates
        boolean success = Math.random() < 0.55;

        if (success) {
            return ExecutionResult.success(
                    "Rail 4 (WHATSAPP_LINK) — delivered to " + target
                    + " | Amount: ₹" + amount
                    + " | Rail chain: RETRY → EMAIL → UPI → WhatsApp ✅"
                    + " | Customer opened and paid"
                    + " (simulated — production uses WhatsApp Business API)");
        }
        return ExecutionResult.failure(
                "Rail 4 (WHATSAPP_LINK) — sent to " + target
                + " but not yet opened. All 4 rails exhausted."
                + " (simulated — production uses WhatsApp Business API)");
    }

    // ═══════════════════════════════════════════════════════════════
    // DUNNING_MESSAGE
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executeDunningMessage(
            String caseId, BigDecimal amount, String customerId,
            String customerEmail, String customerPhone, String channel) {

        String target;
        if ("EMAIL".equalsIgnoreCase(channel) && customerEmail != null) {
            target = customerEmail;
        } else if (customerPhone != null) {
            target = customerPhone;
        } else {
            target = customerId;
        }

        log.info("DUNNING_MESSAGE for case [{}] via {} to {}", caseId, channel, target);

        boolean customerPaid = Math.random() < 0.50;
        if (customerPaid) {
            return ExecutionResult.success(
                    "Dunning sent via " + channel + " to " + target
                    + ". Customer paid ₹" + amount
                    + " (simulated — production uses Razorpay notification API)");
        }
        return ExecutionResult.failure(
                "Dunning sent via " + channel + " to " + target
                + " — no response yet"
                + " (simulated — production uses Razorpay notification API)");
    }

    // ═══════════════════════════════════════════════════════════════
    // ALT_METHOD
    // ═══════════════════════════════════════════════════════════════
    private ExecutionResult executeAltMethod(
            String caseId, BigDecimal amount, String customerId,
            String customerEmail, String channel) {

        String target = customerEmail != null ? customerEmail : customerId;

        log.info("ALT_METHOD for case [{}] via {} to {}", caseId, channel, target);

        boolean customerPaid = Math.random() < 0.45;
        if (customerPaid) {
            return ExecutionResult.success(
                    "Alt method suggestion sent via " + channel + " to " + target
                    + ". Customer paid ₹" + amount + " via alt method"
                    + " (simulated — production creates payment link with method filter)");
        }
        return ExecutionResult.failure(
                "Alt method suggestion sent via " + channel + " to " + target
                + " — no response yet"
                + " (simulated — production creates payment link with method filter)");
    }

    // ═══════════════════════════════════════════════════════════════
    // Result
    // ═══════════════════════════════════════════════════════════════
    public record ExecutionResult(
            boolean success,
            boolean skipped,
            String detail
    ) {
        public static ExecutionResult success(String detail) {
            return new ExecutionResult(true, false, detail);
        }
        public static ExecutionResult failure(String detail) {
            return new ExecutionResult(false, false, detail);
        }
        public static ExecutionResult skipped(String detail) {
            return new ExecutionResult(false, true, detail);
        }
    }
}

