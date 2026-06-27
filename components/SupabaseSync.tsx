import { useMemo, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function useSupabase() {
  const { getAccessToken, authenticated } = usePrivy();
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    const fetchToken = async () => {
      if (authenticated) {
        const accessToken = await getAccessToken();
        setToken(accessToken || undefined);
      } else {
        setToken(undefined);
      }
    };
    fetchToken();
  }, [authenticated, getAccessToken]);

  // Token her değiştiğinde Supabase istemcisi yeni yetkiyle güncellenir
  return useMemo(() => getSupabaseClient(token), [token]);
}