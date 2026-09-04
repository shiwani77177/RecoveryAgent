package com.example.recovery_agent.recovery;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.domain.enums.CaseStatus;

public final class StoppingRules {

    //Maximum number of recovery attempts
    public static final int MAX_ATTEMPTS = 4;

    //Escalate to human
    public static final double CONFIDENCE_THRESHOLD = 0.6;

    //Backoff delays in seconds: immediate, 30min, 2hr, 24hr
    public static final long[] BACKOFF_SECONDS = {0, 1800, 7200, 86400};

    private StoppingRules() {}

    public static boolean canAttempt(RecoveryCase c) {
        if (c.getStatus() == CaseStatus.RECOVERED
                || c.getStatus() == CaseStatus.ESCALATED
                || c.getStatus() == CaseStatus.ABANDONED) {
            return false;
        }
        // Hit the attempt limit — stop
        return c.getAttemptCount() < MAX_ATTEMPTS;
    }

    //Time for next attempt
    public static long getBackoffSeconds(int attemptNumber) {
        if (attemptNumber < 0) return 0;
        if (attemptNumber >= BACKOFF_SECONDS.length) {
            return BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1];
        }
        return BACKOFF_SECONDS[attemptNumber];
    }
}

