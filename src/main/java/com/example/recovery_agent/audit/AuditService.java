package com.example.recovery_agent.audit;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.domain.AuditLog;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.repository.AuditLogRepository;

import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository repo;
    private final ObjectMapper mapper = new ObjectMapper();

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    public AuditLog log(RecoveryCase c,
                        Actor actor,
                        String action,
                        String reason,
                        boolean moneyAction,
                        BigDecimal amount,
                        Object inputSnapshot,
                        Object outputSnapshot) {

        AuditLog row = new AuditLog();
        row.setCaseId(c != null ? c.getId() : null);
        row.setActor(actor);
        row.setAction(action);
        row.setReason(reason);
        row.setMoneyAction(moneyAction);
        row.setAmount(amount);
        row.setInputSnapshot(toJson(inputSnapshot));
        row.setOutputSnapshot(toJson(outputSnapshot));

        // Save first so createdAt gets populated by DB
        AuditLog saved = repo.save(row);

        // Now compute and store the integrity hash
        String hash = computeHash(saved);
        saved.setIntegrityHash(hash);
        return repo.save(saved);
    }

    public AuditLog logSystemEvent(String action, String reason) {
        return log(null, Actor.SYSTEM, action, reason, false, null, null, null);
    }

    public long count() {
        return repo.count();
    }

    public VerificationResult verifyAll() {
        List<AuditLog> all = repo.findAll();
        int total = all.size();
        int passed = 0;
        int failed = 0;
        int missing = 0;

        for (AuditLog entry : all) {
            if (entry.getIntegrityHash() == null || entry.getIntegrityHash().isBlank()) {
                missing++;
                continue;
            }
            String expected = computeHash(entry);
            if (expected.equals(entry.getIntegrityHash())) {
                passed++;
            } else {
                failed++;
                log.warn("INTEGRITY VIOLATION detected on audit entry [{}] — stored hash mismatch!",
                        entry.getId());
            }
        }

        boolean clean = failed == 0;
        log.info("Audit integrity check: {}/{} passed, {} failed, {} missing hashes",
                passed, total, failed, missing);

        return new VerificationResult(total, passed, failed, missing, clean);
    }

    public String computeHash(AuditLog entry) {
        String input = String.join("|",
                safe(entry.getId()),
                safe(entry.getCaseId()),
                safe(entry.getActor()),
                safe(entry.getAction()),
                safe(entry.getReason()),
                safe(entry.getCreatedAt())
        );

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String safe(Object o) {
        return o == null ? "" : o.toString();
    }

    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            return null;
        }
    }

    public record VerificationResult(
            int total,
            int passed,
            int failed,
            int missing,
            boolean clean
    ) {}
}

