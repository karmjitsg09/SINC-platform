-- ============================================================================
-- SUPABASE POSTGRESQL READ-ONLY ROW LEVEL SECURITY (RLS) AUDIT SCRIPT
-- File: supabase/rls-audit.sql
-- ============================================================================
--
-- ----------------------------------------------------------------------------
-- AUDIT INSTRUCTIONS FOR SECURITY REVIEWER:
-- ----------------------------------------------------------------------------
-- Paste and run this script in the Supabase SQL Editor (Dashboard > SQL Editor).
-- This script is STRICTLY READ-ONLY (SELECT queries only on PostgreSQL catalogs:
-- pg_class, pg_namespace, pg_tables, pg_policies). It modifies NO data.
--
-- WHEN REVIEWING THE RESULTS, LOOK SPECIFICALLY FOR:
--
--  1. 🚨 RLS DISABLED TABLES (risk_level = '🚨 CRITICAL: RLS DISABLED'):
--     Any table in the "public" schema where rls_status is 'DISABLED'.
--     Tables with RLS disabled are completely exposed according to standard
--     table grants and bypass all policy controls.
--
--  2. 🚨 ANONYMOUS WRITE PERMISSIONS (risk_level = '🚨 HIGH RISK: ANON WRITE'):
--     Any policy where:
--       - command is INSERT, UPDATE, DELETE, or ALL
--       - target roles include 'anon' or 'public'
--     Unless intentionally intended for public sign-ups or public lead capture,
--     anonymous users should NEVER be granted INSERT, UPDATE, or DELETE privileges.
--
--  3. ⚠️ TABLES WITH ZERO POLICIES (risk_level = '⚠️ WARNING: NO POLICIES'):
--     Any table with RLS enabled but 0 policies. All access for non-superusers
--     will be denied by default.
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1: HIGH-RISK SUMMARY OVERVIEW
-- Flags tables with disabled RLS and policies granting anonymous write access.
-- ----------------------------------------------------------------------------
SELECT 
    c.relname AS table_name,
    CASE 
        WHEN c.relrowsecurity THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END AS rls_status,
    COUNT(p.policyname) AS total_policies,
    COUNT(
        CASE 
            WHEN p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') 
                 AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) 
            THEN 1 
        END
    ) AS anon_write_policies_count,
    CASE 
        WHEN NOT c.relrowsecurity 
            THEN '🚨 CRITICAL: RLS DISABLED'
        WHEN COUNT(
            CASE 
                WHEN p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') 
                     AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) 
                THEN 1 
            END
        ) > 0 
            THEN '🚨 HIGH RISK: ANON WRITE PERMITTED'
        WHEN COUNT(p.policyname) = 0 
            THEN '⚠️ WARNING: NO POLICIES (ACCESS DENIED)'
        ELSE '✅ SECURE / POLICIES CONFIGURED'
    END AS security_posture
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' 
  AND c.relkind = 'r' -- regular tables only
GROUP BY c.relname, c.relrowsecurity
ORDER BY 
    CASE 
        WHEN NOT c.relrowsecurity THEN 1
        WHEN COUNT(CASE WHEN p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) THEN 1 END) > 0 THEN 2
        WHEN COUNT(p.policyname) = 0 THEN 3
        ELSE 4
    END,
    c.relname;

-- ----------------------------------------------------------------------------
-- QUERY 2: DETAILED RLS POLICY BREAKDOWN (EVERY TABLE & POLICY IN PUBLIC SCHEMA)
-- Lists every table in public schema, RLS status, each policy, command, roles,
-- permissive/restrictive type, and full USING / WITH CHECK expressions.
-- ----------------------------------------------------------------------------
SELECT 
    c.relname AS table_name,
    CASE 
        WHEN c.relrowsecurity THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END AS rls_status,
    COALESCE(p.policyname, '(no policy defined)') AS policy_name,
    COALESCE(p.cmd, '-') AS command,
    CASE 
        WHEN p.roles IS NULL THEN '-'
        ELSE array_to_string(p.roles, ', ')
    END AS target_roles,
    COALESCE(p.permissive, '-') AS permissive,
    p.qual AS using_expression,
    p.with_check AS with_check_expression,
    CASE 
        WHEN NOT c.relrowsecurity 
            THEN '🚨 CRITICAL: RLS DISABLED'
        WHEN p.policyname IS NULL 
            THEN '⚠️ WARNING: NO POLICIES'
        WHEN p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') 
             AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) 
            THEN '🚨 HIGH RISK: ANON WRITE'
        WHEN p.cmd = 'SELECT' 
             AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) 
            THEN 'ℹ️ PUBLIC READ (AUDIT EXPOSED COLUMNS)'
        ELSE '✅ RESTRICTED TO AUTHENTICATED'
    END AS policy_risk_assessment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
ORDER BY 
    c.relname,
    p.cmd,
    p.policyname;
