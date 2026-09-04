package com.example.recovery_agent.auth;

import com.example.recovery_agent.domain.AppUser;
import com.example.recovery_agent.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AppUserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(AppUserRepository userRepo,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    // ── REGISTER ──
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (userRepo.existsByEmail(req.email())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Email already registered"));
        }

        AppUser user = new AppUser();
        user.setEmail(req.email());
        user.setFullName(req.fullName());
        user.setPassword(passwordEncoder.encode(req.password()));
        userRepo.save(user);

        String token = jwtUtil.generate(user.getEmail());
        return ResponseEntity.ok(Map.of(
                "token", token,
                "email", user.getEmail(),
                "fullName", user.getFullName(),
                "setupDone", false
        ));
    }

    // ── LOGIN ──
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        AppUser user = userRepo.findByEmail(req.email()).orElse(null);

        if (user == null || !passwordEncoder.matches(req.password(), user.getPassword())) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Invalid email or password"));
        }

        String token = jwtUtil.generate(user.getEmail());
        return ResponseEntity.ok(Map.of(
                "token", token,
                "email", user.getEmail(),
                "fullName", user.getFullName() != null ? user.getFullName() : "",
                "setupDone", user.isSetupDone()
        ));
    }

    // ── SETUP (UPI / Bank details) ──
    @PostMapping("/setup")
    public ResponseEntity<?> setup(@RequestBody SetupRequest req, Principal principal) {
        AppUser user = userRepo.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setUpiId(req.upiId());
        user.setBankAccount(req.bankAccount());
        user.setIfscCode(req.ifscCode());
        user.setSetupDone(true);
        userRepo.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Setup complete",
                "setupDone", true
        ));
    }

    // ── ME (get current user info) ──
    @GetMapping("/me")
    public ResponseEntity<?> me(Principal principal) {
        AppUser user = userRepo.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(Map.of(
                "email", user.getEmail(),
                "fullName", user.getFullName() != null ? user.getFullName() : "",
                "upiId", user.getUpiId() != null ? user.getUpiId() : "",
                "bankAccount", user.getBankAccount() != null ? user.getBankAccount() : "",
                "ifscCode", user.getIfscCode() != null ? user.getIfscCode() : "",
                "setupDone", user.isSetupDone()
        ));
    }

    // ── Request classes ──
    static class RegisterRequest {
        @com.fasterxml.jackson.annotation.JsonProperty("email")
        private String email;
        @com.fasterxml.jackson.annotation.JsonProperty("password")
        private String password;
        @com.fasterxml.jackson.annotation.JsonProperty("fullName")
        private String fullName;
        public String email() { return email; }
        public String password() { return password; }
        public String fullName() { return fullName; }
    }

    static class LoginRequest {
        @com.fasterxml.jackson.annotation.JsonProperty("email")
        private String email;
        @com.fasterxml.jackson.annotation.JsonProperty("password")
        private String password;
        public String email() { return email; }
        public String password() { return password; }
    }

    static class SetupRequest {
        @com.fasterxml.jackson.annotation.JsonProperty("upiId")
        private String upiId;
        @com.fasterxml.jackson.annotation.JsonProperty("bankAccount")
        private String bankAccount;
        @com.fasterxml.jackson.annotation.JsonProperty("ifscCode")
        private String ifscCode;
        public String upiId() { return upiId; }
        public String bankAccount() { return bankAccount; }
        public String ifscCode() { return ifscCode; }
    }
}

