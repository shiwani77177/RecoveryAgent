import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react";
import axios from "axios";

const SUGGESTIONS = [
  "What does this dashboard show?",
  "How does the recovery agent work?",
  "What is a payment link intervention?",
  "Why would a case get escalated?",
  "What does insufficient_funds mean?",
];

const CASE_SUGGESTIONS = [
  "Why was this case escalated?",
  "What interventions were tried?",
  "Is this case recoverable?",
  "Explain the audit trail for this case",
];

function Penny() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm Penny 💜 your AI recovery assistant. Ask me anything about your cases, the recovery process, or what the audit trail means!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const location = useLocation();

  const caseIdMatch = location.pathname.match(/\/cases\/([a-f0-9-]+)/);
  const currentCaseId = caseIdMatch ? caseIdMatch[1] : null;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await axios.post("/api/chat", {
        message: text.trim(),
        history: history,
        caseId: currentCaseId,
      });

      const reply =
        response.data.reply ||
        response.data.error ||
        "Sorry, I couldn't process that.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          timestamp: new Date(),
          quotaExceeded: response.data.quotaExceeded === true,
        },
      ]);
    } catch (error) {
      console.error("Penny chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting right now. Make sure the backend is running and your ANTHROPIC_API_KEY is set in the .env file. 🔧",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared! How can I help you? 😊",
        timestamp: new Date(),
      },
    ]);
  };

  const suggestions = currentCaseId ? CASE_SUGGESTIONS : SUGGESTIONS;
  const isQuotaExceeded = messages.some((m) => m.quotaExceeded);

  return (
    <>
      {/*Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
          title="Chat with Penny"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/*Chat Panel*/}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          {/* ── Header ── */}
          <div className="bg-violet-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">Penny</p>
                <p className="text-xs text-violet-200">AI Recovery Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-violet-500 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-violet-500 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentCaseId && (
            <div className="bg-violet-50 border-b border-violet-100 px-4 py-2 flex-shrink-0">
              <p className="text-xs text-violet-700">
                📋 Viewing case{" "}
                <span className="font-mono font-medium">
                  {currentCaseId.substring(0, 8)}…
                </span>{" "}
                — I can answer questions about this case!
              </p>
            </div>
          )}

          {/*Messages*/}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Quota exceeded — special card */}
                {msg.quotaExceeded ? (
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🪫</span>
                      <p className="text-sm font-semibold text-amber-800">
                        Penny's out of juice for today
                      </p>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-200">
                      <p className="text-[10px] text-amber-500">
                        🔄 Resets daily · Free tier: 20 requests/day
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-800 rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === "user"
                          ? "text-violet-200"
                          : "text-gray-400"
                      }`}
                    >
                      {msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/*Typing Indicator*/}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/*Suggested Questions*/}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-xs text-gray-400 mb-1.5">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1.5 rounded-full hover:bg-violet-100 transition-colors border border-violet-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/*Input bar*/}
          <div className="border-t border-gray-200 px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => !isQuotaExceeded && setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isQuotaExceeded
                  ? "Penny is resting — back tomorrow 🌙"
                  : "Ask Penny anything..."
              }
              disabled={isLoading || isQuotaExceeded}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading || isQuotaExceeded}
              className="w-9 h-9 bg-violet-600 text-white rounded-full flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Penny;
