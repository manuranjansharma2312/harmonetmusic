
-- Delete demo documents with fake storage paths that don't exist
DELETE FROM signature_audit_logs WHERE document_id IN (
  SELECT id FROM signature_documents WHERE document_url LIKE 'documents/%' OR document_url LIKE 'demo/%'
);
DELETE FROM signature_otp_logs WHERE recipient_id IN (
  SELECT id FROM signature_recipients WHERE document_id IN (
    SELECT id FROM signature_documents WHERE document_url LIKE 'documents/%' OR document_url LIKE 'demo/%'
  )
);
DELETE FROM signature_fields WHERE document_id IN (
  SELECT id FROM signature_documents WHERE document_url LIKE 'documents/%' OR document_url LIKE 'demo/%'
);
DELETE FROM signature_recipients WHERE document_id IN (
  SELECT id FROM signature_documents WHERE document_url LIKE 'documents/%' OR document_url LIKE 'demo/%'
);
DELETE FROM signature_documents WHERE document_url LIKE 'documents/%' OR document_url LIKE 'demo/%';
