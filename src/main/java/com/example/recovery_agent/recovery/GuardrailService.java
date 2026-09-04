package com.example.recovery_agent.recovery;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.example.recovery_agent.agent.Diagnosis;
import com.example.recovery_agent.domain.RecoveryCase;

//Checkpost before AI starts executing
@Service
public class GuardrailService {

    private static final Logger log = LoggerFactory.getLogger(GuardrailService.class);

    /** Maximum amount of recovery actions per day */
    private static final BigDecimal DAILY_SPEND_CAP = new BigDecimal("10000000");

    /** Maximum messages to a single customer per day */
    private static final int MAX_CUSTOMER_CONTACTS_PER_DAY = 3;

    private final StringRedisTemplate redis;

    public GuardrailService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    //Main check
    public String check(RecoveryCase c, Diagnosis diagnosis) {

        //Idempotency
        String idempotencyKey = "recovery:" + c.getId() + ":attempt:" + (c.getAttemptCount() + 1);
        if (Boolean.TRUE.equals(redis.hasKey(idempotencyKey))) {
            return "Idempotency check failed — attempt " + (c.getAttemptCount() + 1)
                    + " already executed for case " + c.getId();
        }

        //Daily spending
        BigDecimal todaySpend = getTodaySpend();
        if (todaySpend.add(c.getAmount()).compareTo(DAILY_SPEND_CAP) > 0) {
            return "Daily spend cap reached — ₹" + todaySpend + " already spent today"
                    + " (cap: ₹" + DAILY_SPEND_CAP + "). Blocking ₹" + c.getAmount() + " action.";
        }

        //Customer contact rate limit
        if (diagnosis.channel() != null) {
            int contactsToday = getCustomerContactsToday(c.getCustomerId());
            if (contactsToday >= MAX_CUSTOMER_CONTACTS_PER_DAY) {
                return "Customer " + c.getCustomerId() + " already contacted "
                        + contactsToday + " times today (max " + MAX_CUSTOMER_CONTACTS_PER_DAY + ")";
            }
        }

        //Checks passed
        log.debug("Guardrails passed for case [{}]", c.getId());
        return null;
    }

    //After Execution
    public void recordExecution(RecoveryCase c) {
        String today = LocalDate.now().toString();

        // Mark this attempt as done (idempotency)
        String idempotencyKey = "recovery:" + c.getId() + ":attempt:" + c.getAttemptCount();
        redis.opsForValue().set(idempotencyKey, "done", Duration.ofHours(48));

        // Add to today's spend total
        String spendKey = "spend:daily:" + today;
        redis.opsForValue().increment(spendKey, c.getAmount().longValue());
        redis.expire(spendKey, Duration.ofHours(48));

        // Increment customer contact count
        if (c.getCustomerId() != null) {
            String contactKey = "contacts:" + c.getCustomerId() + ":" + today;
            redis.opsForValue().increment(contactKey);
            redis.expire(contactKey, Duration.ofHours(48));
        }
    }

    //Helpers
    private BigDecimal getTodaySpend() {
        String spendKey = "spend:daily:" + LocalDate.now().toString();
        String val = redis.opsForValue().get(spendKey);
        return val != null ? new BigDecimal(val) : BigDecimal.ZERO;
    }

    private int getCustomerContactsToday(String customerId) {
        if (customerId == null) return 0;
        String contactKey = "contacts:" + customerId + ":" + LocalDate.now().toString();
        String val = redis.opsForValue().get(contactKey);
        return val != null ? Integer.parseInt(val) : 0;
    }
}


