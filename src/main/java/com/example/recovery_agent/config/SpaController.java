package com.example.recovery_agent.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Forwards all non-API, non-static requests to index.html
 * so React Router can handle client-side routing.
 *
 * BUG FIX: Previously missing "/profile" — direct URL access
 * (bookmark, refresh on profile page) returned 404.
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
        "/login",
        "/register",
        "/setup",
        "/cases",
        "/cases/**",
        "/metrics",
        "/audit",
        "/profile"    // ← FIX: was missing
    })
    public String forward(HttpServletRequest request) {
        return "forward:/index.html";
    }
}