# SINC Platform — Technology & Developer Network

A next-generation technology community, collaborative ecosystem, and professional networking platform built with Vite, React 18, and Supabase.

---

## 1. Architecture Overview

SINC is organized with a clean separation of concerns between client-side application logic, backend schemas and database resources, automated test suites, documentation, and operational reports:

```text
SINC-platform/
│
├── frontend/                          # Dedicated Frontend Application
│   ├── src/                           # React 18 Application Source Code
│   │   ├── components/                # UI Components (auth, common, profile, posts, layout)
│   │   ├── context/                   # React Contexts (AuthContext, ThemeContext)
│   │   ├── data/                      # Mock, Skills, and Initial Reference Data
│   │   ├── lib/                       # Frontend Services, Utilities, and Intro Engine
│   │   ├── messaging/                 # Direct Messaging & Domain Chat (Hooks & Services)
│   │   ├── notifications/             # In-App Notification System (Hooks & Services)
│   │   ├── pages/                     # Core Route Pages (Feed, Profile, Chat, Search, Settings)
│   │   ├── App.jsx                    # Root Application Shell & Route Resolver
│   │   ├── main.jsx                   # React DOM Root Entry
│   │   └── index.css                  # Unified Design System & Responsive Tokens
│   ├── public/                        # Static Public Assets
│   │   ├── favicon.svg                # SVG Favicon
│   │   ├── sw.js                      # Service Worker for RFC 8292 Web Push
│   │   ├── images/                    # Production Transparent Brand Assets
│   │   └── sinc-intro/                # 6 Modular Logo Pieces for Canvas Intro Engine
│   ├── index.html                     # SPA Entry Point HTML
│   ├── vite.config.js                 # Vite Build & Development Server Config
│   └── package.json                   # Frontend Module Configuration
│
├── backend/                           # Backend & Database Resources
│   ├── schemas/                       # 22 Modular PostgreSQL Canonical Schema Definitions
│   ├── database/                      # Read-Only Database Security Audit (rls-audit.sql)
│   └── README.md                      # Detailed Database Architecture Documentation
│
├── supabase/                          # Supabase CLI Compatibility (Root Exception)
│   ├── migrations/                    # Canonical Production Migrations
│   ├── functions/                     # Deno Edge Functions (send-web-push)
│   └── rls-audit.sql                  # Direct RLS Audit Script for Supabase Editor
│
├── tests/                             # Quality Assurance & Automated Test Suites
│   ├── e2e/                           # Playwright Browser Automation Suites
│   ├── performance/                   # Latency Benchmarks & Bundle Optimization Runners
│   ├── integration/                   # Service & Table Integrity Checkers
│   └── README.md                      # Comprehensive Testing Guide
│
├── docs/                              # Project Documentation & Design Assets
│   ├── architecture/                  # Architectural Overviews & System Diagrams
│   ├── cleanup/                       # Audit Reports & Reorganization Manifests
│   └── design/                        # Source Branding Emblems & Figma Wireframes
│
├── reports/                           # Historical Audit & Benchmark Reports
│
├── .env.example                       # Sanitized Environment Configuration Template
├── .gitignore                         # Project Git Ignore Specification
├── package.json                       # Root Manifest, Workspace Scripts, Dependencies
├── package-lock.json                  # Deterministic Dependency Lockfile
├── vercel.json                        # Vercel Production Routing & Security Headers
├── CODEBASE_CLEANUP_FINAL_REPORT.md   # Final Cleanup & Architectural Audit Report
└── CODEBASE_FILE_MANIFEST.json        # 322-File Verified System Inventory Manifest
```

---

## 2. Prerequisites & Quick Start

### Prerequisites
- Node.js (v18 or later recommended)
- npm (v9 or later)
- Supabase project or local Supabase instance

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your Supabase URL, publishable key, and optional VAPID keys

