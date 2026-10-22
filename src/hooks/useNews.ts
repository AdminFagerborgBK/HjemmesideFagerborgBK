import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { News } from '@/lib/supabase-types';
import { useEffect } from 'react';

export const useNews = (category?: string, search?: string) => {
  return useQuery({
    queryKey: ['news', category, search],
    queryFn: async () => {
      let query = supabase
        .from('news')
        .select('*')
        .eq('is_published', true)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      
      if (category && category !== 'Alle') {
        query = query.eq('category', category);
      }
      
      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as News[];
    },
  });
};

export const useFeaturedNews = (limit = 3) => {
  return useQuery({
    queryKey: ['news', 'featured', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_published', true)
        .eq('is_featured', true)
        .lte('published_at', new Date().toISOString())
        .order('carousel_order', { ascending: true })
        .order('published_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as News[];
    },
  });
};

export const useLatestNews = (limit = 4) => {
  return useQuery({
    queryKey: ['news', 'latest', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_published', true)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as News[];
    },
  });
};

export const useNewsArticle = (slug: string) => {
  const query = useQuery({
    queryKey: ['news', 'article', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as News | null;
    },
    enabled: !!slug,
  });

  // Increment view count when article is loaded
  useEffect(() => {
    if (query.data?.id) {
      supabase
        .from('news')
        .update({ view_count: (query.data.view_count || 0) + 1 })
        .eq('id', query.data.id)
        .then(); // Fire and forget
    }
  }, [query.data?.id]);

  return query;
};

export const useNewsCategories = () => {
  return useQuery({
    queryKey: ['news', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('category')
        .eq('is_published', true)
        .lte('published_at', new Date().toISOString());
      
      if (error) throw error;
      
      const categories = [...new Set(data.map(item => item.category))];
      return ['Alle', ...categories];
    },
  });
};
