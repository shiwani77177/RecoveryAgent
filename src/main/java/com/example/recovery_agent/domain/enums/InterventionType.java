package com.example.recovery_agent.domain.enums;

public enum InterventionType {
    SMART_RETRY,       // attempt 1: retry the charge on the same rail
    PAYMENT_LINK,      // attempt 2: send email payment link (card rail)
    UPI_FALLBACK,      // attempt 3: switch to UPI rail via SMS
    WHATSAPP_LINK,     // attempt 4: last resort — WhatsApp payment link (highest open rate)
    ALT_METHOD,        // suggest a different payment method
    DUNNING_MESSAGE,   // send a reminder / nudge
    ESCALATE,          // hand off to a human
    ABANDON            // stop trying
}

