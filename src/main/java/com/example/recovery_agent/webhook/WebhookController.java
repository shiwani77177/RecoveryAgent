package com.example.recovery_agent.webhook;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks")
public class WebhookController {

    private static final Logger log = LoggerFactory.getLogger(WebhookController.class);
    private final WebhookService webhookService;

    public WebhookController(WebhookService webhookService) {
        this.webhookService = webhookService;
    }

    /**
     * THE MAIN ENDPOINT — Razorpay calls this.
     *
     * @param rawBody            the raw JSON payload from Razorpay
     * @param razorpaySignature  the X-Razorpay-Signature header (HMAC-SHA256)
     * @return always 200 to prevent Razorpay from retrying
     */
    @PostMapping("/razorpay")
    public ResponseEntity<String> handleRazorpayWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String razorpaySignature) {

        log.info("Razorpay webhook received — {} bytes", rawBody.length());

        boolean handled = webhookService.handle(rawBody, razorpaySignature);

        if (handled) {
            return ResponseEntity.ok("Webhook processed");
        } else {
            // Still return 200 — see the WHY note above
            return ResponseEntity.ok("Webhook acknowledged but not processed");
        }
    }

    @PostMapping("/razorpay/test")
    public ResponseEntity<String> handleTestWebhook(@RequestBody String rawBody) {

        log.info("TEST webhook received — {} bytes (signature check SKIPPED)", rawBody.length());

        boolean handled = webhookService.handleWithoutSignatureCheck(rawBody);

        if (handled) {
            return ResponseEntity.ok("Test webhook processed — check your database!");
        } else {
            return ResponseEntity.ok("Test webhook failed — check the logs");
        }
    }
}


