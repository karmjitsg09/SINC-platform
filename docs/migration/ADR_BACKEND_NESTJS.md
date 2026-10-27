# Architecture Decision Record (ADR): SINC Backend Migration to NestJS

**Status:** APPROVED FOR ARCHITECTURAL REVIEW  
**Date:** October 2026  
**Context:** SINC Platform Architecture Modernization  
**Decision Makers:** System Architect, Security Lead, Full-Stack Engineering Team  

---

## 1. Context & Problem Statement

SINC currently operates a hybrid client-heavy architecture:
- Next.js 14 frontend makes direct client-side PostgreSQL queries to Supabase (`supabase.from()`, `rpc()`, `channel()`) for feeds, social interactions, updates, and messaging.
- Realtime typing indicators, presence, and auxiliary notifications run in a standalone Socket.IO gateway (`backend/socket-gateway/server.js`).
- Push notification authorization, event freshness validation, and idempotency locks are handled inside Next.js serverless API routes (`src/app/api/send-web-push/route.ts` and `src/lib/serverAuth.ts`).
- While Supabase RLS enforces basic row isolation, complex business logic (bidirectional social block enforcement, event freshness, notification dispatch, transactional chat delivery, rate limiting, and background workers) requires a unified, high-performance, testable, and robust application server.

### Proposed Solution
Consolidate all business logic, data mutation, access control, WebSockets, background queues, and rate limiting into a **NestJS API application** (`backend/api`), backed by **Prisma ORM**, **Socket.IO** (with Redis adapter), and **BullMQ** on **Redis**, while keeping Supabase as the managed PostgreSQL host, Auth provider, and file Storage engine.

---

## 2. Decision Summary

