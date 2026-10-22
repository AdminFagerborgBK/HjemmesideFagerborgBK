import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GraphicBackground {
  id: string;
  name: string;
  image_url: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useGraphicBackgrounds = () => {
  return useQuery({
    queryKey: ['graphic-backgrounds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graphic_backgrounds')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GraphicBackground[];
    },
  });
};

export const useDefaultBackground = () => {
  return useQuery({
    queryKey: ['graphic-backgrounds', 'default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graphic_backgrounds')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      return data as GraphicBackground | null;
    },
  });
};

export const useCreateGraphicBackground = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bg: { name: string; image_url: string; is_default?: boolean }) => {
      const { data, error } = await supabase
        .from('graphic_backgrounds')
        .insert(bg)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graphic-backgrounds'] });
      toast.success('Bakgrunnsbilde lagt til');
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useSetDefaultBackground = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('graphic_backgrounds')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graphic-backgrounds'] });
      toast.success('Standard bakgrunn oppdatert');
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useDeleteGraphicBackground = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('graphic_backgrounds')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graphic-backgrounds'] });
      toast.success('Bakgrunnsbilde slettet');
    },
    onError: (e) => toast.error(e.message),
  });
};
