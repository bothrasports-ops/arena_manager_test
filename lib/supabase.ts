
import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard: Settings -> API
// Local Dev: Create a .env file in the root directory.
// Deployment: Add to Environment Variables in Vercel/GitHub settings.
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ ARENASYNC: Supabase credentials missing from environment.\n' +
    'The app will not be able to sync data. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.'
  );
}

// Fallback to placeholders to prevent crashes, but warnings will show in console
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
