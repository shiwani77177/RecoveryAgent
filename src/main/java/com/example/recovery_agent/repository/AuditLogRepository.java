package com.example.recovery_agent.repository;

import com.example.recovery_agent.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /** The full audit trail for a case — the "explain this recovery" query. */
    List<AuditLog> findByCaseIdOrderByCreatedAtAsc(UUID caseId);
}
