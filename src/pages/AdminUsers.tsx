import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Loader2, Eye, CheckCircle, XCircle, Search, Shield, ShieldCheck, ShieldX, KeyRound,
  ShieldAlert, Pencil, LogIn, Ban, Trash2, Download, FileX, CheckSquare, MoreVertical, Landmark, X, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { EditProfileModal } from '@/components/EditProfileModal';
import { EditBankDetailsModal } from '@/components/EditBankDetailsModal';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useNavigate } from 'react-router-dom';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { CreateUserModal } from '@/components/CreateUserModal';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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
  hidden_cut_percent?: number;
};

const VerificationBadge = React.forwardRef<HTMLSpanElement, { status: string }>(
  ({ status }, ref) => {
    if (status === 'verified') return <span ref={ref} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 whitespace-nowrap"><ShieldCheck className="h-3 w-3" />Verified</span>;
    if (status === 'rejected') return <span ref={ref} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 whitespace-nowrap"><ShieldX className="h-3 w-3" />Rejected</span>;
    if (status === 'suspended') return <span ref={ref} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 whitespace-nowrap"><ShieldAlert className="h-3 w-3" />Suspended</span>;
    return <span ref={ref} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 whitespace-nowrap"><Shield className="h-3 w-3" />Pending</span>;
  }
);

