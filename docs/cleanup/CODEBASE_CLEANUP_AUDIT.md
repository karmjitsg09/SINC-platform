# SINC PLATFORM — CODEBASE CLEANUP & RESTRUCTURING AUDIT

**Audit Date**: October 2026  
**Project**: SINC Platform (Technology & Developer Network)  
**Document Status**: Phase 1 Initial Inventory & Architectural Plan  
**Target Environment**: React 18, Vite 5, Supabase (PostgreSQL + Realtime + Edge Functions), Vercel

---

## 1. Executive Summary

A comprehensive, read-only audit of the entire SINC platform codebase was conducted to evaluate architecture, code quality, file placement, security, and maintainability.

### Current State Findings
1. **Root Directory Clutter**:
   - The root contains **22 raw SQL schema files** (`supabase_*.sql`) alongside configuration files.
   - User-supplied raw high-resolution design assets (`Glossy Blue SINC Corporate Emblem.png`, `Glossy Blue Triadic Connection Emblem(1).png`) reside in the root.
   - Temporary upload folders (`sinc-intro-files/`) and test asset folders (`scratch_test_assets/`) exist at the root.
   - Test scripts, benchmark runners, reports, and generated screenshot artifacts (90+ files) are concentrated in `website_testing/`, which also includes an unneeded nested `package.json` and `node_modules/`.
2. **Frontend Redundancies & Dead Code**:
   - `src/components/SincLogo.jsx` (45 B) is a dead re-export of `src/components/common/SincLogo.jsx`. No component imports it.
   - `src/components/Header.jsx` (2,644 B) is a legacy header superseded by `src/components/TopHeader.jsx`.
   - `src/components/LeftRail.jsx` (1,011 B) is an unused thin wrapper around `src/components/DomainShortcutRail.jsx`.
   - `src/components/common/SincLogoSplash.jsx` (825 B) is an obsolete intermediate loader superseded by `src/lib/sinc-intro.js`.
   - Duplicate CSS rules for `.sinc-logo-splash` exist at multiple positions in `src/index.css`.
   - `src/notifications/components/NotificationBadge.jsx` is unreferenced.
   - `src/notifications/components/NotificationPanel.jsx` is an obsolete modal panel unreferenced by any active view.
3. **Backend & Database Assets**:
   - Active canonical migrations exist in `supabase/migrations/` (`20261016_protect_user_private_details.sql`, `20261020_web_push_subscriptions.sql`).
   - The 22 root-level SQL files represent modular schema definitions, recovery scripts, triggers, and migrations that belong in organized backend schema directories.
4. **Documentation & Reports**:
   - High-value architectural audit reports (`SINC_PERFORMANCE_REALTIME_AUDIT.md`, `SINC_PERFORMANCE_REMEDIATION_REPORT.md`, `SINC_AUTH_WELCOME_ANIMATION_FINAL_REPORT.md`) are currently scattered inside `website_testing/`.
   - Design reference screenshots are placed in root `figma design/`.

---

## 2. Complete Filesystem Inventory

### 2.1 Root Level Files & Directories

