import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useMediaUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadMedia = async (file: File, folder: string = 'general'): Promise<string | null> => {
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('site-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage
        .from('site-media')
        .getPublicUrl(fileName);
      
      // Add cache-busting parameter to ensure updated images are never served from browser cache
      return `${data.publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Opplasting feilet',
        description: error instanceof Error ? error.message : 'Ukjent feil',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (url: string): Promise<boolean> => {
    try {
      // Extract file path from URL
      const urlParts = url.split('/site-media/');
      if (urlParts.length !== 2) return false;
      
      const filePath = urlParts[1];
      
      const { error } = await supabase.storage
        .from('site-media')
        .remove([filePath]);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Sletting feilet',
        description: error instanceof Error ? error.message : 'Ukjent feil',
        variant: 'destructive',
      });
      return false;
    }
  };

  return { uploadMedia, deleteMedia, uploading };
};
