import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

const EvalContext = createContext(null);

export function EvalProvider({ children }) {
  // Persistent state (survives page navigation)
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // {processed, total, pass, detail}
  const [logs, setLogs] = useState([]); // rolling last 8 log lines
  const [report, setReport] = useState(null); // final EvalReport

  // Store the current stream reader so we can abort if needed
  const readerRef = useRef(null);
  const abortRef = useRef(null);

  /** Start a streaming evaluation run */
  const startEval = useCallback(() => {
    // Prevent double-start
    if (running) return;

    setRunning(true);
    setProgress(null);
    setLogs([]);
    setReport(null);

    // AbortController lets us cancel the fetch if needed
    abortRef.current = new AbortController();

    fetch("/api/eval/run/stream", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("ra_token") || ""}`,
      },
      signal: abortRef.current.signal,
    })
      .then((response) => {
        const reader = response.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        function read() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                setRunning(false);
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const jsonStr = line.substring(5).trim();
                  if (!jsonStr) continue;

                  try {
                    const parsed = JSON.parse(jsonStr);

                    if (
                      parsed.processed !== undefined &&
                      parsed.total !== undefined
                    ) {
                      // Progress event
                      setProgress(parsed);
                      setLogs((prev) => {
                        const next = [...prev, parsed.detail];
                        return next.slice(-8);
                      });
                    } else if (parsed.agentRecoveryRate !== undefined) {
                      // Final result
                      setReport(parsed);
                      setRunning(false);
                    }
                  } catch {
                    // ignore non-JSON lines
                  }
                }
              }

              read();
            })
            .catch(() => {
              setRunning(false);
            });
        }

        read();
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Eval stream error:", err);
        }
        setRunning(false);
      });
  }, [running]);

  /** Clear all eval state (e.g. after user dismisses result) */
  const clearEval = useCallback(() => {
    setProgress(null);
    setLogs([]);
    setReport(null);
  }, []);

  const value = {
    running,
    progress,
    logs,
    report,
    startEval,
    clearEval,
  };

  return <EvalContext.Provider value={value}>{children}</EvalContext.Provider>;
}

export function useEval() {
  const ctx = useContext(EvalContext);
  if (!ctx) throw new Error("useEval must be used inside <EvalProvider>");
  return ctx;
}