# 3. Start local development server
npm run dev
# The application opens at http://localhost:3000
```

---

## 3. Scripts & Verification Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts the Vite development server with local Web Push emulation on `http://localhost:3000` |
| `npm run build` | Compiles the production bundle into `dist/` with vendor chunk isolation |
| `npm run preview` | Previews the compiled production build locally |
| `npm test` | Runs the master SINC intro lifecycle verification suite (`tests/e2e/verify_quick_2s_intro.cjs`) |
| `npm run test:e2e` | Runs both the intro lifecycle and navigation regression test suites |
| `npm run test:perf` | Executes query latency and bundle performance remediation runners |

---

## 4. Key Systems & Features

### A. SINC Intro Animation Engine (`src/lib/sinc-intro.js`)
- **Zero-Dependency Canvas Engine**: Draws the glossy 3D logo live on a `<canvas>` using 2D affine transforms and glint shaders without video or GIF dependencies.
- **Dynamic 2-Second Quick Mode**: Returning authenticated visitors receive a smooth 2-second entrance animation (`mode: "quick"`).
- **16.9-Second Welcome Film**: Very first visit on a browser receives the full 16.9-second welcome story film with a responsive Skip button.
- **Tab Session Suppression**: Route changes and tab reloads suppress replaying (`sessionStorage.sincIntroSeen`).
- **Logout Reset**: Signing out calls `resetSincIntroSession()`, ensuring re-login within the same tab plays the 2-second intro.

### B. Responsive Navigation Architecture
- **Desktop**: Collapsible left sidebar (`src/components/SidebarNavigation.jsx`) and vertical shortcut rail (`src/components/DomainShortcutRail.jsx`).
- **Mobile (< 768px)**: Fixed bottom navigation dock (`src/components/BottomNav.jsx`), smooth overlay drawer, and clean header with user profile menu.

### C. Direct Messaging & Real-Time Engine
- 1-on-1 direct conversations and domain community chats.
- Optimistic message delivery, unread count tracking, and Supabase Realtime channel subscriptions.
- Automatic message deduplication and participant access control.

### D. Web Push Notifications (RFC 8292 VAPID)
- Browser push notification subscriptions stored in `public.push_subscriptions`.
- Local push emulation via Vite middleware (`src/lib/serverPushDispatcher.cjs`).
- Production push delivery via Deno Edge Function (`supabase/functions/send-web-push/`).

---

## 5. Security & Row Level Security (RLS)

1. **Production HTTP Headers (`vercel.json`)**:
   - HSTS: `max-age=63072000; includeSubDomains; preload`
   - Frame Protection: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`
   - MIME Sniffing: `X-Content-Type-Options: nosniff`
   - Content Security Policy (CSP): Strictly whitelists scripts, fonts, Google OAuth, and Supabase APIs.

2. **Database Row Level Security**:
   - `auth.users` is isolated from client queries.
   - PII attributes are segregated into `public.user_private_details` protected by `auth.uid() = user_id`.
   - Direct messages and conversations enforce participant-only access.
   - Run the audit script at `backend/database/rls-audit.sql` in the Supabase SQL Editor to verify live RLS status.

---

## 6. Documentation & Historical Reports

- **Database Architecture**: [`backend/README.md`](backend/README.md)
- **Testing Architecture**: [`tests/README.md`](tests/README.md)
- **Codebase Cleanup Audit**: [`docs/cleanup/CODEBASE_CLEANUP_AUDIT.md`](docs/cleanup/CODEBASE_CLEANUP_AUDIT.md)
- **Final Cleanup Report**: [`docs/cleanup/CODEBASE_CLEANUP_FINAL_REPORT.md`](docs/cleanup/CODEBASE_CLEANUP_FINAL_REPORT.md)
- **File Manifest**: [`docs/cleanup/CODEBASE_FILE_MANIFEST.json`](docs/cleanup/CODEBASE_FILE_MANIFEST.json)
- **Historical Benchmark Reports**: [`reports/`](reports/)
