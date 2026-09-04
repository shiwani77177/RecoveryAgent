package com.example.recovery_agent.recovery;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.agent.Diagnosis;
import com.example.recovery_agent.agent.DiagnosisAgent;
import com.example.recovery_agent.audit.AuditService;
import com.example.recovery_agent.domain.RecoveryAttempt;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.domain.enums.CaseStatus;
import com.example.recovery_agent.domain.enums.InterventionType;
import com.example.recovery_agent.domain.enums.Outcome;
import com.example.recovery_agent.repository.RecoveryAttemptRepository;
import com.example.recovery_agent.repository.RecoveryCaseRepository;

@Service
public class RecoveryOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(RecoveryOrchestrator.class);

    private final DiagnosisAgent diagnosisAgent;
    private final InterventionExecutor executor;        // NEW
    private final GuardrailService guardrails;           // NEW
    private final RecoveryCaseRepository caseRepo;
    private final RecoveryAttemptRepository attemptRepo;
    private final AuditService audit;
    private final StringRedisTemplate redis;

    public RecoveryOrchestrator(
            DiagnosisAgent diagnosisAgent,
            InterventionExecutor executor,               // NEW
            GuardrailService guardrails,                  // NEW
            RecoveryCaseRepository caseRepo,
            RecoveryAttemptRepository attemptRepo,
            AuditService audit,
            StringRedisTemplate redis) {
        this.diagnosisAgent = diagnosisAgent;
        this.executor = executor;
        this.guardrails = guardrails;
        this.caseRepo = caseRepo;
        this.attemptRepo = attemptRepo;
        this.audit = audit;
        this.redis = redis;
    }

    //Main loop(30 secs)
    @Scheduled(fixedDelay = 30000)
    public void processAllPendingCases() {
        List<RecoveryCase> detected = caseRepo.findByStatus(CaseStatus.DETECTED);
        List<RecoveryCase> waiting = caseRepo.findByStatus(CaseStatus.WAITING);

        int total = detected.size() + waiting.size();
        if (total > 0) {
            log.info("Processing {} pending cases ({} detected, {} waiting)",
                    total, detected.size(), waiting.size());
        }

        for (RecoveryCase c : detected) {
            try {
                processCase(c);
            } catch (Exception e) {
                log.error("processCase crashed for [{}] — continuing with next case: {}",
                        c.getId(), e.getMessage());
            }
        }

        for (RecoveryCase c : waiting) {
            if (isBackoffExpired(c)) {
                try {
                    processCase(c);
                } catch (Exception e) {
                    log.error("processCase crashed for [{}] — continuing with next case: {}",
                            c.getId(), e.getMessage());
                }
            }
        }
    }

    public RecoveryCase processCaseById(UUID caseId) {
        RecoveryCase c = caseRepo.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));
        processCase(c);
        return caseRepo.findById(caseId).orElse(c);
    }

    //State maschine
    private void processCase(RecoveryCase c) {
        log.info("━━━ Processing case [{}] type={} amount=₹{} attempts={}/{} ━━━",
                c.getId(), c.getType(), c.getAmount(),
                c.getAttemptCount(), StoppingRules.MAX_ATTEMPTS);

        //Check
        if (!StoppingRules.canAttempt(c)) {
            abandonCase(c, "Maximum attempts (" + StoppingRules.MAX_ATTEMPTS + ") reached");
            return;
        }

        //DIAGNOSING
        c.setStatus(CaseStatus.DIAGNOSING);
        caseRepo.save(c);

        //Ask the agent for diagnosis
        Diagnosis diagnosis;
        try {
            diagnosis = diagnosisAgent.diagnose(c);
            log.info("Diagnosis: action={} confidence={} channel={}",
                    diagnosis.recommendedAction(), diagnosis.confidence(), diagnosis.channel());
        } catch (Exception e) {
            log.error("Agent failed to diagnose case [{}]", c.getId(), e);
            escalateCase(c, "Agent threw an error: " + e.getMessage());
            return;
        }

        //Log the diagnosis
        audit.log(c, Actor.AGENT, "DIAGNOSED",
                diagnosis.rationale(),
                false, null,
                c.getRiskReason(),
                diagnosis.toString()
        );

        //Check confidence
        if (!diagnosis.isConfident()) {
            escalateCase(c, "Agent confidence too low ("
                    + String.format("%.2f", diagnosis.confidence())
                    + " < " + StoppingRules.CONFIDENCE_THRESHOLD
                    + "). Escalating to human.");
            return;
        }

        //Handle terminal recommendations
        if (diagnosis.recommendedAction() == InterventionType.ESCALATE) {
            escalateCase(c, diagnosis.rationale());
            return;
        }
        if (diagnosis.recommendedAction() == InterventionType.ABANDON) {
            abandonCase(c, diagnosis.rationale());
            return;
        }

        //Execute the intervention
        executeIntervention(c, diagnosis);
    }

    //Intervention
    private void executeIntervention(RecoveryCase c, Diagnosis diagnosis) {
        c.setStatus(CaseStatus.EXECUTING);
        caseRepo.save(c);

        //GUARDRAIL CHECK(before any money action)
        String guardFailure = guardrails.check(c, diagnosis);
        if (guardFailure != null) {
            log.warn("Guardrail blocked case [{}]: {}", c.getId(), guardFailure);
            audit.log(c, Actor.SYSTEM, "GUARDRAIL_BLOCKED",
                    guardFailure, false, null, null, null);
            c.setStatus(CaseStatus.WAITING);
            caseRepo.save(c);
            scheduleRetry(c);
            return;
        }

        //Record the attempt — use timestamp suffix so retries don't collide
        //The (case_id, attempt_number) pair is still logically unique because
        //attemptCount is bumped after each execution
        String idempotencyKey = "recovery:" + c.getId()
                + ":attempt:" + (c.getAttemptCount() + 1)
                + ":" + System.currentTimeMillis();
        RecoveryAttempt attempt = new RecoveryAttempt();
        attempt.setCaseId(c.getId());
        attempt.setAttemptNumber(c.getAttemptCount() + 1);
        attempt.setInterventionType(diagnosis.recommendedAction());
        attempt.setChannel(diagnosis.channel());
        attempt.setDecidedBy(Actor.AGENT);
        attempt.setRationale(diagnosis.rationale());
        attempt.setIdempotencyKey(idempotencyKey);

        //Uses real InterventionExecutor
        InterventionExecutor.ExecutionResult result = executor.execute(
                c.getId().toString(),
                c.getAmount(),
                c.getCurrency(),
                c.getCustomerId(),
                c.getCustomerEmail(),
                c.getCustomerPhone(),
                diagnosis
        );

        if (result.skipped()) {
            //ESCALATE or ABANDON
            log.debug("Execution skipped for case [{}]: {}", c.getId(), result.detail());
            return;
        }

        if (result.success()) {
            //RECOVERED
            attempt.setOutcome(Outcome.SUCCEEDED);
            attemptRepo.save(attempt);

            c.setStatus(CaseStatus.RECOVERED);
            c.setRecoveredAmount(c.getAmount());
            c.setAttemptCount(c.getAttemptCount() + 1);
            c.setResolvedAt(Instant.now());
            caseRepo.save(c);

            //spend tracking, contact counting
            guardrails.recordExecution(c);

            audit.log(c, Actor.SYSTEM, "INTERVENTION_SUCCEEDED",
                    result.detail(),
                    true, c.getAmount(),
                    diagnosis.toString(), attempt.getId().toString()
            );

            log.info("✅ RECOVERED case [{}] — ₹{} via {}",
                    c.getId(), c.getAmount(), diagnosis.recommendedAction());

        } else {
            //FAILED(schedule retry or abandon)
            attempt.setOutcome(Outcome.FAILED);
            attemptRepo.save(attempt);

            c.setAttemptCount(c.getAttemptCount() + 1);

            guardrails.recordExecution(c);

            audit.log(c, Actor.SYSTEM, "INTERVENTION_FAILED",
                    result.detail(),
                    true, c.getAmount(),
                    diagnosis.toString(), null
            );

            if (StoppingRules.canAttempt(c)) {
                c.setStatus(CaseStatus.WAITING);
                caseRepo.save(c);
                scheduleRetry(c);
            } else {
                abandonCase(c, "All " + StoppingRules.MAX_ATTEMPTS
                        + " attempts exhausted. " + result.detail());
            }
        }
    }

    //Helpers
    private void scheduleRetry(RecoveryCase c) {
        long backoffSeconds = StoppingRules.getBackoffSeconds(c.getAttemptCount());
        String retryKey = "retry:" + c.getId();
        String retryAt = Instant.now().plusSeconds(backoffSeconds).toString();
        redis.opsForValue().set(retryKey, retryAt);

        audit.log(c, Actor.SYSTEM, "RETRY_SCHEDULED",
                "Next attempt in " + backoffSeconds + " seconds (attempt "
                        + (c.getAttemptCount() + 1) + " of " + StoppingRules.MAX_ATTEMPTS + ")",
                false, null, null, null
        );

        log.info("⏳ Retry scheduled for case [{}] in {} seconds", c.getId(), backoffSeconds);
    }

    private void escalateCase(RecoveryCase c, String reason) {
        c.setStatus(CaseStatus.ESCALATED);
        c.setResolvedAt(Instant.now());
        caseRepo.save(c);
        audit.log(c, Actor.SYSTEM, "ESCALATED", reason, false, null, null, null);
        log.info("⚠️ ESCALATED case [{}] — {}", c.getId(), reason);
    }

    private void abandonCase(RecoveryCase c, String reason) {
        c.setStatus(CaseStatus.ABANDONED);
        c.setResolvedAt(Instant.now());
        caseRepo.save(c);
        audit.log(c, Actor.SYSTEM, "ABANDONED", reason, false, null, null, null);
        log.info("❌ ABANDONED case [{}] — {}", c.getId(), reason);
    }

    private boolean isBackoffExpired(RecoveryCase c) {
        String retryKey = "retry:" + c.getId();
        String retryAt = redis.opsForValue().get(retryKey);
        if (retryAt == null) return true;
        try {
            Instant scheduledTime = Instant.parse(retryAt);
            return Instant.now().isAfter(scheduledTime);
        } catch (Exception e) {
            return true;
        }
    }
}