```
+-----------------------------------------------------------------------------------+
|                                 SINC ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +--------------------+         HTTPS (Auth Only)         +--------------------+  |
|  |                    | --------------------------------> |   Supabase Auth    |  |
|  |                    | <-------------------------------- | (OAuth, Sessions)  |  |
|  |                    |                                   +--------------------+  |
|  |   Next.js 14       |         HTTPS Signed Upload       +--------------------+  |
|  |   Frontend         | --------------------------------> |  Supabase Storage  |  |
|  |   (Strictly UI)    |                                   |  (S3 Object Store) |  |
|  |                    |                                   +--------------------+  |
|  |                    |         REST API (/api/v1)                                |
|  |                    | --------------------------------\                         |
|  |                    |         WSS (Socket.IO)          \                        |
|  |                    | <==============================\  \                       |
|  +--------------------+                                 \  \                      |
|                                                          v  v                     |
|                                       +----------------------------------------+  |
|                                       |           NestJS API Server            |  |
|                                       |   - JwtAuthGuard (Supabase JWT)        |  |
|                                       |   - AccessPolicyService                |  |
|                                       |   - Socket.IO Gateway (Redis Adapter)  |  |
|                                       |   - Prisma Client (Public Schema)      |  |
|                                       +----------------------------------------+  |
|                                                    |              |               |
|                           Prisma SQL (Pooled 6543) |              | BullMQ Queue  |
|                                                    v              v               |
|                                       +------------------+  +------------------+  |
|                                       |   Supabase DB    |  |  Redis (Managed) |  |
|                                       |  (PostgreSQL 15) |  | - Rate Limiter   |  |
|                                       |  - Public Schema |  | - Socket Adapter |  |
|                                       |  - RLS Defense   |  | - BullMQ State   |  |
|                                       +------------------+  +------------------+  |
|                                                                   |               |
|                                                                   | Pop Job       |
|                                                                   v               |
|                                                             +------------------+  |
|                                                             |  BullMQ Worker   |  |
|                                                             |  - Web Push Send |  |
|                                                             |  - Notifications |  |
|                                                             |  - Data Cleanup  |  |
|                                                             +------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Module Architecture (`backend/api/src/modules`)

The API is decomposed into 18 focused, decoupled modules:

1. **`AuthModule`**: Validates Supabase JWTs via `JwtAuthGuard` (supporting both symmetric HS256 and asymmetric JWKS), extracts verified claims, binds authoritative identity to `@CurrentUser()`. Fail-closed on missing configuration.
2. **`UsersModule`**: Public profile views, profile updates, account settings, and owner-only private contact details (`/users/me/private`).
3. **`ProfileSetupModule`**: Multi-step onboarding wizard orchestration, username availability check, domain and skill binding.
4. **`ProfileSectionsModule`**: Manages user portfolio sections: projects, experience, education, certifications, achievements, and section revision histories.
5. **`DomainsModule`**: Domain directories, channels, and user domain memberships.
6. **`FollowsModule`**: Send, accept, reject, cancel, and unfollow workflows. Enforces relationship state machine and trigger compatibility.
7. **`BlocksModule`**: Atomic block/unblock, bidirectional block checks, follow cleanup upon block.
8. **`AccessPolicyModule`**: Exposes injectable `AccessPolicyService` encapsulating all social privacy, follower gates, block checks, and conversation boundaries.
9. **`PostsModule`**: Post creation, deletion, domain filtering, and cursor-based feed pagination.
10. **`EngagementModule`**: Unified post engagement handling:
    - Likes: Atomic toggle of post likes with counter synchronization (`/posts/:id/likes`)
    - Comments: Comment creation, hierarchical replies, deletion by author or post owner (`/posts/:id/comments`)
    - Saves: Private bookmarks and saved post feeds (`/posts/:id/saves`, `/saves`)
    - Shares: Share event logging and metrics (`/posts/:id/shares`)
    *(Merged because all four interactions operate directly on `public.posts`, share parent-post visibility rules via `AccessPolicyService`, and are hydrated simultaneously on post feeds).*
11. **`StoriesModule`**: 24-hour expiring updates, story media association, and impression tracking (`update_views`).
12. **`SearchModule`**: Global and scoped search across users/profiles, posts, domains, and job roles. Results strictly respect private profile follower gates and bidirectional block filters via `AccessPolicyService`.
13. **`ConversationsModule`**: Direct and group conversation lifecycle, member management, unread counts.
14. **`MessagesModule`**: Chat message persistence, cursor-based pagination, read receipts, and post-commit Socket.IO emission.
15. **`NotificationsModule`**: Server-generated in-app notification queries, mark-as-read, read-all.
16. **`PushModule`**: Device push subscription registration, unregistration, and BullMQ push dispatch producer.
17. **`UploadsModule`**: Issues pre-signed URLs for direct client uploads to Supabase Storage (`post-media`, `updates-media`, avatars), enforcing MIME type, size, and user directory sandboxing.
18. **`HealthModule`**: Liveness and readiness probes checking PostgreSQL connectivity, Redis latency, and BullMQ queue health.

---

## 4. API Design Standards

### 4.1 URL & Versioning Conventions
- Base prefix: `/api/v1`
- Resource paths: Plural nouns (e.g. `/api/v1/posts`, `/api/v1/conversations`)
- Sub-resources: Nested paths (e.g. `/api/v1/posts/:postId/comments`)
- RPC/Actions: Post to explicit verbs when not standard CRUD (e.g. `POST /api/v1/follows/:id/accept`)

### 4.2 Data Transfer Objects (DTO) & Strict Validation
All endpoints enforce input validation using `class-validator` and `class-transformer`:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unwhitelisted properties
    forbidNonWhitelisted: true,  // Reject payloads containing rogue properties
    transform: true,              // Automatically cast types
    transformOptions: { enableImplicitConversion: true }
  })
);
```

### 4.3 Error Handling & Response Format
All errors adhere to a standardized schema:
```json
{
  "statusCode": 403,
  "message": "Cannot view private content of non-followed user",
  "error": "Forbidden",
  "timestamp": "2026-10-25T11:45:00.000Z",
  "path": "/api/v1/posts/p-123"
}
```

### 4.4 Pagination Architecture
Feeds and message histories use **cursor-based pagination** to eliminate page-drift on live updates:
- Query parameters: `?limit=20&cursor=eyJjcmVhdGVkQXQiOi...`
- Cursor payload: Base64-encoded JSON `{ createdAt: string, id: string }`.
- Response structure:
  ```json
  {
    "data": [ ... ],
    "pagination": {
      "limit": 20,
      "hasNextPage": true,
      "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTI1..."
    }
  }
  ```

---

## 5. Authentication & Authorization Architecture

### 5.1 Supabase JWT Verification Guard (`JwtAuthGuard`)
The NestJS API acts as a Resource Server validating tokens issued by Supabase Auth:
- **Signing Mode Enforced**: `HS256` (Symmetric HMAC-SHA256) matching current confirmed deployment, with JWKS asymmetric key fallback support when rotated.
- **Fail-Closed Guarantee**: If `SUPABASE_JWT_SECRET` is unset, the guard immediately rejects all requests with HTTP 500.
- **Claims Extracted**:
  - `sub`: Authoritative User UUID (bound to `req.user.id`).
  - `email`: Authenticated user email.
  - `exp`: Timestamp expiration check.
  - `role`: Role validation (`authenticated`).

