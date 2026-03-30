import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'user' | 'admin' | 'team';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  userType: string | null;
  isSubLabel: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSubLabel = userType === 'sub_label';

  const fetchUserInfo = async (userId: string) => {
    const { data } = await supabase.rpc('get_user_role', { _user_id: userId });
    setRole(data as AppRole || 'user');

    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('user_id', userId)
      .maybeSingle();
    setUserType(profileData?.user_type || null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserInfo(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Handle token refresh failures — force re-login
        if (event === 'TOKEN_REFRESHED' && !session) {
          setUser(null);
          setSession(null);
          setRole(null);
          setUserType(null);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserInfo(session.user.id);
        } else {
          setRole(null);
          setUserType(null);
        }
        setLoading(false);
      }
    );

    // Auto-logout after 8 hours of inactivity
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
    
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(async () => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          await supabase.auth.signOut();
          window.location.href = '/auth';
        }
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(inactivityTimer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setUserType(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, userType, isSubLabel, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
