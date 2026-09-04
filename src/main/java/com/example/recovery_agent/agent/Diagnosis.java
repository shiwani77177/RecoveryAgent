package com.example.recovery_agent.agent;

import com.example.recovery_agent.domain.enums.InterventionType;

public record Diagnosis(
        String rootCause,
        InterventionType recommendedAction,
        String channel,
        double confidence,
        String rationale
) {
    public boolean isConfident() {
        return confidence >= 0.6;
    }
    public boolean isTerminal() {
        return recommendedAction == InterventionType.ESCALATE
                || recommendedAction == InterventionType.ABANDON;
    }
}