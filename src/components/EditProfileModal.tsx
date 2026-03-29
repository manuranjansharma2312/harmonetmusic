import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { countries, getStatesForCountry } from '@/data/locations';

interface Profile {
  id: string;
  user_id: string;
  user_type: string;
  artist_name: string | null;
  record_label_name: string | null;
  legal_name: string;
  email: string;
  whatsapp_country_code: string;
  whatsapp_number: string;
  instagram_link: string | null;
  facebook_link: string | null;
  spotify_link: string | null;
  youtube_link: string | null;
  country: string;
  state: string;
  address: string;
  verification_status: string;
}

export function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    user_type: profile.user_type,
    artist_name: profile.artist_name || '',
    record_label_name: profile.record_label_name || '',
    legal_name: profile.legal_name,
    whatsapp_country_code: profile.whatsapp_country_code,
    whatsapp_number: profile.whatsapp_number,
    instagram_link: profile.instagram_link || '',
    facebook_link: profile.facebook_link || '',
    spotify_link: profile.spotify_link || '',
    youtube_link: profile.youtube_link || '',
    country: profile.country,
    state: profile.state,
    address: profile.address,
    verification_status: profile.verification_status,
  });
  const [saving, setSaving] = useState(false);

  // Change email state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState(profile.email);
  const [emailSaving, setEmailSaving] = useState(false);

  // Change password state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const availableStates = form.country ? getStatesForCountry(form.country) : [];

  const inputClass =
    'w-full px-3 sm:px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        user_type: form.user_type,
        artist_name: form.user_type === 'artist' ? form.artist_name || null : null,
        record_label_name: form.user_type === 'record_label' ? form.record_label_name || null : null,
        legal_name: form.legal_name,
        whatsapp_country_code: form.whatsapp_country_code,
        whatsapp_number: form.whatsapp_number,
        instagram_link: form.instagram_link || null,
        facebook_link: form.facebook_link || null,
        spotify_link: form.spotify_link || null,
        youtube_link: form.youtube_link || null,
        country: form.country,
        state: form.state,
        address: form.address,
        verification_status: form.verification_status,
      })
      .eq('user_id', profile.user_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Profile updated!');
    onSaved();
  };

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === profile.email) return;
    setEmailSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { action: 'change_email', user_id: profile.user_id, email: newEmail },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Failed to change email');
      } else {
        toast.success('Email changed successfully!');
        setShowEmailChange(false);
        onSaved();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to change email');
    }
    setEmailSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setPasswordSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { action: 'set_password', user_id: profile.user_id, new_password: newPassword },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Failed to change password');
      } else {
        toast.success('Password changed successfully!');
        setNewPassword('');
        setShowPasswordChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    }
    setPasswordSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="glass-strong rounded-2xl p-4 sm:p-6 max-w-2xl w-full relative animate-scale-in max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold text-foreground mb-4">Edit User Profile</h2>
        <p className="text-xs text-muted-foreground mb-4 break-all">User ID: {profile.user_id}</p>

        {/* Admin Quick Actions: Change Email & Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setShowEmailChange(!showEmailChange); setShowPasswordChange(false); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${showEmailChange ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted'}`}
          >
            <Mail className="h-4 w-4" /> Change Email
          </button>
          <button
            type="button"
            onClick={() => { setShowPasswordChange(!showPasswordChange); setShowEmailChange(false); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${showPasswordChange ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted'}`}
          >
            <KeyRound className="h-4 w-4" /> Change Password
          </button>
        </div>

        {/* Change Email Panel */}
        {showEmailChange && (
          <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
            <label className="block text-xs font-medium text-foreground">New Email Address</label>
            <input
              type="email"
              className={inputClass}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email"
            />
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={emailSaving || !newEmail || newEmail === profile.email}
              className="w-full py-2 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {emailSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Auth Email
            </button>
          </div>
        )}

        {/* Change Password Panel */}
        {showPasswordChange && (
          <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
            <label className="block text-xs font-medium text-foreground">New Password</label>
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={passwordSaving || newPassword.length < 6}
              className="w-full py-2 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Set New Password
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">User Type</label>
            <select className={inputClass} value={form.user_type} onChange={(e) => update('user_type', e.target.value)}>
              <option value="artist">Artist</option>
              <option value="record_label">Record Label</option>
            </select>
          </div>

          {form.user_type === 'artist' ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Artist Name</label>
              <input className={inputClass} value={form.artist_name} onChange={(e) => update('artist_name', e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Record Label Name</label>
              <input className={inputClass} value={form.record_label_name} onChange={(e) => update('record_label_name', e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Legal Name</label>
            <input className={inputClass} value={form.legal_name} onChange={(e) => update('legal_name', e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Email (read-only — use Change Email above)</label>
            <input type="email" className={`${inputClass} opacity-60 cursor-not-allowed`} value={profile.email} readOnly />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Code</label>
              <select className={inputClass} value={form.whatsapp_country_code} onChange={(e) => update('whatsapp_country_code', e.target.value)}>
                {countries.map((c) => (
                  <option key={c.code} value={c.dialCode}>{c.flag} {c.name} ({c.dialCode})</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">WhatsApp</label>
              <input className={inputClass} value={form.whatsapp_number} onChange={(e) => update('whatsapp_number', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Instagram</label>
            <input className={inputClass} value={form.instagram_link} onChange={(e) => update('instagram_link', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Facebook</label>
            <input className={inputClass} value={form.facebook_link} onChange={(e) => update('facebook_link', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Spotify</label>
            <input className={inputClass} value={form.spotify_link} onChange={(e) => update('spotify_link', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">YouTube</label>
            <input className={inputClass} value={form.youtube_link} onChange={(e) => update('youtube_link', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Country</label>
              <select className={inputClass} value={form.country} onChange={(e) => { update('country', e.target.value); update('state', ''); }} required>
                <option value="">Select</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">State</label>
              <select className={inputClass} value={form.state} onChange={(e) => update('state', e.target.value)} required disabled={availableStates.length === 0}>
                <option value="">{availableStates.length > 0 ? 'Select State' : 'N/A'}</option>
                {availableStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Address</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.address} onChange={(e) => update('address', e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Verification Status</label>
            <select className={inputClass} value={form.verification_status} onChange={(e) => update('verification_status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
