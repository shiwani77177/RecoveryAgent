package com.example.recovery_agent.chat;

public class ChatResponse {

    private String reply;
    private String error;
    private boolean quotaExceeded;

    public ChatResponse() {}

    public ChatResponse(String reply) {
        this.reply = reply;
        this.error = null;
        this.quotaExceeded = false;
    }

    public static ChatResponse error(String errorMessage) {
        ChatResponse r = new ChatResponse();
        r.error = errorMessage;
        r.reply = null;
        r.quotaExceeded = false;
        return r;
    }

    public static ChatResponse quota(String message) {
        ChatResponse r = new ChatResponse();
        r.reply = message;
        r.quotaExceeded = true;
        r.error = null;
        return r;
    }

    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public boolean isQuotaExceeded() { return quotaExceeded; }
    public void setQuotaExceeded(boolean quotaExceeded) { this.quotaExceeded = quotaExceeded; }
}

