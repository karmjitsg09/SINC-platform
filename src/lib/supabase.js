import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.trim() !== '' &&
  rawKey.trim() !== '' &&
  !rawUrl.includes('your-project-id')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase Initialization Warning]: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables have not been configured in .env yet.\n' +
    'The application is running in mock mode using local mock data. Add your Supabase project credentials to .env to connect to your database.'
  );
}

// Fallbacks prevent createClient from throwing on initial load before credentials are provided
const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseKey = isSupabaseConfigured ? rawKey : 'placeholder-publishable-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const secretKey = import.meta.env.VITE_SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SECRET_KEY;
export const supabaseAdmin = (isSupabaseConfigured && secretKey) ? createClient(supabaseUrl, secretKey) : supabase;
