package com.example.recovery_agent.domain.enums;

public enum CaseStatus {
    DETECTED,     // just created, not yet touched
    DIAGNOSING,   // LLM is figuring out what to do
    EXECUTING,    // executor is running the chosen intervention
    WAITING,      // waiting for a scheduled retry
    RECOVERED,    // money is back
    ESCALATED,    // handed off to a human
    ABANDONED     // stopping rule fired, giving up
}
