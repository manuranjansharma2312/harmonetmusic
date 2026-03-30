import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert, Clock, XCircle, Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { useBranding } from '@/hooks/useBranding';

function AccountBlockedScreen({ status }: { status: string }) {
  const { signOut } = useAuth();
  const { logoSrc, branding } = useBranding();

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
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center p-6">
      <BackgroundBlobs />
      <div className="glass-card-glow relative z-10 mx-auto w-full max-w-md animate-scale-in space-y-6 p-6 text-center sm:p-8">
        <img src={logoSrc} alt={branding.site_name} className="mx-auto h-14 w-auto sm:h-16" />
        <div className={`mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 ${color}`}>
          <Icon className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{message}</p>
        <button
          onClick={signOut}
          className="rounded-lg border border-border bg-muted/50 px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
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
    if (!user || role === 'admin' || role === 'team') {
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
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
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
