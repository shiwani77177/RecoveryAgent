package com.example.recovery_agent.eval;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.CaseStatus;
import com.example.recovery_agent.recovery.RecoveryOrchestrator;
import com.example.recovery_agent.repository.RecoveryCaseRepository;

@Service
public class EvalHarness {

    private static final Logger log = LoggerFactory.getLogger(EvalHarness.class);
    private static final double BASELINE_RECOVERY_RATE = 0.35;

    private final RecoveryCaseRepository caseRepo;
    private final RecoveryOrchestrator orchestrator;
    private final StringRedisTemplate redis;
    private final com.example.recovery_agent.agent.GeminiDiagnosisAgent geminiAgent;

    public EvalHarness(RecoveryCaseRepository caseRepo, RecoveryOrchestrator orchestrator,
                       StringRedisTemplate redis,
                       com.example.recovery_agent.agent.GeminiDiagnosisAgent geminiAgent) {
        this.caseRepo = caseRepo;
        this.orchestrator = orchestrator;
        this.redis = redis;
        this.geminiAgent = geminiAgent;
    }

    /** Run eval without progress reporting (original behavior) */
    public EvalReport run() {
        return run(null);
    }

    /**
     * Run eval with progress callback.
     * The callback receives a ProgressEvent after each case is processed.
     */
    public EvalReport run(Consumer<ProgressEvent> onProgress) {
        log.info("═══ Starting Eval Harness ═══");
        flushRecoveryKeys();

        List<RecoveryCase> detectedCases = caseRepo.findByStatus(CaseStatus.DETECTED);
        if (detectedCases.isEmpty()) {
            log.warn("No DETECTED cases found.");
            return EvalReport.empty("No DETECTED cases. Generate test data first.");
        }

        int totalCases = detectedCases.size();
        log.info("Found {} DETECTED cases to process", totalCases);

        List<UUID> caseIds = new ArrayList<>();
        for (RecoveryCase c : detectedCases) {
            caseIds.add(c.getId());
        }

        // Send initial progress
        if (onProgress != null) {
            onProgress.accept(new ProgressEvent(0, totalCases, 1, "Starting evaluation..."));
        }

        // Multi-pass processing with progress reporting
        // Track UNIQUE cases finished (not per-pass processing count)
        java.util.Set<UUID> finishedCases = new java.util.HashSet<>();

        for (int pass = 0; pass < 4; pass++) {
            int passProcessed = 0;
            for (int i = 0; i < caseIds.size(); i++) {
                UUID caseId = caseIds.get(i);
                try {
                    RecoveryCase current = caseRepo.findById(caseId).orElse(null);
                    if (current == null) continue;
                    CaseStatus status = current.getStatus();
                    if (status == CaseStatus.DETECTED || status == CaseStatus.WAITING) {
                        orchestrator.processCaseById(caseId);
                        passProcessed++;

                        // Only count this case as "done" if it reached a terminal state
                        RecoveryCase updated = caseRepo.findById(caseId).orElse(current);
                        CaseStatus newStatus = updated.getStatus();
                        boolean isTerminal = newStatus == CaseStatus.RECOVERED
                                          || newStatus == CaseStatus.ESCALATED
                                          || newStatus == CaseStatus.ABANDONED;

                        if (isTerminal) {
                            finishedCases.add(caseId);
                        }

                        // Report progress based on UNIQUE cases finished
                        if (onProgress != null) {
                            String detail = "Pass " + (pass + 1) + " · "
                                    + updated.getRiskReason() + " → " + newStatus;
                            onProgress.accept(new ProgressEvent(
                                    Math.min(finishedCases.size(), totalCases),
                                    totalCases,
                                    pass + 1,
                                    detail));
                        }
                    } else {
                        // Already terminal from previous pass — count it
                        finishedCases.add(caseId);
                    }
                } catch (Exception e) {
                    log.error("Failed to process case [{}]: {}", caseId, e.getMessage());
                    if (onProgress != null) {
                        onProgress.accept(new ProgressEvent(
                                Math.min(finishedCases.size(), totalCases),
                                totalCases,
                                pass + 1,
                                "Error on case " + caseId.toString().substring(0, 8)));
                    }
                }
            }
            log.info("Eval pass {} processed {} cases", pass + 1, passProcessed);
            if (passProcessed == 0) break;

            // Flush retry-backoff keys between passes so WAITING cases become
            // immediately eligible for the next pass instead of being stuck
            // behind a backoff timer (which caused the eval to stall at ~80%).
            flushRetryKeys();
        }

        // Force progress to 100% after the passes complete. Any cases still
        // in WAITING are counted as "processed" for progress purposes — they'll
        // be graded as WAITING in the results, but the bar shouldn't hang.
        if (onProgress != null) {
            onProgress.accept(new ProgressEvent(totalCases, totalCases, -1,
                    "Finalizing results..."));
        }

        // Grade results (unchanged logic)
        List<RecoveryCase> processedCases = caseRepo.findAllById(caseIds);

        int totalRecoverable = 0, totalUnrecoverable = 0;
        int agentRecovered = 0, agentCorrectEscalate = 0, agentFalseEscalate = 0;
        int agentFalseRecover = 0, agentWaiting = 0, agentAbandoned = 0;
        BigDecimal totalAtRisk = BigDecimal.ZERO;
        BigDecimal agentRecoveredAmount = BigDecimal.ZERO;
        List<Map<String, Object>> caseDetails = new ArrayList<>();

        for (RecoveryCase c : processedCases) {
            boolean recoverable = Boolean.TRUE.equals(c.getTrulyRecoverable());
            CaseStatus finalStatus = c.getStatus();
            if (recoverable) totalRecoverable++; else totalUnrecoverable++;
            totalAtRisk = totalAtRisk.add(c.getAmount());

            String grade;
            if (finalStatus == CaseStatus.RECOVERED) {
                agentRecoveredAmount = agentRecoveredAmount.add(
                        c.getRecoveredAmount() != null ? c.getRecoveredAmount() : c.getAmount());
                if (recoverable) { agentRecovered++; grade = "TRUE_POSITIVE"; }
                else { agentFalseRecover++; grade = "FALSE_POSITIVE"; }
            } else if (finalStatus == CaseStatus.ESCALATED) {
                if (!recoverable) { agentCorrectEscalate++; grade = "TRUE_NEGATIVE"; }
                else { agentFalseEscalate++; grade = "FALSE_NEGATIVE"; }
            } else if (finalStatus == CaseStatus.WAITING) {
                agentWaiting++; grade = "WAITING";
            } else if (finalStatus == CaseStatus.ABANDONED) {
                agentAbandoned++;
                grade = recoverable ? "FALSE_NEGATIVE" : "TRUE_NEGATIVE";
            } else { grade = "UNKNOWN"; }

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("caseId", c.getId().toString().substring(0, 8));
            detail.put("type", c.getType().toString());
            detail.put("errorCode", c.getRiskReason());
            detail.put("amount", c.getAmount());
            detail.put("trulyRecoverable", recoverable);
            detail.put("finalStatus", finalStatus.toString());
            detail.put("grade", grade);
            detail.put("attempts", c.getAttemptCount());
            caseDetails.add(detail);
        }

        double agentRecoveryRate = totalRecoverable > 0
                ? (double) agentRecovered / totalRecoverable : 0;
        int baselineRecovered = (int) Math.round(totalRecoverable * BASELINE_RECOVERY_RATE);
        BigDecimal baselineRecoveredAmount = totalAtRisk
                .multiply(BigDecimal.valueOf(BASELINE_RECOVERY_RATE))
                .setScale(2, RoundingMode.HALF_UP);
        double improvement = BASELINE_RECOVERY_RATE > 0
                ? ((agentRecoveryRate - BASELINE_RECOVERY_RATE) / BASELINE_RECOVERY_RATE) * 100 : 0;

        EvalReport report = new EvalReport();
        report.totalCases = totalCases;
        report.totalRecoverable = totalRecoverable;
        report.totalUnrecoverable = totalUnrecoverable;
        report.agentRecovered = agentRecovered;
        report.agentCorrectEscalate = agentCorrectEscalate;
        report.agentFalseEscalate = agentFalseEscalate;
        report.agentFalseRecover = agentFalseRecover;
        report.agentWaiting = agentWaiting;
        report.agentAbandoned = agentAbandoned;
        report.agentRecoveryRate = round(agentRecoveryRate * 100);
        report.agentRecoveredAmount = agentRecoveredAmount;
        report.baselineRecovered = baselineRecovered;
        report.baselineRecoveryRate = round(BASELINE_RECOVERY_RATE * 100);
        report.baselineRecoveredAmount = baselineRecoveredAmount;
        report.improvementPercent = round(improvement);
        report.totalAtRisk = totalAtRisk;
        report.caseDetails = caseDetails;
        report.aiQuotaExhausted = geminiAgent.isQuotaRecentlyExhausted();
        report.message = "Eval complete. Agent recovered "
                + report.agentRecoveryRate + "% vs baseline "
                + report.baselineRecoveryRate + "% ("
                + (improvement >= 0 ? "+" : "") + report.improvementPercent + "% improvement)";

        log.info("═══ EVAL RESULTS: Agent {}% vs Baseline {}% ({}% improvement) ═══",
                report.agentRecoveryRate, report.baselineRecoveryRate, report.improvementPercent);

        // Send completion
        if (onProgress != null) {
            onProgress.accept(new ProgressEvent(totalCases, totalCases, -1,
                    "Complete! " + report.agentRecoveryRate + "% recovery rate"));
        }

        return report;
    }

