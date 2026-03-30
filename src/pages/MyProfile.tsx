import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Loader2, User, Mail, Phone, MapPin, Globe, Shield, ShieldCheck, ShieldX, ShieldAlert, Instagram, Facebook, Music, Youtube, Landmark } from 'lucide-react';

function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400"><ShieldCheck className="h-3.5 w-3.5" />Verified</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400"><ShieldX className="h-3.5 w-3.5" />Rejected</span>;
  if (status === 'suspended') return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400"><ShieldAlert className="h-3.5 w-3.5" />Suspended</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400"><Shield className="h-3.5 w-3.5" />Pending</span>;
}

type Profile = {
  display_id: number;
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
  created_at: string;
  agreement_ratio?: number;
};

type BankDetail = {
  payment_method: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string | null;
  branch_name: string | null;
  swift_bic: string | null;
  bank_address: string | null;
  country: string | null;
};

export default function MyProfile() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bankDetail, setBankDetail] = useState<BankDetail | null>(null);
  const [parentCut, setParentCut] = useState<{ cut: number; parentName: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      const [profileRes, bankRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', effectiveUserId).maybeSingle(),
        supabase.from('bank_details').select('*').eq('user_id', effectiveUserId).maybeSingle(),
      ]);
      const prof = profileRes.data as Profile | null;
      setProfile(prof);
      setBankDetail(bankRes.data as BankDetail | null);

      // Fetch parent label cut for sub-label users
      if (prof?.user_type === 'sub_label') {
        const { data: slData } = await supabase
          .from('sub_labels')
          .select('percentage_cut, parent_label_name')
          .eq('sub_user_id', effectiveUserId)
          .eq('status', 'active')
          .maybeSingle();
        if (slData) {
          setParentCut({ cut: Number(slData.percentage_cut || 0), parentName: slData.parent_label_name });
        }
      }

      setLoading(false);
    })();
  }, [effectiveUserId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Profile not found.</p>
          </div>
          {/* Show bank details section only for non-sub-label users */}
          {profile?.user_type !== 'sub_label' && (
          <GlassCard className="animate-fade-in">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Bank Details
            </h3>
            {bankDetail ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs text-muted-foreground">Payment Method</span>
                  <span className="text-sm font-medium text-foreground">{bankDetail.payment_method === 'wise' ? 'Wise (International)' : 'Bank Transfer (India)'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs text-muted-foreground">Account Holder</span>
                  <span className="text-sm font-medium text-foreground">{bankDetail.account_holder_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs text-muted-foreground">Bank Name</span>
                  <span className="text-sm font-medium text-foreground">{bankDetail.bank_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs text-muted-foreground">{bankDetail.payment_method === 'wise' ? 'Account / IBAN' : 'Account Number'}</span>
                  <span className="text-sm font-medium text-foreground">{bankDetail.account_number}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">No bank details submitted yet.</p>
                <a href="/bank-details" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary-gradient text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  <Landmark className="h-4 w-4" /> Add Bank Details
                </a>
              </div>
            )}
          </GlassCard>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const displayName = profile.user_type === 'artist' ? profile.artist_name : profile.record_label_name;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Your account details (read-only).</p>
        </div>

        <GlassCard className="mb-6 animate-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/20 sm:h-16 sm:w-16">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">#{profile.display_id}</span>
                  <h2 className="text-lg sm:text-xl font-display font-bold text-foreground break-words">{displayName}</h2>
                </div>
                <p className="mt-0.5 text-sm capitalize text-muted-foreground">
                  {profile.user_type === 'record_label' ? 'Record Label' : 'Artist'}
                </p>
              </div>
            </div>
            <div className="self-start sm:self-auto">
              <VerificationBadge status={profile.verification_status} />
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard className="animate-fade-in">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h3>
            <div className="space-y-4">
              <ProfileRow icon={User} label="Legal Name" value={profile.legal_name} />
              <ProfileRow icon={Mail} label="Email" value={profile.email} />
              <ProfileRow icon={Phone} label="WhatsApp" value={`${profile.whatsapp_country_code} ${profile.whatsapp_number}`} />
              <ProfileRow icon={MapPin} label="Address" value={profile.address} />
              <ProfileRow icon={Globe} label="Location" value={`${profile.state}, ${profile.country}`} />
              <ProfileRow icon={Shield} label="Agreement Ratio" value={`${profile.agreement_ratio || 0}%`} />
            </div>
          </GlassCard>

          <GlassCard className="animate-fade-in">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Social Links</h3>
            <div className="space-y-4">
              {profile.instagram_link ? (
                <ProfileRow icon={Instagram} label="Instagram" value={profile.instagram_link} link />
              ) : (
                <ProfileRow icon={Instagram} label="Instagram" value="Not provided" muted />
              )}
              {profile.facebook_link ? (
                <ProfileRow icon={Facebook} label="Facebook" value={profile.facebook_link} link />
              ) : (
                <ProfileRow icon={Facebook} label="Facebook" value="Not provided" muted />
              )}
              {profile.spotify_link ? (
                <ProfileRow icon={Music} label="Spotify" value={profile.spotify_link} link />
              ) : (
                <ProfileRow icon={Music} label="Spotify" value="Not provided" muted />
              )}
              {profile.youtube_link ? (
                <ProfileRow icon={Youtube} label="YouTube" value={profile.youtube_link} link />
              ) : (
                <ProfileRow icon={Youtube} label="YouTube" value="Not provided" muted />
              )}
            </div>
          </GlassCard>
        </div>


        {/* Bank Details Section - hidden for sub-labels */}
        {profile.user_type !== 'sub_label' && (
        <GlassCard className="mt-6 animate-fade-in">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Bank Details
          </h3>
          {bankDetail ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">Payment Method</span>
                <span className="text-sm font-medium text-foreground">{bankDetail.payment_method === 'wise' ? 'Wise (International)' : 'Bank Transfer (India)'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">Account Holder</span>
                <span className="text-sm font-medium text-foreground">{bankDetail.account_holder_name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">Bank Name</span>
                <span className="text-sm font-medium text-foreground">{bankDetail.bank_name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">{bankDetail.payment_method === 'wise' ? 'Account / IBAN' : 'Account Number'}</span>
                <span className="text-sm font-medium text-foreground">{bankDetail.account_number}</span>
              </div>
              {bankDetail.payment_method === 'bank_transfer' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="text-xs text-muted-foreground">IFSC Code</span>
                    <span className="text-sm font-medium text-foreground">{bankDetail.ifsc_code || '-'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="text-xs text-muted-foreground">Branch</span>
                    <span className="text-sm font-medium text-foreground">{bankDetail.branch_name || '-'}</span>
                  </div>
                </>
              )}
              {bankDetail.payment_method === 'wise' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="text-xs text-muted-foreground">SWIFT / BIC</span>
                    <span className="text-sm font-medium text-foreground">{bankDetail.swift_bic || '-'}</span>
                  </div>
                  {bankDetail.bank_address && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Bank Address</span>
                      <span className="text-sm font-medium text-foreground">{bankDetail.bank_address}</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="text-xs text-muted-foreground">Country</span>
                    <span className="text-sm font-medium text-foreground">{bankDetail.country || '-'}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">No bank details submitted yet.</p>
              <a
                href="/bank-details"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary-gradient text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              >
                <Landmark className="h-4 w-4" /> Add Bank Details
              </a>
            </div>
          )}
        </GlassCard>
        )}

      </div>
    </DashboardLayout>
  );
}

function ProfileRow({ icon: Icon, label, value, link, muted }: { icon: any; label: string; value: string; link?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {link ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all block">{value}</a>
        ) : (
          <p className={`text-sm font-medium break-words ${muted ? 'text-muted-foreground/50' : 'text-foreground'}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

