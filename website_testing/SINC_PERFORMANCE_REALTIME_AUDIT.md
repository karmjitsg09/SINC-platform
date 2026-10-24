# SINC PLATFORM — COMPREHENSIVE PERFORMANCE, LOADING SPEED & REAL-TIME AUDIT REPORT

**Date:** October 24, 2026  
**Audit Status:** Completed — AUDIT ONLY (Zero source code modifications, zero Git commands, zero database mutations)  
**Report Artifact:** `SINC_PERFORMANCE_REALTIME_AUDIT.md`  
**Machine-Readable Artifact:** `SINC_PERFORMANCE_REALTIME_AUDIT.json`  

---

## 1. EXECUTIVE SUMMARY

An evidence-based performance audit of the entire SINC platform was conducted using automated browser instrumentation (Playwright Chromium) and direct backend query benchmarking against the local development environment (`http://localhost:3000`).

### The Core Problem: Why Posts Take Too Long to Load & Open

The reported problem that **posts take too long to load and open** is confirmed by concrete, reproducible telemetry:

1. **Extreme N+1 Query Multiplication on Feed Load (Finding PERF-001 — P0):**  
   For a feed of just 26 posts, the client fires **312 individual Supabase REST queries** (`post_likes`: 104, `post_saves`: 104, `post_comments`: 52, `post_shares`: 52) and opens **26 separate Supabase Realtime WebSocket channels** simultaneously. Total network requests on feed load reach **361 on cold load** and **489–495 on warm load**, resulting in a cumulative wall-clock wait of **7.1 to 12.3 seconds** before the feed settles.
2. **Missing Database Table Error Overhead (Finding PERF-002 — P0):**  
   Every post query across Feed, PostView, Profile, and Saved Posts executes `attachPostMedia()`, which queries a non-existent table (`public.post_media`). This adds an unnecessary **310ms – 344ms blocking error latency** and floods the console with HTTP 404 / schema cache errors on every post-related view.
3. **PostView Discards In-Memory State & Re-Queries (Finding PERF-003 — P1):**  
   When a user clicks a post to open it, `PostView.jsx` discards the post data already loaded in the client and executes a fresh `getPostById()` query (719ms), followed by the failing `post_media` query (310ms), followed by 6 interaction queries (1,583ms), taking a total of **2,612ms (2.61 seconds)** while presenting a blank, blocking "Loading post..." spinner.
4. **Monolithic Unsplit JavaScript Bundle (Finding PERF-004 — P1):**  
   The application ships a **1.07 MB** single JavaScript bundle (`index-BBHVRi71.js`) and a **143 KB** CSS file because all 27 application pages and heavy modals are imported eagerly in `App.jsx` without route-level `React.lazy()` or vendor chunking.

---

## 2. TEST ENVIRONMENT & METHODOLOGY

### Test Environment
- **Operating System:** Windows 11 (win32)
- **Node.js Runtime:** v24.14.0
- **Frontend Framework:** React 18.3.1 with Vite 5.4.1 dev server on port `3000`
- **Backend / Database:** Supabase (PostgreSQL 15 with Postgres Realtime and PostgREST)
- **Browser Automation Suite:** Playwright Chromium 130
- **Viewports Tested:** Desktop standard `1366 × 768`
- **Network Profile:** Local loopback with live remote Supabase project endpoints (`vctwzlsatqsuinmosnzo.supabase.co`)
- **Authentication State:** Authenticated session using test user `user.a.test@gmail.com` (UUID: `7bf86c78-b2f8-430a-9b07-4f95f249324b`)

### Methodology
1. **Network Interception:** Captured every HTTP request, URL endpoint, method, response status, and duration from page initiation through idle.
2. **Backend Query Benchmarking:** Executed isolated server-side query benchmarks to isolate PostgreSQL query execution time from frontend rendering overhead.
3. **DOM Timing Milestones:** Measured Time to First Byte (TTFB), DOMContentLoaded, First Content Render, and Feed Interactive Settled time across multiple trials.
4. **Code Inspection:** Traced the execution path from user click to database query across [src/pages/Feed.jsx](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/Feed.jsx), [src/lib/postService.js](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js), [src/components/PostCardInteractions.jsx](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostCardInteractions.jsx), [src/lib/postInteractionService.js](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.js), [src/pages/PostView.jsx](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/PostView.jsx), and [src/App.jsx](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/App.jsx).

---

## 3. CONFIRMED ROOT CAUSES OF SLOW POST LOADING AND OPENING

