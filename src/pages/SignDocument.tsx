import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, PenTool, Type, Upload, Shield, FileSignature } from 'lucide-react';

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'sign' | 'done'>('sign');
  const [signing, setSigning] = useState(false);
  const [consent, setConsent] = useState(false);
  const [signatureTab, setSignatureTab] = useState('draw');
  const [typedName, setTypedName] = useState('');
  const [uploadedSig, setUploadedSig] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [geoInfo, setGeoInfo] = useState<{ ip: string; city: string; region: string; country: string }>({ ip: '', city: '', region: '', country: '' });

  useEffect(() => {
    if (!token) return;
    loadData();
    // Fetch IP + geolocation
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setGeoInfo({ ip: d.ip || '', city: d.city || '', region: d.region || '', country: d.country_name || '' }))
      .catch(() => {});
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    const { data: result, error: err } = await supabase.rpc('get_signing_data', { _token: token! }) as { data: any, error: any };
    if (err || !result) {
      setError('This signing link is invalid or has expired.');
      setLoading(false);
      return;
    }
    setData(result);
    
    // Get signed URL for PDF
    const { data: signedUrl } = await supabase.storage
      .from('signature-documents')
      .createSignedUrl(result.document.document_url, 3600);
    if (signedUrl) setPdfUrl(signedUrl.signedUrl);

    if (result.recipient.otp_verified) {
      setStep('sign');
    }

    // Log document viewed
    await supabase.rpc('log_signature_audit', {
      _token: token!,
      _action: 'document_viewed',
      _ip: geoInfo.ip || '',
      _user_agent: navigator.userAgent,
      _metadata: {},
    });
    setLoading(false);
  };

  const sendOtp = async () => {
    setOtpSending(true);
    const { data: success } = await supabase.rpc('request_signing_otp', {
      _token: token!,
      _ip: geoInfo.ip || '',
    });
    if (success) {
      setOtpSent(true);
      toast.success('OTP sent to your email');
      // Call edge function to actually send the OTP email
      await supabase.functions.invoke('send-signing-otp', {
        body: { token: token },
      });
    } else {
      toast.error('Failed to send OTP. Please try again later.');
    }
    setOtpSending(false);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setVerifying(true);
    const { data: valid } = await supabase.rpc('verify_signing_otp', {
      _token: token!,
      _otp: otp,
      _ip: geoInfo.ip || '',
    });
    if (valid) {
      toast.success('OTP verified');
      setStep('sign');
    } else {
      toast.error('Invalid or expired OTP');
    }
    setVerifying(false);
  };

  // Canvas drawing
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const pos = 'touches' in e ? e.touches[0] : e;
    ctx.beginPath();
    ctx.moveTo(pos.clientX - rect.left, pos.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const pos = 'touches' in e ? e.touches[0] : e;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(pos.clientX - rect.left, pos.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignatureData = (): string | null => {
    if (signatureTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL('image/png');
    } else if (signatureTab === 'type') {
      if (!typedName.trim()) return null;
      // Generate typed signature as image
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.font = 'italic 48px "Georgia", serif';
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 200, 75);
      return canvas.toDataURL('image/png');
    } else if (signatureTab === 'upload') {
      return uploadedSig || null;
    }
    return null;
  };

  const handleFinishSigning = async () => {
    if (!consent) {
      toast.error('Please accept the consent');
      return;
    }
    const sigData = getSignatureData();
    if (!sigData) {
      toast.error('Please provide your signature');
      return;
    }
    setSigning(true);
    const locationStr = [geoInfo.city, geoInfo.region, geoInfo.country].filter(Boolean).join(', ');
    const { data: success } = await supabase.rpc('submit_signature', {
      _token: token!,
      _signature_data: sigData,
      _signature_type: signatureTab,
      _ip: geoInfo.ip || '',
      _user_agent: navigator.userAgent,
      _geolocation: locationStr,
    });
    if (success) {
      setStep('done');
      toast.success('Document signed successfully!');
      
      // Trigger auto-complete (certificate + email) in background
      // This is fire-and-forget; the edge function checks if auto-send is enabled
      supabase.functions.invoke('auto-complete-signature', {
        body: { document_id: data.document.id },
      }).catch(() => { /* silently ignore - admin can manually trigger */ });
    } else {
      toast.error('Failed to sign. Please try again.');
    }
    setSigning(false);
  };

  const handleUploadSig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedSig(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Link Invalid</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Signed Successfully!</h1>
          <p className="text-muted-foreground mb-4">
            Your signature has been recorded. You will receive a copy of the signed document via email.
          </p>
          <div className="p-4 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium">Document: {data?.document?.title}</p>
            <p className="text-muted-foreground">Signed by: {data?.recipient?.name}</p>
            <p className="text-muted-foreground">SHA-256: {data?.document?.document_hash?.slice(0, 20)}...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">{data?.document?.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Secure Signing</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {step === 'otp' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold">Verify Your Identity</h2>
              <p className="text-muted-foreground mt-2">
                Hi {data?.recipient?.name}, to sign this document we need to verify your identity via email OTP.
              </p>
            </div>

            {!otpSent ? (
              <Button className="w-full" onClick={sendOtp} disabled={otpSending}>
                {otpSending ? 'Sending...' : `Send OTP to ${data?.recipient?.email}`}
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Enter 6-digit OTP</Label>
                  <Input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button className="w-full" onClick={verifyOtp} disabled={verifying}>
                  {verifying ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={sendOtp} disabled={otpSending}>
                  Resend OTP
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'sign' && (
          <div className="space-y-6">
            {/* PDF Preview */}
            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="p-2 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                Document Preview
              </div>
              {pdfUrl && (
                <iframe src={pdfUrl} className="w-full" style={{ height: '60vh' }} title="Document" />
              )}
            </div>

            {/* Signature Pad */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <PenTool className="h-4 w-4" /> Your Signature
              </h3>

              <Tabs value={signatureTab} onValueChange={setSignatureTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="draw" className="flex-1"><PenTool className="h-3 w-3 mr-1" /> Draw</TabsTrigger>
                  <TabsTrigger value="type" className="flex-1"><Type className="h-3 w-3 mr-1" /> Type</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1"><Upload className="h-3 w-3 mr-1" /> Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="draw">
                  <div className="border rounded-lg bg-white relative">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={200}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                    <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={clearCanvas}>
                      Clear
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="type">
                  <div className="space-y-2">
                    <Input
                      value={typedName}
                      onChange={e => setTypedName(e.target.value)}
                      placeholder="Type your full name"
                    />
                    {typedName && (
                      <div className="border rounded-lg p-6 bg-white text-center">
                        <p className="text-4xl font-serif italic text-foreground">{typedName}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="upload">
                  <div>
                    <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload signature image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadSig} />
                    </label>
                    {uploadedSig && (
                      <div className="mt-3 border rounded-lg p-4 bg-white text-center">
                        <img src={uploadedSig} alt="Uploaded signature" className="max-h-24 mx-auto" />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Consent */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={v => setConsent(v === true)}
              />
              <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                I agree that my electronic signature is the legal equivalent of my manual/handwritten signature.
                I consent to be legally bound by this document. I understand this signature is valid under the
                Information Technology Act, 2000 (India) and applicable electronic signature laws.
              </label>
            </div>

            <Button className="w-full py-6 text-lg" onClick={handleFinishSigning} disabled={signing || !consent}>
              {signing ? 'Signing...' : '✍️ Finish Signing'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
