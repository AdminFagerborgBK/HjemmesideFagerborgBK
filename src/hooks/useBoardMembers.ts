 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
 
export interface BoardMember {
  id: string;
  name: string;
  role: string;
  email?: string;
  userId?: string;
}
 
 export const useBoardMembers = () => {
   return useQuery({
     queryKey: ['board-members'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('site_settings')
         .select('value')
         .eq('key', 'board_members')
         .single();
       
       if (error && error.code !== 'PGRST116') {
         throw error;
       }
       
      if (!data?.value || !Array.isArray(data.value)) {
        return [];
      }
      
      return data.value as unknown as BoardMember[];
     },
   });
 };
 
 export const useUpdateBoardMembers = () => {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async (members: BoardMember[]) => {
       const { data: existing } = await supabase
         .from('site_settings')
         .select('id')
         .eq('key', 'board_members')
         .single();
       
       if (existing) {
         const { error } = await supabase
           .from('site_settings')
          .update({ value: members as unknown as Json })
           .eq('key', 'board_members');
         
         if (error) throw error;
       } else {
         const { error } = await supabase
           .from('site_settings')
          .insert([{ key: 'board_members', value: members as unknown as Json }]);
         
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['board-members'] });
     },
   });
 };