# SINC Database Schema Diff: Real Production vs Synthesized Baseline

**Generated Date:** 2026-10-25  
**Data Source:** Authoritative PostgreSQL Catalog Extraction via Read-Only Role (`sinc_readonly`) on Live Production Database (`aws-0-ap-northeast-1.pooler.supabase.com`)  
**Scope:** `public` schema tables, columns, constraints, foreign keys, triggers, and Row Level Security policies

---

## Executive Summary

The initial Phase 3 baseline (`00000000000000_baseline.sql`) and handwritten `schema.prisma` were synthesized from historical draft SQL files in `backend/schemas/`. Live catalog extraction of the real production database reveals **significant architectural divergence**:

1. **14 Public Tables Exist in Production:** `profiles`, `posts`, `post_comments`, `post_likes`, `post_saves`, `post_shares`, `updates`, `update_views`, `follow_requests`, `conversations`, `conversation_members`, `messages`, `message_status`, `notifications`.
2. **Missing Speculative Tables:** 9 tables present in the synthesized baseline and handwritten schema **do not exist in production**:
   - `user_private_details` (from unapplied migration `20261016_...`)
   - `blocked_users`
   - `profile_projects`, `profile_experience`, `profile_education`, `profile_certifications`, `profile_achievements`, `profile_item_updates`
   - `user_domains`, `domain_messages`
   - `post_media`
   - `push_subscriptions` (from unapplied migration `20261020_...`)
   - `push_idempotency_keys` (from unapplied migration `20261025_...`)
3. **Discovered Table in Production:** `message_status` (`message_id`, `user_id`, `status` IN ('sent', 'delivered', 'read'), `created_at`) actively manages message delivery and read state in production.
4. **Column Naming Divergences:**
   - `follow_requests`: Uses `follower_user_id` and `following_user_id` (not `requester_id`/`target_id`). Does **not** have `accepted_at`.
   - `update_views`: Uses `viewer_id` (not `user_id`).
   - `posts`: Has `video_url` and `post_type`. Does **not** have counter caches (`likes_count`, `comments_count`, `shares_count`) or `is_private`.
   - `profiles`: Does **not** have `is_verified` or `verification_status`.
   - `messages`: Does **not** have `message_type` or `is_read` (`message_status` table handles read state).
   - `conversations`: Does **not** have `type` or `title`.

> [!IMPORTANT]
> **Row Count Caveat (RLS Filtering)**:
> Production row counts reported via `PROD_READONLY_DATABASE_URL` (using the read-only role `sinc_readonly`) are filtered by PostgreSQL Row Level Security (RLS) policies. In Supabase, non-superuser database roles without explicit bypass-RLS privileges only see rows permitted by RLS policies for that role (or unauthenticated/public views). Therefore, row counts returned by queries using the read-only role (e.g. `0` rows on tables with `TO authenticated` policies) reflect RLS visibility rather than the true physical totals stored in the database.

