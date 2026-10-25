# SINC — FRONTEND TECHNOLOGY STACK MIGRATION AUDIT
**Document ID**: `FRONTEND_STACK_MIGRATION_AUDIT`  
**Date**: October 2026  
**Status**: Completed — Phase 1 Codebase Audit  

---

## 1. Executive Summary & Migration Goals

This audit establishes the baseline architectural inventory, dependency relationships, and migration blueprint for transitioning the SINC web platform from its current Vite-based single-page application to a modern, production-grade enterprise stack:

- **Framework**: Next.js (App Router) + React 18 + TypeScript
- **Styling & UI Primitives**: Tailwind CSS + shadcn/ui (configured to match existing SINC midnight navy/electric blue tokens with zero visual divergence)
- **Server-State Management**: TanStack Query (React Query v5)
- **Client-Side State Management**: Zustand
- **Realtime Integration**: Socket.IO Client (backed by a secure, standalone Node.js Socket.IO gateway coexisting with Supabase Realtime)

### Governing Principles
1. **Zero UI / UX Divergence (Rule A)**: 100% visual parity across all breakpoints (desktop, laptop, tablet, mobile), exact spacing, borders, shadows, animations, and typography.
2. **Strict Zero-Git Mode (Rule B)**: No git commands executed; filesystem operations only.
3. **Zero Production Risk (Rule C)**: No production database mutations or external service disruption.
4. **Preserved Functional Integrity (Rule D)**: All existing authentication flows, welcome animations, messaging persistence, and push notifications remain intact.

---

## 2. Route & Component Inventory

The application currently manages navigation via `frontend/src/lib/routeUtils.js` synchronized with browser history and URL hash/path:

| Path / URL Pattern | Active Component | View / Sub-View State | Description |
|---|---|---|---|
| `/` | `Feed.jsx` | `tab: 'home'` | Main feed (categories, stories, posts, create post) |
| `/login` | `Login.jsx` | `authRoute: 'login'` | Official unauthenticated login view |
| `/signup` | `SignUp.jsx` | `authRoute: 'signup'` | 4-field account creation view |
| `/forgot-password` | `ForgotPassword.jsx` | `authRoute: 'forgot-password'` | Password reset request view |
| `/search` | `Search.jsx` | `tab: 'search'` | Search mode (all, people, jobs, domains) |
| `/domains` | `DomainList.jsx` | `tab: 'domains', sub: 'list'` | Domains catalog and directory |
| `/domains/[domainId]` | `Domain.jsx` | `tab: 'domains', sub: 'domain'` | Specific domain view and channels |
| `/domains/[domainId]/chat/[channelId]` | `DomainChat.jsx` | `tab: 'domains', sub: 'chat'` | Domain channel real-time conversation |
| `/messages` | `MessagesPage.jsx` | `tab: 'messages', sub: 'list'` | Conversations list and messaging inbox |
| `/messages/[conversationId]` | `MessageDetail.jsx` | `tab: 'messages', sub: 'detail'` | Active direct message thread and chat |
| `/notifications` | `Notifications.jsx` | `tab: 'notifications'` | Notification center and activity list |
| `/saved` | `SavedPosts.jsx` | `tab: 'saved'` | Bookmarked and saved posts |
| `/settings` | `Settings.jsx` | `tab: 'settings'` | Account, privacy, notification preferences |
| `/profile` | `Profile.jsx` | `tab: 'profile', sub: 'view'` | Self user profile with timeline & sections |
| `/profile/[userId]` | `Profile.jsx` | `tab: 'profile', sub: 'view'` | Public profile view for other users |
| `/profile/details` | `ProfileDetails.jsx` | `tab: 'profile', sub: 'details'` | Detailed about, background, personal info |
| `/profile/menu` | `ProfileMenu.jsx` | `tab: 'profile', sub: 'menu'` | Mobile profile navigation menu |
| `/profile/projects` | `ProjectsPage.jsx` | `tab: 'profile', sub: 'projects'` | User projects catalog and manager |
| `/profile/experience` | `ExperiencePage.jsx` | `tab: 'profile', sub: 'experience'` | Professional experience history |
| `/profile/education` | `EducationPage.jsx` | `tab: 'profile', sub: 'education'` | Academic history and degrees |
| `/profile/certifications` | `CertificationsPage.jsx` | `tab: 'profile', sub: 'certifications'` | Professional licenses and certifications |
| `/profile/achievements` | `AchievementsPage.jsx` | `tab: 'profile', sub: 'achievements'` | Honors, awards, and recognitions |
| `/profile/item-updates` | `ItemUpdatesPage.jsx` | `tab: 'profile', sub: 'item-updates'` | Section item updates timeline |
| `/post/[postId]` (or `#post-[id]`) | `PostView.jsx` | `tab: 'post-view'` | Single post permalink with comments |

---

## 3. Client & Server State Inventory

### Client-Side State (Target for Zustand)
1. **Navigation & Sidebar UI State** (`App.jsx`):
   - Sidebar open/collapsed state (`sidebarCollapsed`, `isMobileSidebarOpen`)
   - Active navigation tab and sub-views (`activeTab`, `domainSubView`, `messagesSubView`, `profileSubView`)
   - Channel and conversation selections (`selectedChannel`, `selectedConversation`)
   - Onboarding modal visibility (`isOnboardingActive`)
2. **UI Preferences & Modals**:
   - Theme (`light` / `dark`) in `ThemeContext.jsx`
   - Active modals (InAppShare, PostLikers, PostInsights, FollowReject, ProfileModals)
3. **Ephemera & Typing States**:
   - Active conversation typing users map

