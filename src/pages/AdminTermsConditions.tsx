import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTermsConditions() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState('');

  useEffect(() => {
    fetchTerms();
  }, []);

  async function fetchTerms() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('terms_and_conditions')
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
        .from('terms_and_conditions')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', rowId);

      if (error) throw error;
      toast.success('Terms & Conditions updated successfully');
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
          <h1 className="text-2xl font-bold">Terms & Conditions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Edit the terms and conditions that users will see
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Content Editor</h2>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your terms and conditions here..."
                className="min-h-[400px] resize-y text-sm leading-relaxed"
              />
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
