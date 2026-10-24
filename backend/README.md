# SINC Platform — Backend & Database Architecture

This directory contains the canonical database schemas, SQL migrations, RLS security policies, database triggers, and Edge Function resources for the SINC platform.

---

## 1. Directory Structure

```text
backend/
├── schemas/                           # Canonical Modular SQL Schema Definitions
│   ├── supabase_schema.sql            # Core base schema (profiles, domains, jobs)
│   ├── supabase_posts_schema.sql      # Posts, media attachments, like/comment counts
│   ├── supabase_messaging_schema.sql  # Direct conversations and messages
│   ├── supabase_notifications_schema.sql # In-app user notifications
│   ├── supabase_social_interactions_schema.sql # Likes, comments, bookmarks, follow requests
│   ├── supabase_profile_sections_schema.sql    # Experience, education, certifications, projects
│   ├── supabase_protect_user_private_details.sql # PII isolation & user_private_details table
│   ├── supabase_web_push_schema.sql   # Web Push subscriptions and preferences
│   ├── supabase_blocked_users_schema.sql # User blocking and safety controls
│   ├── supabase_auth_trigger.sql      # Auth user creation trigger for profile initialization
│   ├── supabase_domain_messages_migration.sql # Domain channel messaging
│   ├── supabase_onboarding_schema.sql # User onboarding wizard progress
│   ├── supabase_post_insights_rls.sql # Post view & engagement analytics policies
│   ├── supabase_post_media_migration.sql # Post media storage bucket and schema
│   ├── supabase_profile_item_updates_schema.sql # Profile item update milestones
│   ├── supabase_updates_schema.sql    # 24h ephemeral user stories
│   ├── supabase_location_schema.sql   # Geolocation & address fields
│   ├── supabase_achievements_schema.sql # User achievements
│   ├── supabase_certifications_schema.sql # Professional certifications
│   ├── supabase_education_schema.sql  # Academic education records
│   ├── supabase_experience_schema.sql # Work experience records
│   └── supabase_projects_schema.sql   # Portfolio projects
│
├── database/
│   └── rls-audit.sql                  # Read-only audit script for RLS verification
│
└── README.md                          # This architecture guide
```

---

## 2. Supabase Integration Architecture

The platform communicates with Supabase PostgreSQL via the `@supabase/supabase-js` client SDK on the frontend, and invokes server-side capabilities through Deno Edge Functions and development middleware.

```text
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND APPLICATION                    │
│   (React + Supabase JS Client + Service Worker sw.js)      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     Database Queries / Realtime        Push Delivery
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      SUPABASE DATABASE       │ │    DENO EDGE FUNCTION      │
│  - PostgreSQL 15             │ │   supabase/functions/      │
│  - Row Level Security (RLS)  │ │      send-web-push/        │
│  - auth.users & triggers     │ │  (RFC 8292 Web Push VAPID) │
│  - Realtime Publications     │ └────────────────────────────┘
└──────────────────────────────┘
```

---

## 3. Database Security & Row Level Security (RLS)

All public tables are protected by PostgreSQL Row Level Security:

1. **Authentication Isolation**:
   - `auth.users` holds user credentials and emails; it is never queried directly by client browsers.
   - Public user data is queried via `public.profiles`.

2. **Personally Identifiable Information (PII) Protection**:
   - Sensitive columns (`date_of_birth`, `gender`, `location_address`, `location_landmark`, `location_pincode`, `location_latitude`, `location_longitude`, `notification_preferences`) are isolated in `public.user_private_details`.
   - Access to `public.user_private_details` is strictly locked:
     ```sql
     CREATE POLICY "Users can only access their own private details"
       ON public.user_private_details
       FOR ALL
       TO authenticated
       USING (auth.uid() = user_id)
       WITH CHECK (auth.uid() = user_id);
     ```

3. **Direct Messaging Security**:
   - Conversations and messages are restricted to participating members:
     ```sql
     CREATE POLICY "Users can only read messages in their conversations"
       ON public.messages
       FOR SELECT
       TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.conversation_participants
           WHERE conversation_id = messages.conversation_id
             AND user_id = auth.uid()
         )
       );
     ```

4. **Web Push Subscriptions**:
   - Browser push subscriptions are accessible only by the subscribing user:
     ```sql
     CREATE POLICY "Users manage their own push subscriptions"
       ON public.push_subscriptions
       FOR ALL
       TO authenticated
       USING (auth.uid() = user_id)
       WITH CHECK (auth.uid() = user_id);
     ```

---

## 4. How to Run the Security Audit

To audit the live Supabase database for any unprotected tables or overly permissive policies, run the read-only audit script in the Supabase SQL Editor:

```sql
-- Located at backend/database/rls-audit.sql (or supabase/rls-audit.sql)
```

The script reports:
- Tables where RLS is DISABLED (`rls_status = 'DISABLED'`).
- Policies granting anonymous write access (`anon_write_policies_count > 0`).
- Complete breakdown of `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions by role.
