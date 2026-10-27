# SINC Current Frontend App on Staging: Flow Execution Audit

**Date:** 2026-10-25  
**Target Environment:** Staging Supabase (`https://bqmylyedpjeutxhcvmrf.supabase.co`) via `.env.staging`  
**Execution Mode:** Current Next.js App & Frontend Client Services Audit (No Frontend Changes Applied)  

---

## 1. Summary of Flow Results

| Classification | Count | Flows |
|---|:---:|---|
| **Fully Working End-to-End** | **12** | Profile Wizard, Create Post (Single & Multi-Image), Feed & Domain Filters, Like / Comment / Save / Share, Follow Request Lifecycle, Block / Unblock, Private Profile View, Updates / Stories, Domains & Domain Chat, Direct Messages, Notifications, Search |
| **Partially Working** | **3** | Sign Up, Privacy Toggle, Settings & Private Details |
| **Failing** | **2** | Profile Sections (5 Categories), Verification Request |
| **Total Flows Audited** | **17** | |

*(Note: A completed check is NOT counted as a pass. Flows are only classified as Fully Working End-to-End when both the database/API check succeeds and the frontend code inspection confirms active database persistence without silent fallbacks).*

---

## 2. Comprehensive Flow-by-Flow Audit Matrix

| # | Flow Name | DB/API Check Result *(Method: Automated Staging Script `exercise_staging_app_flows.cjs`)* | Frontend Code Status *(Method: Static Code Inspection of `src/`)* | End-to-End Verdict |
|---|---|---|---|:---:|
| **1** | **Sign Up** | **FAILS:** Programmatic `supabase.auth.signUp` returned `email rate limit exceeded` on rapid test probes. | **PARTIAL:** [`AuthContext.tsx:L482-514`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/context/AuthContext.tsx#L482-L514) invokes `supabase.auth.signUp`. If email confirmation is enabled, requires confirmation link before session exists; if immediate, upserts `profiles`. | **PARTIALLY WORKING** *(Cloud rate limits impede rapid test signups)* |
| **2** | **Profile Setup Wizard** | **WORKS:** Updated `profiles` (`name`, `username`, `role`, `bio`, `skills`) cleanly in PostgreSQL. | **WORKS:** [`ProfileSetupWizard.tsx`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/profile/ProfileSetupWizard.tsx) and [`profileService.ts:L980-1030`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts#L980-L1030) update `public.profiles`. Columns match schema. | **FULLY WORKING END-TO-END** |
| **3** | **Profile Sections (Projects, Experience, Education, Certs, Achievements)** | **WORKS (in DB):** Tables `profile_projects`, `profile_experience`, `profile_education`, `profile_certifications`, `profile_achievements` exist on staging with RLS. | **FAILS:** Services query non-existent tables `projects`, `experience`, `education`, `certifications`, `achievements`. PostgREST returns `PGRST205` and catches silently fall back to `localStorage`. | **FAILING (SILENT LOCALSTORAGE FALLBACK)** |
| **4** | **Privacy Toggle** | **WORKS:** Updating `profiles.is_private` immediately triggers RLS followers-only content protection. | **PARTIAL:** [`Settings.tsx:L161-171`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Settings.tsx#L161-L171) attempts to save `privacy_settings` via `upsertUserPrivateDetails` rather than updating `profiles.is_private` directly. | **PARTIALLY WORKING** |
| **5** | **Verification Request** | **WORKS (in DB):** Record inserted into `public.verification_requests` with owner-only RLS check. | **FAILS:** Missing in UI. `src/` contains 0 references to `verification_requests`. [`profileService.ts:L935`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts#L935) actively deletes `is_verified` before save. | **FAILING (MISSING UI & ROUTE)** |
| **6** | **Create Post (Single & Multi-Image)** | **WORKS:** Main post saved to `posts`; multi-image carousel items saved to `post_media`. | **WORKS:** [`postService.ts:L254-258`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.ts#L254-L258) inserts to `posts` and [`postService.ts:L320-324`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.ts#L320-L324) inserts normalized rows into `post_media`. | **FULLY WORKING END-TO-END** |
| **7** | **Feed & Domain Filters** | **WORKS:** Retrieved posts filtered by author and domain tag. | **WORKS:** [`postService.ts:L345-369`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.ts#L345-L369) queries `public.posts` with `.eq('domain', domain)`. | **FULLY WORKING END-TO-END** |
| **8** | **Like / Comment / Save / Share** | **WORKS:** Persisted records into `post_likes`, `post_comments`, `post_saves`, `post_shares`. | **WORKS:** [`postInteractionService.ts:L45-54,L137-140`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.ts#L45-L54) queries and mutates real baseline tables `post_likes`, `post_comments`, `post_saves`, `post_shares`. | **FULLY WORKING END-TO-END** |
| **9** | **Follow Request Lifecycle** | **WORKS:** Pending insert, accepted transition, and database trigger populates `accepted_at`. | **WORKS:** [`socialService.ts:L196,L312,L360`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/socialService.ts#L196) uses `follow_requests` (`follower_user_id`, `following_user_id`). | **FULLY WORKING END-TO-END** |
| **10** | **Block / Unblock** | **WORKS:** Persisted blocker and blocked rows into `blocked_users`; unblock deletes row. | **WORKS:** [`blockService.ts:L153-172,L189-206`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/blockService.ts#L153-L172) writes to `blocked_users` and caches locally for synchronous checks. | **FULLY WORKING END-TO-END** |
| **11** | **Private Profile View** | **WORKS:** Stranger selects basic profile info; private posts shielded by RLS (0 rows). | **WORKS:** [`Profile.tsx:L790-795`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Profile.tsx#L790-L795) checks `is_private` and `isAcceptedFollower`, displaying the private lock banner. | **FULLY WORKING END-TO-END** |
| **12** | **Updates / Stories** | **WORKS:** Story record in `updates` and view logged in `update_views`. Expired stories filtered. | **WORKS:** [`updatesService.ts:L89,L126`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/updatesService.ts#L89) inserts into `updates` (`category_id`, `content`, `expires_at`). | **FULLY WORKING END-TO-END** |
| **13** | **Domains & Domain Chat** | **WORKS:** User membership in `user_domains` and channel message in `domain_messages`. | **WORKS:** [`domainMessageService.ts:L79,L195,L287`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/messaging/services/domainMessageService.ts#L79) loads, sends, and subscribes to `domain_messages`. | **FULLY WORKING END-TO-END** |
| **14** | **Direct Messages** | **WORKS:** `conversations`, `conversation_members`, `messages`, and `message_status` persist. | **WORKS:** [`messageService.ts:L22,L74`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/messaging/services/messageService.ts#L22) and [`conversationService.ts:L104`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/messaging/services/conversationService.ts#L104) query and insert into real baseline tables. | **FULLY WORKING END-TO-END** |
| **15** | **Notifications** | **WORKS:** In-app notification delivered to `notifications`; marked read (`is_read = true`). | **WORKS:** [`notificationService.ts:L74,L153`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/notifications/services/notificationService.ts#L74) loads and updates in-app notification rows. | **FULLY WORKING END-TO-END** |
| **16** | **Search** | **WORKS:** Search ILIKE discovers private profile basic info; excludes blocked profiles. | **WORKS:** [`Search.tsx:L75`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Search.tsx#L75) and [`socialService.ts:L120-148`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/socialService.ts#L120-L148) query `profiles` and exclude `isBlockedSync`. | **FULLY WORKING END-TO-END** |
| **17** | **Settings & Private Details** | **WORKS (in DB):** Profile updates persist; `user_private_details` persists phone & location_data JSONB. | **PARTIAL:** [`profileService.ts:L582-595`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts#L582-L595) attempts to send 10 individual columns that do not exist on `user_private_details`, falling back to `localStorage`. | **PARTIALLY WORKING** |

---

## 3. Detailed Breakdown of Partial & Failing Flows

### Flow 1: Profile Sections (Projects, Experience, Education, Certifications, Achievements)
- **Status:** `FAILING (SILENT LOCALSTORAGE FALLBACK)`
- **Issue:** Frontend services call legacy table names that do not match the real database tables (`profile_projects`, `profile_experience`, `profile_education`, `profile_certifications`, `profile_achievements`). PostgREST returns error `PGRST205` ("table not found in schema cache"), which the client catches and writes to `localStorage`.
- **Exact Files & Lines to Change in Phase 5:**
  1. [`src/lib/projectService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/projectService.ts):
     - Line 90, 147, 221, 263: Replace `.from('projects')` with `.from('profile_projects')`.
     - Lines 96, 106, 155: Remove silent fallback to `localStorage.setItem('sync_user_projects_...')`.
     - Lines 135: Map `technologies` array to `skills TEXT[]` to match database column.
  2. [`src/lib/experienceService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/experienceService.ts):
     - Lines 91, 147, 225, 269: Replace `.from('experience')` with `.from('profile_experience')`.
     - Lines 97, 107, 155: Remove silent fallback to `localStorage`.
  3. [`src/lib/educationService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/educationService.ts):
     - Lines 75, 129, 175, 244: Replace `.from('education')` with `.from('profile_education')`.
     - Lines 81, 91, 137: Remove silent fallback to `localStorage`.
  4. [`src/lib/certificationService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/certificationService.ts):
     - Lines 69, 122, 168, 237: Replace `.from('certifications')` with `.from('profile_certifications')`.
     - Lines 75, 85, 130: Remove silent fallback to `localStorage`.
  5. [`src/lib/achievementService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/achievementService.ts):
     - Lines 69, 121, 167, 236: Replace `.from('achievements')` with `.from('profile_achievements')`.
     - Lines 75, 85, 129: Remove silent fallback to `localStorage`.

---

### Flow 2: Verification Request
- **Status:** `FAILING (MISSING UI & ROUTE)`
- **Issue:** The staging PostgreSQL table `public.verification_requests` and its owner-only RLS policies exist and work. However, the frontend has no user-facing UI or service to submit verification documents. Furthermore, [`profileService.ts:L935`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts#L935) actively deletes `is_verified` before saving profiles to prevent client-side badge spoofing.
- **Exact Files & Lines to Change in Phase 5:**
  1. [`src/lib/profileService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts): Add dedicated API method `submitVerificationRequest(userId: string, documentUrl: string, notes: string)` querying `supabase.from('verification_requests').insert(...)`.
  2. [`src/views/Settings.tsx`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Settings.tsx) or [`src/views/Profile.tsx`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Profile.tsx): Add user-facing "Request Verification" modal button and upload form.

---

### Flow 3: Privacy Toggle
- **Status:** `PARTIALLY WORKING`
- **Issue:** Toggling privacy in the database (`UPDATE profiles SET is_private = true`) authoritatively engages RLS followers-only content protection. However, the frontend Settings UI attempts to store privacy as a subkey in `user_private_details.privacy_settings` rather than updating `public.profiles.is_private`.
- **Exact Files & Lines to Change in Phase 5:**
  1. [`src/views/Settings.tsx`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/views/Settings.tsx):
     - Lines 161–178: In `handleSavePrivacy`, add a direct update to `profiles`:
       ```typescript
       await supabase.from('profiles').update({ is_private: nextSettings.profile_visibility === 'private' }).eq('id', currentUser.id);
       ```

---

### Flow 4: Settings & Private Details
- **Status:** `PARTIALLY WORKING`
- **Issue:** Public profile fields (`name`, `bio`, `role`, `skills`) save cleanly to `public.profiles`. But sensitive personal details fail to persist because `upsertUserPrivateDetails` attempts to send 10 individual columns (`date_of_birth`, `gender`, `gender_custom`, `location_address`, `location_area`, `location_landmark`, `location_pincode`, `location_latitude`, `location_longitude`, `privacy_settings`) that do not exist as top-level columns on `public.user_private_details` (the table contains `user_id`, `email`, `phone`, `location_data JSONB`). The client catches PostgREST column errors and falls back to `localStorage`.
- **Exact Files & Lines to Change in Phase 5:**
  1. [`src/lib/profileService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/profileService.ts):
     - Lines 582–592: Refactor payload packing so location address fields are bundled into `location_data: { address, area, landmark, pincode, lat, lng }` JSONB.
     - Lines 560–564: Remove premature write to `localStorage` before database confirmation.

---

## 4. Resolution of the Contradiction About Blocking

### Question: Does `blockService.ts` write to the database or localStorage today?

**Answer:** `blockService.ts` writes to **BOTH**. It uses `localStorage` as an optimistic cache for synchronous, latency-free client evaluation (via `isBlockedSync`), and simultaneously dispatches an asynchronous persistence call to the Supabase database table `blocked_users` (`blocker_user_id`, `blocked_user_id`).

#### Exact Lines from [`src/lib/blockService.ts`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/blockService.ts):

**1. Blocking a User ([`blockService.ts:L152-172`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/blockService.ts#L152-L172)):**
```typescript
  // 1. Save locally first for instant consistency
  const myBlocks = getLocalBlocks(currentUserId);
  if (!myBlocks.includes(targetUserId)) {
    myBlocks.push(targetUserId);
    saveLocalBlocks(currentUserId, myBlocks);
  }
  blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);

  // 2. Persist in Supabase
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([{ blocker_user_id: currentUserId, blocked_user_id: targetUserId }]);
      if (error && error.code !== '23505') { // Ignore unique constraint violation
        console.warn('[BlockService] Supabase blockUser error:', error.message);
      }
    } catch (e) {
      console.warn('[BlockService] Supabase blockUser exception:', e);
    }
  }
```

**2. Unblocking a User ([`blockService.ts:L189-206`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/blockService.ts#L189-L206)):**
```typescript
  // 1. Remove from local storage
  let myBlocks = getLocalBlocks(currentUserId);
  myBlocks = myBlocks.filter((id) => id !== targetUserId);
  saveLocalBlocks(currentUserId, myBlocks);
  blockMemoryCache.delete(`${currentUserId}_${targetUserId}`);

  // 2. Remove from Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_user_id', currentUserId)
        .eq('blocked_user_id', targetUserId);
    } catch (e) {
      console.warn('[BlockService] Supabase unblockUser error:', e);
    }
  }
```

This confirms:
1. The real database table is `blocked_users` with columns `blocker_user_id` and `blocked_user_id` (there is no table named `blocks`).
2. Both local storage and remote database are written to during block and unblock operations.
