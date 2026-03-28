import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Save, ArrowLeft, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate, useSearchParams } from 'react-router-dom';

const FIELD_TYPES = [
  { value: 'text', label: 'Text - Single Line' },
  { value: 'textarea', label: 'TextArea' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number with Country Code' },
  { value: 'number', label: 'Number Field' },
  { value: 'date', label: 'Date Calendar' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi Select' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'image_upload', label: 'Image Upload (with Auto-Crop)' },
  { value: 'video_upload', label: 'Video Upload' },
  { value: 'document_upload', label: 'Document Upload' },
  { value: 'drag_drop_upload', label: 'Drag & Drop Upload' },
  { value: 'link', label: 'Link / URL' },
];

interface FormField {
  id?: string;
  field_type: string;
  label: string;
  description: string;
  placeholder: string;
  is_required: boolean;
  sort_order: number;
  options: string[];
  settings: Record<string, any>;
}

export default function AdminVideoFormBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formType = searchParams.get('type') || 'upload_video';
  const editId = searchParams.get('edit');

  const [formName, setFormName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [settingsDialogField, setSettingsDialogField] = useState<number | null>(null);

  useEffect(() => {
    if (editId) loadForm();
  }, [editId]);

  const loadForm = async () => {
    setLoading(true);
    const { data: form } = await supabase
      .from('video_forms')
      .select('*')
      .eq('id', editId!)
      .single();
    if (form) {
      setFormName(form.name);
      setIsActive(form.is_active);
      const { data: dbFields } = await supabase
        .from('video_form_fields')
        .select('*')
        .eq('form_id', editId!)
        .order('sort_order');
      if (dbFields) {
        setFields(dbFields.map((f: any) => ({
          id: f.id,
          field_type: f.field_type,
          label: f.label,
          placeholder: f.placeholder || '',
          is_required: f.is_required,
          sort_order: f.sort_order,
          options: Array.isArray(f.options) ? f.options : [],
          settings: typeof f.settings === 'object' && f.settings ? f.settings : {},
        })));
      }
    }
    setLoading(false);
  };

  const addField = () => {
    setFields(prev => [...prev, {
      field_type: 'text',
      label: '',
      placeholder: '',
      is_required: false,
      sort_order: prev.length,
      options: [],
      settings: {},
    }]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newFields.length) return;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields.map((f, i) => ({ ...f, sort_order: i })));
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Form name is required'); return; }
    if (fields.length === 0) { toast.error('Add at least one field'); return; }
    for (const f of fields) {
      if (!f.label.trim()) { toast.error('All fields must have a label'); return; }
    }

    setSaving(true);
    try {
      let formId = editId;

      if (editId) {
        const { error } = await supabase.from('video_forms').update({
          name: formName, is_active: isActive,
        }).eq('id', editId);
        if (error) throw error;
        // Delete old fields and re-insert
        await supabase.from('video_form_fields').delete().eq('form_id', editId);
      } else {
        const { data, error } = await supabase.from('video_forms').insert({
          name: formName, form_type: formType, is_active: isActive,
        }).select('id').single();
        if (error) throw error;
        formId = data.id;
      }

      const fieldInserts = fields.map((f, i) => ({
        form_id: formId!,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder,
        is_required: f.is_required,
        sort_order: i,
        options: f.options,
        settings: f.settings,
      }));

      const { error: fieldsError } = await supabase.from('video_form_fields').insert(fieldInserts);
      if (fieldsError) throw fieldsError;

      toast.success(editId ? 'Form updated!' : 'Form created!');
      navigate('/admin/video-forms');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const needsOptions = (type: string) => ['dropdown', 'multiselect', 'radio'].includes(type);
  const isUploadType = (type: string) => ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(type);

  const typeLabel = formType === 'vevo_channel' ? 'Vevo Channel' : 'Upload Video';

  if (loading) return <DashboardLayout><div className="p-6">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/video-forms')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{editId ? 'Edit' : 'Create'} {typeLabel} Form</h1>
            <p className="text-sm text-muted-foreground">Build a dynamic form for {typeLabel.toLowerCase()}</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Form Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Form Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Upload Video Form v1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active (visible to users)</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Form Fields ({fields.length})</CardTitle>
              <Button onClick={addField} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Field</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No fields yet. Click "Add Field" to start building your form.</p>
            )}
            {fields.map((field, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(index, 'up')} disabled={index === 0}>↑</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1}>↓</Button>
                    {isUploadType(field.field_type) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSettingsDialogField(index)}>
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Field Type</Label>
                    <Select value={field.field_type} onValueChange={v => updateField(index, { field_type: v, options: needsOptions(v) ? field.options : [] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={field.label} onChange={e => updateField(index, { label: e.target.value })} placeholder="Field label" />
                  </div>
                  <div>
                    <Label className="text-xs">Placeholder</Label>
                    <Input value={field.placeholder} onChange={e => updateField(index, { placeholder: e.target.value })} placeholder="Placeholder text" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox checked={field.is_required} onCheckedChange={v => updateField(index, { is_required: !!v })} />
                  <Label className="text-xs">Required</Label>
                </div>

                {needsOptions(field.field_type) && (
                  <div>
                    <Label className="text-xs">Options (separated by comma)</Label>
                    <Input
                      value={field.options.join(', ')}
                      onChange={e => updateField(index, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}

                {field.field_type === 'image_upload' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Aspect Ratio (e.g. 1:1, 16:9)</Label>
                      <Input
                        value={field.settings.aspect_ratio || ''}
                        onChange={e => updateField(index, { settings: { ...field.settings, aspect_ratio: e.target.value } })}
                        placeholder="1:1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Output Width (px)</Label>
                      <Input
                        type="number" min={1}
                        value={field.settings.output_width || ''}
                        onChange={e => updateField(index, { settings: { ...field.settings, output_width: parseInt(e.target.value) || '' } })}
                        placeholder="e.g. 1080"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Output Height (px)</Label>
                      <Input
                        type="number" min={1}
                        value={field.settings.output_height || ''}
                        onChange={e => updateField(index, { settings: { ...field.settings, output_height: parseInt(e.target.value) || '' } })}
                        placeholder="e.g. 1080"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Count (for multiple)</Label>
                      <Input
                        type="number" min={1}
                        value={field.settings.max_count || 1}
                        onChange={e => updateField(index, { settings: { ...field.settings, max_count: parseInt(e.target.value) || 1 } })}
                      />
                    </div>
                  </div>
                )}

                {(field.field_type === 'file_upload' || field.field_type === 'document_upload' || field.field_type === 'drag_drop_upload') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Accepted File Types</Label>
                      <Input
                        value={field.settings.accept || ''}
                        onChange={e => updateField(index, { settings: { ...field.settings, accept: e.target.value } })}
                        placeholder=".pdf,.doc,.docx"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max File Size (MB)</Label>
                      <Input
                        type="number" min={1}
                        value={field.settings.max_size_mb || 50}
                        onChange={e => updateField(index, { settings: { ...field.settings, max_size_mb: parseInt(e.target.value) || 50 } })}
                      />
                    </div>
                  </div>
                )}

                {field.field_type === 'video_upload' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Accepted Formats</Label>
                      <Input
                        value={field.settings.accept || ''}
                        onChange={e => updateField(index, { settings: { ...field.settings, accept: e.target.value } })}
                        placeholder=".mp4,.mov,.avi"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max File Size (MB)</Label>
                      <Input
                        type="number" min={1}
                        value={field.settings.max_size_mb || 500}
                        onChange={e => updateField(index, { settings: { ...field.settings, max_size_mb: parseInt(e.target.value) || 500 } })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/video-forms')}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Form'}
          </Button>
        </div>
      </div>

      {/* Settings Dialog for Upload Fields */}
      <Dialog open={settingsDialogField !== null} onOpenChange={() => setSettingsDialogField(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Field Settings</DialogTitle></DialogHeader>
          {settingsDialogField !== null && fields[settingsDialogField] && (
            <div className="space-y-4">
              <div>
                <Label>Max File Size (MB)</Label>
                <Input
                  type="number" min={1}
                  value={fields[settingsDialogField].settings.max_size_mb || 50}
                  onChange={e => updateField(settingsDialogField, {
                    settings: { ...fields[settingsDialogField].settings, max_size_mb: parseInt(e.target.value) || 50 }
                  })}
                />
              </div>
              <div>
                <Label>Accepted File Types</Label>
                <Input
                  value={fields[settingsDialogField].settings.accept || ''}
                  onChange={e => updateField(settingsDialogField, {
                    settings: { ...fields[settingsDialogField].settings, accept: e.target.value }
                  })}
                  placeholder=".pdf,.jpg,.mp4"
                />
              </div>
              {fields[settingsDialogField].field_type === 'image_upload' && (
                <>
                  <div>
                    <Label>Aspect Ratio</Label>
                    <Input
                      value={fields[settingsDialogField].settings.aspect_ratio || ''}
                      onChange={e => updateField(settingsDialogField, {
                        settings: { ...fields[settingsDialogField].settings, aspect_ratio: e.target.value }
                      })}
                      placeholder="1:1 or 16:9"
                    />
                  </div>
                  <div>
                    <Label>Max Count</Label>
                    <Input
                      type="number" min={1}
                      value={fields[settingsDialogField].settings.max_count || 1}
                      onChange={e => updateField(settingsDialogField, {
                        settings: { ...fields[settingsDialogField].settings, max_count: parseInt(e.target.value) || 1 }
                      })}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={fields[settingsDialogField].settings.multiple || false}
                  onCheckedChange={v => updateField(settingsDialogField, {
                    settings: { ...fields[settingsDialogField].settings, multiple: !!v }
                  })}
                />
                <Label>Allow Multiple Files</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSettingsDialogField(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