export default function AdminUsers() {
  const { isTeam, canDelete, canChangeSettings } = useTeamPermissions();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; userId?: string; name?: string } | null>(null);
  const [resetPasswordProfile, setResetPasswordProfile] = useState<Profile | null>(null);
  const [editBankDetail, setEditBankDetail] = useState<any>(null);
  const [viewBankDetails, setViewBankDetails] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingCut, setEditingCut] = useState<{ userId: string; value: string } | null>(null);
  const { startImpersonating } = useImpersonate();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleViewProfile = async (profile: Profile) => {
    setViewBankDetails(null);
    setViewProfile(profile);
    const { data, error } = await supabase.from('bank_details').select('*').eq('user_id', profile.user_id).maybeSingle();
    if (error) console.error('Bank details fetch error:', error);
    setViewBankDetails(data);
  };

  const filtered = profiles.filter((p) => {
    if (p.user_type === 'sub_label') return false;
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

  const paginatedUsers = useMemo(() => paginateItems(filtered, page, pageSize), [filtered, page, pageSize]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

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

  const handleSaveHiddenCut = async (userId: string, percent: number) => {
    const { error } = await supabase.from('profiles').update({ hidden_cut_percent: percent }).eq('user_id', userId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Hidden cut set to ${percent}%`);
    setEditingCut(null);
    fetchProfiles();
  };

  // Toggle selection
  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.user_id)));
    }
  };

  // Delete users via edge function
  const handleDeleteUsers = async (userIds: string[]) => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { error } = await supabase.functions.invoke('delete-users', {
        body: { user_ids: userIds },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      toast.success(`${userIds.length} user(s) deleted`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      setViewProfile(null);
      fetchProfiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Delete ID proof files
  const handleDeleteIdProof = async (profile: Profile, side: 'front' | 'back') => {
    const url = side === 'front' ? profile.id_proof_front_url : profile.id_proof_back_url;
    if (!url) return;

    // Extract file path from URL
    const pathMatch = url.match(/id-proofs\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from('id-proofs').remove([pathMatch[1]]);
    }

    const updateField = side === 'front' ? { id_proof_front_url: null } : { id_proof_back_url: null };
    const { error } = await supabase.from('profiles').update(updateField).eq('user_id', profile.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`ID proof (${side}) deleted`);
    fetchProfiles();
    // Update view modal
    if (viewProfile?.user_id === profile.user_id) {
      setViewProfile({ ...viewProfile, ...(side === 'front' ? { id_proof_front_url: null } : { id_proof_back_url: null }) });
    }
  };

  // Export CSV
  const handleExport = () => {
    const dataToExport = selectedIds.size > 0
      ? profiles.filter((p) => selectedIds.has(p.user_id))
      : filtered;

    const headers = ['ID', 'Name', 'Legal Name', 'Type', 'Email', 'WhatsApp', 'Instagram', 'Facebook', 'Spotify', 'YouTube', 'Country', 'State', 'Address', 'Status', 'Joined'];
    const rows = dataToExport.map((p) => [
      `#${p.display_id}`,
      p.user_type === 'artist' ? p.artist_name || '' : p.record_label_name || '',
      p.legal_name,
      p.user_type === 'record_label' ? 'Record Label' : 'Artist',
      p.email,
      `${p.whatsapp_country_code} ${p.whatsapp_number}`,
      p.instagram_link || '',
      p.facebook_link || '',
      p.spotify_link || '',
      p.youtube_link || '',
      p.country,
      p.state,
      p.address,
      p.verification_status,
      new Date(p.created_at).toLocaleDateString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${dataToExport.length} users`);
  };

  const inputClass = "px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm";

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage and verify registered users.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className={`${inputClass} w-full pl-10`} placeholder="Search by ID, name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} w-full sm:w-[180px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Bulk action bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-4">
        <button
          onClick={handleExport}
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border text-sm font-medium text-foreground hover:bg-muted transition-all"
        >
          <Download className="h-4 w-4" />
          Export {selectedIds.size > 0 ? `(${selectedIds.size})` : 'All'}
        </button>
        {selectedIds.size > 0 && canDelete && (
          <button
            onClick={() => setDeleteConfirm({ type: 'bulk' })}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg bg-destructive/20 border border-destructive/30 text-sm font-medium text-destructive hover:bg-destructive/30 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedIds.size})
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-all text-left sm:text-center"
          >
            Clear selection
          </button>
        )}
      </div>

      <GlassCard className="animate-fade-in">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No users found.</p>
        ) : (
          <div className="responsive-table-wrap">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border accent-primary h-4 w-4"
                    />
                  </th>
                  <th className="text-left py-3 px-3 font-medium w-16">ID</th>
                  <th className="text-left py-3 px-3 font-medium">Name</th>
                  <th className="text-left py-3 px-3 font-medium hidden sm:table-cell">Type</th>
                  <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left py-3 px-3 font-medium">Status</th>
                  <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Joined</th>
                  <th className="text-right py-3 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((profile) => (
                  <tr key={profile.id} className={`border-b border-border/30 table-row-hover ${selectedIds.has(profile.user_id) ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(profile.user_id)}
                        onChange={() => toggleSelect(profile.user_id)}
                        className="rounded border-border accent-primary h-4 w-4"
                      />
                    </td>
                    <td className="py-3 px-3 text-foreground font-mono font-bold">#{profile.display_id}</td>
                    <td className="py-3 px-3 text-foreground font-medium min-w-[12rem]">
                      {profile.user_type === 'artist' ? profile.artist_name : profile.record_label_name}
                      <span className="block text-xs text-muted-foreground">{profile.legal_name}</span>
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize whitespace-nowrap">
                        {profile.user_type === 'record_label' ? 'Record Label' : 'Artist'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">{profile.email}</td>
                    <td className="py-3 px-3"><VerificationBadge status={profile.verification_status} /></td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap hidden lg:table-cell">{new Date(profile.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => handleViewProfile(profile)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all" title="More actions">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditProfile(profile)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {!isTeam && (
                              <DropdownMenuItem onClick={() => handleLoginAs(profile)}>
                                <LogIn className="h-4 w-4 mr-2" /> Login as User
                              </DropdownMenuItem>
                            )}
                            {!isTeam && (
                              <DropdownMenuItem onClick={() => setResetPasswordProfile(profile)}>
                                <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {profile.verification_status !== 'verified' && (
                              <DropdownMenuItem onClick={() => handleVerification(profile.user_id, 'verified')} className="text-green-400 focus:text-green-400">
                                <CheckCircle className="h-4 w-4 mr-2" /> Verify
                              </DropdownMenuItem>
                            )}
                            {profile.verification_status !== 'rejected' && (
                              <DropdownMenuItem onClick={() => handleVerification(profile.user_id, 'rejected')} className="text-red-400 focus:text-red-400">
                                <XCircle className="h-4 w-4 mr-2" /> Reject
                              </DropdownMenuItem>
                            )}
                            {profile.verification_status !== 'suspended' && (
                              <DropdownMenuItem onClick={() => handleVerification(profile.user_id, 'suspended')} className="text-orange-400 focus:text-orange-400">
                                <Ban className="h-4 w-4 mr-2" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteConfirm({ type: 'single', userId: profile.user_id, name: profile.legal_name })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          totalItems={filtered.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="users"
        />
      </GlassCard>

      {/* View Profile Modal */}
      {viewProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewProfile(null)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="glass-strong rounded-2xl p-6 max-w-lg w-full relative animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewProfile(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>

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

              {/* Hidden Cut - only for admins */}
              {!isTeam && (
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Hidden Cut %</span>
                  {editingCut?.userId === viewProfile.user_id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingCut.value}
                        onChange={(e) => setEditingCut({ ...editingCut, value: e.target.value.replace(/[^0-9.]/g, '') })}
                        className="w-20 px-2 py-1 rounded bg-muted/50 border border-border text-foreground text-sm text-right"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveHiddenCut(viewProfile.user_id, Number(editingCut.value) || 0)}
                        className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30"
                      >Save</button>
                      <button onClick={() => setEditingCut(null)} className="text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingCut({ userId: viewProfile.user_id, value: String(viewProfile.hidden_cut_percent || 0) })}
                      className="text-foreground font-medium hover:text-primary transition-colors"
                    >
                      {viewProfile.hidden_cut_percent || 0}% <Pencil className="inline h-3 w-3 ml-1 opacity-50" />
                    </button>
                  )}
                </div>
              </div>
              )}

              {/* ID Proof section with delete buttons */}
              {(viewProfile.id_proof_front_url || viewProfile.id_proof_back_url) && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-muted-foreground mb-2 font-medium">ID Proof</p>
                  <div className="grid grid-cols-2 gap-3">
                    {viewProfile.id_proof_front_url && (
                      <div className="relative group">
                        <p className="text-xs text-muted-foreground mb-1">Front</p>
                        <img src={viewProfile.id_proof_front_url} alt="ID Front" className="w-full rounded-lg border border-border" />
                        <button
                          onClick={() => handleDeleteIdProof(viewProfile, 'front')}
                          className="absolute top-6 right-1 p-1.5 rounded-lg bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete front ID proof"
                        >
                          <FileX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {viewProfile.id_proof_back_url && (
                      <div className="relative group">
                        <p className="text-xs text-muted-foreground mb-1">Back</p>
                        <img src={viewProfile.id_proof_back_url} alt="ID Back" className="w-full rounded-lg border border-border" />
                        <button
                          onClick={() => handleDeleteIdProof(viewProfile, 'back')}
                          className="absolute top-6 right-1 p-1.5 rounded-lg bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete back ID proof"
                        >
                          <FileX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bank Details Section */}
              <div className="pt-3 border-t border-border/50">
                <p className="text-muted-foreground mb-2 font-medium flex items-center gap-2"><Landmark className="h-3.5 w-3.5" /> Bank Details</p>
                {viewBankDetails ? (
                  <div className="space-y-2 text-sm">
                    <Row label="Method" value={viewBankDetails.payment_method === 'wise' ? 'Wise (International)' : 'Bank Transfer (India)'} />
                    <Row label="Account Holder" value={viewBankDetails.account_holder_name} />
                    <Row label="Bank" value={viewBankDetails.bank_name} />
                    <Row label={viewBankDetails.payment_method === 'wise' ? 'Account/IBAN' : 'Account No.'} value={viewBankDetails.account_number} />
                    {viewBankDetails.payment_method === 'bank_transfer' && (
                      <>
                        <Row label="IFSC" value={viewBankDetails.ifsc_code || '-'} />
                        <Row label="Branch" value={viewBankDetails.branch_name || '-'} />
                      </>
                    )}
                    {viewBankDetails.payment_method === 'wise' && (
                      <>
                        <Row label="SWIFT/BIC" value={viewBankDetails.swift_bic || '-'} />
                        {viewBankDetails.bank_address && <Row label="Bank Address" value={viewBankDetails.bank_address} />}
                        <Row label="Country" value={viewBankDetails.country || '-'} />
                      </>
                    )}
                    <button
                      onClick={() => { setViewProfile(null); setEditBankDetail(viewBankDetails); }}
                      className="w-full mt-2 py-2 rounded-lg bg-muted/50 border border-border text-sm font-medium text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit Bank Details
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">No bank details submitted.</p>
                )}
              </div>
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
              <button
                onClick={() => { setViewProfile(null); setResetPasswordProfile(viewProfile); }}
                className="flex-1 py-2.5 rounded-lg bg-primary/20 text-primary font-medium hover:bg-primary/30 transition-all flex items-center justify-center gap-2"
              >
                <KeyRound className="h-4 w-4" /> Reset Password
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
            <button
              onClick={() => setDeleteConfirm({ type: 'single', userId: viewProfile.user_id, name: viewProfile.legal_name })}
              className="w-full mt-3 py-2.5 rounded-lg bg-destructive/20 text-destructive font-medium hover:bg-destructive/30 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete User
            </button>
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

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title={deleteConfirm.type === 'bulk' ? `Delete ${selectedIds.size} Users` : 'Delete User'}
          message={
            deleteConfirm.type === 'bulk'
              ? `Are you sure you want to permanently delete ${selectedIds.size} selected user(s)? This will remove all their data, releases, and files. This action cannot be undone.`
              : `Are you sure you want to permanently delete "${deleteConfirm.name}"? This will remove all their data, releases, and files. This action cannot be undone.`
          }
          onConfirm={() => {
            if (deleteConfirm.type === 'bulk') {
              handleDeleteUsers(Array.from(selectedIds));
            } else if (deleteConfirm.userId) {
              handleDeleteUsers([deleteConfirm.userId]);
            }
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Edit Bank Details Modal */}
      {editBankDetail && (
        <EditBankDetailsModal
          bankDetail={editBankDetail}
          onClose={() => setEditBankDetail(null)}
          onSaved={() => { setEditBankDetail(null); }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordProfile && (
        <ResetPasswordModal
          userId={resetPasswordProfile.user_id}
          email={resetPasswordProfile.email}
          name={resetPasswordProfile.legal_name}
          onClose={() => setResetPasswordProfile(null)}
        />
      )}
    </DashboardLayout>
  );
}

import { CopyButton } from '@/components/CopyButton';

const Row = React.forwardRef<HTMLDivElement, { label: string; value: string; link?: boolean }>(
  ({ label, value, link }, ref) => {
    const showCopy = value && value !== '—' && value !== 'N/A';
    return (
      <div ref={ref} className="flex items-start justify-between gap-4">
        <span className="text-muted-foreground flex-shrink-0">{label}</span>
        <div className="flex items-center gap-1 min-w-0 justify-end">
          {link ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-right truncate max-w-[200px]">{value}</a>
          ) : (
            <span className="text-foreground font-medium text-right">{value}</span>
          )}
          {showCopy && <CopyButton value={value} />}
        </div>
      </div>
    );
  }
);
