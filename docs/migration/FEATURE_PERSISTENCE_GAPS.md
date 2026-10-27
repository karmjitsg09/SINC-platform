# SINC Platform: Feature Persistence Gaps Audit

**Date:** 2026-10-25  
**Scope:** Complete catalog of features referencing missing tables or columns in production database  
**Ordering:** Most user-visible and security-critical first  

---

## Executive Summary

When inspecting production PostgreSQL (`aws-0-ap-northeast-1.pooler.supabase.com`), only 14 core tables exist in the `public` schema (`profiles`, `posts`, `post_comments`, `post_likes`, `post_saves`, `post_shares`, `updates`, `update_views`, `follow_requests`, `conversations`, `conversation_members`, `messages`, `message_status`, `notifications`).

Many frontend services and server routes were developed with local mock fallbacks or client-side `localStorage` caching to function before backend migrations were applied. As a result, critical user features currently exhibit **silent client-side containment**—data appears to save on the user's current device, but is never persisted remotely, causing multi-device desynchronization, blank public profiles, and ephemeral data loss.

---

## Top Feature Persistence Gaps

### 1. Profile Sections (Projects, Experience, Education, Certifications, Achievements)
- **Missing Tables:** `profile_projects`, `profile_experience`, `profile_education`, `profile_certifications`, `profile_achievements`
- **Referencing Code:** `src/lib/profileService.ts` (lines 188-235, 270-345)
- **Current Behavior:** Tries `supabase.from('profile_*')`. When query fails, catches error and falls back to `localStorage.getItem(getStorageKey(userId))`.
- **User Impact:** **Severe.** A user filling out their projects, work history, and degrees can see them in their own browser via `localStorage`. However, **any other user viewing their profile sees completely blank sections**, because `localStorage` is not shared across users.

---

### 2. Domain Community Discussions (Channel Messages)
- **Missing Table:** `domain_messages`
- **Referencing Code:** `src/messaging/services/domainMessageService.ts` (lines 78-115, 195-240), `src/views/DomainChat.tsx`
- **Current Behavior:** Attempts to query and insert into `domain_messages`. On failure, logs a warning, saves messages into `localStorage`, and broadcasts over ephemeral Supabase Realtime channel.
- **User Impact:** **High.** Domain channel chat history is ephemeral. Messages only reach active users currently viewing the channel; upon browser reload or switching devices, chat history is completely empty.

---

### 3. User Blocking & Safety (Bidirectional Social Blocks)
- **Missing Table:** `blocked_users`
- **Referencing Code:** `src/lib/blockService.ts` (lines 78-115, 164-210), `src/lib/serverAuth.ts`
- **Current Behavior:** Attempts to query `blocked_users`. On DB error, falls back to `localStorage.getItem('sync_blocked_users_' + userId)`.
- **User Impact:** **High / Safety Critical.** Blocks are client-local to that specific browser device. A blocked user on desktop is NOT blocked on mobile or another browser. Server-side push and API authorization cannot enforce blocks remotely, exposing users to harassment.

---

### 4. Profile Privacy Switch & Private Posts
- **Missing Columns:** `profiles.is_private`, `posts.is_private`
- **Referencing Code:** `src/views/Profile.tsx` (line 790), `src/lib/serverAuth.ts` (lines 530-565)
- **Current Behavior:** `dbProfile.is_private` evaluates to `undefined` (falsy).
- **User Impact:** **High.** All accounts and posts default to public. Users cannot toggle their profile to private in the database, breaking follower-only privacy expectations.

---

### 5. Multi-Media Post Attachments (Images & Video Carousel)
- **Missing Table:** `post_media`
- **Referencing Code:** `src/lib/postService.ts` (lines 316-345)
- **Current Behavior:** Attempts to insert into `post_media`. On failure, logs a warning and serializes the array of media objects into a stringified JSON string stored inside `posts.image_url`.
- **User Impact:** **Moderate.** Multiple images work via unstructured stringified JSON in `image_url`, but media items lack individual identifiers, sorting orders, media types, and cannot be individually queried or deleted.

---

### 6. Private Contact & Location Details
- **Missing Table:** `user_private_details`
- **Referencing Code:** `src/lib/profileService.ts` (lines 497-625), `src/views/Settings.tsx`
- **Current Behavior:** Attempts to write to `user_private_details`. Catches error, logs `user_private_details table does not exist in DB yet. Saved to local cache`, and writes to `localStorage`.
- **User Impact:** **Moderate.** User email, phone number, and location privacy settings do not persist across devices or logins.

---

### 7. User Domain Memberships
- **Missing Table:** `user_domains`
- **Referencing Code:** `src/lib/profileService.ts` (lines 429-485), `src/views/DomainChat.tsx`
- **Current Behavior:** Fails DB query, falls back to `localStorage.getItem('sync_user_domains_' + userId)`.
- **User Impact:** **Moderate.** Domain selections (e.g. Technology, Design, Entrepreneurship) are client-local and lost when clearing browser storage.

---

### 8. Project & Experience Changelog Updates
- **Missing Table:** `profile_item_updates`
- **Referencing Code:** `src/lib/profileItemUpdateService.ts` (lines 90-130)
- **Current Behavior:** Fails DB query, falls back to browser `localStorage`.
- **User Impact:** **Moderate.** Changelogs for projects and achievements are only visible to the author on the browser where they were created.

---

### 9. Web Push Subscriptions
- **Missing Table:** `push_subscriptions`
- **Referencing Code:** `src/app/api/register-web-push/route.ts`, `src/lib/serverPushDispatcher.cjs`
- **Current Behavior:** In production/non-test mode, dispatcher and routes fail closed (`Could not find the table 'public.push_subscriptions' in the schema cache`).
- **User Impact:** **Moderate / System.** No device push subscriptions can be registered or stored; push notifications cannot be delivered to users.

---

### 10. Durable Push Replay Protection
- **Missing Table:** `push_idempotency_keys`
- **Referencing Code:** `src/lib/serverAuth.ts` (PostgresPushIdempotencyStore)
- **Current Behavior:** Fails closed with 500 when `PUSH_IDEMPOTENCY_STORE=postgres`.
- **User Impact:** **Low to Moderate.** Durable multi-server idempotency requires this table.

---

### 11. Follow Request Acceptance Timestamp
- **Missing Column:** `follow_requests.accepted_at`
- **Referencing Code:** `src/lib/serverAuth.ts`, `tests/unit/test_web_push_api_security.cjs`
- **Current Behavior:** Relies on `updated_at` fallback.
- **User Impact:** **Low.** State transitions cannot be chronologically isolated from subsequent updates.

---

### 12. Verified Profile Checkmark Badge
- **Missing Columns:** `profiles.is_verified`, `profiles.verification_status`
- **Referencing Code:** `src/views/ProfileDetails.tsx`, `src/views/UpdateStoryViewer.tsx`, `src/components/ProfileSearchResults.tsx`
- **Current Behavior:** Field is `undefined` (treated as `false`).
- **User Impact:** **Visual.** The verified checkmark badge (`✓`) cannot be displayed for verified users.
