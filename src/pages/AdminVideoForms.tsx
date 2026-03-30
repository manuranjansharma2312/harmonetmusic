import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Video, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

export default function AdminVideoForms() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState('upload_video');

  const fetchForms = async () => {
    setLoading(true);
    const { data } = await supabase.from('video_forms').select('*').order('created_at', { ascending: false });
    setForms(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchForms(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('video_forms').delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success('Form deleted'); fetchForms(); }
    setDeleteId(null);
  };

  const filtered = forms.filter(f => f.form_type === tab);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Video Form Builder</h1>
            <p className="text-sm text-muted-foreground">Create and manage forms for video distribution</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="upload_video" className="gap-2"><Video className="h-4 w-4" /> Upload Video Forms</TabsTrigger>
              <TabsTrigger value="vevo_channel" className="gap-2"><Tv className="h-4 w-4" /> Vevo Channel Forms</TabsTrigger>
            </TabsList>
            <Button onClick={() => navigate(`/admin/video-forms/builder?type=${tab}`)}>
              <Plus className="h-4 w-4 mr-1" /> Create {tab === 'vevo_channel' ? 'Vevo Channel' : 'Upload Video'} Form
            </Button>
          </div>

          <TabsContent value={tab}>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No forms created yet</p>
                ) : (
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(form => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.name}</TableCell>
                          <TableCell>
                            <Badge variant={form.is_active ? 'default' : 'secondary'}>
                              {form.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(form.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/video-forms/builder?type=${form.form_type}&edit=${form.id}`)}>
                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteId(form.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete Form"
          message="This will delete the form and all its fields. Existing submissions will remain. Are you sure?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </DashboardLayout>
  );
}
