import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Mail, KeyRound, CheckCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccountSecurity() {
  const { user } = useAuth();
  const userEmail = user?.email || '';

  const [newEmail, setNewEmail] = useState(userEmail);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);

  const inputClass =
    'w-full px-3 sm:px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === userEmail) {
      toast.error('Enter a different email address');
      return;
    }
    if (newEmail !== confirmEmail) {
      toast.error('Email addresses do not match');
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('A confirmation link has been sent to both your current and new email. Please confirm to complete the change.');
        setConfirmEmail('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update email');
    }
    setEmailSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInError) {
        toast.error('Current password is incorrect');
        setPasswordSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    }
    setPasswordSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            Admin Account Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Change your admin account email or password settings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Change Email */}
          <GlassCard className="animate-fade-in">
            <h3 className="mb-4 text-base font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Change Email
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              A confirmation link will be sent to both your current and new email address. You must confirm from both to complete the change.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Current Email</label>
                <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={userEmail} readOnly />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">New Email</label>
                <input type="email" className={inputClass} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Confirm New Email</label>
                <input type="email" className={inputClass} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Re-enter new email" />
              </div>
              <button
                onClick={handleChangeEmail}
                disabled={emailSaving || !newEmail || newEmail === userEmail || newEmail !== confirmEmail}
                className="w-full py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2"
              >
                {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Update Email
              </button>
            </div>
          </GlassCard>

          {/* Change Password */}
          <GlassCard className="animate-fade-in">
            <h3 className="mb-4 text-base font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Change Password
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Enter your current password to verify your identity, then set a new one.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Current Password</label>
                <div className="relative">
                  <input type={showCurrentPw ? 'text' : 'password'} className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Confirm New Password</label>
                <div className="relative">
                  <input type={showConfirmPw ? 'text' : 'password'} className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className="w-full py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2"
              >
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Update Password
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}