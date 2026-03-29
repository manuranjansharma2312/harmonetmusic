import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { logoSrc, branding } = useBranding();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { setSuccess(true); toast.success('Password updated successfully'); }
  };

  const inputClass = "w-full pl-10 pr-12 py-3 rounded-lg bg-card/80 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm sm:text-base";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <BackgroundBlobs />
      <div className="w-full max-w-md glass-card p-6 sm:p-8 rounded-2xl space-y-6 relative z-10">
        <div className="text-center">
          <img src={logoSrc} alt={branding.site_name} style={{ height: `${branding.login_logo_height}px` }} className="w-auto mb-4 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {success ? 'Password updated successfully' : 'Set your new password'}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Your password has been reset. You can now sign in with your new password.</p>
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold"
            >
              Go to Sign In
            </button>
          </div>
        ) : !isRecovery ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Invalid or expired reset link. Please request a new password reset.</p>
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