| Item | Type | Size / Items | Purpose & Role | Action |
|---|---|---|---|---|
| `.env` | File | 664 B | Local environment secrets (Supabase URL, VAPID keys) | **Category A**: Keep private; never expose |
| `.env.example` | File | 752 B | Safe configuration template with placeholders | **Category A**: Keep at root |
| `.gitignore` | File | 290 B | Git ignore rules | **Category A**: Keep at root; expand to cover reports/caches |
| `.supabase_home/` | Dir | Cache files | Supabase CLI local home/cache | **Category D**: Preserve for CLI compatibility |
| `dist/` | Dir | Build output | Vite production build output | **Category D**: Safe to recreate via `npm run build` |
| `figma design/` | Dir | 15 files | Design reference screenshots for UI verification | **Category F**: Move to `docs/design/` |
| `Glossy Blue SINC Corporate Emblem.png` | File | 734 KB | Source emblem asset provided by user | **Category F**: Move to `docs/design/branding/` |
| `Glossy Blue Triadic Connection Emblem(1).png` | File | 1.15 MB | Source official emblem asset provided by user | **Category F**: Move to `docs/design/branding/` |
| `index.html` | File | 1,675 B | Single-page application entry HTML | **Category A**: Frontend entry point |
| `node_modules/` | Dir | Dependencies | Installed npm dependencies | **Category A**: Preserve strictly |
| `package.json` | File | 578 B | Project manifest, dependencies, and build scripts | **Category A**: Keep at root |
| `package-lock.json` | File | 94 KB | Lockfile ensuring reproducible dependency tree | **Category A**: Keep at root |
| `public/` | Dir | 11 files | Static assets (`favicon.svg`, `sw.js`, `images/`, `sinc-intro/`) | **Category A**: Frontend public directory |
| `README.md` | File | 3,203 B | Project documentation and architecture guide | **Category A**: Update with comprehensive docs |
| `scratch_test_assets/` | Dir | 6 files | Test dummy SVG files used during manual media upload checks | **Category D/E**: Safe to remove or archive |
| `sinc-intro-files/` | Dir | 3 files | Temporary uploaded zip extraction folder | **Category E**: Obsolete duplicate; active files are in `src/lib/` and `public/` |
| `src/` | Dir | 86 files | Frontend React application source code | **Category A**: Active frontend application |
| `supabase/` | Dir | 3 files | Active Supabase migrations, Edge function, and RLS audit | **Category B**: Backend Supabase directory |
| `supabase_*.sql` (22 files) | Files | ~100 KB total | Modular database schema definitions, triggers, and RLS policies | **Category B**: Move to `backend/schemas/` |
| `vercel.json` | File | 1,268 B | Production routing rewrites and HTTP security headers | **Category A**: Keep at root |
| `vite.config.js` | File | 3,371 B | Vite build, React plugin, chunks, and dev push server | **Category A**: Keep at root |
| `website_testing/` | Dir | 90 files | Test suites, benchmarks, temporary debug scripts, reports | **Category C/D/E**: Reorganize into `tests/` and `reports/` |

---

## 3. Classification of Every File

### Category A — Required Application Files (Preserve & Maintain)
- **App Entry**: `index.html`, `src/main.jsx`, `src/App.jsx`.
- **Core Configuration**: `package.json`, `package-lock.json`, `vite.config.js`, `vercel.json`, `.env`, `.env.example`, `.gitignore`.
- **Active Pages (25)**:
  - `Feed.jsx`, `DomainList.jsx`, `Domain.jsx`, `DomainChat.jsx`, `MessagesList.jsx`, `MessageDetail.jsx`, `MessagesPage.jsx`, `PostView.jsx`, `Search.jsx`, `Profile.jsx`, `Notifications.jsx`, `Login.jsx`, `SignUp.jsx`.
  - Lazy-loaded: `Settings.jsx`, `ProfileDetails.jsx`, `ProfileMenu.jsx`, `SavedPosts.jsx`, `ProjectsPage.jsx`, `ExperiencePage.jsx`, `EducationPage.jsx`, `CertificationsPage.jsx`, `AchievementsPage.jsx`, `ItemUpdatesPage.jsx`, `CreatePost.jsx`, `UpdateStoryViewer.jsx`, `ForgotPassword.jsx`.
- **Active Navigation & Layouts**:
  - `src/components/TopHeader.jsx` (canonical header).
  - `src/components/SidebarNavigation.jsx` (canonical left navigation sidebar).
  - `src/components/BottomNav.jsx` (canonical mobile bottom navigation).
  - `src/components/DomainShortcutRail.jsx` (canonical domain shortcut vertical rail).
- **Active Common Components**:
  - `src/components/common/SincLogo.jsx` (canonical logo component rendering transparent PNG).
  - `src/components/common/SincIntro.jsx` (active client watcher for 2s quick intro / 16.9s welcome film).
