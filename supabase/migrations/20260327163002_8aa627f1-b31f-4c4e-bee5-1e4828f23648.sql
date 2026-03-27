
-- Tighten anon policies to use token-based access via RPC instead
DROP POLICY "Anon can view by token" ON public.signature_recipients;
DROP POLICY "Anon can update by token" ON public.signature_recipients;
DROP POLICY "Anon can view signature_fields" ON public.signature_fields;
DROP POLICY "Anon can update signature_fields" ON public.signature_fields;
DROP POLICY "Anon can insert audit logs" ON public.signature_audit_logs;
DROP POLICY "Anon can manage otp_logs" ON public.signature_otp_logs;

-- Create security definer functions for anon access via token
CREATE OR REPLACE FUNCTION public.get_signing_data(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  rec record;
BEGIN
  SELECT r.*, d.title as doc_title, d.document_url, d.document_hash, d.status as doc_status
  INTO rec
  FROM signature_recipients r
  JOIN signature_documents d ON d.id = r.document_id
  WHERE r.signing_token = _token
    AND r.token_expires_at > now()
    AND r.status != 'signed';
  
  IF NOT FOUND THEN RETURN NULL; END IF;
  
  SELECT jsonb_build_object(
    'recipient', jsonb_build_object(
      'id', rec.id, 'name', rec.name, 'email', rec.email,
      'status', rec.status, 'otp_verified', rec.otp_verified
    ),
    'document', jsonb_build_object(
      'id', rec.document_id, 'title', rec.doc_title,
      'document_url', rec.document_url, 'document_hash', rec.document_hash,
      'status', rec.doc_status
    ),
    'fields', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', f.id, 'page_number', f.page_number,
        'x_position', f.x_position, 'y_position', f.y_position,
        'width', f.width, 'height', f.height, 'signed', f.signed
      )), '[]'::jsonb)
      FROM signature_fields f
      WHERE f.recipient_id = rec.id AND f.document_id = rec.document_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to log audit events from anon
CREATE OR REPLACE FUNCTION public.log_signature_audit(
  _token text, _action text, _ip text, _user_agent text, _metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc_id uuid;
  _rec_id uuid;
BEGIN
  SELECT document_id, id INTO _doc_id, _rec_id
  FROM signature_recipients
  WHERE signing_token = _token AND token_expires_at > now();
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;
  
  INSERT INTO signature_audit_logs (document_id, recipient_id, action, ip_address, user_agent, metadata)
  VALUES (_doc_id, _rec_id, _action, _ip, _user_agent, _metadata);
END;
$$;

-- Function to send OTP
CREATE OR REPLACE FUNCTION public.request_signing_otp(_token text, _ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec_id uuid;
  _otp text;
  recent_count integer;
BEGIN
  SELECT id INTO _rec_id FROM signature_recipients
  WHERE signing_token = _token AND token_expires_at > now() AND status != 'signed';
  
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Rate limit: max 5 OTPs per hour
  SELECT count(*) INTO recent_count FROM signature_otp_logs
  WHERE recipient_id = _rec_id AND created_at > now() - interval '1 hour';
  IF recent_count >= 5 THEN RETURN false; END IF;
  
  -- Generate 6-digit OTP
  _otp := lpad(floor(random() * 1000000)::text, 6, '0');
  
  INSERT INTO signature_otp_logs (recipient_id, otp_code, expires_at, ip_address)
  VALUES (_rec_id, _otp, now() + interval '10 minutes', _ip);
  
  RETURN true;
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_signing_otp(_token text, _otp text, _ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec_id uuid;
  _valid boolean;
BEGIN
  SELECT id INTO _rec_id FROM signature_recipients
  WHERE signing_token = _token AND token_expires_at > now();
  
  IF NOT FOUND THEN RETURN false; END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM signature_otp_logs
    WHERE recipient_id = _rec_id AND otp_code = _otp
      AND expires_at > now() AND verified = false
  ) INTO _valid;
  
  IF _valid THEN
    UPDATE signature_otp_logs SET verified = true
    WHERE recipient_id = _rec_id AND otp_code = _otp AND verified = false;
    
    UPDATE signature_recipients SET otp_verified = true
    WHERE id = _rec_id;
    
    INSERT INTO signature_audit_logs (document_id, recipient_id, action, ip_address, metadata)
    SELECT document_id, _rec_id, 'otp_verified', _ip, '{}'::jsonb
    FROM signature_recipients WHERE id = _rec_id;
  END IF;
  
  RETURN _valid;
END;
$$;

-- Function to submit signature
CREATE OR REPLACE FUNCTION public.submit_signature(
  _token text, _signature_data text, _signature_type text,
  _ip text, _user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
BEGIN
  SELECT * INTO _rec FROM signature_recipients
  WHERE signing_token = _token AND token_expires_at > now()
    AND status != 'signed' AND otp_verified = true;
  
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Update recipient
  UPDATE signature_recipients SET
    status = 'signed', signed_at = now(),
    signature_data = _signature_data, signature_type = _signature_type,
    ip_address = _ip, user_agent = _user_agent
  WHERE id = _rec.id;
  
  -- Mark fields as signed
  UPDATE signature_fields SET signed = true, signature_image_url = _signature_data
  WHERE recipient_id = _rec.id;
  
  -- Log audit
  INSERT INTO signature_audit_logs (document_id, recipient_id, action, ip_address, user_agent, metadata)
  VALUES (_rec.document_id, _rec.id, 'document_signed', _ip, _user_agent, 
    jsonb_build_object('signature_type', _signature_type));
  
  -- Check if all recipients signed
  IF NOT EXISTS (
    SELECT 1 FROM signature_recipients
    WHERE document_id = _rec.document_id AND status != 'signed'
  ) THEN
    UPDATE signature_documents SET status = 'completed', updated_at = now()
    WHERE id = _rec.document_id;
  END IF;
  
  RETURN true;
END;
$$;
