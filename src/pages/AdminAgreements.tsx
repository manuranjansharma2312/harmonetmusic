import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/GlassCard";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Copy, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { RichTextEditor } from "@/components/RichTextEditor";

const SHORTCODES = [
  { code: "{{client_type}}", label: "Client Type (Artist/Record Label)" },
  { code: "{{date_of_agreement}}", label: "Date of Agreement" },
  { code: "{{artist_label_name}}", label: "Artist / Label Name" },
  { code: "{{legal_name}}", label: "Legal Name" },
  { code: "{{address}}", label: "Residential / Business Address" },
  { code: "{{mobile_number}}", label: "Mobile Number" },
  { code: "{{email}}", label: "Email Address" },
  { code: "{{govt_ids}}", label: "Govt ID List" },
  { code: "{{client_revenue_percent}}", label: "Client Revenue %" },
  { code: "{{harmonet_revenue_percent}}", label: "Harmonet Revenue %" },
];

export default function AdminAgreements() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["agreement-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("agreement_templates")
          .update({ name, content, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agreement_templates")
          .insert({ name, content, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreement-templates"] });
      toast.success(editing ? "Template updated" : "Template created");
      resetForm();
    },
    onError: () => toast.error("Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agreement_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreement-templates"] });
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setName("");
    setContent("");
  };

  const startEdit = (t: any) => {
    setEditing(t);
    setName(t.name);
    setContent(t.content);
    setShowForm(true);
  };

  const copyShortcode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agreement Templates</h1>
            <p className="text-muted-foreground text-sm">Create templates with shortcodes for PDF generation</p>
          </div>
          <div className="flex gap-2">
            {!showForm && (
              <Button variant="outline" onClick={() => navigate("/admin/agreements/generate")}>
                Generate PDF
              </Button>
            )}
            {!showForm && (
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New Template
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{editing ? "Edit Template" : "New Template"}</h2>

              <div>
                <Label>Template Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Artist Agreement" />
              </div>

              <div>
                <Label className="mb-2 block">Available Shortcodes (click to copy)</Label>
                <div className="flex flex-wrap gap-2">
                  {SHORTCODES.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => copyShortcode(s.code)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-xs font-mono text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" /> {s.code}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Template Content</Label>
                <RichTextEditor value={content} onChange={setContent} />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !content.trim() || saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Save"}
                </Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          </GlassCard>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : templates.length === 0 && !showForm ? (
          <GlassCard>
            <p className="text-center text-muted-foreground py-8">No templates yet. Create your first one!</p>
          </GlassCard>
        ) : (
          <div className="grid gap-4">
            {templates.map((t: any) => (
              <GlassCard key={t.id}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Updated: {new Date(t.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(t)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {!!deleteId && (
        <ConfirmDialog
          title="Delete Template"
          message="Are you sure you want to delete this template?"
          onConfirm={() => { deleteMutation.mutate(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div
            className="agreement-preview p-6 rounded-md"
            style={{ backgroundColor: "white", color: "black" }}
            dangerouslySetInnerHTML={{ __html: previewTemplate?.content || "" }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
