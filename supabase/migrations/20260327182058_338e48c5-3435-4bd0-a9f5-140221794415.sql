
CREATE OR REPLACE FUNCTION public.submit_signature(_token text, _signature_data text, _signature_type text, _ip text, _user_agent text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rec record;
  _all_signed boolean;
  _supabase_url text;
  _service_key text;
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

    -- Read Supabase URL and service key from vault or env
    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
    
    -- Fallback to app settings if vault not available
    IF _supabase_url IS NULL THEN
      _supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;
    IF _service_key IS NULL THEN
      _service_key := current_setting('app.settings.service_role_key', true);
    END IF;

    -- Trigger auto-complete if we have the URL
    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/auto-complete-signature',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object('document_id', _rec.document_id)
      );
    END IF;
  END IF;
  
  RETURN true;
END;
$function$;