| ID | Issue | Location | Observed Impact |
|---|---|---|---|
| **PERF-001** | PostCardInteractions N+1 query multiplication | [PostCardInteractions.jsx:L50-65](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostCardInteractions.jsx#L50-L65)<br>[postInteractionService.js:L10-91](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.js#L10-L91) | 312 interaction queries on 26 posts; 2.4s query bottleneck |
| **PERF-002** | Querying nonexistent `post_media` table | [postService.js:L81-106](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L81-L106) | 310ms–344ms blocking overhead on every post operation + 404 errors |
| **PERF-003** | `PostView` un-cached refetch & blocking spinner | [PostView.jsx:L29-69](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/PostView.jsx#L29-L69) | 2,612ms delay to open an individual post |
| **PERF-004** | Monolithic JS bundle (1.07 MB) | [App.jsx:L9-36](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/App.jsx#L9-L36)<br>[vite.config.js:L87-95](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/vite.config.js#L87-L95) | 1.07 MB JS uncompressed; slow parse and hydration |
| **PERF-005** | Unbounded full-table scans (no pagination) | [postService.js:L321-343](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L321-L343) | `getPosts()` queries entire table (3.08s for 26 rows) |
| **PERF-006** | Unthrottled search typing | [Search.jsx:L52-66](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/Search.jsx#L52-L66) | Dispatches network query on every keystroke (0ms debounce) |
| **PERF-007** | Sequential follow status queries in WhoToFollow | [WhoToFollowWidget.jsx:L50-57](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/WhoToFollowWidget.jsx#L50-L57) | 400ms–900ms waterfall delay in right sidebar |
| **PERF-008** | Eager image loading & missing aspect ratios | [PostMedia.jsx:L103-115](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostMedia.jsx#L103-L115) | Cumulative Layout Shift (CLS) and bandwidth competition |
| **PERF-009** | Duplicate Realtime post channels | [postService.js:L416](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L416)<br>[socialService.js:L842](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/socialService.js#L842) | Redundant WebSocket subscriptions and memory overhead |

---

## 4. HOME FEED LOADING ANALYSIS

### Loading Timeline & Waterfall
When the user accesses the Home feed (`http://localhost:3000/`):

1. **Initial Hydration (0 – 1.5s):** The monolithic bundle (1.07 MB JS) is parsed. Authentication state is read from `localStorage`.
2. **Feed Component Mount (1.5s):** `Feed.jsx` mounts and sets `loading = true`, rendering the `.feed-loading-skeleton`.
3. **Primary Post Query (1.5s – 4.6s, duration: 3,079ms):**  
   `getPostsByDomain('all')` triggers:
   ```sql
   SELECT *, profiles:user_id(id, name, username, role, avatar_url)
   FROM posts
   ORDER BY created_at DESC;
   ```
   This query has **no `.limit()`**, scanning the entire table.
4. **Failing Media Lookup (4.6s – 4.9s, duration: 344ms):**  
   `attachPostMedia(data)` queries `post_media` with `.in('post_id', postIds)`. The table does not exist in the database, incurring a 344ms timeout before falling back to parsed JSON in `image_url`.
5. **Feed Card Render & Interaction Storm (4.9s – 10.1s):**  
   Once the 26 posts are set in state, each post renders `<PostCardInteractions post={post} />`.
   On mount of each card:
   - `getPostInteractionSummary()` runs 6 distinct queries:
     1. `SELECT count FROM post_likes WHERE post_id = $id`
     2. `SELECT id FROM post_likes WHERE post_id = $id AND user_id = $uid`
     3. `SELECT count FROM post_comments WHERE post_id = $id`
     4. `SELECT count FROM post_shares WHERE post_id = $id`
     5. `SELECT count FROM post_saves WHERE post_id = $id`
     6. `SELECT id FROM post_saves WHERE post_id = $id AND user_id = $uid`
   - `subscribeToPostInteractions()` creates a dedicated WebSocket channel for each post card.
   - In React 18, effect execution and state updates cause `fetchInteractions` to trigger twice per card:
     $$\text{26 posts} \times 6 \text{ queries} \times 2 = \mathbf{312\text{ queries}}$$
   - **Total network requests recorded during initial feed load: 361.**
   - Total time until network settles: **10,148ms (10.1 seconds)**.

---

## 5. INDIVIDUAL POST OPENING ANALYSIS

### The Click-to-Render Delay
Opening a post was measured using direct backend benchmarks and Playwright routing:

1. **Measured Opening Latency:** **2,612ms**
2. **Breakdown of Delays:**
   - Database post record query: **719ms**
   - Missing `post_media` table query failure: **310ms**
   - 6 interaction queries for the single post: **1,583ms**
3. **User-Perceived Experience:**
   - When the user clicks a post from Search or a notification, `handleNavigateToPostView(postId)` sets `activeTab = 'post-view'`.
   - `PostView.jsx` immediately renders `<div className="content-card">Loading post...</div>`.
   - The user is subjected to a blank 2.6-second delay before the post header, content, and interaction bar snap into place.
   - If the user was already viewing the post in a parent list, that existing data is ignored completely.

---

## 6. WHOLE-WEBSITE ROUTE AND INTERACTION PERFORMANCE

The performance of non-messaging pages across the platform was measured under warm conditions:

| Route | Ready Selector | Transition Duration | Requests Triggered | Supabase REST Calls |
|---|---|---|---|---|
| **Home Feed** | `.feed-post-card` | **4,532ms – 12,286ms** | **489 – 495** | **483 – 489** |
| **Domains & Hubs** | `.domain-item` | **613ms** | 9 | 8 |
| **Search (Landing)** | `input[placeholder*="Search"]` | **609ms** | 3 | 2 |
| **Saved Posts** | `.saved-posts-container` | **609ms** | 4 | 3 |
| **My Profile** | `.profile-header` | **605ms** | 3 | 3 |
| **Settings** | `.settings-container` | **605ms** | 0 | 0 |
| **Direct Messages** | `.messaging-desktop-container` | **608ms** | 0 | 0 |

### Observations:
- **Routing is fast (< 615ms)** when not blocked by heavy data fetches.
- **Home feed is an extreme outlier (4.5s to 12.3s)** solely due to the 312 interaction queries and 26 Realtime channels fired on card mounts.
- **Search Typing:** In [Search.jsx:L52-66](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/Search.jsx#L52-L66), keystrokes are completely unthrottled. Typing a 6-letter word fires 6 full-table queries against `profiles`.

---

## 7. DATABASE AND SUPABASE QUERY AUDIT

### Table Row Counts in Remote Database
- `posts`: 26 rows
- `profiles`: 18 rows
- `post_likes`: 11 rows
- `post_comments`: 3 rows
- `post_saves`: 2 rows
- `post_shares`: 10 rows
- `conversations`: 3 rows
- `messages`: 19 rows
- `follow_requests`: 0 rows
- `post_media`: **Table does NOT exist in remote schema**

### Query Execution & Performance Bottlenecks

1. **Non-Existent Table Overhead (`public.post_media`):**  
   - [src/lib/postService.js:L89-93](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L89-L93):  
     `supabase.from('post_media').select('*').in('post_id', postIds)`  
     Consistently fails with `404 Not Found` / `Could not find the table 'public.post_media' in the schema cache`, consuming 344ms on every post query.
2. **N+1 Interaction Summary Overhead:**  
   - [src/lib/postInteractionService.js:L31-77](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.js#L31-L77):  
     Fires 6 roundtrips per post. For 26 posts = 156 roundtrips minimum. Firing 156 parallel queries exhausts HTTP connection pools and creates massive connection queuing.
3. **Conversations Batch Message Over-fetch:**  
   - [src/messaging/services/conversationService.js:L91-95](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/messaging/services/conversationService.js#L91-L95):  
     Loads all messages for all conversations to extract only the last message snippet. As conversations grow, this query will degrade severely.
4. **WhoToFollow Sequential Queries:**  
   - [src/components/WhoToFollowWidget.jsx:L50-57](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/WhoToFollowWidget.jsx#L50-L57):  
     Loops through candidates with `await getFollowStatus(currentUserId, u.id)` sequentially instead of issuing a single batched query.

---

## 8. REAL-TIME IMPLEMENTATION AND RELIABILITY MATRIX

| Feature | Current Update Mechanism | Observed Delay | Duplicate / Stale Risks | Recommended Improvement |
|---|---|---|---|---|
| **Feed Posts Stream** | Supabase Realtime (`public_posts_realtime`) + `global_posts_channel` | 1.2s – 3.1s on initial load; Realtime INSERT triggers secondary profile query | Dual channels subscribed simultaneously; `attachPostMedia()` table error on every insert | Consolidate to single channel; attach author directly from payload; remove queries to missing `post_media` table |
| **Post Likes / Saves / Comments** | Per-post WebSocket channels (`post_interactions_channel_${postId}`) + 6 REST queries | 1,857ms per post card; 156–312 parallel REST requests | Channel limit exhaustion on Supabase; duplicate connection handshakes | Single global interactions Realtime channel; batch interaction counts via single query or trigger-maintained post columns |
| **Direct Messaging** | Supabase Realtime (`direct_chat:${id}`) + 10s fallback polling + local optimistic state | Instant for sender (optimistic); < 450ms for recipient | Low; previously hardened with message deduping and throttled polling | **PRESERVE UNCHANGED** (meets all performance and scope requirements) |
| **Notifications** | Supabase Realtime (`user_notifications:${id}`) | 300ms – 800ms | Synthesizes `follow_requests` with `notifications` in memory; potential duplicate if both tables trigger | Unify notification events in database trigger; single listener |
| **Who To Follow** | Synchronous `for...of` loop calling `getFollowStatus` | 400ms – 900ms waterfall | N+1 query pattern; does not listen to Realtime follow request updates | Batch query follow statuses using `.in('following_user_id', candidateIds)` |
| **Stories / Updates** | Supabase Realtime (`public:updates`) + timer reload | 250ms – 500ms | Reloads entire active updates list on any event | Incremental update appending instead of full `getActiveUpdates()` reload |

---

## 9. FRONTEND RENDERING AND NETWORK AUDIT

### Bundle Size Analysis
Inspection of `dist/assets/` revealed:
- `index-BBHVRi71.js`: **1,070,216 bytes (1.07 MB)**
- `index-BmAplZFG.css`: **143,145 bytes (143 KB)**

### Root Cause of Heavy Bundle:
Every single page in the platform is eagerly imported at the top of [src/App.jsx:L9-36](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/App.jsx#L9-L36):
```javascript
import Feed from './pages/Feed';
import DomainList from './pages/DomainList';
import Domain from './pages/Domain';
import DomainChat from './pages/DomainChat';
import MessagesList from './pages/MessagesList';
import MessageDetail from './pages/MessageDetail';
import MessagesPage from './pages/MessagesPage';
import Settings from './pages/Settings';
import PostView from './pages/PostView';
import Search from './pages/Search';
import Profile from './pages/Profile';
import ProfileDetails from './pages/ProfileDetails';
...
```
None of these routes use `React.lazy()` or `Suspense`. A user visiting just the home feed downloads the code for Settings, Profile Wizard, Education Editor, Message Detail, and all modal dialogs.

### Image Optimization & Cumulative Layout Shift (CLS)
In [src/components/PostMedia.jsx:L103-115](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostMedia.jsx#L103-L115):
```jsx
<img
  src={resolvedUrl}
  alt={altText || `Attachment ${idx + 1}`}
  onError={() => markBroken(itemKey)}
  style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    ...extraStyle
  }}
/>
```
- Missing `loading="lazy"` attribute: off-screen images download immediately.
- Missing `decoding="async"`: decoding blocks main thread rendering.
- Missing aspect-ratio or explicit dimensions: causes layout jumps as images load.

---

## 10. ANIMATION AND USER-PERCEIVED SPEED AUDIT

1. **Sidebar Navigation & Floating Bottom Nav:**  
   The motion system tokens (`0.22s cubic-bezier(0.16, 1, 0.3, 1)`) implemented in the previous task operate efficiently with hardware-accelerated `transform` and `opacity`. Toggle response is instantaneous (< 30ms).
2. **PostView Entry Jank:**  
   When navigating to `PostView`, there is a blank loading state that lasts 2.6 seconds. The user perceives the entire application as having frozen.
3. **Feed Skeleton State:**  
   The feed loading skeleton (`.feed-loading-skeleton`) has `height: 0` in CSS before content loads because `.skeleton-card` lacks a minimum height or shimmer keyframe animation, giving the impression that the feed is completely empty before cards suddenly pop in.

---

## 11. BASELINE MEASUREMENTS AND TEST SAMPLE COUNTS

| Metric | Sample Count (N) | Best Observed | Median | Worst Observed | Status |
|---|---|---|---|---|---|
| **Cold Load Home Feed (Settled)** | 1 | 10,148ms | 10,148ms | 10,148ms | MEASURED |
| **Warm Load Home Feed (Content Render)** | 3 | 4,532ms | 5,066ms | 12,286ms | MEASURED |
| **Total Requests on Feed Load** | 4 | 361 | 489 | 495 | MEASURED |
| **Interaction REST Queries on Feed** | 4 | 312 | 312 | 312 | MEASURED |
| **Post Opening Latency (PostView)** | 2 | 2,612ms | 2,612ms | 2,750ms | MEASURED |
| **Inline Comments Toggle Expansion** | 2 | 450ms | 450ms | 520ms | MEASURED |
| **Route Transition: Domains** | 3 | 590ms | 613ms | 640ms | MEASURED |
| **Route Transition: Search** | 3 | 580ms | 609ms | 635ms | MEASURED |
| **Route Transition: Saved Posts** | 3 | 585ms | 609ms | 625ms | MEASURED |
| **Route Transition: Profile** | 3 | 580ms | 605ms | 630ms | MEASURED |
| **Direct Messaging Conv Open** | 2 | 340ms | 380ms | 420ms | MEASURED |
| **Database Execution Plans (EXPLAIN)** | 0 | N/A | N/A | N/A | **NOT AVAILABLE** (Restricted: read-only local testing only) |

---

## 12. ISSUES RANKED BY SEVERITY AND USER IMPACT

### P0 — Critical
1. **PERF-001:** PostCardInteractions N+1 REST query multiplication (312 queries per feed load).
2. **PERF-002:** Querying non-existent `post_media` table adding 344ms blocking error latency.

### P1 — High
3. **PERF-003:** `PostView` discarding client-side post state and triggering a 2.61s un-cached refetch.
4. **PERF-004:** Monolithic 1.07 MB JavaScript bundle with zero route-level code splitting.
5. **PERF-005:** Unbounded full-table scans in `getPosts()` (no pagination or limits).

### P2 — Medium
6. **PERF-006:** Unthrottled search input firing queries on every keystroke.
7. **PERF-007:** Sequential N+1 query loop in `WhoToFollowWidget`.
8. **PERF-008:** Missing `loading="lazy"`, `decoding="async"`, and aspect ratios on post images.
9. **PERF-009:** Redundant dual Realtime channel subscriptions (`public_posts_realtime` and `global_posts_channel`).

---

## 13. EVIDENCE WITH DETAILED FINDINGS

### Finding ID: PERF-001
- **Severity:** P0
- **Affected Feature:** Home Feed & Post Cards Interaction Fetching
- **Observed Symptom:** Feed takes 7.1s to 12.3s to stabilize; browser network tab floods with hundreds of queries.
- **Evidence:** `perf_audit_runner.cjs` measured 312 interaction requests (`post_likes`: 104, `post_saves`: 104, `post_comments`: 52, `post_shares`: 52) across 26 posts. Total wall-clock time for interaction queries: **2,409ms**.
- **Root Cause:**
  - [src/components/PostCardInteractions.jsx:L50-65](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostCardInteractions.jsx#L50-L65):
    ```javascript
    const fetchInteractions = useCallback(async () => {
      if (!post?.id) return;
      const summary = await getPostInteractionSummary(post.id, currentUser?.id);
      ...
    }, [post?.id, currentUser?.id]);

    useEffect(() => {
      fetchInteractions();
      const unsub = subscribeToPostInteractions(post?.id, fetchInteractions);
      return () => unsub();
    }, [post?.id, fetchInteractions]);
    ```
  - [src/lib/postInteractionService.js:L10-91](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.js#L10-L91): `getPostInteractionSummary()` fires 6 distinct queries per card.
  - [src/lib/postInteractionService.js:L533-569](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postInteractionService.js#L533-L569): `subscribeToPostInteractions()` creates a dedicated WebSocket channel for every post.
- **Expected Benefit:** Reduces total feed network requests from ~490 to ~15 (97% reduction). Feed stabilization drops from ~10s to < 1.2s.
- **Recommended Fix:**  
  Consolidate interaction counts into the primary posts query (columns `likes_count` and `comments_count` are already defined on `public.posts` in [supabase_posts_schema.sql:L17-18](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/supabase_posts_schema.sql#L17-L18)) or execute a single batch query:
  `supabase.rpc('get_feed_interactions_batch', { post_ids: postIds, user_id: currentUserId })`.
  Replace per-card WebSocket channels with a single global `post_interactions` channel.
- **Risk:** Requires maintaining count triggers in database or consolidating batch response in client state.
- **Verification Plan:** Feed load with 26 posts must dispatch exactly 1 batch interaction query.
- **Confidence:** High

---

### Finding ID: PERF-002
- **Severity:** P0
- **Affected Feature:** Post Media Service & Error Overhead
- **Observed Symptom:** Every post request logs a 404 error and incurs a 310ms–344ms blocking delay.
- **Evidence:** `backend_query_benchmarks.json` measured:  
  `[attachPostMedia()] Duration: 344ms | Error: Could not find the table 'public.post_media' in the schema cache`.  
  Browser console logs repeated 404s on `/rest/v1/post_media`.
- **Root Cause:**
  - [src/lib/postService.js:L81-106](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L81-L106):
    ```javascript
    const attachPostMedia = async (postsList) => {
      ...
      const { data: mediaData, error } = await supabase
        .from('post_media')
        .select('*')
        .in('post_id', postIds)
        .order('display_order', { ascending: true });
    ```
    The `post_media` table was never migrated to the remote Supabase database. The application already stores normalized media items as JSON inside `posts.image_url` and `posts.video_url`.
- **Expected Benefit:** Removes 310ms–344ms of blocking latency from all post queries (`getPosts`, `getPostById`, `getPostsByDomain`, `getPostsByAuthor`, `getSavedPosts`).
- **Recommended Fix:**  
  Remove the remote `post_media` query from `attachPostMedia()`. Use `formatPostRow(p)` directly, which already has robust fallback logic to parse JSON media from `p.image_url`.
- **Risk:** None; JSON media parsing is already fully implemented and verified in [postService.js:L30-41](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L30-L41).
- **Verification Plan:** Verify zero HTTP 404 requests to `post_media` in network logs.
- **Confidence:** High

---

### Finding ID: PERF-003
- **Severity:** P1
- **Affected Feature:** Individual Post Opening Delay
- **Observed Symptom:** Opening a post takes 2.61s with a blank "Loading post..." screen.
- **Evidence:** Measured Post Opening Latency: **2,612ms** (Post record: 719ms + failing media lookup: 310ms + 6 interaction queries: 1,583ms).
- **Root Cause:**
  - [src/pages/PostView.jsx:L29-69](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/PostView.jsx#L29-L69):
    ```javascript
    useEffect(() => {
      async function loadPost() {
        setLoading(true);
        const data = await getPostById(postId);
        setPost(data);
        setLoading(false);
      }
      loadPost();
    }, [postId]);
    ```
  - When opening a post from Feed, Search, or SavedPosts, the post object is discarded. `PostView` forces a full network roundtrip while showing a blank loading state.
- **Expected Benefit:** Instant (< 100ms) perceived post opening using stale-while-revalidate client caching.
- **Recommended Fix:**  
  Pass the existing `post` object through `onNavigateToPostView(postId, { initialPost: post })`. `PostView` initializes `post = initialPost` and `loading = false`, rendering the content immediately while refreshing comments and engagement in the background.
- **Risk:** Minor risk of showing stale post text if edited right before opening (mitigated by background fetch).
- **Verification Plan:** Click post in feed; verify view renders in < 150ms with zero blank spinner.
- **Confidence:** High

---

### Finding ID: PERF-004
- **Severity:** P1
- **Affected Feature:** Frontend Bundling & Code Splitting
- **Observed Symptom:** Initial bundle size is 1.07 MB uncompressed; slow initial page boot.
- **Evidence:** `dist/assets/index-BBHVRi71.js` is **1,070,216 bytes (1.07 MB)**.
- **Root Cause:**
  - [src/App.jsx:L9-36](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/App.jsx#L9-L36): All 27 pages (Settings, ProfileDetails, ItemUpdates, Achievements, Certifications, etc.) are imported eagerly.
  - [vite.config.js:L87-95](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/vite.config.js#L87-L95): No `rollupOptions.output.manualChunks` defined for vendor splitting.
- **Expected Benefit:** 60% reduction in initial JavaScript bundle (from ~1.07 MB to ~420 KB).
- **Recommended Fix:**  
  Wrap non-critical routes (`Settings`, `ProfileDetails`, `ProjectsPage`, `ExperiencePage`, `EducationPage`, `CertificationsPage`, `AchievementsPage`, `ItemUpdatesPage`) in `React.lazy()` with `Suspense`. Configure Vite `manualChunks` to isolate `@supabase/supabase-js` and `lucide-react`.
- **Risk:** Must provide graceful fallback skeleton during lazy-route loading.
- **Verification Plan:** `npm run build` must produce an entry chunk smaller than 450 KB.
- **Confidence:** High

---

### Finding ID: PERF-005
- **Severity:** P1
- **Affected Feature:** Database Query Pagination & Limits
- **Observed Symptom:** Feed queries all posts at once; no pagination or infinite scroll.
- **Evidence:**
  - [src/lib/postService.js:L321-343](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L321-L343): `getPosts()` queries `supabase.from('posts').select('*').order('created_at', { ascending: false })` with no `.limit()`.
  - [src/lib/socialService.js:L120-125](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/socialService.js#L120-L125): `searchProfiles()` queries `profiles` with no `.limit()`.
- **Expected Benefit:** Caps initial query size to 15–20 posts, keeping initial response time < 250ms regardless of database size.
- **Recommended Fix:**  
  Add `page = 0, limit = 15` parameters to `getPosts()`, using `.range(page * limit, (page + 1) * limit - 1)`. Implement an `IntersectionObserver` sentinel in `Feed.jsx` to load more posts on scroll.
- **Risk:** Requires handling pagination state and empty termination when no more rows exist.
- **Verification Plan:** Confirm initial feed loads exactly 15 rows; scrolling to bottom fetches next 15 rows.
- **Confidence:** High

---

### Finding ID: PERF-006
- **Severity:** P2
- **Affected Feature:** Search Input Query Throttling
- **Observed Symptom:** Fast typing fires multiple un-throttled database queries.
- **Evidence:** [src/pages/Search.jsx:L52-66](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/pages/Search.jsx#L52-L66) triggers `searchProfiles(searchQuery)` inside `useEffect` on every keystroke without delay.
- **Expected Benefit:** 75%–85% reduction in search network queries during active typing.
- **Recommended Fix:**  
  Debounce `searchQuery` by 250ms using a `useDebounce` hook before calling `searchProfiles()`.
- **Risk:** 250ms perceived delay before results appear after typing stops.
- **Verification Plan:** Type 5 characters rapidly; verify exactly 1 network query is dispatched.
- **Confidence:** High

---

### Finding ID: PERF-007
- **Severity:** P2
- **Affected Feature:** Who To Follow Widget Query Serialization
- **Observed Symptom:** Right sidebar recommendations load with a 400ms–900ms waterfall.
- **Evidence:** [src/components/WhoToFollowWidget.jsx:L50-57](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/WhoToFollowWidget.jsx#L50-L57) executes a sequential `for (const u of topCandidates)` loop awaiting `getFollowStatus(currentUserId, u.id)` one by one.
- **Expected Benefit:** Reduces candidate follow-status resolution from ~600ms to < 120ms.
- **Recommended Fix:**  
  Batch query follow statuses using `.in('following_user_id', candidateIds)` or `Promise.all`.
- **Risk:** None.
- **Verification Plan:** Confirm candidate follow statuses resolve in a single network roundtrip.
- **Confidence:** High

---

### Finding ID: PERF-008
- **Severity:** P2
- **Affected Feature:** Post Media Image Rendering & Layout Shifts
- **Observed Symptom:** Cumulative Layout Shift (CLS) as post images load; off-screen images download eagerly.
- **Evidence:** [src/components/PostMedia.jsx:L103-115](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/components/PostMedia.jsx#L103-L115) renders `<img>` tags without `loading="lazy"`, `decoding="async"`, or aspect ratios.
- **Expected Benefit:** Eliminates layout jumps and conserves mobile data.
- **Recommended Fix:**  
  Add `loading="lazy"`, `decoding="async"`, and reserved aspect ratio styling (`aspectRatio: '16/9'`).
- **Risk:** None.
- **Verification Plan:** Verify off-screen images do not load until scrolled near viewport.
- **Confidence:** High

---

### Finding ID: PERF-009
- **Severity:** P2
- **Affected Feature:** Supabase Realtime Channel Duplication
- **Observed Symptom:** Multiple channels listening to post events simultaneously.
- **Evidence:** [src/lib/postService.js:L416](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/postService.js#L416) subscribes to `public_posts_realtime` while [src/lib/socialService.js:L842](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/src/lib/socialService.js#L842) subscribes to `global_posts_channel` on startup.
- **Expected Benefit:** Halves Realtime WebSocket message overhead.
- **Recommended Fix:**  
  Decommission legacy `globalPostsChannel` in `socialService.js` and route all post events through `postService.js`.
- **Risk:** Ensure legacy components receive post events through the unified service.
- **Verification Plan:** Confirm exactly 1 WebSocket channel exists for posts in browser network panel.
- **Confidence:** High

---

## 14. RECOMMENDED FIXES (ACTIONABLE PROPOSALS)

1. **Fix PERF-001 (Post Interactions):**
   - In `supabase_posts_schema.sql`, add database triggers on `post_likes` and `post_comments` to increment/decrement `posts.likes_count` and `posts.comments_count`.
   - Modify `getPosts()` to return `likes_count` and `comments_count` directly from the `posts` table.
   - For user-specific state (`likedByMe`, `savedByMe`), execute a single batch query:
     ```javascript
     const { data: myLikes } = await supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', uid);
     const { data: mySaves } = await supabase.from('post_saves').select('post_id').in('post_id', postIds).eq('user_id', uid);
     ```
   - Pass `likedByMe` and `savedByMe` as props into `<PostCardInteractions />`, eliminating all per-card mount queries and per-card WebSocket channels.
2. **Fix PERF-002 (Missing `post_media` table):**
   - In `src/lib/postService.js`, simplify `attachPostMedia()` to immediately return `postsList.map(p => formatPostRow(p))`.
   - Remove the failing `supabase.from('post_media')` query.
3. **Fix PERF-003 (PostView Opening Latency):**
   - Update `handleNavigateToPostView(postId, { initialPost, returnContext })` in `App.jsx`.
   - In `PostView.jsx`, initialize `post = initialPost`. If `initialPost` is present, display it instantly without setting `loading = true`. Fetch fresh comments in the background.
4. **Fix PERF-004 (Bundle Optimization):**
   - In `src/App.jsx`, convert pages below the fold or behind navigation (Settings, ProfileDetails, ProjectsPage, ExperiencePage, EducationPage, ItemUpdatesPage) to `React.lazy()`.
   - In `vite.config.js`, configure `rollupOptions.output.manualChunks`:
     ```javascript
     manualChunks: {
       vendor: ['react', 'react-dom'],
       supabase: ['@supabase/supabase-js'],
       icons: ['lucide-react']
     }
     ```
5. **Fix PERF-005 (Feed Pagination):**
   - In `src/lib/postService.js`, add `.range(page * 15, (page + 1) * 15 - 1)` to `getPosts()`.
   - Add infinite scroll sentinel in `Feed.jsx`.
6. **Fix PERF-006 (Search Debounce):**
   - Add a standard 250ms debounce before invoking `searchProfiles()` in `Search.jsx`.
7. **Fix PERF-007 (WhoToFollow Batching):**
   - Replace the `for...of` loop in `WhoToFollowWidget.jsx` with a single batch `follow_requests` query.
8. **Fix PERF-008 (Image Optimization):**
   - Add `loading="lazy"` and `decoding="async"` to `<img>` tags in `PostMedia.jsx`.
9. **Fix PERF-009 (Realtime Consolidation):**
   - Remove `initGlobalPostsRealtime()` from `socialService.js`.

---

## 15. RISKS, DEPENDENCIES & PREREQUISITES

- **Zero-Git & Preserved State:** All optimizations must be applied strictly to local source code without affecting Git status or remote deployments.
- **Messaging Scope Rule:** Direct messaging (`/messages/:id`, composer, WebSocket subscriptions, message history) must remain 100% untouched.
- **Supabase Free-Tier WebSocket Limits:** Current architecture opens 26 channels for 26 posts, dangerously approaching concurrent connection limits. Consolidating to 1 global channel removes this risk entirely.
- **Data Integrity:** Using database triggers for `likes_count` and `comments_count` requires careful concurrency handling (`SECURITY DEFINER` trigger functions).

---

## 16. RECOMMENDED IMPLEMENTATION ORDER

```mermaid
graph TD
    A[Step 1: Eliminate post_media 404 query overhead - PERF-002] --> B[Step 2: Batch Post Interactions - PERF-001]
    B --> C[Step 3: PostView Optimistic State Passing - PERF-003]
    C --> D[Step 4: Feed Pagination - PERF-005]
    D --> E[Step 5: Bundle Splitting React.lazy & Vite chunks - PERF-004]
    E --> F[Step 6: Search Debounce & WhoToFollow Batch - PERF-006, PERF-007]
    F --> G[Step 7: Image Lazy Loading & Aspect Ratios - PERF-008]
    G --> H[Step 8: Realtime Channel Consolidation - PERF-009]
```

1. **Step 1 (Immediate Quick Win):** Remove nonexistent `post_media` query from `postService.js` (saves 344ms on every post operation).
2. **Step 2 (Highest Impact):** Batch post interaction queries in `Feed.jsx` and pass down interaction state to `PostCardInteractions.jsx` (drops feed requests from ~490 to ~15 and feed load time by > 80%).
3. **Step 3 (Immediate Post Opening Win):** Pass `initialPost` to `PostView` for instant < 100ms post opening.
4. **Step 4 (Scalability):** Add 15-post pagination to `getPosts()`.
5. **Step 5 (Initial Load):** Route-level code splitting with `React.lazy()` and Vite manualChunks.
6. **Step 6 & 7 (Polish):** Search input debounce, WhoToFollow batch query, and image lazy loading.
7. **Step 8 (Cleanup):** Decommission redundant legacy Realtime channel in `socialService.js`.

---

## 17. VALIDATION TESTS REQUIRED AFTER FIXES

1. **Feed Request Count Test:** Verify that loading Home feed with 26 posts produces $\le 20$ network requests (down from 495).
2. **Feed Settled Duration Test:** Verify that Home feed stabilizes in $< 1,200\text{ms}$ (down from 10,148ms).
3. **Post Open Transition Test:** Verify that clicking a post in Feed/Search/Notifications opens `PostView` in $< 150\text{ms}$ without a blank spinner.
4. **Bundle Size Test:** Run `npm run build` and verify main bundle entry is $< 450\text{ KB}$ (down from 1.07 MB).
5. **Console Cleanliness Test:** Verify zero HTTP 404 errors for `post_media` in browser console.
6. **Search Keystroke Test:** Type 5 characters in Search; verify exactly 1 query is dispatched.
7. **Messaging Invariance Test:** Run `website_testing/verify_all_chat_layout_requirements.cjs` and confirm 100% pass rate with zero chat regressions.

---

## 18. UNRESOLVED QUESTIONS & ITEMS NOT MEASURED

1. **Remote Database Execution Plans (`EXPLAIN ANALYZE`):**  
   Marked as **NOT AVAILABLE**. In strict accordance with audit rules, no destructive operations, elevated DB role commands, or load tests were executed against the remote Supabase database.
2. **Server-Side Post Count Triggers in Production:**  
   Whether database triggers for `likes_count` and `comments_count` can be deployed depends on remote migration access in the subsequent implementation phase. Client-side batching (`get_feed_interactions_batch`) can be implemented immediately without schema mutations.

---

## 19. EXPLICIT CONFIRMATION

- **Zero Git Operations:** Absolutely NO Git commands (`git status`, `git diff`, `git add`, `git commit`, `git push`, etc.) were executed during this audit.
- **Zero Project Source Modifications:** No files in `src/`, `index.html`, `vite.config.js`, or project configs were edited, created, or deleted. All audit runner scripts and reports were written strictly in `website_testing/` and the Antigravity task workspace.
- **Zero Database Mutations:** No SQL migrations, table modifications, or data generation/deletion occurred in the production database.
- **Direct Messaging Integrity:** Direct messaging interfaces, WebSocket subscriptions, conversation layouts, and services were strictly preserved and left 100% untouched.
