package com.example.recovery_agent.domain.enums;

public enum Actor {
    AGENT,   // the LLM diagnosis agent
    SYSTEM,  // deterministic code (executor, scheduler, guardrails)
    HUMAN    // an operator via the dashboard
}