- **Active Profile & Modal Components**:
  - `AchievementModal.jsx`, `CertificationModal.jsx`, `EducationModal.jsx`, `ExperienceModal.jsx`, `ProjectModal.jsx`.
  - `ProfileEditModal.jsx`, `LocationSelector.jsx`, `SkillMultiSelect.jsx`, `ProfileSetupWizard.jsx`.
  - `ProfileHeader.jsx`, `ProfileAbout.jsx`, `ProfileSkills.jsx`, `ProfileDomains.jsx`, `ProfileProjects.jsx`, `ProfileExperience.jsx`, `ProfileEducation.jsx`, `ProfileCertifications.jsx`, `ProfileAchievements.jsx`.
  - `ProfileFollowersModal.jsx`, `ProfileFollowingModal.jsx`.
  - `ProfileItemPostModal.jsx`, `ProfileItemPostEmbed.jsx`, `ProfileItemUpdateModal.jsx`, `ProfileItemUpdatesSnippet.jsx`.
- **Active Post & Interaction Components**:
  - `PostMedia.jsx`, `PostCardInteractions.jsx`, `PostInsightsModal.jsx`, `PostLikersModal.jsx`, `QuickPostComposer.jsx`, `UpdatesStories.jsx`, `InAppShareModal.jsx`, `RejectFollowRequestModal.jsx`.
- **Active Search & Widget Components**:
  - `SearchInput.jsx`, `SearchModeSelector.jsx`, `ProfileSearchResults.jsx`, `DomainSearchResults.jsx`, `JobSearchResults.jsx`, `EmptySearchState.jsx`, `WhoToFollowWidget.jsx`, `TrendingTopicsWidget.jsx`.
- **Active Auth Components**:
  - `AuthButton.jsx`, `AuthInput.jsx`, `PasswordInput.jsx`, `GoogleSignInButton.jsx`.
- **Active Notifications & Messaging**:
  - `src/notifications/components/NotificationItem.jsx`.
  - `src/messaging/hooks/` (`useConversations.js`, `useMessages.js`, `usePresence.js`).
  - `src/messaging/services/` (`conversationService.js`, `domainMessageService.js`, `messageService.js`, `presenceService.js`, `realtimeService.js`).
- **Active Services & Libs**:
  - `supabase.js`, `sinc-intro.js`, `sinc-intro.d.ts`, `routeUtils.js`, `profileService.js`, `postService.js`, `postInteractionService.js`, `socialService.js`, `pushNotificationService.js`, `serverPushDispatcher.cjs`, `locationService.js`, `passwordPolicy.js`, `domainUtils.js`, `savedPostsService.js`, `updatesService.js`, `achievementService.js`, `certificationService.js`, `educationService.js`, `experienceService.js`, `projectService.js`, `blockService.js`, `profileItemPostService.js`, `profileItemUpdateService.js`.
- **Active Contexts & Styles**:
  - `AuthContext.jsx`, `ThemeContext.jsx`, `src/index.css`.
- **Public Assets**:
  - `public/favicon.svg`, `public/sw.js`.
  - `public/images/sinc-official-logo-transparent.png`, `public/images/sinc-corporate-logo.png`, `public/images/sinc-official-logo.png`.
  - `public/sinc-intro/sinc-piece-1..6.webp`.

---

### Category B — Required Backend & Database Resources (Organize under `backend/`)
- **Active Migrations**:
  - `supabase/migrations/20261016_protect_user_private_details.sql` (PII column protection, `user_private_details` table, RLS isolation).
  - `supabase/migrations/20261020_web_push_subscriptions.sql` (`push_subscriptions` table, indexes, preferences).
- **Edge Functions**:
  - `supabase/functions/send-web-push/index.ts` (Deno Edge Function delivering encrypted Web Push notifications).
- **Audit & Security**:
  - `supabase/rls-audit.sql` (Read-only RLS diagnostic script).
