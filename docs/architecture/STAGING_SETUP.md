# SINC — Staging Environment Setup & Configuration Guide

This document details the configuration requirements, environment variable boundaries, database migration order, and durable idempotency activation procedure for deploying the SINC platform to a staging environment.

---

## 1. Environment Variables Specification

The platform strictly segregates server-only credentials from client-facing variables. **Never expose server-only variables to browser bundles (`NEXT_PUBLIC_` or `VITE_` prefixes).**

### A. Server-Only Environment Variables (Next.js Application & API Routes)

These variables must be configured in server runtime environments (e.g. Docker container, Vercel Server Environment, or Node.js server) and are never bundled into client JavaScript.

| Variable Name | Required | Purpose | Fail-Closed Behavior |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **Yes** | Server-side Supabase project URL for administrative & authorization queries. | Server returns `500` if missing during database lookups. |
| `SUPABASE_SECRET_KEY` | **Yes** | Supabase `service_role` secret key. Bypasses RLS to perform block lookups, visibility audits, and idempotency updates. | Server returns `500` fail-closed; no push dispatched. Never exposed in logs. |
| `SUPABASE_JWT_SECRET` | **Yes** | Secret or public key used to verify Supabase JWT signatures on incoming API requests. | API returns `500 Server Configuration Error` on any request. |
| `SUPABASE_JWT_ALGORITHM` | No | JWT verification algorithm (`HS256`, `RS256`, or `ES256`). Defaults to `HS256`. | Non-matching algorithm returns `401 Unauthorized`. |
| `PUSH_IDEMPOTENCY_STORE` | No | Storage engine for web push deduplication: `memory` (default) or `postgres`. | Defaults safely to in-memory store if unset. |
| `PUSH_EVENT_FRESHNESS_WINDOW_SECONDS` | No | Authoritative event freshness threshold in seconds. Defaults to `600` (10 minutes). | Stale events (> 10m) suppressed with status `200` (no dispatch, no UI error). |
| `VAPID_PRIVATE_KEY` | **Yes** | ECDSA private key for Web Push protocol signing (`web-push` library). | Web push dispatch returns `500` delivery error. |
| `VAPID_SUBJECT` | No | Contact URI for VAPID protocol header (e.g. `mailto:notifications@sinc.network`). | Defaults to internal platform contact. |

### B. Server-Only Environment Variables (Socket.IO Gateway)

These variables configure the standalone realtime auxiliary gateway (`backend/socket-gateway/server.js`).

| Variable Name | Required | Purpose | Fail-Closed Behavior |
| :--- | :--- | :--- | :--- |
| `SOCKET_PORT` | No | Port on which the Socket.IO server listens (default: `3001`). | Defaults to `3001`. |
| `SOCKET_CORS_ORIGIN` | **Yes** (in Staging/Prod) | Allowed origin(s) for WebSocket handshakes (e.g. `https://staging.sinc.network`). | Rejects cross-origin handshake requests. |
| `SUPABASE_JWT_SECRET` | **Yes** | Secret used to verify client JWT on initial Socket handshake auth packet. | Rejects connection during handshake auth with error. |
| `NODE_ENV` | No | Runtime mode (`staging` or `production`). | Determines log verbosity. |

### C. Client-Facing Environment Variables (Browser-Bundled)

These variables are baked into browser client bundles at build time. They contain only public identifiers and anonymous keys guarded by Supabase Row Level Security (RLS).

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL for browser client (`src/lib/supabase.ts`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous public key. All client operations subject to RLS. |
| `NEXT_PUBLIC_SOCKET_URL` | **Yes** | WebSocket gateway URL for client Socket.IO connection. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **Yes** | VAPID public key used by browser service worker to generate push subscriptions. |

---

## 2. Database Migration Application Order

All migrations are located in `supabase/migrations/` and must be applied sequentially to the staging Supabase project database.

> [!IMPORTANT]
> Migrations must **never** be run directly against production until verified on staging. Verify that each migration completes cleanly before executing the next.

| Execution Order | Migration File | Description & Purpose |
| :---: | :--- | :--- |
| **1** | `supabase/migrations/20261016_protect_user_private_details.sql` | Secures user profiles, privacy flags, and core private details. |
| **2** | `supabase/migrations/20261020_web_push_subscriptions.sql` | Creates `public.push_subscriptions` table with RLS and user indexing. |
| **3** | `supabase/migrations/20261025_push_idempotency_keys.sql` | Creates `public.push_idempotency_keys` table with strict RLS (service_role only). |
| **4** | `supabase/migrations/20261025_follow_requests_accepted_at.sql` | Adds dedicated `accepted_at` column, partial index, and transition trigger to `public.follow_requests`. |

### Applying Migrations via Supabase CLI (Staging)

```bash
# Link to staging project
supabase link --project-ref <STAGING_PROJECT_REF>

# Apply pending migrations in order
supabase db push
```

Alternatively, copy and run each SQL script sequentially in the Supabase Dashboard SQL Editor for the staging project.

---

## 3. Switching `PUSH_IDEMPOTENCY_STORE` to PostgreSQL

By default, the application runs with an in-memory idempotency store (`MemoryPushIdempotencyStore`), which deduplicates push requests within a single Node.js process. In staging and production with multiple container instances, durable PostgreSQL-backed idempotency should be enabled.

### Step-by-Step Activation Procedure

1. **Verify Database Migration:**
   Confirm that migration `20261025_push_idempotency_keys.sql` has been executed on the staging database:
   ```sql
   SELECT table_name, rowsecurity 
   FROM information_schema.tables 
   JOIN pg_tables ON information_schema.tables.table_name = pg_tables.tablename 
   WHERE table_name = 'push_idempotency_keys';
   ```
   *Expected output: 1 row, `rowsecurity = true`.*

2. **Verify Server Environment Variables:**
   Ensure both server-only variables are configured in the environment:
   - `SUPABASE_URL` (pointing to the staging database)
   - `SUPABASE_SECRET_KEY` (staging `service_role` key)

3. **Set the Store Flag:**
   Add or update the environment variable in the staging environment:
   ```env
   PUSH_IDEMPOTENCY_STORE=postgres
   ```

4. **Restart Application Server:**
   Deploy or restart the Next.js application service so the process re-evaluates the environment variable on initialization.

5. **Verify Activation via Server Logs:**
   On the first Web Push request, the server logs will reflect:
   ```
   [ServerAuth] Initializing PostgreSQL push idempotency store
   ```

6. **Validate Concurrency & Deduplication:**
   Verify that replayed push dispatches receive `{ duplicate: true, idempotent: true, replayed: true }` and return status `200` without triggering secondary mobile/browser push deliveries.
