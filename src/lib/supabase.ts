import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const rawKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.trim() !== '' &&
  rawKey.trim() !== '' &&
  !rawUrl.includes('your-project-id')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase Initialization Warning]: Supabase environment variables have not been configured.\n' +
    'The application requires valid Supabase credentials for authenticated features.'
  );
}

// Fallbacks prevent createClient from throwing on initial load before credentials are provided
const supabaseUrl: string = isSupabaseConfigured && rawUrl ? rawUrl : 'https://placeholder.supabase.co';
const supabaseKey: string = isSupabaseConfigured && rawKey ? rawKey : 'placeholder-publishable-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
