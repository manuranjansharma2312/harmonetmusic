CREATE OR REPLACE FUNCTION public.submit_signature(_token text, _signature_data text, _signature_type text, _ip text, _user_agent text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rec record;
  _all_signed boolean;
  _auto_send boolean;
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
  SELECT NOT EXISTS (
    SELECT 1 FROM signature_recipients
    WHERE document_id = _rec.document_id AND status != 'signed'
  ) INTO _all_signed;

  IF _all_signed THEN
    UPDATE signature_documents SET status = 'completed', updated_at = now()
    WHERE id = _rec.document_id;

    -- Trigger auto-complete via net.http_post if available
    -- The edge function will check if auto_send is enabled
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-complete-signature',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('document_id', _rec.document_id)
    );
  END IF;
  
  RETURN true;
END;
$function$;