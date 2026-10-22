import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCallback, useEffect } from 'react';

export interface TikTokStatus {
  success: boolean;
  status: 'valid' | 'expired' | 'not_connected' | 'not_configured';
  message: string;
  username?: string;
  open_id?: string;
}

export function useTikTokHealth() {
  return useQuery<TikTokStatus>({
    queryKey: ['tiktok-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-auth', {
        body: { action: 'check' },
      });
      if (error) throw error;
      return data as TikTokStatus;
    },
    // Checked when an admin opens the page; no background timer.
    staleTime: 1000 * 60 * 60,
  });
}

export function useTikTokDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-auth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Frakobling feilet');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-health'] });
      toast({ title: 'TikTok frakoblet' });
    },
    onError: (error) => {
      toast({
        title: 'Kunne ikke koble fra TikTok',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    },
  });
}

export function useTikTokOAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startOAuth = useCallback(async () => {
    try {
      const redirectUri = `${window.location.origin}/admin/tiktok-callback`;
      const { data, error } = await supabase.functions.invoke('tiktok-auth', {
        body: { action: 'oauth_url', redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (!data?.oauth_url) throw new Error('Kunne ikke generere OAuth-URL');

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.oauth_url,
        'tiktok-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err) {
      toast({
        title: 'Kunne ikke starte TikTok-innlogging',
        description: err instanceof Error ? err.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'tiktok-oauth-result') return;

      if (event.data.success) {
        queryClient.invalidateQueries({ queryKey: ['tiktok-health'] });
        toast({
          title: 'TikTok koblet til! 🎉',
          description: event.data.data?.message || 'Autorisasjon fullført',
        });
      } else {
        toast({
          title: 'TikTok-autorisasjon feilet',
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

export function useTikTokPublish() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { video_url: string; title: string; description?: string; video_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('tiktok-publish', {
        body: params,
      });
      if (error) throw error;
      if (!data?.success && data?.status !== 'pending') throw new Error(data?.error || 'Publisering feilet');
      return data;
    },
    onSuccess: (data) => {
      if (data.status === 'pending') {
        toast({
          title: 'TikTok API ikke godkjent',
          description: data.error || 'Bruk manuell publisering.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Publisert på TikTok! 🎉',
          description: data.message,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'TikTok-publisering feilet',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    },
  });
}
