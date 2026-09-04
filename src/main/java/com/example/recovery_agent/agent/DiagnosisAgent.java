package com.example.recovery_agent.agent;

import com.example.recovery_agent.domain.RecoveryCase;

public interface DiagnosisAgent {

    /**
     * Analyze a recovery case and recommend an intervention.
     *
     * @param recoveryCase the case to diagnose (failed payment, etc.)
     * @return a Diagnosis with rootCause, recommendedAction, confidence, rationale
     */
    Diagnosis diagnose(RecoveryCase recoveryCase);
}

