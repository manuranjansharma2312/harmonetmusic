import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileSignature, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DownloadSignedPdf() {
  const { documentId } = useParams<{ documentId: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');
  const [docTitle, setDocTitle] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    if (!documentId) {
      setStatus('error');
      return;
    }
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setStatus('loading');

    try {
      const { data, error } = await supabase.functions.invoke('download-signed-pdf', {
        body: { document_id: documentId },
      });

      if (error) {
        setStatus('error');
        return;
      }

      if (data?.status === 'expired') {
        setDocTitle(data.title || '');
        setStatus('expired');
      } else if (data?.status === 'ready') {
        setDocTitle(data.title || '');
        setDownloadUrl(data.download_url);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">Download Link Expired</h1>
          <p className="text-muted-foreground">
            This download link has expired after 7 days. Please contact the administrator to receive a new download link for <strong>"{docTitle}"</strong>.
          </p>
          <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            For security reasons, signed document download links are valid for 7 days only.
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 space-y-4">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Link Invalid</h1>
          <p className="text-muted-foreground">
            This download link is invalid or the document is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8 space-y-6">
        <FileSignature className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Signed Document Ready</h1>
        <p className="text-muted-foreground">
          Your signed document <strong>"{docTitle}"</strong> is ready for download.
        </p>
        <Button asChild size="lg" className="w-full py-6 text-lg">
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-5 w-5 mr-2" /> Download Signed PDF
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          This link will expire 7 days after the document was completed.
        </p>
      </div>
    </div>
  );
}
