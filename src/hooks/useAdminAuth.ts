import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type AppRole = 'user' | 'site_admin' | 'superadmin';

interface AdminAuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  roles: AppRole[];
  loading: boolean;
}

export const useAdminAuth = () => {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    session: null,
    isAdmin: false,
    roles: [],
    loading: true,
  });

  useEffect(() => {
    const fetchRoles = async (userId: string) => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }
      
      return data.map(r => r.role as AppRole);
    };

    const updateAuthState = async (session: Session | null) => {
      if (!session?.user) {
        setState({
          user: null,
          session: null,
          isAdmin: false,
          roles: [],
          loading: false,
        });
        return;
      }

      const roles = await fetchRoles(session.user.id);
      const isAdmin = roles.includes('site_admin') || roles.includes('superadmin');

      setState({
        user: session.user,
        session,
        isAdmin,
        roles,
        loading: false,
      });
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Use setTimeout to avoid potential deadlock
        setTimeout(() => {
          updateAuthState(session);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
};
