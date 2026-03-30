import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/GlassCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Image as ImageIcon, X } from 'lucide-react';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { format } from 'date-fns';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

interface Notice {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminNotices() {
  const { isTeam, canDelete, canChangeSettings } = useTeamPermissions();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['admin-notices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Notice[];
    },
  });

  const paginatedNotices = useMemo(() => paginateItems(notices, page, pageSize), [notices, page, pageSize]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('notices').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notices'] });
      toast.success('Notice updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notices'] });
      toast.success('Notice deleted');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setContent('');
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  };

  const handleEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setTitle(notice.title);
    setContent(notice.content);
    setExistingImageUrl(notice.image_url);
    setImagePreview(notice.image_url);
    setImageFile(null);
    setShowForm(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExistingImageUrl(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      let image_url = existingImageUrl;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('notice-images')
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('notice-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      if (editingId) {
        const { error } = await supabase
          .from('notices')
          .update({ title: title.trim(), content: content.trim(), image_url, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Notice updated');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('notices')
          .insert({ title: title.trim(), content: content.trim(), image_url, created_by: user?.id });
        if (error) throw error;
        toast.success('Notice created');
      }

      queryClient.invalidateQueries({ queryKey: ['admin-notices'] });
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Notice Updates</h1>
          {!showForm && !isTeam && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> New Notice
            </Button>
          )}
        </div>

        {showForm && (
          <GlassCard className="p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Notice' : 'Create Notice'}</h2>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write notice content..." rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Image (optional)</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg border border-border" />
                  <button onClick={removeImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ImageIcon className="h-5 w-5" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </GlassCard>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading notices...</p>
        ) : notices.length === 0 ? (
          <GlassCard className="p-8 text-center text-muted-foreground">
            No notices created yet.
          </GlassCard>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              {paginatedNotices.map((notice) => (
                <GlassCard key={notice.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{notice.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notice.created_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                          checked={notice.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: notice.id, is_active: checked })}
                        />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(notice)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(notice.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {notice.content && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{notice.content}</p>
                  )}
                  {notice.image_url && (
                    <img src={notice.image_url} alt="" className="max-h-40 rounded-lg border border-border" />
                  )}
                </GlassCard>
              ))}
            </div>
            <TablePagination
              totalItems={notices.length}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="notices"
            />
          </div>
        )}
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete Notice"
          message="Are you sure you want to delete this notice? This action cannot be undone."
          onConfirm={() => { deleteMutation.mutate(deleteId); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </DashboardLayout>
  );
}