### 5.2 `@CurrentUser()` Decorator
Client-sent `userId` parameters in headers or bodies are **strictly forbidden** for identity determination. All controllers obtain identity via:
```typescript
@Get('me')
async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
  return this.usersService.getProfile(user.id);
}
```

### 5.3 Centralized `AccessPolicyService`
Instead of duplicating RLS policies in individual controllers, all authorization rules are encapsulated in `AccessPolicyService`:
- `canViewProfile(viewerId, targetUserId)`: Checks public/private status, accepted follow, and blocks.
- `canViewPost(viewerId, post)`: Checks post privacy, author block status, and accepted follow.
- `assertNotBlocked(userA, userB)`: Throws `ForbiddenException` if a block exists in either direction ($A \rightarrow B$ or $B \rightarrow A$).
- `assertConversationMember(userId, conversationId)`: Validates membership before allowing reads, writes, or room joins.
- `assertNotificationRecipient(userId, notificationId)`: Ensures a user cannot read/acknowledge another user's notifications.

---

## 6. Database & Prisma Strategy

### 6.1 Schema Ownership
- **Single Owner**: SQL migrations in `supabase/migrations/` remain the authoritative owner of the database schema and RLS policies.
- **Prisma's Role**: Prisma is strictly a **type-safe data access client**.
- **Introspection Workflow**: Prisma introspects the public schema (`npx prisma db pull`). It generates types via `npx prisma generate`.
- **Safety Directive**: `prisma migrate dev` is NOT run directly against shared or production databases. Schema changes are applied via versioned SQL migration scripts, followed by `prisma db pull`.

### 6.2 Connection Architecture & Network Topologies
NestJS is a long-running, persistent application process (unlike ephemeral serverless functions). Therefore:
- **Runtime Connection (`DATABASE_URL`)**: Uses the **Supabase Session Pooler** (`port 5432`) or a **direct connection** (`port 5432`), NOT the transaction pooler (`port 6543`). The session pooler supports prepared statements, advisory locks, and persistent connection lifecycles needed by long-running NestJS services.
- **Transaction Pooler Exception**: If the transaction pooler (`port 6543`) is ever used under extreme concurrency, the connection URL MUST include `?pgbouncer=true` to disable prepared statements in Prisma.
- **Direct Connection URL (`DIRECT_URL`)**: Direct PostgreSQL connection (`port 5432`) is used exclusively for migrations, DDL, and local Docker initialization.
- **IPv4 vs. IPv6 Network Considerations**:
  - Direct connections to AWS Supabase database hosts require native IPv6 networking. Many cloud container hosting providers operate on IPv4-only networks by default.
  - The **Supabase Session Pooler** (`aws-0-[region].pooler.supabase.com:5432/postgres`) natively provides IPv4 resolution, ensuring reliable connectivity from any IPv4 container host.

