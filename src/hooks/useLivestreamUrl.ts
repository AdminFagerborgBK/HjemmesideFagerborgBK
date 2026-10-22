import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const LIVESTREAM_TOKEN_PREFIX = 'fbk_stream_token_';

/**
 * Fetches the livestream URL from the server. The link is never present in
 * public match data — the edge function only returns it when the visitor holds a
 * valid server-issued access token, or when the club disabled member gating.
 */
export const useLivestreamUrl = (matchId?: string) => {
  const { data } = useQuery({
    queryKey: ['livestream-url', matchId],
    enabled: !!matchId,
    staleTime: 60_000,
    queryFn: async () => {
      const token = localStorage.getItem(`${LIVESTREAM_TOKEN_PREFIX}${matchId}`);
      const { data, error } = await supabase.functions.invoke('livestream-otp', {
        body: { action: 'stream_url', match_id: matchId, access_token: token },
      });
      if (error) throw error;
      return (data?.livestream_url as string | null) ?? null;
    },
  });

  return data ?? undefined;
};
