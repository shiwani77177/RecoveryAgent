package com.example.recovery_agent.agent;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.InterventionType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class GeminiDiagnosisAgent implements DiagnosisAgent {

    private static final Logger log = LoggerFactory.getLogger(GeminiDiagnosisAgent.class);
    private static final String GEMINI_MODEL = "gemini-3.6-flash";
    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/"
                    + GEMINI_MODEL + ":generateContent";

    private static final String SYSTEM_INSTRUCTION =
        "You are a payment recovery classifier for a fintech revenue recovery system. " +
        "You receive failed revenue data and output a JSON decision. " +
        "You ONLY output raw JSON. No markdown, no prose, no explanation. " +
        "Your entire response must be a single JSON object starting with { and ending with }. " +
        "Valid recommendedAction values: SMART_RETRY, PAYMENT_LINK, UPI_FALLBACK, WHATSAPP_LINK, ALT_METHOD, DUNNING_MESSAGE, ESCALATE, ABANDON. " +
        "Valid channel values: SMS, WHATSAPP, EMAIL, null. " +

        "CASE TYPE RULES: " +

        "FAILED_PAYMENT (card/UPI payment failure): " +
        "  attempt 1: SMART_RETRY for temp failures, PAYMENT_LINK for card issues. " +
        "  attempt 2: PAYMENT_LINK channel EMAIL. " +
        "  attempt 3: UPI_FALLBACK channel SMS (switch payment rail). " +
        "  attempt 4: WHATSAPP_LINK channel WHATSAPP (last resort, 98% open rate). " +

        "ABANDONED_CHECKOUT (customer left before paying): " +
        "  attempt 1: DUNNING_MESSAGE channel SMS (gentle nudge with cart reminder). " +
        "  attempt 2: PAYMENT_LINK channel EMAIL (direct link to complete purchase). " +
        "  attempt 3: WHATSAPP_LINK channel WHATSAPP (high urgency recovery). " +
        "  high_value_hesitation (amount > 5000): DUNNING_MESSAGE first, then PAYMENT_LINK. " +

        "FAILED_SUBSCRIPTION (recurring charge failed): " +
        "  mandate_expired or card_expired -> PAYMENT_LINK channel EMAIL (update payment method). " +
        "  insufficient_funds -> DUNNING_MESSAGE then PAYMENT_LINK. " +
        "  charge_failed_attempt_1 -> SMART_RETRY. " +
        "  charge_failed_attempt_2+ -> PAYMENT_LINK then UPI_FALLBACK. " +
        "  mandate_revoked or subscription_cancelled -> ESCALATE. " +

        "OVERDUE_INVOICE (B2B invoice not paid): " +
        "  forgot_3_days -> DUNNING_MESSAGE channel EMAIL (polite reminder). " +
        "  forgot_7_days -> PAYMENT_LINK channel EMAIL (include payment link). " +
        "  forgot_14_days -> WHATSAPP_LINK channel WHATSAPP (escalate urgency). " +
        "  partial_payment -> DUNNING_MESSAGE channel EMAIL (request balance). " +
        "  disputed -> ESCALATE (human review required). " +
        "  unresponsive -> ESCALATE after 2 attempts. " +

        "GLOBAL RULES (override all above): " +
        "payment_risk_check_failed or fraud_decline or debit_instrument_blocked -> ESCALATE confidence 0.95. " +
        "card_blocked or subscription_cancelled -> ESCALATE confidence 0.90.";

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final int MAX_RETRIES = 3;
    private static final long INITIAL_BACKOFF_MS = 1000; // 1 second

    // ── THIS IS THE KEY LINE — must be ObjectMapper, nothing else ──
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    // Cache: "errorCode|attempt" -> Diagnosis (avoids redundant LLM calls)
    private final ConcurrentHashMap<String, Diagnosis> diagnosisCache = new ConcurrentHashMap<>();

    // Tracks whether Gemini hit its daily quota recently. Used to warn the
    // user that eval results reflect rule-based fallback, not full AI.
    private volatile long lastQuotaExhaustedAt = 0L;

    /** Returns true if Gemini was quota-limited (429) in the last 5 minutes. */
    public boolean isQuotaRecentlyExhausted() {
        return lastQuotaExhaustedAt > 0
                && (System.currentTimeMillis() - lastQuotaExhaustedAt) < 5 * 60 * 1000L;
    }

    private void markQuotaExhausted() {
        this.lastQuotaExhaustedAt = System.currentTimeMillis();
    }

    @Override
    public Diagnosis diagnose(RecoveryCase c) {
        log.info("GEMINI diagnosing [{}] error={} attempt={}",
                c.getId(), c.getRiskReason(), c.getAttemptCount() + 1);

        // Check cache first — same error+attempt = same diagnosis
        String cacheKey = (c.getRiskReason() != null ? c.getRiskReason() : "unknown")
                + "|" + (c.getAttemptCount() + 1) + "|" + c.getType();
        Diagnosis cached = diagnosisCache.get(cacheKey);
        if (cached != null) {
            log.info("Cache HIT for [{}] key={}", c.getId(), cacheKey);
            return cached;
        }

        if (geminiApiKey == null || geminiApiKey.isBlank()
                || geminiApiKey.equals("your-gemini-key-here")) {
            log.warn("Gemini key not set — using rule fallback");
            Diagnosis fallback = ruleFallback(c, "Gemini key not configured");
            diagnosisCache.put(cacheKey, fallback);
            return fallback;
        }

        // CIRCUIT BREAKER: if we've confirmed the daily quota is exhausted,
        // skip Gemini entirely and go straight to rules. This avoids wasting
        // ~7 seconds per case on retries that we know will fail. The breaker
        // auto-resets after 5 minutes (see isQuotaRecentlyExhausted), so when
        // quota comes back tomorrow, AI diagnosis resumes automatically.
        if (isQuotaRecentlyExhausted()) {
            log.info("Quota circuit-breaker OPEN — skipping Gemini for [{}], using rules", c.getId());
            Diagnosis fallback = ruleFallback(c, "Daily AI quota exhausted");
            diagnosisCache.put(cacheKey, fallback);
            return fallback;
        }

        try {
            String userMessage = "error_code=" + (c.getRiskReason() != null ? c.getRiskReason() : "unknown")
                    + " amount=" + c.getAmount()
                    + " attempt=" + (c.getAttemptCount() + 1)
                    + " type=" + c.getType();

            String raw = callGemini(userMessage);
            log.info("=== GEMINI RAW RESPONSE ===\n{}\n=== END ===", raw);
            Diagnosis result = parse(raw, c);
            diagnosisCache.put(cacheKey, result);
            return result;

        } catch (Exception e) {
            log.error("Gemini call failed [{}]: {} — rule fallback", c.getId(), e.getMessage());
            Diagnosis fallback = ruleFallback(c, "API error: " + e.getMessage());
            diagnosisCache.put(cacheKey, fallback);
            return fallback;
        }
    }

    private String callGemini(String userMessage) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();

        body.put("systemInstruction", Map.of(
                "parts", List.of(Map.of("text", SYSTEM_INSTRUCTION))
        ));
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userMessage))
        )));
        body.put("generationConfig", Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 250
        ));

        // mapper is ObjectMapper — writeValueAsString works fine
        String jsonBody = mapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", geminiApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = null;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                break;
            }

            if (response.statusCode() == 429) {
                // Distinguish "daily quota exhausted" from a transient rate blip.
                // The daily-quota error body mentions the per-day free-tier metric.
                String errBody = response.body() != null ? response.body() : "";
                boolean dailyQuotaGone = errBody.contains("PerDay")
                        || errBody.contains("generate_content_free_tier_requests");

                if (dailyQuotaGone) {
                    // No point retrying — quota won't come back for hours.
                    // Trip the breaker so subsequent cases skip Gemini entirely.
                    log.warn("Gemini DAILY quota exhausted — tripping circuit breaker, using rules");
                    markQuotaExhausted();
                    throw new RuntimeException("Gemini daily quota exhausted");
                }

                if (attempt < MAX_RETRIES) {
                    // Transient rate limit — retry with backoff
                    long sleepMs = INITIAL_BACKOFF_MS * (1L << attempt); // 1s, 2s, 4s
                    log.warn("Gemini 429 (transient) — retrying in {}ms (attempt {}/{})",
                            sleepMs, attempt + 1, MAX_RETRIES);
                    Thread.sleep(sleepMs);
                    continue;
                }
            }

            log.error("Gemini HTTP {}: {}", response.statusCode(), response.body());
            throw new RuntimeException("Gemini HTTP " + response.statusCode());
        }

        if (response == null || response.statusCode() != 200) {
            throw new RuntimeException("Gemini failed after " + MAX_RETRIES + " retries");
        }

        // mapper.readTree parses the JSON response
        JsonNode root = mapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");

        if (candidates.isArray() && !candidates.isEmpty()) {
            String finishReason = candidates.get(0).path("finishReason").asText("");
            if ("SAFETY".equals(finishReason)) {
                throw new RuntimeException("Blocked by Gemini safety filter");
            }
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                String text = parts.get(0).path("text").asText("").trim();
                if (!text.isBlank()) return text;
            }
        }

        throw new RuntimeException("Empty Gemini response: " + response.body());
    }

    private Diagnosis parse(String raw, RecoveryCase c) {
        try {
            String json = extractJson(raw);
            if (json == null) {
                log.warn("No JSON found in response for [{}]: '{}'", c.getId(), raw);
                return ruleFallback(c, "No JSON in AI response");
            }

            // mapper.readTree parses the extracted JSON string
            JsonNode node = mapper.readTree(json);

            String rootCause  = node.path("rootCause").asText("Unknown cause");
            String actionStr  = node.path("recommendedAction").asText("ESCALATE");
            String channelRaw = node.path("channel").asText(null);
            double confidence = node.path("confidence").asDouble(0.5);
            String rationale  = node.path("rationale").asText("No rationale.");

            String channel = null;
            if (channelRaw != null && !channelRaw.isBlank()
                    && !"null".equalsIgnoreCase(channelRaw.trim())) {
                channel = channelRaw.trim();
            }

            InterventionType action;
            try {
                action = InterventionType.valueOf(actionStr.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown action '{}' — rule fallback", actionStr);
                return ruleFallback(c, "Unknown action from AI: " + actionStr);
            }

            confidence = Math.max(0.0, Math.min(1.0, confidence));
            log.info("Diagnosis OK: action={} confidence={} channel={}", action, confidence, channel);
            return new Diagnosis(rootCause, action, channel, confidence, rationale);

        } catch (Exception e) {
            log.error("Parse failed [{}]: {}", c.getId(), e.getMessage());
            return ruleFallback(c, "Parse error: " + e.getMessage());
        }
    }

    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim()
                .replaceAll("(?s)^```(?:json)?\\s*", "")
                .replaceAll("(?s)\\s*```\\s*$", "")
                .trim();
        if (s.startsWith("{")) return s;
        int start = raw.indexOf('{');
        int end   = raw.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) {
            return raw.substring(start, end + 1);
        }
        return null;
    }

    private Diagnosis ruleFallback(RecoveryCase c, String note) {
        log.warn("Rule fallback for [{}] error={}: {}", c.getId(), c.getRiskReason(), note);
        String err = c.getRiskReason() != null ? c.getRiskReason() : "unknown";
        int attempt = c.getAttemptCount();

        // Hard failures — never retry, always escalate
        if ("payment_risk_check_failed".equals(err)
                || "debit_instrument_blocked".equals(err)
                || "fraud_decline".equals(err)) {
            return new Diagnosis(
                    "Risk or fraud flag — do not retry.",
                    InterventionType.ESCALATE, null, 0.95,
                    "(Rule fallback) " + note);
        }

        // Card issues — go straight to payment link, then UPI, then WhatsApp
        if ("card_expired".equals(err) || "incorrect_cvv".equals(err)
                || "card_disabled_for_online_payments".equals(err)
                || "card_not_enrolled".equals(err)) {
            return switch (attempt) {
                case 0 -> new Diagnosis(
                        "Card issue — sending payment link.",
                        InterventionType.PAYMENT_LINK, "EMAIL", 0.85,
                        "(Rule fallback) Rail 2 — card issue, skip retry | " + note);
                case 1 -> new Diagnosis(
                        "Card issue — switching to UPI.",
                        InterventionType.UPI_FALLBACK, "SMS", 0.80,
                        "(Rule fallback) Rail 3 — UPI fallback | " + note);
                default -> new Diagnosis(
                        "Card issue — last resort WhatsApp.",
                        InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.75,
                        "(Rule fallback) Rail 4 — WhatsApp last resort | " + note);
            };
        }

        // Temporary failures (bank down, timeout) — smart retry first
        if ("bank_downtime".equals(err) || "bank_technical_error".equals(err)
                || "gateway_technical_error".equals(err) || "upi_provider_downtime".equals(err)
                || "upi_partner_bank_technical".equals(err) || "payment_timed_out".equals(err)) {
            return switch (attempt) {
                case 0 -> new Diagnosis(
                        "Temporary outage — smart retry.",
                        InterventionType.SMART_RETRY, null, 0.90,
                        "(Rule fallback) Rail 1 — temp failure | " + note);
                case 1 -> new Diagnosis(
                        "Still failing — sending payment link.",
                        InterventionType.PAYMENT_LINK, "EMAIL", 0.80,
                        "(Rule fallback) Rail 2 — retry failed, email link | " + note);
                case 2 -> new Diagnosis(
                        "Switching to UPI rail.",
                        InterventionType.UPI_FALLBACK, "SMS", 0.75,
                        "(Rule fallback) Rail 3 — UPI fallback | " + note);
                default -> new Diagnosis(
                        "Last resort — WhatsApp link.",
                        InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.70,
                        "(Rule fallback) Rail 4 — WhatsApp last resort | " + note);
            };
        }

        // Insufficient funds — dunning first, then escalate through rails
        if ("insufficient_funds".equals(err)) {
            return switch (attempt) {
                case 0 -> new Diagnosis(
                        "Insufficient funds — sending reminder.",
                        InterventionType.DUNNING_MESSAGE, "SMS", 0.78,
                        "(Rule fallback) Dunning first | " + note);
                case 1 -> new Diagnosis(
                        "Still insufficient — sending payment link.",
                        InterventionType.PAYMENT_LINK, "EMAIL", 0.75,
                        "(Rule fallback) Rail 2 — payment link | " + note);
                case 2 -> new Diagnosis(
                        "Switching to UPI.",
                        InterventionType.UPI_FALLBACK, "SMS", 0.72,
                        "(Rule fallback) Rail 3 — UPI fallback | " + note);
                default -> new Diagnosis(
                        "Last resort — WhatsApp.",
                        InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.70,
                        "(Rule fallback) Rail 4 — WhatsApp last resort | " + note);
            };
        }

        // Auth failures — retry once, then link-based recovery
        if ("authentication_failed".equals(err) || "upi_payment_cancelled".equals(err)) {
            return switch (attempt) {
                case 0 -> new Diagnosis(
                        "Auth failure — retrying.",
                        InterventionType.SMART_RETRY, "SMS", 0.70,
                        "(Rule fallback) Rail 1 — auth retry | " + note);
                case 1 -> new Diagnosis(
                        "Auth still failing — payment link.",
                        InterventionType.PAYMENT_LINK, "EMAIL", 0.72,
                        "(Rule fallback) Rail 2 — payment link | " + note);
                default -> new Diagnosis(
                        "Switching to UPI.",
                        InterventionType.UPI_FALLBACK, "SMS", 0.68,
                        "(Rule fallback) Rail 3 — UPI fallback | " + note);
            };
        }

        // Limit exceeded — go straight to alt method / UPI
        if ("transaction_limit_exceeded".equals(err) || "upi_limit_exceeded".equals(err)) {
            return switch (attempt) {
                case 0 -> new Diagnosis(
                        "Limit exceeded — suggesting UPI.",
                        InterventionType.UPI_FALLBACK, "SMS", 0.80,
                        "(Rule fallback) Rail 3 — limit exceeded, UPI | " + note);
                case 1 -> new Diagnosis(
                        "Limit exceeded — alt method.",
                        InterventionType.ALT_METHOD, "SMS", 0.75,
                        "(Rule fallback) Alt method | " + note);
                default -> new Diagnosis(
                        "Limit exceeded — WhatsApp link.",
                        InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.70,
                        "(Rule fallback) Rail 4 — WhatsApp | " + note);
            };
        }

        // Overdue invoices — escalate based on days overdue and status
        if (err.startsWith("overdue_") || err.equals("disputed_invoice")
                || err.equals("unresponsive_customer") || err.equals("partial_payment_pending")
                || err.equals("promise_to_pay_broken")) {

            if ("disputed_invoice".equals(err) || "unresponsive_customer".equals(err)) {
                return new Diagnosis(
                        "Invoice dispute or unresponsive customer — human required.",
                        InterventionType.ESCALATE, null, 0.95,
                        "(Rule fallback) B2B escalation | " + note);
            }

            // Extract days from "overdue_N_days"
            int days = 0;
            if (err.startsWith("overdue_")) {
                try {
                    days = Integer.parseInt(err.split("_")[1]);
                } catch (NumberFormatException ignored) { days = 7; }
            }

            if (days <= 7 || "partial_payment_pending".equals(err)) {
                return switch (attempt) {
                    case 0 -> new Diagnosis(
                            "Invoice overdue " + days + " days — sending dunning.",
                            InterventionType.DUNNING_MESSAGE, "EMAIL", 0.80,
                            "(Rule fallback) Short overdue, email nudge | " + note);
                    case 1 -> new Diagnosis(
                            "No response — sending payment link.",
                            InterventionType.PAYMENT_LINK, "EMAIL", 0.75,
                            "(Rule fallback) Payment link follow-up | " + note);
                    default -> new Diagnosis(
                            "Switching to WhatsApp — higher open rate.",
                            InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.70,
                            "(Rule fallback) WhatsApp last resort | " + note);
                };
            } else if (days <= 21) {
                return switch (attempt) {
                    case 0 -> new Diagnosis(
                            "Invoice overdue " + days + " days — firm payment link.",
                            InterventionType.PAYMENT_LINK, "EMAIL", 0.78,
                            "(Rule fallback) Medium overdue | " + note);
                    case 1 -> new Diagnosis(
                            "No payment — UPI fallback.",
                            InterventionType.UPI_FALLBACK, "SMS", 0.72,
                            "(Rule fallback) UPI option | " + note);
                    default -> new Diagnosis(
                            "Escalating to human for 21-day overdue.",
                            InterventionType.ESCALATE, null, 0.85,
                            "(Rule fallback) Escalate medium overdue | " + note);
                };
            } else {
                // 30+ days — escalate immediately
                return new Diagnosis(
                        "Invoice overdue " + days + " days — escalating to human.",
                        InterventionType.ESCALATE, null, 0.90,
                        "(Rule fallback) Long overdue, human needed | " + note);
            }
        }
        return switch (attempt) {
            case 0 -> new Diagnosis(
                    "Unknown error — smart retry.",
                    InterventionType.SMART_RETRY, null, 0.65,
                    "(Rule fallback) Rail 1 — unknown | " + note);
            case 1 -> new Diagnosis(
                    "Unknown error — payment link.",
                    InterventionType.PAYMENT_LINK, "EMAIL", 0.62,
                    "(Rule fallback) Rail 2 — unknown | " + note);
            case 2 -> new Diagnosis(
                    "Unknown error — UPI fallback.",
                    InterventionType.UPI_FALLBACK, "SMS", 0.60,
                    "(Rule fallback) Rail 3 — unknown | " + note);
            default -> new Diagnosis(
                    "Unknown error — WhatsApp last resort.",
                    InterventionType.WHATSAPP_LINK, "WHATSAPP", 0.58,
                    "(Rule fallback) Rail 4 — unknown | " + note);
        };
    }
}