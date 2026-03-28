import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { FileText } from 'lucide-react';
import DOMPurify from 'dompurify';

export default function VideoGuidelines() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('video_guidelines')
      .select('content')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setContent(data.content);
        setLoading(false);
      });
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Video Distribution Guidelines</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Please read these guidelines before submitting
          </p>
        </div>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Guidelines</h2>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : content ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
            />
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No guidelines available yet.</p>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
