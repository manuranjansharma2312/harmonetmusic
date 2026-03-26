import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Phone } from 'lucide-react';

export default function ContactSupport() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await supabase
          .from('contact_support')
          .select('content')
          .limit(1)
          .single();
        if (data) setContent(data.content);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contact Support</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reach out to us using the contact details below
          </p>
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
          ) : content ? (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {content}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No contact details have been added yet.
            </p>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