### 6.3 Multi-Schema Isolation
Prisma's `schema.prisma` is explicitly configured to manage **only** the `public` schema:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas  = ["public"]
}
```
Tables in `auth` (e.g. `auth.users`) and `storage` (e.g. `storage.objects`) are NEVER managed or mutated by Prisma. References to `auth.users` are maintained via foreign keys or UUID identity strings.

---

## 7. Redis & BullMQ Architecture

### 7.1 Redis Key Spaces & TTL Policies
| Key Pattern | Purpose | Data Type | TTL |
| :--- | :--- | :--- | :--- |
| `rl:ip:<ip>:<route>` | Unauthenticated endpoint rate limiting | Integer Counter | 60 seconds |
| `rl:user:<userId>:<route>` | Authenticated endpoint rate limiting | Integer Counter | 60 seconds |
| `sinc:presence:<userId>` | Active WebSocket socket IDs for user | Set | 60 seconds (heartbeat refreshed) |
| `sinc:lock:<eventKey>` | Distributed lock for event dispatch | String (Token) | 30 seconds (auto-release) |
| `sinc:cache:user:<userId>` | Hot profile metadata cache | JSON String | 300 seconds (invalidated on update) |

### 7.2 BullMQ Background Queues
Background operations are decoupled from HTTP request cycles:

1. **`push-dispatch` Queue**:
   - **Job ID**: Natural event key (e.g. `push:event:message:<cid>:<mid>`). BullMQ automatically deduplicates jobs sharing identical Job IDs within the queue window.
   - **Job Data**: `{ recipientId, callerId, type, title, message, url, entityType, entityId, eventTimestamp }`.
   - **Freshness Check**: Worker verifies `eventTimestamp` is within the 10-minute freshness window before dispatch.
   - **Retries**: 3 attempts with exponential backoff (`attempts: 3, backoff: { type: 'exponential', delay: 2000 }`).
   - **Dead Letter Handling**: Permanently failed jobs are routed to `push-dispatch-dlq` and logged with full error diagnostics (no secrets).

2. **`notification-create` Queue**:
   - Triggered upon authoritative domain events (like, comment, follow request).
   - Inserts row into `public.notifications` and triggers Socket.IO `notification:received` emit.

3. **`maintenance-cleanup` Queue (Cron)**:
   - Daily cron (`0 3 * * *`): Purges expired 24-hr stories (`updates`) where `expires_at < now()`, removes orphan files, and cleans stale rate limit keys.

---

## 8. Realtime & Socket.IO Architecture

### 8.1 Horizontal Scaling & Transport Architecture
Socket.IO runs natively inside the NestJS process (`EventsModule`) configured with `@socket.io/redis-adapter`:
- **WebSocket Transport Only**: Frontend clients connect strictly via pure WebSockets (`transports: ['websocket']`).
- **No Sticky Sessions Required**: Because HTTP long-polling and transport upgrading are eliminated, socket connections establish an immediate bidirectional TCP/TLS pipe. Load balancers and ingress controllers require **zero sticky-session (session affinity) configuration**, significantly simplifying multi-container autoscaling.
- **Redis Adapter**: The `@socket.io/redis-adapter` relays broadcasts across all NestJS API instances via Redis Pub/Sub channels.

### 8.2 Rooms & Namespaces
- Root namespace: `/`
- User Room: `user:<userId>` — joined automatically upon verified handshake. Receives personal notifications and direct message pings.
- Conversation Room: `conversation:<conversationId>` — joined after `AccessPolicyService.assertConversationMember()`. Receives live chat messages and typing indicators.

### 8.3 Post-Commit Event Emission Guarantee
To prevent race conditions where a WebSocket client receives an event before the database transaction has committed:
1. All database operations execute inside a Prisma transaction (`prisma.$transaction`).
2. WebSocket emission occurs **strictly in the `afterCommit` hook** or immediately following successful transaction resolution.

---

## 9. Responsibilities Retained by Supabase

| Capability | Retained on Supabase? | Rationale |
| :--- | :---: | :--- |
| **User Authentication** | **YES** | Supabase Auth handles email verification, Google OAuth, password hashing (bcrypt), and session token rotation. |
| **Session Management** | **YES** | Browser holds Supabase session; sends JWT Bearer token to NestJS API. |
| **Object Storage (S3)** | **YES** | Storage buckets (`post-media`, `updates-media`, `avatars`) remain on Supabase. Uploads are direct from browser using pre-signed URLs issued by NestJS. |
| **PostgreSQL Database** | **YES** | High-availability PostgreSQL database, extensions (`pgcrypto`, `uuid-ossp`), backups, and read replicas hosted on Supabase. |
| **Row Level Security** | **YES** | Existing RLS policies remain enabled as defense-in-depth against direct database connections. |

---

## 10. Infrastructure & Hosting Requirements

For production stability and horizontal scalability:
1. **API Server (`backend/api`)**:
   - Persistent Node.js 20+ runtime container.
   - Horizontal scaling (minimum 2 replicas for high availability).
   - Standard load balancing (no sticky sessions required thanks to pure WebSocket transport).
2. **Background Worker (`backend/worker`)**:
   - Separate Node.js container executing BullMQ consumers.
   - Scaled independently based on queue latency and job throughput.
3. **Managed Redis (v7+)**:
   - Managed Redis service (e.g. Upstash, AWS ElastiCache, or Redis Cloud).
   - Persistence enabled (AOF or RDB) for BullMQ reliability.
   - Minimum memory: 256 MB+ with eviction policy `noeviction` for BullMQ keys.
   - Minimum memory: 256 MB+ with eviction policy `noeviction` for BullMQ keys.

---

## 11. Migration Phasing & Operator Review Stop

As mandated by the master prompt:
- **Phase 1 (Audit)**: COMPLETE (documented in `docs/migration/BACKEND_INVENTORY.md`).
- **Phase 2 (Architecture Decision Record)**: COMPLETE (this document).
- **Execution Rule**: STOP immediately after Phase 2 for operator review before any NestJS code scaffolding or Prisma operations commence.