- **Modular Schema Definitions (to be placed in `backend/schemas/`)**:
  - `supabase_schema.sql` (Core foundational tables).
  - `supabase_posts_schema.sql` (Posts, media, like/comment counts).
  - `supabase_messaging_schema.sql` (Direct conversations & messages).
  - `supabase_notifications_schema.sql` (In-app notifications).
  - `supabase_profile_sections_schema.sql` (Experience, education, certifications, achievements, projects).
  - `supabase_social_interactions_schema.sql` (Post likes, bookmarks, comments, shares, follow requests).
  - `supabase_auth_trigger.sql` (Auto profile creation trigger on signup).
  - `supabase_blocked_users_schema.sql` (User blocking and moderation).
  - `supabase_domain_messages_migration.sql` (Domain channel chat messaging).
  - `supabase_onboarding_schema.sql` (Profile onboarding progress tracking).
  - `supabase_post_insights_rls.sql` (Post analytics security policies).
  - `supabase_post_media_migration.sql` (Post attachments & storage policies).
  - `supabase_profile_item_updates_schema.sql` (Milestone updates on profile items).
  - `supabase_updates_schema.sql` (Ephemeral 24h stories/updates).
  - `supabase_location_schema.sql` (Geographic location fields).
  - `supabase_achievements_schema.sql`, `supabase_certifications_schema.sql`, `supabase_education_schema.sql`, `supabase_experience_schema.sql`, `supabase_projects_schema.sql`.

---

### Category C — Useful Tests & Verification Tools (Organize under `tests/`)
- **Master Regression & E2E Suites**:
  - `verify_quick_2s_intro.cjs` -> `tests/e2e/verify_quick_2s_intro.cjs` (10/10 test verification of 2s intro, 16.9s welcome, reset on logout, reload suppression).
  - `verify_all_chat_layout_requirements.cjs` -> `tests/e2e/verify_all_chat_layout_requirements.cjs`.
  - `verify_auth_welcome_flow.cjs` -> `tests/e2e/verify_auth_welcome_flow.cjs`.
  - `verify_sidebar_bottom_nav_master.cjs` -> `tests/e2e/verify_sidebar_bottom_nav_master.cjs`.
  - `verify_transparent_logo.cjs` -> `tests/e2e/verify_transparent_logo.cjs`.
  - `verify_zoom_and_motion.cjs` -> `tests/e2e/verify_zoom_and_motion.cjs`.
  - `verify_avatar_only_header.cjs` -> `tests/e2e/verify_avatar_only_header.cjs`.
  - `verify_master_ui_ux_optimization.cjs` -> `tests/e2e/verify_master_ui_ux_optimization.cjs`.
  - `verify_master_auth_experience.cjs` -> `tests/e2e/verify_master_auth_experience.cjs`.
  - `e2e_dm_playwright_test.cjs` -> `tests/e2e/e2e_dm_playwright_test.cjs`.
  - `e2e_two_accounts_test.js` -> `tests/e2e/e2e_two_accounts_test.js`.
  - `e2e_web_push_test.cjs` -> `tests/e2e/e2e_web_push_test.cjs`.
- **Integration & Performance Tests**:
  - `perf_remediation_runner.cjs` -> `tests/performance/perf_remediation_runner.cjs`.
  - `perf_audit_runner.cjs` -> `tests/performance/perf_audit_runner.cjs`.
  - `benchmark_queries.cjs` -> `tests/performance/benchmark_queries.cjs`.
  - `check_table_counts.cjs` -> `tests/integration/check_table_counts.cjs`.
  - `check_auth_counts.cjs` -> `tests/integration/check_auth_counts.cjs`.
  - `setup_test_notifications.js` -> `tests/integration/setup_test_notifications.js`.

---

