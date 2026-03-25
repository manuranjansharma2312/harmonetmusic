import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Send, History } from 'lucide-react';
import { TablePagination, paginateItems } from '@/components/TablePagination';

export interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'url';
  placeholder?: string;
  required?: boolean;
}

interface ContentRequestPageProps {
  title: string;
  requestType: string;
  fields: FieldConfig[];
}

export function ContentRequestPage({ title, requestType, fields }: ContentRequestPageProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('content_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('request_type', requestType)
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const insertData: Record<string, any> = {
      user_id: user.id,
      request_type: requestType,
    };
    fields.forEach((f) => {
      insertData[f.name] = formData[f.name] || null;
    });

    const { error } = await supabase.from('content_requests').insert(insertData as any);
    if (error) {
      toast.error('Failed to submit request');
    } else {
      toast.success('Request submitted successfully');
      setFormData({});
      fetchHistory();
    }
    setSubmitting(false);
  };

  const getFieldLabel = (name: string) => {
    const field = fields.find((f) => f.name === name);
    return field?.label || name;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>

        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form" className="gap-2">
              <Send className="h-4 w-4" /> New Request
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form">
            <GlassCard>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                {fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{field.label} {field.required !== false && <span className="text-destructive">*</span>}</Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={field.name}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        required={field.required !== false}
                      />
                    ) : (
                      <Input
                        id={field.name}
                        type={field.type === 'url' ? 'url' : 'text'}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        required={field.required !== false}
                      />
                    )}
                  </div>
                ))}
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </GlassCard>
          </TabsContent>

          <TabsContent value="history">
            <GlassCard>
              <div className="p-6">
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No requests yet.</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {fields.map((field) =>
                            item[field.name] ? (
                              <div key={field.name}>
                                <span className="text-xs text-muted-foreground">{field.label}:</span>
                                <p className="text-sm text-foreground break-all">{item[field.name]}</p>
                              </div>
                            ) : null
                          )}
                        </div>
                        {item.status === 'rejected' && item.rejection_reason && (
                          <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                            <span className="text-xs font-medium text-destructive">Rejection Reason:</span>
                            <p className="text-sm text-destructive">{item.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
