# Architecture Decision Record (ADR): Prisma Schema Scope, Cross-Schema Auth References & Absolute Migration Ownership

## Status
Accepted and Applied (2026-10-25)

## Context
When introspecting the PostgreSQL database using Prisma CLI (`prisma db pull`), Supabase projects contain two relevant schemas:
1. `public`: The application domain schema containing user profiles, posts, comments, conversations, messages, notifications, and interaction tables.
2. `auth`: Supabase's internal identity and session management schema (including `auth.users`, `auth.refresh_tokens`, `auth.audit_log_entries`, `auth.sso_providers`, etc.).

Production and staging database tables include cross-schema foreign keys:
- `public.profiles.id -> auth.users.id` (ON DELETE CASCADE)
- `public.notifications.recipient_id -> auth.users.id` (ON DELETE CASCADE)
- `public.notifications.actor_id -> auth.users.id` (ON DELETE SET NULL)

## Problem & Requirements
1. **Introspection Compatibility**: When Prisma is restricted solely to `schemas = ["public"]`, `prisma db pull` halts or logs error `P4002` ("Cross schema references are only allowed when the target schema is listed in the schemas property").
2. **Read-Only Auth Models**: The NestJS backend application layer must treat `auth` models strictly as read-only references for referential joins, without modifying Supabase's identity tables.
3. **Database Schema Ownership**: The PostgreSQL database schema must NEVER be modified, migrated, or pushed to by Prisma. Prisma is strictly an ORM query and introspection tool. All DDL and schema modifications must strictly originate from versioned SQL migrations in `supabase/migrations/`.

## Decision
1. **Configure Prisma for Multi-Schema Introspection**:
   - `schema.prisma` is configured with `previewFeatures = ["multiSchema"]` and `schemas = ["public", "auth"]`.
   - `prisma db pull` introspects both `public` and `auth` schemas natively, allowing Prisma to construct cross-schema relations between domain models and `auth.users`.
2. **Auth Models are Read-Only References**:
   - The generated `auth.users` model in `schema.prisma` serves solely as a read-only foreign relation anchor. Application code must never issue mutations (`create`, `update`, `delete`) to `auth.*` models via Prisma Client.
3. **Absolute Schema Ownership by `supabase/migrations`**:
   - SQL migrations stored in `supabase/migrations/` are the **sole and authoritative schema owner** for all environments (development, staging, and production).
   - Any execution of `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push` is strictly prohibited.
   - Npm scripts `prisma:migrate` and `prisma:push` in `backend/api/package.json` are permanently blocked with error exits.
   - Automated unit test `tests/unit/test_prisma_schema_owner.cjs` runs continuously to fail any build or PR that introduces mutating Prisma migration commands or removes the schema ownership notice.

## Consequences
- **Positive**:
  - `prisma db pull` executes cleanly against Staging without `P4002` errors.
  - Cross-schema foreign keys to `auth.users` are accurately modeled with full type-safety in Prisma Client.
  - Database schema safety is strictly guaranteed: no ORM command can accidentally alter database tables or bypass Supabase RLS policies.
- **Maintenance**:
  - Whenever a new SQL migration is applied to Staging via the migration runner, developers re-sync Prisma by running `npm run prisma:pull` followed by `npm run prisma:generate`.

