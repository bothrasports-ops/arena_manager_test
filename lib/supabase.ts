
import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard: Settings -> API
// Local Dev: Create a .env file in the root directory.
// Deployment: Add to Environment Variables in Vercel/GitHub settings.
const supabaseUrl = process.env.SUPABASE_URL || 'https://uxyhipfvupyrtuntavnw.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eWhpcGZ2dXB5cnR1bnRhdm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDEyNjcsImV4cCI6MjA4NjM3NzI2N30.VsBB4Ibu3TIpsp-IwGHdQrW25WtrsiKvNi1DqF7xhzM';

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
