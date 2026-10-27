# Database Schema Baseline Procedure

**Document Version:** 1.0.0  
**Target:** Operator & Backend Engineering  
**Scope:** Creating an Authoritative Baseline Migration in `supabase/migrations`

---

## 1. Overview & Objective

To establish a single, indisputable **schema source of truth**, SINC requires an authoritative baseline migration. Historical SQL definitions previously scattered in `backend/schemas/` have been archived to [`docs/archive/schemas/`](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/docs/archive/schemas/).

Because some tables, RLS policies, and triggers were created directly in the remote Supabase SQL Editor over time, the real production database contains the definitive state. This document details the **strictly read-only procedure** for the operator to extract this schema and commit it as `supabase/migrations/00000000000000_baseline.sql`.

> [!CRITICAL]
> **Prisma Introspection Rule:**
> `prisma db pull` and `prisma generate` must **NEVER** run directly against the production database.
> Prisma will introspect an isolated **local Docker PostgreSQL** instance (or a confirmed staging database) instantiated from this baseline.

---

## 2. Operator Read-Only Extraction Procedure

### Step 2.1: Obtain Read-Only Connection Credentials
From the Supabase Dashboard:
- Navigate to `Project Settings -> Database -> Connection string -> URI`
- Select **Session pooler** (port 5432) or **Direct connection** (port 5432)
- Note: If using IPv4-only networks, use the session pooler (`aws-0-[region].pooler.supabase.com:5432/postgres`). Direct connection requires IPv6 on AWS Supabase regions.

```bash
# In your local shell (macOS/Linux):
export PROD_DB_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# In PowerShell (Windows):
$env:PROD_DB_URL = "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

---

### Step 2.2: Extract Schema-Only Dump (via `pg_dump` or Supabase CLI)

#### Option A: Using `pg_dump` (Recommended)
Execute a strictly schema-only dump targeting only the `public` schema. This extracts table DDL, constraints, foreign keys, triggers, functions, and RLS policies without touching data:

```bash
pg_dump "$PROD_DB_URL" \
  --schema-only \
  --schema=public \
  --quote-all-identifiers \
  --no-owner \
  --no-privileges \
  --file="supabase/migrations/00000000000000_baseline.sql"
```

*(Windows PowerShell equivalent):*
```powershell
pg_dump $env:PROD_DB_URL `
  --schema-only `
  --schema=public `
  --quote-all-identifiers `
  --no-owner `
  --no-privileges `
  --file="supabase/migrations/00000000000000_baseline.sql"
```

#### Option B: Using Supabase CLI (if project is linked)
```bash
supabase db dump --project-ref [PROJECT_REF] --schema-only --schema public -f supabase/migrations/00000000000000_baseline.sql
```

---

### Step 2.3: Verification of Baseline Migration
Verify that the output file contains all active public tables and RLS configurations:
```bash
# Confirm expected tables are present
grep -E "CREATE TABLE.*profiles" supabase/migrations/00000000000000_baseline.sql
grep -E "CREATE TABLE.*posts" supabase/migrations/00000000000000_baseline.sql
grep -E "CREATE TABLE.*conversations" supabase/migrations/00000000000000_baseline.sql
grep -E "CREATE POLICY" supabase/migrations/00000000000000_baseline.sql
```

Confirm:
1. File contains NO `INSERT INTO` or data rows (strictly DDL).
2. All tables from the Phase 1 audit (`profiles`, `posts`, `post_likes`, `post_comments`, `post_saves`, `post_shares`, `updates`, `update_views`, `follow_requests`, `conversations`, `conversation_members`, `messages`, `notifications`) are defined.
3. RLS policies and triggers (`trg_protect_profile_verification`, `trg_follow_request_accepted_at`) are captured.

---

## 3. Production Reconciliation & Safety Guard

> [!CAUTION]
> **NEVER RUN `supabase db push` AGAINST PRODUCTION:**
> The baseline migration (`00000000000000_baseline.sql`) and any migrations already present in production reflect tables, types, and triggers that already exist in the live database. Running `supabase db push` against production without reconciling migration history will attempt to re-create existing objects and cause hard failures or schema corruption.

### Migration History Reconciliation Procedure (Operator Manual Execution Only)
When linking Supabase CLI to remote production:
1. **Do NOT run `db push`.**
2. Check existing migration records on the remote project:
   ```bash
   npx supabase migration list
   ```
3. Mark ONLY the baseline as applied in the Supabase migration history table (`supabase_migrations.schema_migrations`), because catalog inspection on 2026-10-25 confirmed that ONLY the baseline tables currently exist in production:
   ```bash
   npx supabase migration repair --status applied 00000000000000
   ```
   > [!NOTE]
   > The later migrations (`20261016_protect_user_private_details.sql`, `20261020_web_push_subscriptions.sql`, `20261025_follow_requests_accepted_at.sql`, and `20261025_push_idempotency_keys.sql`) were confirmed via live catalog query **NOT** to exist in production yet. Do NOT mark them as applied until the operator decides to apply them.
4. Only once `supabase migration list` shows migration history synchronized may new migrations be planned.

---

## 4. Local Development Environment (Supabase CLI Stack)

Because the SINC database relies on Supabase-internal constructs (`auth.users`, `auth.uid()`, `authenticated`, and `anon` roles), local development runs on the **Supabase CLI Local Stack** (`npx supabase start`) powered by Docker Desktop, rather than plain Postgres.

1. **Prerequisites:**
   - Docker Desktop for Windows installed with WSL2 backend running.
2. **Start Local Supabase Stack:**
   ```bash
   npx supabase start
   ```
   This spins up the Supabase local suite (PostgreSQL 15, GoTrue Auth, Kong Gateway, Storage, and Studio).
   - Local DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - Local Kong API: `http://127.0.0.1:54321`
   - Local Studio: `http://127.0.0.1:54323`
3. **Start Local Redis:**
   ```bash
   docker compose up -d sinc-redis
   ```
   Redis runs on `localhost:6379`.
4. **Apply Local Migrations:**
   ```bash
   npx supabase db reset
   # or
   npx supabase migration up
   ```
5. **Introspect Schema with Prisma (Local DB Only):**
   ```bash
   cd backend/api
   npx prisma db pull --schema=./prisma/schema.prisma
   npx prisma generate
   ```

---

## 5. Ongoing Schema Migration Lifecycle

After baseline creation, all future schema changes follow this strict lifecycle:
```
1. Write versioned SQL migration in supabase/migrations/<timestamp>_<name>.sql
2. Apply to local Supabase stack: npx supabase migration up
3. Run Prisma introspection locally: cd backend/api && npx prisma db pull
4. Re-generate Prisma Client: npx prisma generate
5. Update DTOs, AccessPolicyService, and NestJS modules
6. Run unit and e2e test suites
```
This guarantees that PostgreSQL SQL migrations remain the single source of truth, while Prisma provides pure type-safety without destructive drift.

