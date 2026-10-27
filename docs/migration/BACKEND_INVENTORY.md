# SINC Backend Inventory & Migration Mapping

**Document Version:** 1.0.0  
**Phase:** 1 — Read-Only Comprehensive Audit  
**Date:** October 2026  
**Status:** Approved for Architecture Design (Phase 2)

---

## Executive Summary

This document establishes the exhaustive audit of all data operations, real-time communications, authorization policies, and server-side logic in the SINC codebase. Every client-side Supabase call, API route, server helper, Socket.IO event, and PostgreSQL database constraint (RLS, triggers, functions) is cataloged and directly mapped to its future destination in the **NestJS + Prisma + Socket.IO + Redis + BullMQ** backend.

---

## 1. Frontend Data Operations Inventory

The frontend codebase contains 215 Supabase operations across 25 service and component files. The table below details every data operation, table/resource touched, operation type, the frontend feature served, and the target NestJS module and endpoint/event.

| Source File | Resource / Target | Operation Type | Feature Served | Current Implementation | Target NestJS Module & Endpoint/Event |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/context/AuthContext.tsx` | Supabase Auth | Session check | App Initialization | `supabase.auth.getSession()` | `AuthModule` (Kept on Supabase client-side for sessions; token passed in Authorization header) |
| `src/context/AuthContext.tsx` | Supabase Auth | State listener | Realtime Auth State | `supabase.auth.onAuthStateChange()` | Client Supabase Auth listener (remains client-side for token renewal) |
| `src/context/AuthContext.tsx` | Supabase Auth | OAuth Login | Google Social Sign-In | `supabase.auth.signInWithOAuth()` | Client Supabase Auth (redirect flow) |
| `src/context/AuthContext.tsx` | Supabase Auth | Password Login | Email/Password Login | `supabase.auth.signInWithPassword()` | Client Supabase Auth |
| `src/context/AuthContext.tsx` | Supabase Auth | Sign Up | Registration | `supabase.auth.signUp()` | Client Supabase Auth |
| `src/context/AuthContext.tsx` | `public.profiles` | SELECT | Load Current Profile | `supabase.from('profiles').select('*').eq('id', ...)` | `UsersModule`: `GET /api/v1/users/me` |
| `src/context/AuthContext.tsx` | `public.user_private_details` | SELECT | Load Private Contact | `supabase.from('user_private_details').select('*').eq('user_id', ...)` | `UsersModule`: `GET /api/v1/users/me/private` |
| `src/context/AuthContext.tsx` | Supabase Auth | Password Reset | Forgot Password | `supabase.auth.resetPasswordForEmail()` | Client Supabase Auth |
| `src/context/AuthContext.tsx` | Supabase Auth | Password Update | Update Account Password | `supabase.auth.updateUser()` | Client Supabase Auth |
| `src/context/AuthContext.tsx` | Supabase Auth | Sign Out | Session Teardown | `supabase.auth.signOut()` | Client Supabase Auth + Socket disconnect |
| `src/components/common/SocketInitializer.tsx` | Supabase Auth | Session Token | Socket Connection | `supabase.auth.getSession()` | Passes JWT to NestJS Socket.IO handshake auth |
| `src/lib/profileService.ts` | `public.profiles` | SELECT | Public/User Profile View | `supabase.from('profiles').select(...)` | `UsersModule`: `GET /api/v1/users/:userId/profile` |
| `src/lib/profileService.ts` | `public.profiles` | UPDATE / UPSERT | Edit Profile / Wizard | `supabase.from('profiles').upsert(...)` | `UsersModule`: `PUT /api/v1/users/me/profile` |
| `src/lib/profileService.ts` | `public.user_private_details` | UPSERT | Save Private Contact | `supabase.from('user_private_details').upsert(...)` | `UsersModule`: `PUT /api/v1/users/me/private` |
| `src/lib/profileService.ts` | `public.profile_projects` | SELECT / INSERT / DELETE | Profile Projects Grid | `supabase.from('profile_projects')` | `ProfileSectionsModule`: `GET/POST/DELETE /api/v1/users/me/projects` |
| `src/lib/profileService.ts` | `public.profile_experience` | SELECT / INSERT / DELETE | Profile Experience Timeline | `supabase.from('profile_experience')` | `ProfileSectionsModule`: `GET/POST/DELETE /api/v1/users/me/experience` |
| `src/lib/profileService.ts` | `public.profile_education` | SELECT / INSERT / DELETE | Profile Education History | `supabase.from('profile_education')` | `ProfileSectionsModule`: `GET/POST/DELETE /api/v1/users/me/education` |
| `src/lib/profileService.ts` | `public.profile_certifications` | SELECT / INSERT / DELETE | Profile Certifications | `supabase.from('profile_certifications')` | `ProfileSectionsModule`: `GET/POST/DELETE /api/v1/users/me/certifications` |
| `src/lib/profileService.ts` | `public.profile_achievements` | SELECT / INSERT / DELETE | Profile Achievements | `supabase.from('profile_achievements')` | `ProfileSectionsModule`: `GET/POST/DELETE /api/v1/users/me/achievements` |
| `src/lib/profileService.ts` | `public.user_domains` | SELECT / INSERT / DELETE | Selected Domains | `supabase.from('user_domains')` | `DomainsModule`: `GET/PUT /api/v1/users/me/domains` |
| `src/lib/profileService.ts` | Storage `avatars` / `profiles` | Upload Photo | Avatar Image Upload | Direct upload via browser client | `UploadsModule`: `POST /api/v1/uploads/signed-url` (direct S3/Supabase upload with signed URL) |
| `src/lib/projectService.ts` | `public.projects` | CRUD | Standalone Projects | `supabase.from('projects')` | `ProjectsModule`: `/api/v1/projects` |
| `src/lib/experienceService.ts` | `public.experience` | CRUD | Standalone Experience | `supabase.from('experience')` | `ExperienceModule`: `/api/v1/experience` |
| `src/lib/educationService.ts` | `public.education` | CRUD | Standalone Education | `supabase.from('education')` | `EducationModule`: `/api/v1/education` |
| `src/lib/certificationService.ts` | `public.certifications` | CRUD | Standalone Certifications | `supabase.from('certifications')` | `CertificationsModule`: `/api/v1/certifications` |
| `src/lib/achievementService.ts` | `public.achievements` | CRUD | Standalone Achievements | `supabase.from('achievements')` | `AchievementsModule`: `/api/v1/achievements` |
| `src/lib/profileItemUpdateService.ts` | `public.profile_item_updates` | SELECT / INSERT | Profile Section Revisions | `supabase.from('profile_item_updates')` | `ProfileSectionsModule`: `GET/POST /api/v1/profile-items/:id/updates` |
| `src/lib/socialService.ts` | `public.profiles` | SELECT (ILIKE) | User Search & Discovery | `supabase.from('profiles').select(...).ilike(...)` | `SearchModule`: `GET /api/v1/search/users?q=...` |
| `src/lib/socialService.ts` | `public.follow_requests` | SELECT | Follow Relationship Check | `supabase.from('follow_requests').select(...)` | `FollowsModule`: `GET /api/v1/follows/status?userId=...` |
| `src/lib/socialService.ts` | `public.follow_requests` | INSERT | Send Follow Request | `supabase.from('follow_requests').insert(...)` | `FollowsModule`: `POST /api/v1/follows/request` |
| `src/lib/socialService.ts` | `public.follow_requests` | UPDATE ('accepted') | Accept Follow Request | `supabase.from('follow_requests').update({ status: 'accepted' })` | `FollowsModule`: `POST /api/v1/follows/:id/accept` |
| `src/lib/socialService.ts` | `public.follow_requests` | UPDATE ('rejected') | Reject Follow Request | `supabase.from('follow_requests').update({ status: 'rejected' })` | `FollowsModule`: `POST /api/v1/follows/:id/reject` |
| `src/lib/socialService.ts` | `public.follow_requests` | DELETE | Unfollow / Cancel Follow | `supabase.from('follow_requests').delete(...)` | `FollowsModule`: `DELETE /api/v1/follows/:id` |
| `src/lib/socialService.ts` | `public.notifications` | INSERT | Follow Notification | Direct browser insert into `notifications` | Removed from frontend. Created server-side in `FollowsService` on DB commit. |
| `src/lib/blockService.ts` | `public.blocked_users` | SELECT | Block Status Checks | `supabase.from('blocked_users').select(...)` | `BlocksModule`: `GET /api/v1/blocks` & `AccessPolicyService` |
| `src/lib/blockService.ts` | `public.blocked_users` | INSERT | Block User | `supabase.from('blocked_users').insert(...)` | `BlocksModule`: `POST /api/v1/blocks` |
| `src/lib/blockService.ts` | `public.blocked_users` | DELETE | Unblock User | `supabase.from('blocked_users').delete(...)` | `BlocksModule`: `DELETE /api/v1/blocks/:userId` |
| `src/lib/blockService.ts` | Database RPC | Atomic Block & Reject | `supabase.rpc('reject_and_block_user', ...)` | `BlocksModule`: `POST /api/v1/blocks` (handled via Prisma transaction) |
| `src/lib/postService.ts` | `public.posts` | SELECT (Pagination) | Global / Domain Feed | `supabase.from('posts').select(...).range(...)` | `PostsModule`: `GET /api/v1/posts?domain=...&cursor=...` |
| `src/lib/postService.ts` | `public.posts` | SELECT | Post Detail View | `supabase.from('posts').select(...).eq('id', ...)` | `PostsModule`: `GET /api/v1/posts/:postId` |
| `src/lib/postService.ts` | `public.posts` | INSERT | Create Feed Post | `supabase.from('posts').insert(...)` | `PostsModule`: `POST /api/v1/posts` |
| `src/lib/postService.ts` | `public.posts` | DELETE | Delete Post | `supabase.from('posts').delete().eq('id', ...)` | `PostsModule`: `DELETE /api/v1/posts/:postId` |
| `src/lib/postService.ts` | `public.post_media` | SELECT | Post Media Attachments | `supabase.from('post_media').select(...)` | `PostsModule`: included in post payload relations |
| `src/lib/postService.ts` | Supabase Realtime | Feed Invalidation | `supabase.channel('public_posts_realtime')` | `PostsGateway`: Socket.IO broadcast `post:created`, `post:deleted` |
| `src/lib/postInteractionService.ts` | `public.post_likes` | SELECT / COUNT | Get Likes & User Status | `supabase.from('post_likes').select(...)` | `EngagementModule`: `GET /api/v1/posts/:postId/likes` |
| `src/lib/postInteractionService.ts` | `public.post_likes` | INSERT | Like Post | `supabase.from('post_likes').insert(...)` | `EngagementModule`: `POST /api/v1/posts/:postId/likes` |
| `src/lib/postInteractionService.ts` | `public.post_likes` | DELETE | Unlike Post | `supabase.from('post_likes').delete(...)` | `EngagementModule`: `DELETE /api/v1/posts/:postId/likes` |
| `src/lib/postInteractionService.ts` | `public.post_comments` | SELECT | List Comments | `supabase.from('post_comments').select(...)` | `EngagementModule`: `GET /api/v1/posts/:postId/comments` |
| `src/lib/postInteractionService.ts` | `public.post_comments` | INSERT | Add Comment | `supabase.from('post_comments').insert(...)` | `EngagementModule`: `POST /api/v1/posts/:postId/comments` |
| `src/lib/postInteractionService.ts` | `public.post_comments` | DELETE | Delete Comment | `supabase.from('post_comments').delete(...)` | `EngagementModule`: `DELETE /api/v1/comments/:commentId` |
| `src/lib/postInteractionService.ts` | `public.post_saves` | SELECT / COUNT | Save Status & Saves List | `supabase.from('post_saves').select(...)` | `EngagementModule`: `GET /api/v1/saves` |
| `src/lib/postInteractionService.ts` | `public.post_saves` | INSERT | Bookmark Post | `supabase.from('post_saves').insert(...)` | `EngagementModule`: `POST /api/v1/posts/:postId/saves` |
| `src/lib/postInteractionService.ts` | `public.post_saves` | DELETE | Remove Bookmark | `supabase.from('post_saves').delete(...)` | `EngagementModule`: `DELETE /api/v1/posts/:postId/saves` |
| `src/lib/postInteractionService.ts` | `public.post_shares` | INSERT | Track Share Event | `supabase.from('post_shares').insert(...)` | `EngagementModule`: `POST /api/v1/posts/:postId/shares` |
| `src/lib/postInteractionService.ts` | Supabase Realtime | Interaction Counts | `supabase.channel('post_interactions_channel_*')` | `PostsGateway`: Socket.IO room broadcast `post:interaction:update` |
| `src/lib/savedPostsService.ts` | `public.post_saves` | SELECT | Saved Posts Screen | `supabase.from('post_saves').select('*, posts(*)')` | `EngagementModule`: `GET /api/v1/saves` |
| `src/lib/updatesService.ts` | `public.updates` | SELECT | 24-Hour Stories Bar | `supabase.from('updates').select(...).gt('expires_at', ...)` | `StoriesModule`: `GET /api/v1/stories` |
| `src/lib/updatesService.ts` | `public.updates` | INSERT | Create 24-Hour Story | `supabase.from('updates').insert(...)` | `StoriesModule`: `POST /api/v1/stories` |
| `src/lib/updatesService.ts` | `public.updates` | DELETE | Delete Active Story | `supabase.from('updates').delete(...)` | `StoriesModule`: `DELETE /api/v1/stories/:id` |
| `src/lib/updatesService.ts` | `public.update_views` | INSERT | Record Story Impression | `supabase.from('update_views').insert(...)` | `StoriesModule`: `POST /api/v1/stories/:id/view` |
| `src/lib/updatesService.ts` | `public.update_views` | SELECT | Get Viewed Story IDs | `supabase.from('update_views').select(...)` | `StoriesModule`: included in story list response |
| `src/lib/updatesService.ts` | Storage `updates-media` | Upload Story Media | Upload photo/video for story | `supabase.storage.from('updates-media').upload(...)` | `UploadsModule`: `POST /api/v1/uploads/signed-url` |
| `src/lib/updatesService.ts` | Supabase Realtime | Story Notifications | `supabase.channel('public:updates')` | `StoriesGateway`: Socket.IO broadcast `story:new` |
| `src/messaging/services/conversationService.ts` | `public.conversations` | SELECT | List Conversations | `supabase.from('conversations').select(...)` | `ConversationsModule`: `GET /api/v1/conversations` |
| `src/messaging/services/conversationService.ts` | `public.conversations` | INSERT | Create Direct/Group Chat | `supabase.from('conversations').insert(...)` | `ConversationsModule`: `POST /api/v1/conversations` |
| `src/messaging/services/conversationService.ts` | `public.conversation_members` | SELECT / INSERT | Conversation Members | `supabase.from('conversation_members')` | `ConversationsModule`: managed via Prisma relation |
| `src/messaging/services/messageService.ts` | `public.messages` | SELECT (Pagination) | Chat History | `supabase.from('messages').select(...).order(...)` | `MessagesModule`: `GET /api/v1/conversations/:id/messages?cursor=...` |
| `src/messaging/services/messageService.ts` | `public.messages` | INSERT | Send Chat Message | `supabase.from('messages').insert(...)` | `MessagesModule`: `POST /api/v1/conversations/:id/messages` (Persist DB -> emit Socket.IO) |
| `src/messaging/services/messageService.ts` | `public.messages` | UPDATE | Mark Message Read | `supabase.from('messages').update({ is_read: true })` | `MessagesModule`: `POST /api/v1/conversations/:id/read` |
| `src/messaging/services/domainMessageService.ts` | `public.domain_messages` | SELECT / INSERT | Domain Public Channels | `supabase.from('domain_messages')` | `DomainChatModule`: `/api/v1/domains/:domainId/messages` |
| `src/messaging/services/realtimeService.ts` | Supabase Realtime Broadcast | Typing Indicators | `supabase.channel('typing:${conversationId}')` | NestJS `MessagingGateway`: Socket.IO events `typing:start` / `typing:stop` |
| `src/messaging/services/presenceService.ts` | Supabase Realtime Presence | Global Presence Tracking | `supabase.channel('room:global-presence')` | NestJS `MessagingGateway`: Redis-backed Socket.IO presence tracking |
| `src/notifications/services/notificationService.ts` | `public.notifications` | SELECT | Notification Bell & Feed | `supabase.from('notifications').select(...)` | `NotificationsModule`: `GET /api/v1/notifications` |
| `src/notifications/services/notificationService.ts` | `public.notifications` | UPDATE | Mark Notification Read | `supabase.from('notifications').update({ is_read: true })` | `NotificationsModule`: `PATCH /api/v1/notifications/:id/read` |
| `src/notifications/services/notificationService.ts` | `public.notifications` | INSERT | Direct Notification Creation | Browser insert (insecure pattern) | Removed from frontend. Created server-side on DB commit in BullMQ worker. |
| `src/lib/pushNotificationService.ts` | Next.js API Routes | Push Token & Dispatch | `POST /api/register-web-push`, `POST /api/send-web-push` | `PushModule`: `/api/v1/push/register`, `/api/v1/push/unregister` |

---

## 2. Server-Side Routes, Helpers & Gateways Inventory

### 2.1 Next.js API Routes (`src/app/api/...`)
1. **`POST /api/register-web-push`**
   - **Current Implementation**: Uses `verifyServerAuth(req)` to authenticate caller via Supabase JWT. Validates subscription object with `validatePushSubscription`. Upserts record into `public.push_subscriptions` using service client or test store.
   - **Target NestJS**: `PushModule` -> `POST /api/v1/push/subscriptions`.
2. **`POST /api/unregister-web-push`**
   - **Current Implementation**: Verifies caller via Supabase JWT. Deactivates/removes subscription from `public.push_subscriptions`.
   - **Target NestJS**: `PushModule` -> `DELETE /api/v1/push/subscriptions`.
3. **`POST /api/send-web-push`**
   - **Current Implementation**: Validates token, binds caller identity authoritatively, validates notification type, performs database lookup for underlying authoritative event, checks freshness window (10 min), verifies bidirectional blocks and private post follower status, computes idempotency key, acquires lock, dispatches VAPID Web Push, updates idempotency store.
   - **Target NestJS**: **Internal server BullMQ Queue (`push-dispatch`)**. In the new architecture, client browsers NEVER invoke `send-web-push`. Instead, whenever an authoritative event occurs in the API (e.g. comment created, message sent, follow accepted), a BullMQ job is enqueued server-side inside the transaction commit.

### 2.2 Server Helpers (`src/lib/serverAuth.ts` & `src/lib/serverPushDispatcher.cjs`)
| Component / Function | Current Implementation | Target NestJS Equivalent |
| :--- | :--- | :--- |
| `assertJwtConfiguration()` & `verifyServerAuth()` | Custom crypto HMAC-SHA256 verifier with fail-closed checks for `SUPABASE_JWT_SECRET` | `JwtAuthGuard` + `Passport` / `@nestjs/jwt` strategy with strict HS256 / JWKS mode and fail-closed secret checks. |
| `CurrentUser` extraction | Manual `result.userId` extraction from token claims | NestJS `@CurrentUser()` parameter decorator. |
| `ALLOWED_NOTIFICATION_TYPES` & type guards | Runtime array validation in `serverAuth.ts` | TypeScript enum + NestJS DTO validation (`class-validator`). |
| `authorizePushNotificationRequest()` | Request body sanitization, anti-spoofing, URL validation | NestJS DTO pipes + `PushNotificationDto`. |
| `isEventWithinFreshnessWindow()` | 10-minute maximum age verification for authoritative events | `PushService` / BullMQ job processor freshness check. |
| `PushEventDbResolver` & verification methods: <br>- `hasActiveSocialBlock()` <br>- `getConversationMembership()` <br>- `getMessage()` <br>- `getPendingFollowRequest()` <br>- `getAcceptedFollowTransition()` <br>- `getPostLike()` <br>- `getPostComment()` <br>- `getPost()` <br>- `hasAcceptedFollow()` | Raw Supabase admin client queries in `serverAuth.ts` | Centralized `AccessPolicyService` backed by Prisma ORM client with strict relationship traversal. |
| `computePushEventIdempotencyKey()` | Event-type keyed SHA256 string generator (e.g. `push:event:message:<cid>:<mid>`) | `PushQueueService.buildJobId(event)` (natively used as BullMQ Job ID). |
| `PushIdempotencyStore` (`MemoryPushIdempotencyStore`, `PostgresPushIdempotencyStore`) | Custom PostgreSQL table `push_idempotency_keys` with lock states `IN_PROGRESS` / `DISPATCHED` | **Redis key-value store with TTL & atomic Lua locks**, backed by BullMQ deduplication. |
| `validatePushSubscription()` | Checks for valid HTTPS endpoint, p256dh (65 bytes), auth key (16 bytes) | `RegisterSubscriptionDto` validation annotations. |
| `serverPushDispatcher.cjs` | WebPush library invocation, VAPID key loading, recipient subscription resolution | `PushWorker` process consuming BullMQ queue with retry backoff and dead-letter queue. |

### 2.3 Standalone Socket.IO Gateway (`backend/socket-gateway/server.js`)
| Event / Handler | Current Implementation | Target NestJS Equivalent |
| :--- | :--- | :--- |
| Handshake Auth | Manual `verifySupabaseToken(socket.handshake.auth.token)` in `io.use` | `WsJwtGuard` in NestJS Socket.IO Gateway validating token and binding user to `socket.data.user`. |
| Room Join Protection | Custom checks ensuring `socket.join('user:' + userId)` is only allowed for the socket's own verified identity | `MessagingGateway`: Enforced automatically in `handleConnection()` and `user:join` handler. |
| `conversation:join` / `leave` | `socket.join('conversation:' + conversationId)` | `MessagingGateway` with `AccessPolicyService.assertConversationMember(userId, conversationId)`. |
| `typing:start` / `typing:stop` | Ephemeral broadcast to conversation room with bound `userId` | `MessagingGateway`: `@SubscribeMessage('typing:start')` emitting `typing:status`. |
| `notification:send` | User-to-user notification relay with bound `senderId` | Deprecated for direct client calls. Server emits `notification:received` via Redis adapter upon database commit. |
| `presence:query` | In-memory `Map<userId, Set<socketId>>` | Redis-backed distributed presence tracker (`sinc:presence:<userId>`). |
| Connection / Disconnection | Broadcast `presence:update` { userId, status: 'online' / 'offline' } | `MessagingGateway`: Distributed presence broadcast backed by Redis adapter. |

---

## 3. Database RLS Policies, Triggers & Functions Inventory

### 3.1 Row Level Security (RLS) Policies
| Table | Policy Name | Command | Plain Words Enforcement Rule |
| :--- | :--- | :---: | :--- |
| `public.profiles` | `Allow public read access to profiles` | SELECT | Anyone (authenticated or public) can read public profile columns (id, name, username, role, bio, avatar_url, skills, domains). |
| `public.profiles` | `Allow users to insert their own profile` | INSERT | A user can only insert a profile row matching their authenticated `auth.uid()`. |
| `public.profiles` | `Allow users to update their own profile` | UPDATE | A user can only update their own profile row (`auth.uid() = id`). Cannot alter verification status directly. |
| `public.user_private_details` | `Users can only view their own private details` | SELECT | Private details (real email, phone, locationData) can ONLY be read by the account owner (`auth.uid() = user_id`). |
| `public.user_private_details` | `Users can only insert/update/delete their own` | ALL | Private details can only be written or deleted by the account owner. |
| `public.follow_requests` | `Allow users to view follow requests involving them` | SELECT | Follow requests are only visible to the sender (`requester_id = auth.uid()`) or recipient (`target_id = auth.uid()`). |
| `public.follow_requests` | `Allow users to send follow requests` | INSERT | Authenticated users can only create follow requests where `requester_id = auth.uid()` and cannot follow blocked users. |
| `public.follow_requests` | `Allow recipient or sender to update status` | UPDATE | Target user can accept/reject; sender can cancel. |
| `public.conversations` | `Allow conversation members to view conversation` | SELECT | A user can only read conversations where a record exists in `conversation_members` for their `auth.uid()`. |
| `public.conversations` | `Allow authenticated users to insert conversations` | INSERT | Any authenticated user can create a conversation. |
| `public.conversation_members` | `Allow conversation members to view members` | SELECT | A user can only see member lists of conversations they are part of. |
| `public.conversation_members` | `Allow authenticated users to add conversation members` | INSERT | Users can add members to conversations they belong to. |
| `public.messages` | `Allow conversation members to view messages` | SELECT | Messages are strictly readable only by verified members of that conversation. |
| `public.messages` | `Allow conversation members to send messages` | INSERT | Messages can only be sent by verified members, and `sender_id` must match `auth.uid()`. |
| `public.posts` | `posts_select_policy` | SELECT | Public posts are readable by anyone; private posts are only readable by the author or accepted followers (`can_view_user_content`). |
| `public.posts` | `posts_insert_policy` | INSERT | Users can only insert posts with `user_id = auth.uid()`. |
| `public.posts` | `posts_update_policy` / `delete_policy` | UPDATE/DELETE | Posts can only be modified or deleted by their author (`user_id = auth.uid()`). |
| `public.post_likes` | `post_likes_select_policy` | SELECT | Likes are readable if the viewer can view the parent post. |
| `public.post_likes` | `post_likes_insert_policy` / `delete_policy` | INSERT/DELETE | Users can only like or unlike as themselves (`user_id = auth.uid()`). |
| `public.post_comments` | `post_comments_select_policy` | SELECT | Comments are readable if the viewer can view the parent post. |
| `public.post_comments` | `post_comments_insert_policy` | INSERT | Users can only comment as themselves (`user_id = auth.uid()`). |
| `public.post_comments` | `post_comments_delete_policy` | DELETE | Comments can be deleted by comment author OR parent post author. |
| `public.post_saves` | `post_saves_select_policy` | SELECT | Saved post bookmarks are strictly private to the user who saved them (`auth.uid() = user_id`). |
| `public.post_saves` | `post_saves_insert_policy` / `delete_policy` | INSERT/DELETE | Users can only save or unsave for themselves. |
| `public.post_shares` | `post_shares_select_policy` / `insert_policy` | SELECT/INSERT | Share logs are readable by all viewers of the post; users can only log shares as themselves. |
| `public.updates` | `updates_select_active_policy` | SELECT | Active updates (`expires_at > now()`) are viewable by accepted followers or if the author profile is public. |
| `public.updates` | `updates_insert_own_policy` / `delete_own_policy` | INSERT/DELETE | Users can only create or delete their own stories (`user_id = auth.uid()`). |
| `public.update_views` | `update_views_select_own_policy` / `insert_own_policy` | SELECT/INSERT | Users can only view or record their own view impressions. |
| `public.blocked_users` | `blocked_users_select_policy` | SELECT | Block records are viewable only by the blocker (`user_id = auth.uid()`). |
| `public.blocked_users` | `blocked_users_insert_policy` / `delete_policy` | INSERT/DELETE | Users can only block or unblock as themselves. |
| `public.notifications` | `notifications_select_policy` | SELECT | Notifications are strictly private to `recipient_id = auth.uid()`. |
| `public.notifications` | `notifications_update_policy` | UPDATE | Users can only mark their own notifications as read (`recipient_id = auth.uid()`). |
| `public.push_subscriptions` | `Users can view/insert/update/delete own push` | ALL | Push tokens are strictly private to `user_id = auth.uid()`. |
| `public.projects`, `experience`, `education`, `certifications`, `achievements` | Owner write + visibility read | ALL | Section records are viewable if viewer has access to profile; write/delete restricted to owner (`auth.uid() = user_id`). |

### 3.2 Database Triggers & Functions
| Name | Type | Table / Event | Plain Words Enforcement Rule |
| :--- | :---: | :--- | :--- |
| `trg_protect_profile_verification` | Trigger | `BEFORE UPDATE ON public.profiles` | Prevents regular users from changing their own `is_verified` or `verification_status` flag. Raises exception if non-service role attempts modification. |
| `protect_profile_verification_update()` | Function | Executed by `trg_protect_profile_verification` | Compares `OLD.is_verified` with `NEW.is_verified`; blocks update unless executing role is `service_role`. |
| `admin_set_user_verification()` | Function | Security Definer RPC | Privileged administrative function to approve or reject a user's verification badge. |
| `can_view_user_content(target_user_id)` | Function | Security Definer Utility | Returns boolean: `true` if viewer is target user, or target profile is public and no block exists, or viewer is an accepted follower and not blocked. |
| `reject_and_block_user(p_target_user_id)` | Function | Security Definer RPC | Atomically deletes any mutual follow records, rejects pending requests, and inserts into `blocked_users`. |
| `trg_follow_request_accepted_at` | Trigger | `BEFORE UPDATE ON public.follow_requests` | Enforces that `accepted_at` is set to `now()` ONLY when transitioning from `pending` -> `accepted`. Disallows client forgery of accepted timestamps. |
| `set_follow_request_accepted_at()` | Function | Executed by `trg_follow_request_accepted_at` | Sets `NEW.accepted_at := now()` when `OLD.status <> 'accepted' AND NEW.status = 'accepted'`; preserves `OLD.accepted_at` on all other updates. |
| `trg_push_subscription_timestamp` | Trigger | `BEFORE UPDATE ON public.push_subscriptions` | Automatically updates `updated_at` column to current timestamp on row change. |
| `handle_push_subscription_timestamp()` | Function | Executed by `trg_push_subscription_timestamp` | Sets `NEW.updated_at = now()`. |

---

## 4. Feature → NestJS Module Mapping Table

| Feature Domain | Existing Client-Side Files | Target NestJS Module | Target Endpoints / WebSocket Events |
| :--- | :--- | :--- | :--- |
| **Authentication & Identity** | `src/context/AuthContext.tsx`, `SocketInitializer.tsx` | `AuthModule` | Guard: `JwtAuthGuard`, Decorator: `@CurrentUser()`. (Supabase manages signin/signup/OAuth sessions). |
| **Users & Profiles** | `src/lib/profileService.ts`, `src/views/Profile.tsx`, `ProfileDetails.tsx` | `UsersModule` | `GET /api/v1/users/me`, `PUT /api/v1/users/me/profile`, `GET /api/v1/users/:userId/profile`, `PUT /api/v1/users/me/private` |
| **Profile Sections (Projects, Experience, Education)** | `src/lib/projectService.ts`, `experienceService.ts`, `educationService.ts`, `certificationService.ts`, `achievementService.ts` | `ProfileSectionsModule` | `GET/POST/PUT/DELETE /api/v1/profile/projects`, `/experience`, `/education`, `/certifications`, `/achievements` |
| **Domains & Channels** | `src/lib/profileService.ts` (`user_domains`), `domainMessageService.ts` | `DomainsModule` | `GET /api/v1/domains`, `GET /api/v1/domains/:id/channels`, `GET/PUT /api/v1/users/me/domains` |
| **Follows & Relationships** | `src/lib/socialService.ts` | `FollowsModule` | `GET /api/v1/follows/status`, `POST /api/v1/follows/request`, `POST /api/v1/follows/:id/accept`, `POST /api/v1/follows/:id/reject`, `DELETE /api/v1/follows/:id` |
| **Blocks & Mutes** | `src/lib/blockService.ts` | `BlocksModule` | `GET /api/v1/blocks`, `POST /api/v1/blocks`, `DELETE /api/v1/blocks/:userId` |
| **Central Access Policy** | Evaluated via RLS in database & `serverAuth.ts` | `AccessPolicyModule` | Internal injectable `AccessPolicyService` used across all modules. |
| **Posts & Feeds** | `src/lib/postService.ts`, `src/views/Feed.tsx` | `PostsModule` | `GET /api/v1/posts` (cursor pagination), `GET /api/v1/posts/:id`, `POST /api/v1/posts`, `DELETE /api/v1/posts/:id` |
| **Engagement (Likes, Comments, Saves, Shares)** | `src/lib/postInteractionService.ts`, `savedPostsService.ts` | `EngagementModule` | `POST/DELETE /api/v1/posts/:id/likes`, `GET/POST/DELETE /api/v1/posts/:id/comments`, `GET /api/v1/saves`, `POST/DELETE /api/v1/posts/:id/saves`, `POST /api/v1/posts/:id/shares` |
| **Stories & Expiring Updates** | `src/lib/updatesService.ts`, `UpdatesStories.tsx` | `StoriesModule` | `GET /api/v1/stories`, `POST /api/v1/stories`, `DELETE /api/v1/stories/:id`, `POST /api/v1/stories/:id/view` |
| **Conversations & Messages** | `src/messaging/services/conversationService.ts`, `messageService.ts` | `MessagingModule` | `GET/POST /api/v1/conversations`, `GET /api/v1/conversations/:id/messages`, `POST /api/v1/conversations/:id/messages`, `POST /api/v1/conversations/:id/read` |
| **Realtime WebSockets** | `backend/socket-gateway/server.js`, `realtimeService.ts`, `presenceService.ts` | `EventsModule` (NestJS Gateway) | Sockets with Redis adapter (WebSocket transport only): `typing:start`, `typing:stop`, `presence:query`, `presence:update`, `message:new`, `notification:received` |
| **Notifications** | `src/notifications/services/notificationService.ts` | `NotificationsModule` | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all` |
| **Web Push & Background Jobs** | `src/lib/pushNotificationService.ts`, `src/app/api/send-web-push` | `PushModule` + `WorkerService` | `POST /api/v1/push/subscriptions`, `DELETE /api/v1/push/subscriptions`, BullMQ Queue: `push-dispatch` |
| **Search & Discovery** | `src/views/Search.tsx`, `socialService.ts` | `SearchModule` | `GET /api/v1/search/users?q=...`, `GET /api/v1/search/posts?q=...`, `GET /api/v1/search/domains?q=...`, `GET /api/v1/search/roles?q=...` (Enforces block checks and private profile gates) |
| **Media & File Uploads** | `updatesService.ts`, `postService.ts`, `profileService.ts` | `UploadsModule` | `POST /api/v1/uploads/signed-url` (Returns signed URL for direct browser-to-Supabase Storage PUT) |
| **Health & Monitoring** | `backend/socket-gateway/server.js` | `HealthModule` | `GET /api/v1/health` (Checks DB connection, Redis ping, BullMQ worker status) |

---

## 5. Security Invariants to Maintain During Cutover

1. **No Client-Controlled Identity**: The client-sent `userId` is never trusted. Every operation strictly extracts the authenticated user ID from the verified Supabase JWT claims (`sub`).
2. **Universal Bidirectional Block Check**: Blocked relationships suppress all profile visibility, posts, follow requests, direct messaging, and push notifications in both directions ($A \rightarrow B$ and $B \rightarrow A$).
3. **Private Profile Follower Gate**: Posts and profile details of private accounts are accessible only to approved followers (`status = 'accepted'`).
4. **Conversation Membership Boundary**: A user cannot read or write to a conversation room unless an active membership record exists in `conversation_members`.
5. **No Browser Notification Creation**: Browsers can never insert notifications or trigger push notifications directly. Notifications are created purely server-side upon successful database commit of authoritative actions.
6. **Web Push Freshness & Idempotency**: Social push notifications older than 10 minutes are suppressed. Push delivery is strictly deduplicated via BullMQ natural event keys.
