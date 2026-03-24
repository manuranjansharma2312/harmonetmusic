import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { Loader2, Search, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';

interface Tutorial {
  id: string;
  subject: string;
  content: string;
  created_at: string;
}

export default function HelpTutorials() {
  const [search, setSearch] = useState('');
  const [viewTutorial, setViewTutorial] = useState<Tutorial | null>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Tutorial[];
    },
  });

  const filtered = tutorials.filter((t) =>
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Help Tutorials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Learn how to use the platform with step-by-step guides</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tutorials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center text-muted-foreground">
            {search ? 'No tutorials match your search.' : 'No tutorials available yet.'}
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tutorial) => (
              <GlassCard
                key={tutorial.id}
                className="p-4 sm:p-5 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => setViewTutorial(tutorial)}
              >
                <h3 className="font-semibold text-base line-clamp-2">{tutorial.subject}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(tutorial.created_at), 'dd MMM yyyy')}
                </p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                  {stripHtml(tutorial.content)}
                </p>
                <span className="text-xs text-primary mt-3 inline-block font-medium">Read more →</span>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewTutorial} onOpenChange={(open) => !open && setViewTutorial(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTutorial?.subject}</DialogTitle>
          </DialogHeader>
          <TutorialContent html={viewTutorial?.content || ''} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
