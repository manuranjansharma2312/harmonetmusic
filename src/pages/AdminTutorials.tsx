import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/GlassCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Tutorial {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function AdminTutorials() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewTutorial, setViewTutorial] = useState<Tutorial | null>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ['admin-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Tutorial[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] });
      toast.success('Tutorial deleted');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSubject('');
    setContent('');
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setSubject(tutorial.subject);
    setContent(tutorial.content);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') {
      toast.error('Details content is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('tutorials')
          .update({ subject: subject.trim(), content, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Tutorial updated');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('tutorials')
          .insert({ subject: subject.trim(), content, created_by: user?.id });
        if (error) throw error;
        toast.success('Tutorial created');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-tutorials'] });
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {showForm && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="mb-2 gap-1 -ml-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <h1 className="text-2xl font-bold">Help Tutorials</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage tutorials for artists</p>
          </div>
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> New Tutorial
            </Button>
          )}
        </div>

        {showForm && (
          <GlassCard className="p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Tutorial' : 'Create Tutorial'}</h2>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Tutorial subject / title" />
            </div>
            <div className="space-y-2">
              <Label>Details *</Label>
              <p className="text-xs text-muted-foreground">Write content, add images (upload), and embed videos (YouTube links)</p>
              <RichTextEditor value={content} onChange={setContent} placeholder="Write tutorial details here..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </GlassCard>
        )}

        {!showForm && (
          <>
            {isLoading ? (
              <p className="text-muted-foreground">Loading tutorials...</p>
            ) : tutorials.length === 0 ? (
              <GlassCard className="p-8 text-center text-muted-foreground">
                No tutorials created yet. Click "New Tutorial" to get started.
              </GlassCard>
            ) : (
              <div className="grid gap-4">
                {tutorials.map((tutorial) => (
                  <GlassCard key={tutorial.id} className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base">{tutorial.subject}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {format(new Date(tutorial.created_at), 'dd MMM yyyy, hh:mm a')}
                          {tutorial.updated_at !== tutorial.created_at && (
                            <> · Updated: {format(new Date(tutorial.updated_at), 'dd MMM yyyy, hh:mm a')}</>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {stripHtml(tutorial.content)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setViewTutorial(tutorial)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(tutorial)} title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(tutorial.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* View Tutorial Dialog */}
      <Dialog open={!!viewTutorial} onOpenChange={(open) => !open && setViewTutorial(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTutorial?.subject}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-invert max-w-none tutorial-content"
            dangerouslySetInnerHTML={{ __html: viewTutorial?.content || '' }}
          />
        </DialogContent>
      </Dialog>

      {deleteId && (
        <ConfirmDialog
          title="Delete Tutorial"
          message="Are you sure you want to delete this tutorial? This action cannot be undone."
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </DashboardLayout>
  );
}