### Category D — Generated Files & Artifacts (Disposable or Recreated)
- `dist/`: Vite build artifacts (recreated via `npm run build`).
- `website_testing/node_modules/`: Nested dependencies duplicating root node_modules.
- `website_testing/package.json` & `website_testing/package-lock.json`: Nested redundant test package manifests.
- Temporary screenshots in `website_testing/` (e.g. `account_a_sent_verified.png`, `current_layout_*.png`, `debug_click_result.png`, `verified_*.png`).

---

### Category E — Duplicates & Obsolete Implementations (Remove Safely)
1. `src/components/SincLogo.jsx` (45 B): Dead re-export. All consumers import `src/components/common/SincLogo.jsx`.
2. `src/components/Header.jsx` (2,644 B): Superseded by `TopHeader.jsx`.
3. `src/components/LeftRail.jsx` (1,011 B): Superseded by direct usage of `DomainShortcutRail.jsx`.
4. `src/components/common/SincLogoSplash.jsx` (825 B): Obsolete splash loader replaced by `sinc-intro.js`.
5. Duplicate CSS blocks in `src/index.css`: Lines 1384–1455 and 9478–9525 defining `.sinc-logo-splash`.
6. `sinc-intro-files/`: Temporary folder containing duplicate intro assets already installed in `src/lib/` and `public/sinc-intro/`.
7. `scratch_test_assets/`: Temporary SVGs from manual tests.
8. One-off ad-hoc debugging scripts in `website_testing/` (`check_vis.cjs`, `check_children.cjs`, `check_profiles_queries.cjs`, `debug_feed.cjs`, `debug_message_click.cjs`, `debug_profile_click.cjs`, `test_click_user_b.cjs`, `inspect_chat_overlap.cjs`, `inspect_posts.cjs`, `eval_conv_service.cjs`, `reproduce_dm_failure.cjs`).

---

### Category F — Unknown or Important Assets (Preserve in Documentation Archive)
- Root source emblems:
  - `Glossy Blue SINC Corporate Emblem.png` -> Move to `docs/design/branding/`
  - `Glossy Blue Triadic Connection Emblem(1).png` -> Move to `docs/design/branding/`
- Figma reference screenshots:
  - `figma design/` -> Move to `docs/design/figma/`
- Audit and benchmark markdown reports:
  - `website_testing/SINC_*.md` -> Move to `reports/`

---

## 4. Proposed Clean Architecture

```text
SINC-platform/
│
├── src/                               # Clean Frontend Application Source
│   ├── components/                    # Reusable React UI Components
│   │   ├── auth/                      # Authentication Controls & Inputs
│   │   ├── common/                    # SincLogo, SincIntro
│   │   ├── layout/                    # TopHeader, SidebarNavigation, BottomNav, DomainShortcutRail
│   │   ├── messaging/                 # ChatInput
│   │   ├── posts/                     # PostMedia, PostInteractions, QuickPostComposer, etc.
│   │   ├── profile/                   # Profile modals, sections, setup wizard
│   │   └── widgets/                   # TrendingTopics, WhoToFollow
│   ├── context/                       # AuthContext, ThemeContext
│   ├── data/                          # Mock Data, Skills Data
│   ├── lib/                           # Frontend Services, Utilities, Sinc Intro Engine
│   ├── messaging/                     # Messaging Hooks & Services
│   ├── notifications/                 # Notifications Hooks & Services
│   ├── pages/                         # Core Route Pages (Feed, Profile, Search, Chat, etc.)
│   ├── App.jsx                        # Application Shell & Route Resolver
│   ├── main.jsx                       # React DOM Root Entry
│   └── index.css                      # Unified Design System & Styles
│
├── public/                            # Static Public Assets
│   ├── favicon.svg
│   ├── sw.js                          # Service Worker for Push Notifications
│   ├── images/                        # Production Logo Images (transparent PNGs)
│   └── sinc-intro/                    # 6 Logo Pieces for 2s/16.9s Intro Canvas
│
├── backend/                           # Backend & Database Resources
│   ├── supabase/                      # Supabase Configuration & Migrations
│   │   ├── migrations/                # Canonical Production Migrations
│   │   └── functions/                 # Deno Edge Functions (send-web-push)
│   ├── schemas/                       # Canonical Modular SQL Schemas
│   ├── database/                      # RLS Audits & Recovery Scripts
│   └── README.md                      # Backend Architecture Documentation
│
├── tests/                             # Organized Test Suites & Verification
│   ├── e2e/                           # Playwright E2E Tests (Auth, Intro, Chat, Responsive)
│   ├── integration/                   # Database & Notification Integration Checks
│   ├── performance/                   # Query & Bundle Performance Runners
│   └── README.md                      # Test Execution Documentation
│
├── docs/                              # Comprehensive Documentation & Design Assets
│   ├── architecture/                  # Architecture & Security Documentation
│   ├── cleanup/                       # Audit Reports & Restructuring Logs
│   └── design/                        # Figma Screenshots & Source Branding Logos
│
├── reports/                           # Historical Audit & Benchmark Reports
│
├── scripts/                           # Maintenance & Verification Scripts
│
├── .env                               # Local Secrets (ignored by Git)
├── .env.example                       # Sanitized Configuration Template
├── .gitignore                         # Project Git Ignore Specification
├── index.html                         # SPA HTML Entry
├── package.json                       # Root Manifest & Dependency Definition
├── package-lock.json                  # Deterministic Lockfile
├── vercel.json                        # Vercel Production Routing & Security Headers
├── vite.config.js                     # Vite Build & Development Server Config
└── README.md                          # Master Project Overview
```

