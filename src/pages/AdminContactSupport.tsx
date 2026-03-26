import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminContactSupport() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await supabase
          .from('contact_support')
          .select('*')
          .limit(1)
          .single();
        if (data) {
          setContent(data.content);
          setRecordId(data.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const handleSave = async () => {
    if (!recordId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('contact_support')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', recordId);
      if (error) throw error;
      toast.success('Contact details saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contact Support Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Add contact information that users will see on the Contact Support page
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Contact Details</h2>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter contact details here... (e.g., email addresses, phone numbers, office hours, social media links, etc.)"
              className="min-h-[300px] text-sm"
            />
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
