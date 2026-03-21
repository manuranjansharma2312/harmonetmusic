import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, CheckCircle, XCircle, Search, Shield, ShieldCheck, ShieldX, ShieldAlert, Pencil, LogIn, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { EditProfileModal } from '@/components/EditProfileModal';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useNavigate } from 'react-router-dom';

type Profile = {
  id: string;
  user_id: string;
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
  id_proof_front_url: string | null;
  id_proof_back_url: string | null;
  verification_status: string;
  created_at: string;
};

function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 whitespace-nowrap"><ShieldCheck className="h-3 w-3" />Verified</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 whitespace-nowrap"><ShieldX className="h-3 w-3" />Rejected</span>;
  if (status === 'suspended') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 whitespace-nowrap"><ShieldAlert className="h-3 w-3" />Suspended</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 whitespace-nowrap"><Shield className="h-3 w-3" />Pending</span>;
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const { startImpersonating } = useImpersonate();
  const navigate = useNavigate();

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const filtered = profiles.filter((p) => {
    if (statusFilter !== 'all' && p.verification_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.legal_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.artist_name?.toLowerCase().includes(q)) ||
        (p.record_label_name?.toLowerCase().includes(q)) ||
        String(p.display_id).includes(q)
      );
    }
    return true;
  });

  const handleVerification = async (userId: string, status: string) => {
    const { error } = await supabase.from('profiles').update({ verification_status: status }).eq('user_id', userId);
    if (error) { toast.error(error.message); return; }
    toast.success(`User ${status}`);
    fetchProfiles();
    if (viewProfile?.user_id === userId) setViewProfile(null);
  };

  const handleLoginAs = (profile: Profile) => {
    startImpersonating(profile.user_id, profile.email);
    toast.success(`Now viewing as ${profile.email}`);
    navigate('/dashboard');
  };

  const inputClass = "px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">Manage and verify registered users.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <GlassCard className="!p-4 text-center">
          <p className="text-2xl font-bold font-display text-foreground">{profiles.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </GlassCard>
        <GlassCard className="!p-4 text-center">
          <p className="text-2xl font-bold font-display text-yellow-400">{profiles.filter(p => p.verification_status === 'pending').length}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </GlassCard>
        <GlassCard className="!p-4 text-center">
          <p className="text-2xl font-bold font-display text-green-400">{profiles.filter(p => p.verification_status === 'verified').length}</p>
          <p className="text-xs text-muted-foreground">Verified</p>
        </GlassCard>
        <GlassCard className="!p-4 text-center">
          <p className="text-2xl font-bold font-display text-red-400">{profiles.filter(p => p.verification_status === 'rejected').length}</p>
          <p className="text-xs text-muted-foreground">Rejected</p>
        </GlassCard>
        <GlassCard className="!p-4 text-center">
          <p className="text-2xl font-bold font-display text-orange-400">{profiles.filter(p => p.verification_status === 'suspended').length}</p>
          <p className="text-xs text-muted-foreground">Suspended</p>
        </GlassCard>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className={`${inputClass} w-full pl-10`} placeholder="Search by ID, name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <GlassCard className="animate-fade-in">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No users found.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-3 px-3 font-medium w-16">ID</th>
                  <th className="text-left py-3 px-3 font-medium">Name</th>
                  <th className="text-left py-3 px-3 font-medium">Type</th>
                  <th className="text-left py-3 px-3 font-medium">Email</th>
                  <th className="text-left py-3 px-3 font-medium">Status</th>
                  <th className="text-left py-3 px-3 font-medium">Joined</th>
                  <th className="text-right py-3 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile) => (
                  <tr key={profile.id} className="border-b border-border/30 table-row-hover">
                    <td className="py-3 px-3 text-foreground font-mono font-bold">#{profile.display_id}</td>
                    <td className="py-3 px-3 text-foreground font-medium whitespace-nowrap">
                      {profile.user_type === 'artist' ? profile.artist_name : profile.record_label_name}
                      <span className="block text-xs text-muted-foreground">{profile.legal_name}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize whitespace-nowrap">
                        {profile.user_type === 'record_label' ? 'Label' : 'Artist'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{profile.email}</td>
                    <td className="py-3 px-3"><VerificationBadge status={profile.verification_status} /></td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{new Date(profile.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewProfile(profile)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditProfile(profile)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleLoginAs(profile)} className="p-2 rounded-lg hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-all" title="Login as user">
                          <LogIn className="h-4 w-4" />
                        </button>
                        {profile.verification_status !== 'verified' && (
                          <button onClick={() => handleVerification(profile.user_id, 'verified')} className="p-2 rounded-lg hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-all" title="Verify">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {profile.verification_status !== 'rejected' && (
                          <button onClick={() => handleVerification(profile.user_id, 'rejected')} className="p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all" title="Reject">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {profile.verification_status !== 'suspended' && (
                          <button onClick={() => handleVerification(profile.user_id, 'suspended')} className="p-2 rounded-lg hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400 transition-all" title="Suspend">
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* View Profile Modal */}
      {viewProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewProfile(null)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="glass-strong rounded-2xl p-6 max-w-lg w-full relative animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewProfile(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">✕</button>

            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">#{viewProfile.display_id}</span>
              <h2 className="font-display text-xl font-bold text-foreground">
                {viewProfile.user_type === 'artist' ? viewProfile.artist_name : viewProfile.record_label_name}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground capitalize mb-4">{viewProfile.user_type === 'record_label' ? 'Record Label' : 'Artist'}</p>

            <div className="space-y-3 text-sm">
              <Row label="Legal Name" value={viewProfile.legal_name} />
              <Row label="Email" value={viewProfile.email} />
              <Row label="WhatsApp" value={`${viewProfile.whatsapp_country_code} ${viewProfile.whatsapp_number}`} />
              {viewProfile.instagram_link && <Row label="Instagram" value={viewProfile.instagram_link} link />}
              {viewProfile.facebook_link && <Row label="Facebook" value={viewProfile.facebook_link} link />}
              {viewProfile.spotify_link && <Row label="Spotify" value={viewProfile.spotify_link} link />}
              {viewProfile.youtube_link && <Row label="YouTube" value={viewProfile.youtube_link} link />}
              <Row label="Country" value={viewProfile.country} />
              <Row label="State" value={viewProfile.state} />
              <Row label="Address" value={viewProfile.address} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Verification</span>
                <VerificationBadge status={viewProfile.verification_status} />
              </div>
              <Row label="Joined" value={new Date(viewProfile.created_at).toLocaleDateString()} />

              {(viewProfile.id_proof_front_url || viewProfile.id_proof_back_url) && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-muted-foreground mb-2 font-medium">ID Proof</p>
                  <div className="grid grid-cols-2 gap-3">
                    {viewProfile.id_proof_front_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Front</p>
                        <img src={viewProfile.id_proof_front_url} alt="ID Front" className="w-full rounded-lg border border-border" />
                      </div>
                    )}
                    {viewProfile.id_proof_back_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Back</p>
                        <img src={viewProfile.id_proof_back_url} alt="ID Back" className="w-full rounded-lg border border-border" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setViewProfile(null); setEditProfile(viewProfile); }}
                className="flex-1 py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-medium flex items-center justify-center gap-2"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button
                onClick={() => { setViewProfile(null); handleLoginAs(viewProfile); }}
                className="flex-1 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="h-4 w-4" /> Login As
              </button>
            </div>
            <div className="flex gap-3 mt-3">
              {viewProfile.verification_status !== 'verified' && (
                <button onClick={() => handleVerification(viewProfile.user_id, 'verified')} className="flex-1 py-2.5 rounded-lg bg-green-500/20 text-green-400 font-medium hover:bg-green-500/30 transition-all flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Verify
                </button>
              )}
              {viewProfile.verification_status !== 'rejected' && (
                <button onClick={() => handleVerification(viewProfile.user_id, 'rejected')} className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              )}
              {viewProfile.verification_status !== 'suspended' && (
                <button onClick={() => handleVerification(viewProfile.user_id, 'suspended')} className="flex-1 py-2.5 rounded-lg bg-orange-500/20 text-orange-400 font-medium hover:bg-orange-500/30 transition-all flex items-center justify-center gap-2">
                  <Ban className="h-4 w-4" /> Suspend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfile && (
        <EditProfileModal
          profile={editProfile}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); fetchProfiles(); }}
        />
      )}
    </DashboardLayout>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-right truncate max-w-[200px]">{value}</a>
      ) : (
        <span className="text-foreground font-medium text-right">{value}</span>
      )}
    </div>
  );
}
