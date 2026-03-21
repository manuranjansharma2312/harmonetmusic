import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert, Clock, XCircle, Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function AccountBlockedScreen({ status }: { status: string }) {
  const { signOut } = useAuth();

  const config: Record<string, { icon: typeof Clock; title: string; message: string; color: string }> = {
    pending: {
      icon: Clock,
      title: 'Account Under Review',
      message: 'Your account is not approved yet. It is still under review. Please wait while our team verifies your details.',
      color: 'text-yellow-400',
    },
    rejected: {
      icon: XCircle,
      title: 'Account Rejected',
      message: 'Your account has been rejected. Please contact support for more information or to resolve any issues.',
      color: 'text-red-400',
    },
    suspended: {
      icon: Ban,
      title: 'Account Suspended',
      message: 'Your account has been suspended. Please contact support for more information.',
      color: 'text-orange-400',
    },
  };

  const { icon: Icon, title, message, color } = config[status] || config.pending;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className={`inline-flex items-center justify-center h-20 w-20 rounded-full bg-muted/50 ${color} mx-auto`}>
          <Icon className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{message}</p>
        <button
          onClick={signOut}
          className="px-6 py-2.5 rounded-lg bg-muted/50 border border-border text-sm font-medium text-foreground hover:bg-muted transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}) {
  const { user, role, loading } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!user || role === 'admin') {
      setCheckingProfile(false);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('verification_status')
        .eq('user_id', user.id)
        .maybeSingle();
      setVerificationStatus(data?.verification_status || 'pending');
      setCheckingProfile(false);
    })();
  }, [user, role]);

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  // Block non-admin users who aren't verified
  if (role !== 'admin' && verificationStatus && verificationStatus !== 'verified') {
    return <AccountBlockedScreen status={verificationStatus} />;
  }

  return <>{children}</>;
}
