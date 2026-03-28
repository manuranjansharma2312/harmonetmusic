import { useState, useEffect, useRef, useCallback } from 'react';
import { countries } from '@/data/countries';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BrandingCropModal } from '@/components/BrandingCropModal';
import { Badge } from '@/components/ui/badge';

interface FieldDef {
  id: string;
  field_type: string;
  label: string;
  description: string;
  placeholder: string;
  is_required: boolean;
  sort_order: number;
  options: string[];
  settings: Record<string, any>;
}

export default function VideoSubmit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const submissionType = searchParams.get('type') || 'upload_video';

  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cropField, setCropField] = useState<{ fieldId: string; src: string; aspect?: number; outputSize?: { width: number; height: number } } | null>(null);

  useEffect(() => { loadForm(); }, [submissionType]);

  const loadForm = async () => {
    setLoading(true);
    const { data: forms } = await supabase
      .from('video_forms')
      .select('*')
      .eq('form_type', submissionType)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (forms && forms.length > 0) {
      setForm(forms[0]);
      const { data: dbFields } = await supabase
        .from('video_form_fields')
        .select('*')
        .eq('form_id', forms[0].id)
        .order('sort_order');
      setFields((dbFields || []).map((f: any) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options.filter((o: string) => o.trim()) : [],
        settings: typeof f.settings === 'object' && f.settings ? f.settings : {},
      })));
    } else {
      setForm(null);
      setFields([]);
    }
    setLoading(false);
  };

  const handleFileSelect = (fieldId: string, file: File | null, field: FieldDef) => {
    if (!file) return;

    // Check if image_upload with aspect ratio or output size -> show crop
    if (field.field_type === 'image_upload') {
      const hasAspect = !!field.settings.aspect_ratio;
      const hasOutput = field.settings.output_width && field.settings.output_height;
      if (hasAspect || hasOutput) {
        let aspect: number | undefined;
        if (hasAspect) {
          const parts = field.settings.aspect_ratio.split(':').map(Number);
          aspect = parts.length === 2 && parts[1] ? parts[0] / parts[1] : undefined;
        } else if (hasOutput) {
          aspect = field.settings.output_width / field.settings.output_height;
        }
        const outputSize = hasOutput ? { width: field.settings.output_width, height: field.settings.output_height } : undefined;
        const src = URL.createObjectURL(file);
        setCropField({ fieldId, src, aspect, outputSize });
        return;
      }
    }

    setFileValues(prev => ({ ...prev, [fieldId]: file }));
  };

  const handleCropComplete = (croppedFile: File) => {
    if (!cropField) return;
    setFileValues(prev => ({ ...prev, [cropField.fieldId]: croppedFile }));
    URL.revokeObjectURL(cropField.src);
    setCropField(null);
  };

  const uploadFile = async (file: File, fieldId: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `videos/${user!.id}/${fieldId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('video-uploads').upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('video-uploads').getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!form || !user) return;

    // Validate required fields
    for (const field of fields) {
      if (!field.is_required) continue;
      const isFile = ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(field.field_type);
      if (field.field_type === 'multiselect') {
        if (!multiSelectValues[field.id]?.length) {
          toast.error(`${field.label} is required`);
          return;
        }
      } else if (isFile) {
        if (!fileValues[field.id]) {
          toast.error(`${field.label} is required`);
          return;
        }
      } else {
        if (!values[field.id]?.trim()) {
          toast.error(`${field.label} is required`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Upload files first
      const uploadedUrls: Record<string, string> = {};
      for (const [fieldId, file] of Object.entries(fileValues)) {
        if (file) {
          uploadedUrls[fieldId] = await uploadFile(file, fieldId);
        }
      }

      // Create submission
      const { data: sub, error: subError } = await supabase.from('video_submissions').insert({
        form_id: form.id,
        user_id: user.id,
        submission_type: submissionType,
      }).select('id').single();
      if (subError) throw subError;

      // Insert values
      const valueInserts = fields.map(field => {
        const isFile = ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(field.field_type);
        const isMultiSelect = field.field_type === 'multiselect';
        return {
          submission_id: sub.id,
          field_id: field.id,
          text_value: isMultiSelect ? (multiSelectValues[field.id] || []).join(', ') : (values[field.id] || null),
          file_url: isFile ? (uploadedUrls[field.id] || null) : null,
        };
      });

      const { error: valError } = await supabase.from('video_submission_values').insert(valueInserts);
      if (valError) throw valError;

      toast.success('Submission sent successfully!');
      navigate(submissionType === 'vevo_channel' ? '/vevo-channels' : '/my-videos');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = submissionType === 'vevo_channel' ? 'Create Vevo Channel' : 'Upload Video';

  if (loading) return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  if (!form) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No active form available for {typeLabel}. Please contact admin.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">{typeLabel}</h1>
          <p className="text-sm text-muted-foreground">{form.name}</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {fields.map(field => (
              <div key={field.id} className="space-y-1.5">
                <Label>
                  {field.label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}

                {field.field_type === 'text' && (
                  <Input
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}

                {field.field_type === 'textarea' && (
                  <Textarea
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    rows={4}
                  />
                )}

                {field.field_type === 'email' && (
                  <Input
                    type="email"
                    placeholder={field.placeholder || 'email@example.com'}
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}

                {field.field_type === 'phone' && (
                  <div className="flex gap-2">
                    <select
                      className="w-[140px] px-2 py-2 rounded-md border border-input bg-background text-sm"
                      value={values[`${field.id}_code`] || '+91'}
                      onChange={e => setValues(prev => ({ ...prev, [`${field.id}_code`]: e.target.value }))}
                    >
                      {countries.map(c => (
                        <option key={c.code} value={c.dialCode}>{c.flag} {c.name} ({c.dialCode})</option>
                      ))}
                    </select>
                    <Input
                      className="flex-1"
                      placeholder={field.placeholder || 'Phone number'}
                      value={values[field.id]?.replace(/^\+\d+\s*/, '') || ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.id]: `${values[`${field.id}_code`] || '+91'} ${e.target.value}` }))}
                    />
                  </div>
                )}

                {field.field_type === 'number' && (
                  <Input
                    type="number"
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}

                {field.field_type === 'date' && (
                  <Input
                    type="date"
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}

                {field.field_type === 'dropdown' && (
                  <Select value={values[field.id] || ''} onValueChange={v => setValues(prev => ({ ...prev, [field.id]: v }))}>
                    <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                {field.field_type === 'multiselect' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(multiSelectValues[field.id] || []).map(v => (
                        <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => {
                          setMultiSelectValues(prev => ({ ...prev, [field.id]: (prev[field.id] || []).filter(x => x !== v) }));
                        }}>
                          {v} ×
                        </Badge>
                      ))}
                    </div>
                    <Select onValueChange={v => {
                      setMultiSelectValues(prev => {
                        const current = prev[field.id] || [];
                        return { ...prev, [field.id]: current.includes(v) ? current : [...current, v] };
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select options..." /></SelectTrigger>
                      <SelectContent>
                        {field.options.filter(o => !(multiSelectValues[field.id] || []).includes(o)).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {field.field_type === 'radio' && (
                  <RadioGroup value={values[field.id] || ''} onValueChange={v => setValues(prev => ({ ...prev, [field.id]: v }))}>
                    {field.options.map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                        <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {field.field_type === 'checkbox' && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={values[field.id] === 'true'}
                      onCheckedChange={v => setValues(prev => ({ ...prev, [field.id]: v ? 'true' : 'false' }))}
                    />
                    <span className="text-sm">{field.placeholder || field.label}</span>
                  </div>
                )}

                {['file_upload', 'document_upload', 'drag_drop_upload'].includes(field.field_type) && (
                  <div>
                    <Input
                      type="file"
                      accept={field.settings.accept || undefined}
                      onChange={e => handleFileSelect(field.id, e.target.files?.[0] || null, field)}
                    />
                    {fileValues[field.id] && <p className="text-xs text-muted-foreground mt-1">{fileValues[field.id]!.name}</p>}
                  </div>
                )}

                {field.field_type === 'image_upload' && (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileSelect(field.id, e.target.files?.[0] || null, field)}
                    />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {field.settings.aspect_ratio && (
                        <p className="text-xs text-muted-foreground">Ratio: {field.settings.aspect_ratio}</p>
                      )}
                      {field.settings.output_width && field.settings.output_height && (
                        <p className="text-xs text-muted-foreground">Size: {field.settings.output_width}×{field.settings.output_height}px</p>
                      )}
                    </div>
                    {fileValues[field.id] && (
                      <div className="mt-2">
                        <img src={URL.createObjectURL(fileValues[field.id]!)} alt="Preview" className="h-24 rounded object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {field.field_type === 'link' && (
                  <Input
                    type="url"
                    placeholder={field.placeholder || 'https://...'}
                    value={values[field.id] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}

                {field.field_type === 'video_upload' && (
                  <div>
                    <Input
                      type="file"
                      accept={field.settings.accept || 'video/*'}
                      onChange={e => handleFileSelect(field.id, e.target.files?.[0] || null, field)}
                    />
                    {fileValues[field.id] && <p className="text-xs text-muted-foreground mt-1">{fileValues[field.id]!.name}</p>}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-4">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : <><Upload className="h-4 w-4 mr-2" /> Submit</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Crop Modal */}
      {cropField && (
        <BrandingCropModal
          open={true}
          imageSrc={cropField.src}
          aspect={cropField.aspect}
          outputSize={cropField.outputSize}
          title="Crop Image"
          onCropComplete={handleCropComplete}
          onCancel={() => { URL.revokeObjectURL(cropField.src); setCropField(null); }}
        />
      )}
    </DashboardLayout>
  );
}