    private double round(double val) {
        return BigDecimal.valueOf(val).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private void flushRecoveryKeys() {
        try {
            int deleted = 0;
            for (String prefix : List.of("recovery:", "retry:", "spend:", "contacts:")) {
                var keys = redis.keys(prefix + "*");
                if (keys != null && !keys.isEmpty()) {
                    redis.delete(keys);
                    deleted += keys.size();
                }
            }
            log.info("Flushed {} stale Redis keys before eval", deleted);
        } catch (Exception e) {
            log.warn("Failed to flush Redis keys: {}", e.getMessage());
        }
    }

    /**
     * Flush ONLY the retry-backoff keys (not spend/contact tracking).
     * Called between eval passes so WAITING cases don't stay blocked behind
     * an unexpired backoff timer.
     */
    private void flushRetryKeys() {
        try {
            var keys = redis.keys("retry:*");
            if (keys != null && !keys.isEmpty()) {
                redis.delete(keys);
            }
        } catch (Exception e) {
            log.warn("Failed to flush retry keys between passes: {}", e.getMessage());
        }
    }

    /** Progress event sent to frontend via SSE */
    public record ProgressEvent(int processed, int total, int pass, String detail) {}

    public static class EvalReport {
        public String message;
        public int totalCases, totalRecoverable, totalUnrecoverable;
        public BigDecimal totalAtRisk;
        public int agentRecovered, agentCorrectEscalate, agentFalseEscalate;
        public int agentFalseRecover, agentWaiting, agentAbandoned;
        public double agentRecoveryRate;
        public BigDecimal agentRecoveredAmount;
        public int baselineRecovered;
        public double baselineRecoveryRate;
        public BigDecimal baselineRecoveredAmount;
        public double improvementPercent;

        // True if Gemini hit its daily quota during this run — signals the
        // frontend to warn the user that results reflect rule-based fallback.
        public boolean aiQuotaExhausted = false;
        public List<Map<String, Object>> caseDetails;

        public static EvalReport empty(String message) {
            EvalReport r = new EvalReport();
            r.message = message;
            r.caseDetails = List.of();
            r.totalAtRisk = BigDecimal.ZERO;
            r.agentRecoveredAmount = BigDecimal.ZERO;
            r.baselineRecoveredAmount = BigDecimal.ZERO;
            return r;
        }
    }
}