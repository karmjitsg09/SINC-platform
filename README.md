# SINC Platform — Technology & Developer Network

A next-generation technology community and professional networking platform built with Vite, React, and Supabase.

---

## Security Architecture & Policies

### 1. HTTP Security Headers (`vercel.json`)
Production deployments on Vercel enforce strict HTTP security headers across all routes (`/(.*)`):
- **HSTS (`Strict-Transport-Security`)**: `max-age=63072000; includeSubDomains; preload`
- **Clickjacking Protection (`X-Frame-Options`)**: `DENY` & CSP `frame-ancestors 'none'`
- **MIME-Type Sniffing Protection (`X-Content-Type-Options`)**: `nosniff`
- **Referrer Policy**: `strict-origin-when-cross-origin`
- **Permissions Policy**: `camera=(), microphone=(), geolocation=()`
- **Content Security Policy (`Content-Security-Policy`)**:
  - `default-src 'self'`
  - `script-src 'self' 'sha256-Kr3hbyxNhoKW/YbNeCjIxsEwuDHDiM3P9e4LN4Azk+U='` (whitelists inline theme initialization script without relaxing to `'unsafe-inline'`)
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' https://fonts.gstatic.com`
  - `img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://images.unsplash.com`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://nominatim.openstreetmap.org`
  - `frame-src https://accounts.google.com`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`

---

### 2. Database Row Level Security (RLS) & Audit Script
A comprehensive read-only audit script is provided at [`supabase/rls-audit.sql`](supabase/rls-audit.sql). Run this script in the Supabase SQL Editor to audit:
- Tables where RLS is DISABLED (`rls_status = 'DISABLED'`)
- Policies granting anonymous write/update/delete access (`anon_write_policies_count > 0`)
- Policy commands, target roles, `USING` filters, and `WITH CHECK` clauses

---

### 3. Deliberate Design Choice: Public Read on `public.profiles`
The `Allow public read access to profiles` policy on `public.profiles` (`USING (true)`) is a **deliberate architectural design choice**:
- SINC is an open developer networking community where public user discovery, creator portfolios, skill badges, and username handles are accessible to both visitors and registered members.
- Authentication credentials (emails, phone numbers, password hashes) are completely isolated in Supabase's `auth.users` system schema and are never exposed in `public.profiles`.

#### Security Recommendation on Added Sensitive Columns
Later features introduced columns into `public.profiles` that contain sensitive Personally Identifiable Information (PII) and location data:
- `date_of_birth` (DOB / age PII)
- `gender`, `gender_custom`
- `location_address`, `location_landmark`, `location_pincode`, `location_latitude`, `location_longitude` (precise physical address & GPS coordinates)
- `privacy_settings`

**Recommended Action**:
Because PostgreSQL RLS applies at the row level, anonymous callers querying `SELECT *` can retrieve these columns. We recommend isolating these private attributes into a dedicated `public.user_private_details` table protected by `USING (auth.uid() = user_id)`.
