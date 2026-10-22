import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCallback, useEffect } from 'react';

export interface TokenHealthStatus {
  success: boolean;
  status: 'valid' | 'expiring_soon' | 'expired' | 'not_configured';
  message: string;
  is_valid?: boolean;
  is_permanent?: boolean;
  expires_at?: string | null;
  days_until_expiry?: number | null;
  scopes?: string[];
  page_name?: string | null;
  page_id?: string;
  token_prefix?: string;
}

export function useFacebookTokenHealth() {
  return useQuery<TokenHealthStatus>({
    queryKey: ['facebook-token-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('facebook-token-health', {
        body: { action: 'check' },
      });
      if (error) throw error;
      return data as TokenHealthStatus;
    },
    // Checked when an admin opens the page; no background timer.
    staleTime: 1000 * 60 * 60,
  });
}

export function useFacebookTokenExchange() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userToken: string) => {
      const { data, error } = await supabase.functions.invoke('facebook-token-health', {
        body: { action: 'exchange', user_token: userToken },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Token-utveksling feilet');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['facebook-token-health'] });
      toast({
        title: 'Token oppdatert',
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: 'Token-utveksling feilet',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    },
  });
}

export function useFacebookOAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startOAuth = useCallback(async () => {
    try {
      const redirectUri = 'https://fagerborgbk.no/admin/facebook-callback';
      const { data, error } = await supabase.functions.invoke('facebook-token-health', {
        body: { action: 'oauth_url', redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (!data?.oauth_url) throw new Error('Kunne ikke generere OAuth-URL');

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.oauth_url,
        'facebook-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err) {
      toast({
        title: 'Kunne ikke starte Facebook-innlogging',
        description: err instanceof Error ? err.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Listen for OAuth result from popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'facebook-oauth-result') return;

      if (event.data.success) {
        queryClient.invalidateQueries({ queryKey: ['facebook-token-health'] });
        toast({
          title: 'Facebook-token oppdatert! 🎉',
          description: event.data.data?.message || 'Permanent token generert',
        });
      } else {
        toast({
          title: 'Facebook-autorisasjon feilet',
          description: event.data.error || 'Noe gikk galt',
          variant: 'destructive',
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient, toast]);

  return { startOAuth };
}