| Table Name | In Production Catalog? | In Synthesized Baseline? | In Handwritten `schema.prisma`? | Notes & Divergence |
| :--- | :---: | :---: | :---: | :--- |
| `profiles` | **YES** | YES | YES | Production lacks `is_verified`, `verification_status`. Foreign key points to `auth.users(id) ON DELETE CASCADE`. |
| `posts` | **YES** | YES | YES | Production contains `video_url` and `post_type`. Production **lacks** `likes_count`, `comments_count`, `shares_count`, `is_private`. |
| `post_comments` | **YES** | YES | YES | Matches production catalog. |
| `post_likes` | **YES** | YES | YES | Matches production catalog. Unique constraint: `(post_id, user_id)`. |
| `post_saves` | **YES** | YES | YES | Matches production catalog. Unique constraint: `(post_id, user_id)`. |
| `post_shares` | **YES** | YES | YES | Matches production catalog. Unique constraint: `(post_id, sender_id, recipient_id)`. |
| `updates` | **YES** | YES | YES | Matches production catalog. Contains check constraints `updates_has_content` and `updates_media_type_check`. |
| `update_views` | **YES** | YES | YES | Production column is `viewer_id`, NOT `user_id`. Unique on `(update_id, viewer_id)`. |
| `follow_requests` | **YES** | YES | YES | Production uses `follower_user_id` and `following_user_id` (NOT `requester_id`/`target_id`). Lacks `accepted_at`. |
| `conversations` | **YES** | YES | YES | Production has `(id, created_at, updated_at, last_message_id)`. Lacks `type` and `title`. |
| `conversation_members` | **YES** | YES | YES | Matches production catalog. |
| `messages` | **YES** | YES | YES | Production has `(id, conversation_id, sender_id, content, created_at)`. Lacks `message_type` and `is_read`. |
| `message_status` | **YES** | **NO** | **NO** | **Present in production.** Tracks message delivery (`sent`, `delivered`, `read`). |
| `notifications` | **YES** | YES | YES | Production foreign keys `recipient_id` and `actor_id` point directly to `auth.users(id)`. |
| `user_private_details` | **NO** | YES | YES | Defined in migration `20261016_...`, but **not yet applied to production**. |
| `push_subscriptions` | **NO** | YES | YES | Defined in migration `20261020_...`, but **not yet applied to production**. |
| `push_idempotency_keys`| **NO** | YES | YES | Defined in migration `20261025_...`, but **not yet applied to production**. |
| `blocked_users` | **NO** | YES | YES | Speculative SQL file in `docs/archive/schemas/`; never applied to production. |
| `profile_projects` | **NO** | YES | YES | Speculative draft; never created in production. |
| `profile_experience` | **NO** | YES | YES | Speculative draft; never created in production. |
| `profile_education` | **NO** | YES | YES | Speculative draft; never created in production. |
| `profile_certifications` | **NO** | YES | YES | Speculative draft; never created in production. |
| `profile_achievements` | **NO** | YES | YES | Speculative draft; never created in production. |
| `profile_item_updates` | **NO** | YES | YES | Speculative draft; never created in production. |
| `user_domains` | **NO** | YES | YES | Speculative draft; never created in production. |
| `domain_messages` | **NO** | YES | YES | Speculative draft; never created in production. |
| `post_media` | **NO** | YES | YES | Speculative draft; never created in production. |

---

## 2. Functions & Triggers Comparison

### Real Production Catalog:
1. **Functions:**
   - `public.is_member_of(_conversation_id uuid, _user_id uuid) RETURNS boolean`: Security definer function checking conversation membership for RLS policies.
   - `public.update_posts_updated_at() RETURNS trigger`: Auto-updates `posts.updated_at` before update.
2. **Triggers:**
   - `posts_updated_at_trigger`: `BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION update_posts_updated_at()`.

### Synthesized Baseline (Archived):
- Contained synthesized functions `protect_profile_verification_fields()` and `set_follow_request_accepted_at()`. Neither exists in production.

---

## 3. Migration Files Status vs Production Catalog

Every existing migration file in `supabase/migrations/` was audited against the live catalog:

| Migration File | Objects Checked | Status in Production | Action Required |
| :--- | :--- | :---: | :--- |
| `00000000000000_baseline_from_production.sql` | 13 public tables, RLS policies, functions, triggers | **APPLIED (EXISTS)** | Marked as baseline source of truth. |
| `20261016_protect_user_private_details.sql` | Table `user_private_details`, triggers | **NOT APPLIED** | Leave unapplied. Do not run `db push` against production. |
| `20261020_web_push_subscriptions.sql` | Table `push_subscriptions`, RLS policies | **NOT APPLIED** | Leave unapplied. Do not run `db push` against production. |
| `20261025_follow_requests_accepted_at.sql` | Column `follow_requests.accepted_at`, trigger | **NOT APPLIED** | Leave unapplied. Confirmed NOT in production catalog. |
| `20261025_push_idempotency_keys.sql` | Table `push_idempotency_keys` | **NOT APPLIED** | Leave unapplied. Confirmed NOT in production catalog. |

---

## 4. Prisma Introspection Reconciliation

- The previous handwritten schema at `docs/archive/schema.prisma.handwritten` contained 22 models, of which 9 models referenced non-existent tables.
- The introspected `schema.prisma` contains the 14 models accurately reflecting the database structure (`conversation_members`, `conversations`, `follow_requests`, `message_status`, `messages`, `notifications`, `post_comments`, `post_likes`, `post_saves`, `post_shares`, `posts`, `profiles`, `update_views`, `updates`).
- Relation fields, column mappings, and constraints in `backend/api` must use the real introspected models (`profiles`, `posts`, `follow_requests` with `follower_user_id`/`following_user_id`, etc.).
