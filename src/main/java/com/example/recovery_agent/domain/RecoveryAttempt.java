package com.example.recovery_agent.domain;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import com.example.recovery_agent.domain.enums.Actor;
import com.example.recovery_agent.domain.enums.InterventionType;
import com.example.recovery_agent.domain.enums.Outcome;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "recovery_attempt")
@Getter
@Setter
@NoArgsConstructor
public class RecoveryAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID caseId;

    @Column(nullable = false)
    private int attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterventionType interventionType;

    /** "SMS", "WHATSAPP", "EMAIL", "AUTO_RETRY" — nullable when N/A. */
    private String channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Actor decidedBy;

    /** The LLM's justification — copied straight into the audit log. */
    @Column(columnDefinition = "text")
    private String rationale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Outcome outcome = Outcome.PENDING;

    /** Unique per attempt — guarantees a retry can't double-charge. */
    @Column(unique = true)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant executedAt;
}
