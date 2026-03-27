import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Send, FileSignature, Download, CheckCircle, Clock, Eye, Award, Mail, KeyRound, PenLine, FileDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { CopyButton } from '@/components/CopyButton';

export default function AdminSignatureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    const [docRes, recRes, auditRes] = await Promise.all([
      supabase.from('signature_documents').select('*').eq('id', id).single(),
      supabase.from('signature_recipients').select('*').eq('document_id', id).order('signing_order'),
      supabase.from('signature_audit_logs').select('*').eq('document_id', id).order('created_at', { ascending: false }),
    ]);
    if (!docRes.error) setDoc(docRes.data);
    if (!recRes.error) setRecipients(recRes.data || []);
    if (!auditRes.error) setAuditLogs(auditRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSend = async () => {
    try {
      await supabase.from('signature_documents').update({ status: 'sent' }).eq('id', id);
      const { error } = await supabase.functions.invoke('send-signing-email', {
        body: { document_id: id },
      });
      if (error) throw error;
      toast.success('Signing emails sent');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    }
  };

  const [generatingCert, setGeneratingCert] = useState(false);
  const [sendingCompletion, setSendingCompletion] = useState(false);

  const getSigningUrl = (token: string) => {
    return `${window.location.origin}/sign/${token}`;
  };

  const handleGenerateCertificate = async () => {
    setGeneratingCert(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-signature-certificate', {
        body: { document_id: id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Failed to generate certificate');
      toast.success('Certificate generated and bound to document');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate certificate');
    }
    setGeneratingCert(false);
  };

  const handleDownloadSignedPdf = async () => {
    if (!doc?.signed_pdf_url) {
      toast.error('Signed PDF not available. Generate the certificate first.');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('signature-documents')
        .createSignedUrl(doc.signed_pdf_url, 3600);
      if (error || !data?.signedUrl) throw new Error('Failed to get download URL');
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download');
    }
  };

  const handleSendCompletionEmail = async () => {
    setSendingCompletion(true);
    try {
      if (!doc?.signed_pdf_url) {
        toast.error('Generate the certificate first before sending emails');
        setSendingCompletion(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('send-completion-email', {
        body: { document_id: id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Failed to send emails');
      toast.success(`Completion emails sent to ${data.emails_sent} recipients`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send completion emails');
    }
    setSendingCompletion(false);
  };

  const actionIcons: Record<string, React.ReactNode> = {
    'email_sent': <Mail className="h-3.5 w-3.5 mr-1.5 text-blue-500" />,
    'document_viewed': <Eye className="h-3.5 w-3.5 mr-1.5 text-amber-500" />,
    'otp_requested': <KeyRound className="h-3.5 w-3.5 mr-1.5 text-orange-500" />,
    'otp_verified': <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />,
    'document_signed': <PenLine className="h-3.5 w-3.5 mr-1.5 text-primary" />,
    'completion_email_sent': <FileDown className="h-3.5 w-3.5 mr-1.5 text-green-600" />,
  };

  const actionLabels: Record<string, string> = {
    'email_sent': 'Email Sent',
    'document_viewed': 'Document Viewed',
    'otp_requested': 'OTP Requested',
    'otp_verified': 'OTP Verified',
    'document_signed': 'Document Signed',
    'completion_email_sent': 'Completion Email Sent',
  };

  const renderAction = (action: string) => (
    <span className="flex items-center">
      {actionIcons[action] || null}
      {actionLabels[action] || action}
    </span>
  );

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!doc) return <DashboardLayout><div className="text-center py-12 text-muted-foreground">Document not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/signatures')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{doc.title}</h1>
            <p className="text-muted-foreground text-sm">{doc.description}</p>
          </div>
          <Badge variant={doc.status === 'completed' ? 'default' : 'secondary'} className="flex items-center gap-1.5">
            {doc.status === 'completed' ? <><CheckCircle className="h-3.5 w-3.5" /> Completed</> : doc.status === 'sent' ? <><Send className="h-3.5 w-3.5" /> Sent</> : <><FileSignature className="h-3.5 w-3.5" /> Draft</>}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold">{recipients.length}</p>
            <p className="text-sm text-muted-foreground">Recipients</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold">{recipients.filter(r => r.status === 'signed').length}</p>
            <p className="text-sm text-muted-foreground">Signed</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{doc.document_hash?.slice(0, 12)}...</p>
            <p className="text-sm text-muted-foreground">SHA-256 Hash</p>
          </GlassCard>
        </div>

        <div className="flex gap-2 flex-wrap">
          {doc.status === 'draft' && (
            <>
              <Button onClick={() => navigate(`/admin/signature/${id}/fields`)}>
                <FileSignature className="h-4 w-4 mr-2" /> Place Signature Fields
              </Button>
              <Button onClick={handleSend} variant="secondary">
                <Send className="h-4 w-4 mr-2" /> Send for Signing
              </Button>
            </>
          )}
          {doc.status === 'sent' && (
            <Button onClick={handleSend} variant="outline">
              <Send className="h-4 w-4 mr-2" /> Resend Emails
            </Button>
          )}
          {doc.status === 'completed' && !doc.signed_pdf_url && (
            <Button onClick={handleGenerateCertificate} disabled={generatingCert} variant="default">
              {generatingCert ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
              {generatingCert ? 'Generating Certificate...' : 'Generate & Bind Certificate'}
            </Button>
          )}
          {doc.status === 'completed' && doc.signed_pdf_url && (
            <>
              <Button onClick={handleDownloadSignedPdf} variant="default">
                <FileDown className="h-4 w-4 mr-2" /> Download Signed PDF
              </Button>
              <Button onClick={handleSendCompletionEmail} disabled={sendingCompletion} variant="secondary">
                {sendingCompletion ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {sendingCompletion ? 'Sending...' : 'Send to Recipients'}
              </Button>
              <Button onClick={handleGenerateCertificate} disabled={generatingCert} variant="outline" size="sm">
                {generatingCert ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
                Regenerate
              </Button>
            </>
          )}
        </div>

        {/* Recipients */}
        <GlassCard>
          <div className="p-4 border-b">
            <h2 className="font-semibold">Recipients</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed At</TableHead>
                <TableHead>Signing Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.signing_order}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'signed' ? 'default' : 'secondary'}>
                      {r.status === 'signed' ? <><CheckCircle className="h-3 w-3 mr-1" /> Signed</> : <><Clock className="h-3 w-3 mr-1" /> Pending</>}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.signed_at ? format(new Date(r.signed_at), 'dd MMM yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {r.signing_token && (
                      <CopyButton value={getSigningUrl(r.signing_token)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>

        {/* Audit Trail */}
        <GlassCard>
          <div className="p-4 border-b">
            <h2 className="font-semibold">Audit Trail</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>User Agent</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No activity yet</TableCell></TableRow>
              ) : auditLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{renderAction(log.action)}</TableCell>
                  <TableCell className="text-sm">{log.ip_address || '-'}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{log.user_agent || '-'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
