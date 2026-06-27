import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Token gelirse Authorization header'ına ekler, gelmezse anonim devam eder.
export const getSupabaseClient = (privyAccessToken?: string) => {
  const options = privyAccessToken
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${privyAccessToken}`,
          },
        },
      }
    : {};

  return createClient(supabaseUrl, supabaseAnonKey, options);
};