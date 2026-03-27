import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react';

interface Field {
  id?: string;
  recipient_id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
}

export default function AdminSignatureFields() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [docRes, recRes, fieldsRes] = await Promise.all([
        supabase.from('signature_documents').select('*').eq('id', id).single(),
        supabase.from('signature_recipients').select('*').eq('document_id', id).order('signing_order'),
        supabase.from('signature_fields').select('*').eq('document_id', id),
      ]);
      if (docRes.data) {
        setDoc(docRes.data);
        const { data: signedUrl } = await supabase.storage
          .from('signature-documents')
          .createSignedUrl(docRes.data.document_url, 3600);
        if (signedUrl) setPdfUrl(signedUrl.signedUrl);
      }
      if (recRes.data) {
        setRecipients(recRes.data);
        if (recRes.data.length > 0) setSelectedRecipient(recRes.data[0].id);
      }
      if (fieldsRes.data) {
        setFields(fieldsRes.data.map((f: any) => ({
          id: f.id,
          recipient_id: f.recipient_id,
          page_number: f.page_number,
          x_position: Number(f.x_position),
          y_position: Number(f.y_position),
          width: Number(f.width),
          height: Number(f.height),
        })));
      }
    };
    fetchData();
  }, [id]);

  const addField = () => {
    if (!selectedRecipient) {
      toast.error('Select a recipient first');
      return;
    }
    setFields([...fields, {
      recipient_id: selectedRecipient,
      page_number: currentPage,
      x_position: 50,
      y_position: 50,
      width: 200,
      height: 80,
    }]);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing fields
      await supabase.from('signature_fields').delete().eq('document_id', id);
      
      // Insert new fields
      if (fields.length > 0) {
        const { error } = await supabase.from('signature_fields').insert(
          fields.map(f => ({
            document_id: id,
            recipient_id: f.recipient_id,
            page_number: f.page_number,
            x_position: f.x_position,
            y_position: f.y_position,
            width: f.width,
            height: f.height,
          }))
        );
        if (error) throw error;
      }
      toast.success('Fields saved successfully');
      navigate(`/admin/signature/${id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleMouseDown = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const field = fields[idx];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingIdx(idx);
    setDragOffset({
      x: e.clientX - rect.left - field.x_position,
      y: e.clientY - rect.top - field.y_position,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIdx === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - fields[draggingIdx].width));
    const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - fields[draggingIdx].height));
    const updated = [...fields];
    updated[draggingIdx] = { ...updated[draggingIdx], x_position: Math.round(x), y_position: Math.round(y) };
    setFields(updated);
  };

  const handleMouseUp = () => {
    setDraggingIdx(null);
  };

  const getRecipientColor = (recId: string) => {
    const idx = recipients.findIndex(r => r.id === recId);
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    return colors[idx % colors.length];
  };

  const getRecipientName = (recId: string) => {
    return recipients.find(r => r.id === recId)?.name || 'Unknown';
  };

  const pageFields = fields.filter(f => f.page_number === currentPage);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/signature/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Place Signature Fields</h1>
            <p className="text-muted-foreground text-sm">{doc?.title}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Fields'}
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center p-3 rounded-lg bg-muted/50 border">
          <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select recipient" />
            </SelectTrigger>
            <SelectContent>
              {recipients.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getRecipientColor(r.id) }} />
                    {r.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="h-3 w-3 mr-1" /> Add Signature Field
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className="border rounded-lg overflow-hidden bg-muted/30">
          <div
            ref={canvasRef}
            className="relative mx-auto bg-white"
            style={{ width: 612, height: 792, cursor: draggingIdx !== null ? 'grabbing' : 'default' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* PDF preview placeholder */}
            {pdfUrl && (
              <iframe src={`${pdfUrl}#page=${currentPage}`} className="absolute inset-0 w-full h-full pointer-events-none" title="PDF Preview" />
            )}
            
            {/* Signature fields */}
            {fields.filter(f => f.page_number === currentPage).map((field, _i) => {
              const globalIdx = fields.indexOf(field);
              return (
                <div
                  key={globalIdx}
                  className="absolute border-2 border-dashed rounded flex items-center justify-center cursor-grab select-none group"
                  style={{
                    left: field.x_position,
                    top: field.y_position,
                    width: field.width,
                    height: field.height,
                    borderColor: getRecipientColor(field.recipient_id),
                    backgroundColor: `${getRecipientColor(field.recipient_id)}20`,
                  }}
                  onMouseDown={e => handleMouseDown(globalIdx, e)}
                >
                  <div className="text-center pointer-events-none">
                    <GripVertical className="h-4 w-4 mx-auto mb-1" style={{ color: getRecipientColor(field.recipient_id) }} />
                    <p className="text-[10px] font-medium" style={{ color: getRecipientColor(field.recipient_id) }}>
                      {getRecipientName(field.recipient_id)}
                    </p>
                  </div>
                  <button
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => { e.stopPropagation(); removeField(globalIdx); }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Field list */}
        {fields.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <h3 className="text-sm font-semibold mb-2">Placed Fields ({fields.length})</h3>
            <div className="space-y-1">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-background">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getRecipientColor(f.recipient_id) }} />
                    {getRecipientName(f.recipient_id)} — Page {f.page_number} ({f.x_position}, {f.y_position})
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeField(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
