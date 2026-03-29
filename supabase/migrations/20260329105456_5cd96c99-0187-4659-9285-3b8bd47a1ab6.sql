
-- Add new email categories
INSERT INTO email_categories (name, key, sort_order) VALUES
  ('YouTube CMS', 'youtube_cms', 10),
  ('Video Distribution', 'video_distribution', 11),
  ('E-Signatures', 'signatures', 12)
ON CONFLICT DO NOTHING;

-- YouTube CMS email templates
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('cms_link_approved', 'CMS Link Approved/Linked', 'youtube_cms', 'Your YouTube CMS Channel Has Been Linked', '<p>Hello {{user_name}},</p><p>Your YouTube channel <strong>{{channel_name}}</strong> has been successfully linked to our CMS system.</p><p><strong>CMS Company:</strong> {{cms_company}}<br/><strong>Linked Date:</strong> {{linked_date}}<br/><strong>Revenue Cut:</strong> {{cut_percent}}%</p><p>You can now view your CMS reports in your dashboard.</p>', true, ARRAY['user_name', 'channel_name', 'cms_company', 'linked_date', 'cut_percent']),
  
  ('cms_link_rejected', 'CMS Link Rejected', 'youtube_cms', 'Your YouTube CMS Link Request Was Rejected', '<p>Hello {{user_name}},</p><p>Unfortunately, your CMS link request for channel <strong>{{channel_name}}</strong> has been rejected.</p><p><strong>Reason:</strong> {{rejection_reason}}</p><p>Please review the feedback and feel free to submit a new request.</p>', true, ARRAY['user_name', 'channel_name', 'rejection_reason']),
  
  ('cms_link_submitted', 'CMS Link Request Submitted', 'youtube_cms', 'CMS Link Request Received', '<p>Hello {{user_name}},</p><p>Your CMS link request for channel <strong>{{channel_name}}</strong> has been received and is under review.</p><p>We will notify you once the review is complete.</p>', true, ARRAY['user_name', 'channel_name']),
  
  ('cms_report_imported', 'CMS Report Imported', 'youtube_cms', 'New CMS Report Available', '<p>Hello {{user_name}},</p><p>A new CMS report for <strong>{{reporting_month}}</strong> is now available for your channel <strong>{{channel_name}}</strong>.</p><p>Login to your dashboard to view the details.</p>', true, ARRAY['user_name', 'channel_name', 'reporting_month']),
  
  ('cms_withdrawal_requested', 'CMS Withdrawal Request Submitted', 'youtube_cms', 'CMS Withdrawal Request Received', '<p>Hello {{user_name}},</p><p>Your CMS withdrawal request for <strong>{{currency}}{{amount}}</strong> has been submitted and is being processed.</p>', true, ARRAY['user_name', 'amount', 'currency']),
  
  ('cms_withdrawal_approved', 'CMS Withdrawal Approved', 'youtube_cms', 'CMS Withdrawal Approved', '<p>Hello {{user_name}},</p><p>Your CMS withdrawal request for <strong>{{currency}}{{amount}}</strong> has been approved and will be processed shortly.</p>', true, ARRAY['user_name', 'amount', 'currency']),
  
  ('cms_withdrawal_paid', 'CMS Withdrawal Paid', 'youtube_cms', 'CMS Withdrawal Payment Completed', '<p>Hello {{user_name}},</p><p>Your CMS withdrawal of <strong>{{currency}}{{amount}}</strong> has been paid to your registered bank account.</p>', true, ARRAY['user_name', 'amount', 'currency']),
  
  ('cms_withdrawal_rejected', 'CMS Withdrawal Rejected', 'youtube_cms', 'CMS Withdrawal Request Rejected', '<p>Hello {{user_name}},</p><p>Your CMS withdrawal request for <strong>{{currency}}{{amount}}</strong> has been rejected.</p><p><strong>Reason:</strong> {{rejection_reason}}</p>', true, ARRAY['user_name', 'amount', 'currency', 'rejection_reason']),
  
  ('cms_threshold_reached', 'CMS Payout Threshold Reached', 'youtube_cms', 'CMS Payout Threshold Reached!', '<p>Hello {{user_name}},</p><p>Your CMS balance has reached the withdrawal threshold of <strong>{{currency}}{{threshold}}</strong>. Your current balance is <strong>{{currency}}{{balance}}</strong>.</p><p>You can now submit a withdrawal request from your dashboard.</p>', true, ARRAY['user_name', 'threshold', 'balance', 'currency']),
  
  ('admin_cms_withdrawal_notification', 'Admin: New CMS Withdrawal Request', 'youtube_cms', 'New CMS Withdrawal Request', '<p>A new CMS withdrawal request has been submitted.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Amount:</strong> {{currency}}{{amount}}<br/><strong>Channel:</strong> {{channel_name}}</p>', true, ARRAY['user_name', 'user_email', 'amount', 'currency', 'channel_name']);