---

## 5. Safe Step-by-Step Execution Plan

To eliminate risk of breaking imports, builds, or deployment compatibility, execution will proceed in verified phases:

1. **Step 1: Backend Organization**:
   - Create `backend/schemas/` and move the 22 root `supabase_*.sql` files into it.
   - Create `backend/database/` and link/place `supabase/rls-audit.sql`.
   - Ensure `supabase/migrations/` and `supabase/functions/` remain discoverable by Supabase CLI.
   - Create `backend/README.md`.
2. **Step 2: Documentation & Design Asset Organization**:
   - Create `docs/design/branding/` and move root emblem PNG files into it.
   - Move `figma design/` into `docs/design/figma/`.
   - Create `docs/architecture/` and update project documentation.
3. **Step 3: Reports & Test Suite Organization**:
   - Create `reports/` and move the 6 historical audit `.md` and `.json` reports from `website_testing/` into `reports/`.
   - Create `tests/e2e/`, `tests/integration/`, `tests/performance/`.
   - Move reusable verification suites into `tests/` and update relative paths (e.g. paths to `src/` and `public/`).
   - Remove redundant nested `website_testing/node_modules/`, `website_testing/package.json`, and one-off debug scripts.
4. **Step 4: Frontend Dead Code Removal**:
   - Remove dead re-export `src/components/SincLogo.jsx`.
   - Remove unused legacy `src/components/Header.jsx`.
   - Remove unused wrapper `src/components/LeftRail.jsx`.
   - Remove unused splash component `src/components/common/SincLogoSplash.jsx`.
   - Remove unreferenced `src/notifications/components/NotificationBadge.jsx` and `NotificationPanel.jsx`.
   - Remove duplicated `.sinc-logo-splash` CSS blocks in `src/index.css`.
   - Remove `sinc-intro-files/` and `scratch_test_assets/`.
5. **Step 5: Verification & Validation**:
   - Run production build `npm run build` to confirm zero broken imports or bundle errors.
   - Run the 10/10 SINC intro verification suite in `tests/e2e/verify_quick_2s_intro.cjs`.
   - Verify browser runtime, login, navigation, feed, and messaging.
6. **Step 6: Reporting**:
   - Generate `CODEBASE_CLEANUP_FINAL_REPORT.md` and `CODEBASE_FILE_MANIFEST.json`.
   - Update `README.md`.
