package com.example.recovery_agent.api;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.recovery_agent.domain.RecoveryCase;
import com.example.recovery_agent.eval.EvalHarness;
import com.example.recovery_agent.eval.SyntheticDataGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/eval")
@CrossOrigin(origins = "*")
public class EvalController {

    private final SyntheticDataGenerator generator;
    private final EvalHarness harness;
    private final ObjectMapper mapper = new ObjectMapper();

    public EvalController(SyntheticDataGenerator generator, EvalHarness harness) {
        this.generator = generator;
        this.harness = harness;
    }

    @PostMapping("/generate")
    public Map<String, Object> generateTestCases() {
        List<RecoveryCase> cases = generator.generateAll();

        long recoverable = cases.stream()
                .filter(c -> Boolean.TRUE.equals(c.getTrulyRecoverable()))
                .count();

        return Map.of(
                "message", "Synthetic test cases generated successfully",
                "totalCases", cases.size(),
                "recoverable", recoverable,
                "unrecoverable", cases.size() - recoverable
        );
    }

    /** Original blocking endpoint (still works for Postman) */
    @PostMapping("/run")
    public EvalHarness.EvalReport runEval() {
        return harness.run();
    }

    /**
     * SSE streaming endpoint — sends progress events as each case is processed.
     * Frontend connects with EventSource to receive real-time updates.
     *
     * Events sent:
     *   - "progress" → {processed, total, pass, detail}
     *   - "result"   → full EvalReport JSON
     *   - "error"    → error message
     */
    @PostMapping(value = "/run/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter runEvalStreaming() {
        // 30 min timeout — Gemini 429 throttling can make a full run take
        // 10+ minutes (each throttled case adds 7s of backoff). The old 5 min
        // timeout was killing the stream mid-run, freezing the UI at ~80%.
        SseEmitter emitter = new SseEmitter(1_800_000L);

        emitter.onTimeout(emitter::complete);
        emitter.onError((ex) -> emitter.complete());

        new Thread(() -> {
            try {
                EvalHarness.EvalReport report = harness.run(progress -> {
                    try {
                        String json = mapper.writeValueAsString(progress);
                        emitter.send(SseEmitter.event()
                                .name("progress")
                                .data(json));
                    } catch (Exception e) {
                        // Client disconnected — ignore, keep processing server-side
                    }
                });

                // Send final result
                String reportJson = mapper.writeValueAsString(report);
                emitter.send(SseEmitter.event()
                        .name("result")
                        .data(reportJson));
                emitter.complete();

            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data("{\"message\":\"" + e.getMessage() + "\"}"));
                } catch (Exception ignored) {}
                emitter.completeWithError(e);
            }
        }).start();

        return emitter;
    }
}