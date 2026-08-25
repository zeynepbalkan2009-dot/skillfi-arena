import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";

const env = getPublicEnv();

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
