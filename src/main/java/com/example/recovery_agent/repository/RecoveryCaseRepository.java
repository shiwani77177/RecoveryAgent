package com.example.recovery_agent.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.CaseStatus;

public interface RecoveryCaseRepository extends JpaRepository<RecoveryCase, UUID> {

    /** Handy for the orchestrator: find all cases in a given state. */
    List<RecoveryCase> findByStatus(CaseStatus status);
}
