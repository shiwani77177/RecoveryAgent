package com.example.recovery_agent.chat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.domain.AuditLog;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.repository.AuditLogRepository;
import com.example.recovery_agent.repository.RecoveryCaseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private static final String GEMINI_MODEL = "gemini-3.6-flash";
    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/"
                    + GEMINI_MODEL + ":generateContent";

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private final RecoveryCaseRepository caseRepo;
    private final AuditLogRepository auditRepo;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public ChatService(RecoveryCaseRepository caseRepo, AuditLogRepository auditRepo) {
        this.caseRepo = caseRepo;
        this.auditRepo = auditRepo;
    }

    //Penny reply
    public ChatResponse chat(ChatRequest request) {
        if (geminiApiKey == null || geminiApiKey.isBlank()
                || geminiApiKey.equals("your-gemini-key-here")) {
            return ChatResponse.error(
                "Penny is not configured yet. Please add your GEMINI_API_KEY to the .env file. "
                + "Get a free key at aistudio.google.com.");
        }

        try {
            String systemPrompt = buildSystemPrompt(request.getCaseId());
            List<Map<String, Object>> contents = buildContents(request);
            String reply = callGemini(systemPrompt, contents);
            return new ChatResponse(reply);
        } catch (QuotaExceededException e) {
            return ChatResponse.quota("""
                                      Penny has used up today's AI quota \ud83e\udeab
                                      
                                      The free Gemini tier allows 20 requests per day. I'll be back to full power tomorrow at midnight!
                                      
                                      In the meantime, you can still explore the Dashboard, Cases, and Audit Log \u2014 everything is working normally \ud83d\udc9c""");
        } catch (Exception e) {
            log.error("Penny chat error", e);
            return ChatResponse.error("Sorry, I ran into an issue: " + e.getMessage());
        }
    }

    //System Prompt
    private String buildSystemPrompt(String caseId) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("""
            You are Penny, a friendly and knowledgeable AI assistant for RecoveryAgent,
            an AI-powered revenue recovery dashboard built for the Razorpay Buildathon.

            Your personality:
            - Warm, helpful, and concise
            - You explain technical concepts in simple terms
            - You use emojis occasionally to be friendly 😊
            - You always give specific, actionable answers
            - When you don't know something, you say so honestly

            About the system you help with:
            - RecoveryAgent detects failed payments (via Razorpay webhooks)
            - An AI diagnosis agent analyzes each failure and recommends an intervention
            - Interventions include: SMART_RETRY, PAYMENT_LINK, ALT_METHOD, DUNNING_MESSAGE
            - If confidence is below 0.6, the case is ESCALATED to a human
            - Maximum 4 attempts per case, with exponential backoff
            - Every decision is logged in an append-only audit trail
            - The system principle: "The LLM proposes, deterministic gated code disposes"

            Common Razorpay error codes you should know:
            - insufficient_funds: Customer's account balance is too low. Usually temporary.
            - card_expired: Card has expired, customer needs to use a new card.
            - bank_downtime: Bank servers are temporarily unavailable. Auto-retry works.
            - authentication_failed: Wrong OTP or 3DS failure. Customer can retry.
            - payment_risk_check_failed: Bank flagged as potential fraud. Should NOT be retried.
            - debit_instrument_blocked: Card is permanently blocked. Escalate.

            Case statuses:
            - DETECTED: Just received, not yet processed
            - DIAGNOSING: AI agent is analyzing the failure
            - EXECUTING: Running the chosen intervention
            - WAITING: Waiting for retry backoff to expire
            - RECOVERED: Money successfully recovered ✅
            - ESCALATED: Handed to a human for review ⚠️
            - ABANDONED: Max attempts reached, gave up ❌

            Keep answers brief (2-4 sentences) unless the user asks for detail.
            """);

            //Specific case
        if (caseId != null && !caseId.isBlank()) {
            try {
                UUID id = UUID.fromString(caseId);
                Optional<RecoveryCase> caseOpt = caseRepo.findById(id);

                if (caseOpt.isPresent()) {
                    RecoveryCase c = caseOpt.get();
                    prompt.append("\n\nThe user is currently viewing this case:\n");
                    prompt.append("- Case ID: ").append(c.getId()).append("\n");
                    prompt.append("- Type: ").append(c.getType()).append("\n");
                    prompt.append("- Amount: ₹").append(c.getAmount()).append("\n");
                    prompt.append("- Status: ").append(c.getStatus()).append("\n");
                    prompt.append("- Risk Reason: ").append(c.getRiskReason()).append("\n");
                    prompt.append("- Attempts: ").append(c.getAttemptCount()).append(" of 4\n");
                    prompt.append("- Recovered: ₹").append(c.getRecoveredAmount()).append("\n");

                    List<AuditLog> trail = auditRepo.findByCaseIdOrderByCreatedAtAsc(id);
                    if (!trail.isEmpty()) {
                        prompt.append("\nAudit trail for this case:\n");
                        for (AuditLog entry : trail) {
                            prompt.append("  [").append(entry.getActor())
                                    .append("] ").append(entry.getAction());
                            if (entry.getReason() != null) {
                                prompt.append(" — ").append(entry.getReason());
                            }
                            prompt.append("\n");
                        }
                    }

                    prompt.append("\nUse this context to give specific answers about this case.");
                }
            } catch (Exception e) {
                log.debug("Could not load case context for {}: {}", caseId, e.getMessage());
            }
        }

        return prompt.toString();
    }

    //Message
    private List<Map<String, Object>> buildContents(ChatRequest request) {
        List<Map<String, Object>> contents = new ArrayList<>();

        //Conversation history
        if (request.getHistory() != null) {
            for (ChatRequest.ChatMessage msg : request.getHistory()) {
                String role = "assistant".equals(msg.getRole()) ? "model" : "user";
                contents.add(Map.of(
                        "role", role,
                        "parts", List.of(Map.of("text", msg.getContent()))
                ));
            }
        }

        //New user message
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", request.getMessage()))
        ));

        return contents;
    }

    // Sentinel exception — caught separately so the frontend knows to show quota UI
    static class QuotaExceededException extends RuntimeException {
        QuotaExceededException() { super("quota_exceeded"); }
    }

    //API call
    private String callGemini(String systemPrompt, List<Map<String, Object>> contents)
            throws Exception {

        //Request body     
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", contents);
        body.put("systemInstruction", Map.of(
                "parts", List.of(Map.of("text", systemPrompt))
        ));
        body.put("generationConfig", Map.of(
                "temperature", 0.7,
                "maxOutputTokens", 1024
        ));

        String jsonBody = mapper.writeValueAsString(body);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", geminiApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        log.debug("Calling Gemini API with {} messages", contents.size());

        HttpResponse<String> response = httpClient.send(httpRequest,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 429) {
            log.warn("Gemini quota exhausted for Penny chat");
            throw new QuotaExceededException();
        }

        if (response.statusCode() != 200) {
            log.error("Gemini API error {}: {}", response.statusCode(), response.body());
            throw new RuntimeException("Gemini API returned status " + response.statusCode()
                    + " — " + response.body());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");

        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                return parts.get(0).path("text")
                        .asText("Sorry, I couldn't generate a response.");
            }
        }

        return "Sorry, I received an empty response. Please try again.";
    }
}


