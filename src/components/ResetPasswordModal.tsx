import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, Key, Mail, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface ResetPasswordModalProps {
  userId: string;
  email: string;
  name: string;
  onClose: () => void;
}

export function ResetPasswordModal({ userId, email, name, onClose }: ResetPasswordModalProps) {
  const [mode, setMode] = useState<'choose' | 'set_password'>('choose');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const invokeAction = async (action: string, body: Record<string, string>) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { action, ...body },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || 'Done!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    await invokeAction('set_password', { user_id: userId, new_password: newPassword });
  };

  const handleSendResetLink = async () => {
    await invokeAction('send_reset_link', { email });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="glass-strong rounded-2xl p-6 max-w-md w-full relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>

        <h2 className="font-display text-xl font-bold text-foreground mb-1">Reset Password</h2>
        <p className="text-sm text-muted-foreground mb-5">
          For <span className="font-medium text-foreground">{name}</span> ({email})
        </p>

        {mode === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode('set_password')}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <div className="p-2.5 rounded-lg bg-primary/20">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Set New Password</p>
                <p className="text-xs text-muted-foreground">Directly change the user's password</p>
              </div>
            </button>

            <button
              onClick={handleSendResetLink}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <div className="p-2.5 rounded-lg bg-blue-500/20">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Send Reset Link</p>
                <p className="text-xs text-muted-foreground">Send a password reset email to the user</p>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={6}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-all text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Set Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
