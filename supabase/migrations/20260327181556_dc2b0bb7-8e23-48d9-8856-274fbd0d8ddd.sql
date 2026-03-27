
-- Create demo document
INSERT INTO signature_documents (id, title, description, document_url, document_hash, created_by, status, created_at)
VALUES (
  'f0a1b2c3-d4e5-4f67-8901-abcdef123456',
  'Phoebus B2B Agreement',
  'Business-to-business partnership agreement for testing',
  'phoebus-b2b-agreement.pdf',
  '63559740cbe65f8298c1507701ab6bd8cecc77cbee74374809bec3100af9c9f6',
  'b155d618-790c-44aa-8771-bd478ab08bb5',
  'completed',
  now()
);

-- Create two signed recipients
INSERT INTO signature_recipients (id, document_id, name, email, signing_order, signing_token, token_expires_at, status, signed_at, otp_verified, signature_data, signature_type, ip_address, user_agent)
VALUES 
(
  'a1a1a1a1-1111-4000-a000-000000000001',
  'f0a1b2c3-d4e5-4f67-8901-abcdef123456',
  'Rahul Sharma',
  'rahul@example.com',
  1,
  'tok-' || gen_random_uuid(),
  '2099-12-31T23:59:59Z',
  'signed',
  now() - interval '2 hours',
  true,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'draw',
  '103.45.67.89',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'
),
(
  'b2b2b2b2-2222-4000-b000-000000000002',
  'f0a1b2c3-d4e5-4f67-8901-abcdef123456',
  'Priya Patel',
  'priya@example.com',
  2,
  'tok-' || gen_random_uuid(),
  '2099-12-31T23:59:59Z',
  'signed',
  now() - interval '1 hour',
  true,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'type',
  '182.73.22.101',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36'
);

-- Create signature fields
INSERT INTO signature_fields (document_id, recipient_id, page_number, x_position, y_position, width, height, signed, signature_image_url)
VALUES 
(
  'f0a1b2c3-d4e5-4f67-8901-abcdef123456',
  'a1a1a1a1-1111-4000-a000-000000000001',
  1, 350, 600, 200, 80, true,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
),
(
  'f0a1b2c3-d4e5-4f67-8901-abcdef123456',
  'b2b2b2b2-2222-4000-b000-000000000002',
  1, 350, 700, 200, 80, true,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);

-- Create audit trail
INSERT INTO signature_audit_logs (document_id, recipient_id, action, ip_address, user_agent, created_at)
VALUES
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', NULL, 'document_sent', '127.0.0.1', 'Admin', now() - interval '4 hours'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'a1a1a1a1-1111-4000-a000-000000000001', 'document_viewed', '103.45.67.89', 'Chrome/120.0', now() - interval '3 hours'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'a1a1a1a1-1111-4000-a000-000000000001', 'otp_verified', '103.45.67.89', 'Chrome/120.0', now() - interval '2 hours 30 minutes'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'a1a1a1a1-1111-4000-a000-000000000001', 'document_signed', '103.45.67.89', 'Chrome/120.0', now() - interval '2 hours'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'b2b2b2b2-2222-4000-b000-000000000002', 'document_viewed', '182.73.22.101', 'Safari/537.36', now() - interval '90 minutes'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'b2b2b2b2-2222-4000-b000-000000000002', 'otp_verified', '182.73.22.101', 'Safari/537.36', now() - interval '75 minutes'),
  ('f0a1b2c3-d4e5-4f67-8901-abcdef123456', 'b2b2b2b2-2222-4000-b000-000000000002', 'document_signed', '182.73.22.101', 'Safari/537.36', now() - interval '1 hour');