-- Video Distribution / Vevo email templates
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('video_submission_approved', 'Video Submission Approved', 'video_distribution', 'Your Video Submission Has Been Approved', '<p>Hello {{user_name}},</p><p>Your video submission <strong>{{submission_type}}</strong> has been approved and is being processed.</p>', true, ARRAY['user_name', 'submission_type']),
  
  ('video_submission_rejected', 'Video Submission Rejected', 'video_distribution', 'Your Video Submission Has Been Rejected', '<p>Hello {{user_name}},</p><p>Your video submission <strong>{{submission_type}}</strong> has been rejected.</p><p><strong>Reason:</strong> {{rejection_reason}}</p>', true, ARRAY['user_name', 'submission_type', 'rejection_reason']),
  
  ('video_submission_submitted', 'Video Submission Submitted', 'video_distribution', 'Video Submission Received', '<p>Hello {{user_name}},</p><p>Your video submission for <strong>{{submission_type}}</strong> has been received and is under review.</p>', true, ARRAY['user_name', 'submission_type']),
  
  ('vevo_channel_approved', 'Vevo Channel Approved', 'video_distribution', 'Your Vevo Channel Has Been Approved', '<p>Hello {{user_name}},</p><p>Your Vevo channel request has been approved. Your channel is now active.</p>', true, ARRAY['user_name']),
  
  ('vevo_channel_rejected', 'Vevo Channel Rejected', 'video_distribution', 'Your Vevo Channel Request Was Rejected', '<p>Hello {{user_name}},</p><p>Your Vevo channel request has been rejected.</p><p><strong>Reason:</strong> {{rejection_reason}}</p>', true, ARRAY['user_name', 'rejection_reason']),
  
  ('vevo_report_uploaded', 'Vevo Report Uploaded', 'video_distribution', 'New Vevo Report Available', '<p>Hello {{user_name}},</p><p>A new Vevo report for <strong>{{reporting_month}}</strong> is now available in your dashboard.</p>', true, ARRAY['user_name', 'reporting_month']);

-- E-Signature email templates
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('signature_document_sent', 'Document Sent for Signing', 'signatures', 'Document Sent for Signing: {{document_title}}', '<p>Hello {{user_name}},</p><p>A document <strong>{{document_title}}</strong> has been sent for signing to the following recipients:</p><p>{{recipient_list}}</p>', true, ARRAY['user_name', 'document_title', 'recipient_list']),
  
  ('signature_completed', 'All Signatures Completed', 'signatures', 'Document Completed: {{document_title}}', '<p>Hello {{user_name}},</p><p>All recipients have signed the document <strong>{{document_title}}</strong>.</p><p>The signed PDF and certificate of completion are available for download.</p>', true, ARRAY['user_name', 'document_title']),
  
  ('signature_recipient_signed', 'Recipient Signed', 'signatures', 'Recipient Signed: {{document_title}}', '<p>Hello {{user_name}},</p><p><strong>{{signer_name}}</strong> ({{signer_email}}) has signed the document <strong>{{document_title}}</strong>.</p>', true, ARRAY['user_name', 'document_title', 'signer_name', 'signer_email']);
