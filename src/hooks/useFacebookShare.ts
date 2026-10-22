import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FacebookShareOptions {
  message: string;
  link?: string;
  image_url?: string;
  video_url?: string;
  news_id?: string;
}

export function useFacebookShare() {
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const shareToFacebook = async (options: FacebookShareOptions) => {
    setIsSharing(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-post', {
        body: options,
      });

      if (error) throw error;

      if (data?.success) {
        // Save facebook_post_id to news table
        if (options.news_id && data.post_id) {
          await supabase
            .from('news')
            .update({ facebook_post_id: data.post_id } as any)
            .eq('id', options.news_id);
        }

        toast({
          title: 'Delt på Facebook',
          description: 'Innlegget er publisert på Facebook-siden.',
        });
        return true;
      } else {
        throw new Error(data?.error || 'Kunne ikke dele på Facebook');
      }
    } catch (error) {
      console.error('Facebook share error:', error);
      toast({
        title: 'Facebook-deling feilet',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSharing(false);
    }
  };

  const deleteFromFacebook = async (newsId: string, facebookPostId: string) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-post', {
        body: { action: 'delete', facebook_post_id: facebookPostId },
      });

      if (error) throw error;

      if (data?.success) {
        // Clear facebook_post_id from news table
        await supabase
          .from('news')
          .update({ facebook_post_id: null } as any)
          .eq('id', newsId);

        toast({
          title: 'Fjernet fra Facebook',
          description: 'Innlegget er slettet fra Facebook-siden.',
        });
        return true;
      } else {
        throw new Error(data?.error || 'Kunne ikke fjerne fra Facebook');
      }
    } catch (error) {
      console.error('Facebook delete error:', error);
      toast({
        title: 'Fjerning fra Facebook feilet',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return { shareToFacebook, deleteFromFacebook, isSharing, isDeleting };
}