### Server-State (Target for TanStack Query)
1. **User Profile**: `fetchUserProfile`, `updateProfile` (`profileService.js`)
2. **Feed & Posts**: `fetchPosts`, `createPost`, `likePost`, `savePost`, `sharePost` (`postService.js`, `postInteractionService.js`)
3. **Conversations & Messages**: `getConversations`, `getMessages`, `sendMessage`, `markAsRead` (`conversationService.js`, `messageService.js`)
4. **Notifications**: `fetchNotifications`, `markAsRead`, `getUnreadCount` (`notificationService.js`)
5. **Domains**: `fetchDomains`, `getDomainChannels`, `checkIsDomainMember` (`domainUtils.js`)
6. **Social Graphs**: Followers, following, follow requests, blocks (`socialService.js`, `blockService.js`)
7. **Profile Section Items**: Projects, Experience, Education, Certifications, Achievements (`projectService.js`, etc.)

---

## 4. Backend & Realtime Integrations

### Supabase Architecture
- **Client Configuration**: `frontend/src/lib/supabase.js`
- **Authentication**: `supabase.auth` (Email/password, OAuth with Google, password recovery)
- **Database Tables**: `profiles`, `posts`, `post_interactions`, `conversations`, `conversation_members`, `messages`, `domain_messages`, `notifications`, `user_private_details`, `projects`, `experience`, `education`, `certifications`, `achievements`, `item_updates`, `web_push_subscriptions`
- **Realtime Channels**:
  - `typing:${conversationId}` (Broadcast ephemeral typing indicator)
  - `messages:conversation_id=eq.${conversationId}` (Postgres changes)
  - `conversations` (Postgres changes for inbox updates)

### Vite Web Push Middleware
`frontend/vite.config.js` currently provides three local Express-style middlewares:
- `POST /api/send-web-push`
- `POST /api/register-web-push`
- `POST /api/unregister-web-push`
These will migrate to Next.js App Router Route Handlers (`app/api/.../route.ts`).

---

## 5. CSS & Styling System

- **Primary Stylesheet**: `frontend/src/index.css` (191 KB, 9,389 lines)
- **Design Tokens**:
  - Backgrounds: `--bg-app: #080E18`, `--bg-surface: #0D1624`, `--bg-card: #142033`
  - Accents: `--color-primary-blue: #2878FF`, `--color-bright-blue: #438EFF`
  - Typography: Plus Jakarta Sans / Inter
  - Radii: 8px, 12px, 16px, 20px, 9999px
  - Transitions: Cubic-bezier spring and standard curves
- **Tailwind Strategy**:
  - Configure `tailwind.config.ts` with SINC tokens, colors, and keyframes.
  - Retain `index.css` as the authoritative global stylesheet imported in the root layout to guarantee 100% visual parity.
  - Configure shadcn/ui `components.json` to leverage existing tokens.

---

## 6. Authentication & Animation Lifecycle

- **Component**: `frontend/src/components/common/SincIntro.jsx`
- **Engine**: `frontend/src/lib/sinc-intro.js` (Canvas-based procedural rendering with 6 webp logo assets in `/sinc-intro/`)
- **Key Behaviors**:
  1. Fresh unauthenticated visit: Clean sign-in form with official logo.
  2. First password/OAuth login: 16.9s full welcome story with Skip button.
  3. Sign-out: Clears `sincIntroSeen` (session) and `sincWelcomeSeen` (local).
  4. Re-login after sign-out: 16.9s full welcome story with Skip button again.
  5. Authenticated reload: 2-second short logo animation (`mode: 'quick'`, no Skip button).
  6. Route navigation: Zero animation replay.
  7. Failed login: Zero animation replay.

---

## 7. Migration Risks & Mitigations

1. **Hydration Mismatch Risk**:
   - *Cause*: Browser APIs (`window`, `localStorage`, `sessionStorage`, `matchMedia`, `canvas`) called during server rendering.
   - *Mitigation*: Mark interactive components with `'use client'`; guard storage reads with `useEffect` or client-side mounting checks.
2. **Animation Replay Risk on Route Change**:
   - *Cause*: Next.js page re-rendering causing `SincIntro` to re-execute.
   - *Mitigation*: Mount `SincIntro` exclusively in top-level `AuthenticatedIntroWatcher` in root layout, utilizing unique event identifiers.
3. **Dual Realtime Event Duplication**:
   - *Cause*: Simultaneous Supabase Realtime and Socket.IO listeners emitting duplicate messages.
   - *Mitigation*: Keep Supabase Realtime as authoritative for database-persisted rows; use Socket.IO for ephemeral typing, user presence, and auxiliary gateway relays with deduplication IDs.
4. **Port & Environment Variables**:
   - *Cause*: Vite's `import.meta.env.VITE_*` vs Next.js `process.env.NEXT_PUBLIC_*`.
   - *Mitigation*: Support dual lookup (`process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL`) to maintain backward compatibility with `.env`.

---

## 8. Phased Implementation Roadmap

- **Phase 1**: Audit complete (this document).
- **Phase 2**: Next.js App Router initialization with TypeScript & project configuration.
- **Phase 3**: TypeScript models and types.
- **Phase 4**: Tailwind CSS & shadcn/ui integration.
- **Phase 5**: TanStack Query setup and service hook integration.
- **Phase 6**: Zustand client state store implementation.
- **Phase 7**: Socket.IO client service and standalone backend gateway.
- **Phase 8**: Supabase data services and API Route Handlers.
- **Phase 9**: Authentication and SincIntro animation preservation.
- **Phase 10**: Feature migration (Feed, Profile, Search, Domains, Messages, Settings).
- **Phase 11**: Performance & code quality review.
- **Phase 12**: Dependency and script updates.
- **Phase 13**: E2E testing, visual regression comparisons, and production build verification.
- **Phase 14**: Final reports and documentation.
