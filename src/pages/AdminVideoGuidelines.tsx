import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/RichTextEditor';

export default function AdminVideoGuidelines() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState('');

  useEffect(() => {
    fetchGuidelines();
  }, []);

  async function fetchGuidelines() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('video_guidelines')
        .select('*')
        .limit(1)
        .single();
      if (data) {
        setContent(data.content);
        setRowId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('video_guidelines')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', rowId);
      if (error) throw error;
      toast.success('Video Distribution Guidelines updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Video Distribution Guidelines</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Write guidelines that users will see before submitting videos
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Guideline Editor</h2>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <RichTextEditor value={content} onChange={setContent} />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
