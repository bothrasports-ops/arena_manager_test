import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uxyhipfvupyrtuntavnw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eWhpcGZ2dXB5cnR1bnRhdm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDEyNjcsImV4cCI6MjA4NjM3NzI2N30.VsBB4Ibu3TIpsp-IwGHdQrW25WtrsiKvNi1DqF7xhzM';

// Export config status for App.tsx
export const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey);

// Throw a more descriptive error or return a proxy that errors on access
export const supabase = (function() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in settings.');
    // Return a proxy that will throw when any property is accessed
    return new Proxy({} as any, {
      get(_, prop) {
        throw new Error(
            `Supabase client accessed but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ` +
            `Please provide these in the application settings (gear icon -> Secrets).`
        );
      }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey);
})();
