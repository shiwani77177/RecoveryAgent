package com.example.recovery_agent.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.recovery_agent.domain.AuditLog;
import com.example.recovery_agent.domain.RecoveryAttempt;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.CaseStatus;
import com.example.recovery_agent.recovery.RecoveryOrchestrator;
import com.example.recovery_agent.repository.AuditLogRepository;
import com.example.recovery_agent.repository.RecoveryAttemptRepository;
import com.example.recovery_agent.repository.RecoveryCaseRepository;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")  // Allow React dev server to call this
public class CaseController {

    private final RecoveryCaseRepository caseRepo;
    private final RecoveryAttemptRepository attemptRepo;
    private final AuditLogRepository auditRepo;
    private final RecoveryOrchestrator orchestrator;
    private final com.example.recovery_agent.audit.AuditService auditService;

    public CaseController(
            RecoveryCaseRepository caseRepo,
            RecoveryAttemptRepository attemptRepo,
            AuditLogRepository auditRepo,
            RecoveryOrchestrator orchestrator,
            com.example.recovery_agent.audit.AuditService auditService) {
        this.caseRepo = caseRepo;
        this.attemptRepo = attemptRepo;
        this.auditRepo = auditRepo;
        this.orchestrator = orchestrator;
        this.auditService = auditService;
    }

    @GetMapping("/cases")
    public List<RecoveryCase> getAllCases() {
        return caseRepo.findAll();
    }

    @GetMapping("/cases/{id}")
    public ResponseEntity<RecoveryCase> getCaseById(@PathVariable UUID id) {
        return caseRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }


    @GetMapping("/cases/{id}/attempts")
    public List<RecoveryAttempt> getCaseAttempts(@PathVariable UUID id) {
        return attemptRepo.findByCaseIdOrderByAttemptNumberAsc(id);
    }

    @GetMapping("/cases/{id}/audit")
    public List<AuditLog> getCaseAuditTrail(@PathVariable UUID id) {
        return auditRepo.findByCaseIdOrderByCreatedAtAsc(id);
    }

    @GetMapping("/dashboard/summary")
    public Map<String, Object> getDashboardSummary() {
        List<RecoveryCase> allCases = caseRepo.findAll();

        long totalCases = allCases.size();
        long recovered = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.RECOVERED).count();
        long escalated = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.ESCALATED).count();
        long abandoned = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.ABANDONED).count();
        long waiting = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.WAITING).count();
        long detected = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.DETECTED).count();

        BigDecimal totalAtRisk = allCases.stream()
                .map(RecoveryCase::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRecovered = allCases.stream()
                .filter(c -> c.getStatus() == CaseStatus.RECOVERED)
                .map(RecoveryCase::getRecoveredAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double recoveryRate = totalCases > 0
                ? (double) recovered / totalCases * 100 : 0;

        return Map.of(
                "totalCases", totalCases,
                "recovered", recovered,
                "escalated", escalated,
                "abandoned", abandoned,
                "waiting", waiting,
                "detected", detected,
                "totalAtRisk", totalAtRisk,
                "totalRecovered", totalRecovered,
                "recoveryRate", Math.round(recoveryRate * 100.0) / 100.0
        );
    }

    @GetMapping("/audit")
    public List<AuditLog> getAllAuditLogs() {
        return auditRepo.findAll();
    }

    @PostMapping("/audit/verify")
    public Map<String, Object> verifyAuditIntegrity() {
        var result = auditService.verifyAll();
        return Map.of(
                "total",   result.total(),
                "passed",  result.passed(),
                "failed",  result.failed(),
                "missing", result.missing(),
                "clean",   result.clean(),
                "message", result.clean()
                        ? "✅ All " + result.passed() + " audit entries verified — no tampering detected"
                        : "🚨 " + result.failed() + " entries have mismatched hashes — possible tampering!"
        );
    }

    @PostMapping("/orchestrator/run")
    public Map<String, Object> triggerOrchestrator() {
        long beforeRecovered = caseRepo.findByStatus(CaseStatus.RECOVERED).size();

        orchestrator.processAllPendingCases();

        long afterRecovered = caseRepo.findByStatus(CaseStatus.RECOVERED).size();

        return Map.of(
                "message", "Orchestrator run complete",
                "casesRecoveredThisRun", afterRecovered - beforeRecovered,
                "totalDetected", caseRepo.findByStatus(CaseStatus.DETECTED).size(),
                "totalWaiting", caseRepo.findByStatus(CaseStatus.WAITING).size(),
                "totalRecovered", afterRecovered,
                "totalEscalated", caseRepo.findByStatus(CaseStatus.ESCALATED).size(),
                "totalAbandoned", caseRepo.findByStatus(CaseStatus.ABANDONED).size()
        );
    }

    @PostMapping("/cases/{id}/process")
    public RecoveryCase processSingleCase(@PathVariable UUID id) {
        return orchestrator.processCaseById(id);
    }
}

