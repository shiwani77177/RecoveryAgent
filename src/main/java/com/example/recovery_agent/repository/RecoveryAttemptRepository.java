package com.example.recovery_agent.repository;

import com.example.recovery_agent.domain.RecoveryAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecoveryAttemptRepository extends JpaRepository<RecoveryAttempt, UUID> {

    /** All attempts for a case, oldest first — used to enforce MAX_ATTEMPTS. */
    List<RecoveryAttempt> findByCaseIdOrderByAttemptNumberAsc(UUID caseId);
}
