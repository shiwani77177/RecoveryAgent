package com.example.recovery_agent.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.recovery_agent.audit.AuditService;
import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.domain.enums.CaseType;
import com.example.recovery_agent.repository.RecoveryCaseRepository;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final AuditService audit;
    private final RecoveryCaseRepository cases;
    private final StringRedisTemplate redis;

    public HealthController(AuditService audit,
                            RecoveryCaseRepository cases,
                            StringRedisTemplate redis) {
        this.audit = audit;
        this.cases = cases;
        this.redis = redis;
    }

    /**
     * Lightweight health check for uptime pings (e.g. cron-job.org keep-alive).
     * No side effects — just confirms the app is up. Safe to call frequently.
     */
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "RecoveryAgent",
                "timestamp", Instant.now().toString()
        );
    }

    @GetMapping("/smoke-test")
    public Map<String, Object> smokeTest() {
        // 1. Fake case
        RecoveryCase c = new RecoveryCase();
        c.setType(CaseType.FAILED_PAYMENT);
        c.setMerchantId("merchant_smoke");
        c.setCustomerId("customer_smoke");
        c.setAmount(new BigDecimal("499.00"));
        c.setRiskReason("smoke_test");
        RecoveryCase saved = cases.save(c);

        // 2. Audit row referencing it
        audit.log(saved, Actor.SYSTEM, "SMOKE_TEST",
                  "Manual smoke test at " + Instant.now(),
                  false, null, null, null);

        // 3. Redis round-trip
        redis.opsForValue().set("smoke:last", Instant.now().toString());
        String redisEcho = redis.opsForValue().get("smoke:last");

        return Map.of(
                "status",         "ok",
                "caseId",         saved.getId().toString(),
                "totalCases",     cases.count(),
                "totalAuditRows", audit.count(),
                "redisRoundTrip", redisEcho,
                "message",        "Postgres + audit spine + Redis are all wired."
        );
    }
}