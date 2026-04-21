import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw a more descriptive error or return a proxy that errors on access
export const supabase = (function() {
  if (!supabaseUrl || !supabaseAnonKey) {
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
