# SINC Platform — Testing & Quality Assurance Suite

This directory contains the automated test suites, end-to-end verification scripts, performance runners, and integration tests for the SINC platform.

---

## 1. Directory Structure

```text
tests/
├── e2e/                               # End-to-End Browser Automation Tests (Playwright)
│   ├── verify_quick_2s_intro.cjs      # 10/10 test suite: 2s quick intro, 16.9s welcome, session reset
│   ├── verify_all_chat_layout_requirements.cjs # Chat layout, mobile DM viewports, real-time message bubbles
│   ├── verify_auth_welcome_flow.cjs   # Login, signup, password validation, welcome flow
│   ├── verify_sidebar_bottom_nav_master.cjs # Left sidebar desktop/mobile toggle and bottom nav
│   ├── verify_transparent_logo.cjs    # Official logo transparency and color blending
│   ├── verify_zoom_and_motion.cjs     # Accessibility, browser zoom (100%-200%), reduced motion
│   ├── verify_avatar_only_header.cjs  # Header layout and avatar dropdown interactions
│   ├── verify_master_ui_ux_optimization.cjs # Master UX, responsive layout across all breakpoints
│   ├── verify_master_auth_experience.cjs    # Master authentication transition tests
│   ├── e2e_dm_playwright_test.cjs     # Two-user live direct messaging verification
│   ├── e2e_two_accounts_test.js       # Cross-account live interaction test
│   ├── e2e_web_push_test.cjs          # VAPID encrypted web push notification end-to-end
│   └── playwright.config.js           # Playwright runner configuration
│
├── performance/                       # Query Benchmarks & Bundle Optimization Runners
│   ├── benchmark_queries.cjs          # Supabase SQL PostgREST query latency benchmarks
│   ├── perf_audit_runner.cjs          # Audit runner for real-time channels and query counts
│   └── perf_remediation_runner.cjs    # Remediation runner verifying sub-100ms render targets
│
├── integration/                       # Service & Database Integration Tests
│   ├── check_table_counts.cjs         # Database table row counts & integrity
│   ├── check_auth_counts.cjs          # Supabase auth users count
│   ├── setup_test_notifications.js    # Test notification fixture generator
│   ├── test_batch_interactions.cjs    # Batch like/bookmark PostgREST queries
│   ├── test_post_service_direct.cjs   # Direct post creation and pagination
│   └── test_push_subscription.cjs     # Web Push subscription registration check
│
└── README.md                          # This guide
```

---

## 2. Prerequisites

The test suites run using Node.js and Playwright against the local development server:

```bash
# 1. Start the local development server
npm run dev
# The dev server will listen on http://localhost:3000
```

---

## 3. Running Key Verification Suites

### A. SINC Intro & Session Lifecycle (10/10 Verification)
Verifies:
1. First-time visitors receive the 16.9-second welcome film with Skip button.
2. Returning authenticated visitors receive the 2-second quick animation without Skip button.
3. Tab reloads and route navigation inside the same tab suppress replaying.
4. Logging out calls `resetSincIntroSession()` and resets session storage.
5. Logging back in within the same tab triggers the 2-second quick animation.
6. Signed-out visitors on `/login` and `/signup` never trigger the intro.
7. Responsive viewports (390×844, 844×390, 768×1024, 1366×768, 1920×1080) and dynamic mid-animation rotation resize properly.
8. All six `sinc-piece-1..6.webp` logo assets load cleanly from `/sinc-intro/`.

```bash
node tests/e2e/verify_quick_2s_intro.cjs
```

### B. Chat & Layout Verification
```bash
node tests/e2e/verify_all_chat_layout_requirements.cjs
```

### C. Sidebar & Bottom Navigation Verification
```bash
node tests/e2e/verify_sidebar_bottom_nav_master.cjs
```

### D. Logo Transparency Verification
```bash
node tests/e2e/verify_transparent_logo.cjs
```

### E. Performance & Query Latency Benchmarks
```bash
node tests/performance/perf_remediation_runner.cjs
```
