
-- ============================================
-- MISSING ADMIN NOTIFICATION TEMPLATES
-- ============================================

-- Admin: New CMS Link Request
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('admin_cms_link_notification', 'Admin: New CMS Link Request', 'youtube_cms', 'New YouTube CMS Link Request', '<p>A new CMS link request has been submitted.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Channel:</strong> {{channel_name}}<br/><strong>Channel URL:</strong> {{channel_url}}</p>', true, ARRAY['user_name', 'user_email', 'channel_name', 'channel_url']),

-- Admin: New Label Request
  ('admin_label_notification', 'Admin: New Label Request', 'labels', 'New Label Registration Request', '<p>A new label registration request has been submitted.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Label Name:</strong> {{label_name}}</p>', true, ARRAY['user_name', 'user_email', 'label_name']),

-- Admin: New Smart Link Request
  ('admin_smart_link_notification', 'Admin: New Smart Link Request', 'smart_links', 'New Smart Link Submitted', '<p>A new smart link has been submitted for review.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Title:</strong> {{smart_link_title}}<br/><strong>Artist:</strong> {{artist_name}}</p>', true, ARRAY['user_name', 'user_email', 'smart_link_title', 'artist_name']),

-- Admin: New Content Request
  ('admin_content_request_notification', 'Admin: New Content Request', 'content_requests', 'New Content Request Submitted', '<p>A new content request has been submitted.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Type:</strong> {{request_type}}<br/><strong>Song:</strong> {{song_title}}</p>', true, ARRAY['user_name', 'user_email', 'request_type', 'song_title']),

-- Admin: New Promotion Order
  ('admin_promotion_notification', 'Admin: New Promotion Order', 'promotions', 'New Promotion Order Submitted', '<p>A new promotion order has been submitted.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Product:</strong> {{product_name}}<br/><strong>Amount:</strong> {{currency}}{{amount}}</p>', true, ARRAY['user_name', 'user_email', 'product_name', 'amount', 'currency']),

-- Admin: New Video Submission
  ('admin_video_submission_notification', 'Admin: New Video Submission', 'video_distribution', 'New Video Submission', '<p>A new video has been submitted for review.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Type:</strong> {{submission_type}}</p>', true, ARRAY['user_name', 'user_email', 'submission_type']),

-- Admin: New Release Submitted
  ('admin_release_notification', 'Admin: New Release Submitted', 'releases', 'New Release Submitted for Review', '<p>A new release has been submitted for review.</p><p><strong>User:</strong> {{user_name}} ({{user_email}})<br/><strong>Release:</strong> {{release_name}}<br/><strong>Type:</strong> {{release_type}}</p>', true, ARRAY['user_name', 'user_email', 'release_name', 'release_type']);

-- ============================================
-- MISSING SIGNATURE TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('signature_signing_request', 'Signing Request Email', 'signatures', 'You Have a Document to Sign: {{document_title}}', '<p>Hello {{recipient_name}},</p><p>You have been requested to sign the document <strong>{{document_title}}</strong>.</p><p>Please click the link below to review and sign the document:</p><p><a href="{{signing_url}}">Sign Document</a></p><p>This link will expire on {{expiry_date}}.</p>', true, ARRAY['recipient_name', 'document_title', 'signing_url', 'expiry_date', 'sender_name']),
  
  ('signature_reminder', 'Signing Reminder', 'signatures', 'Reminder: Document Awaiting Your Signature - {{document_title}}', '<p>Hello {{recipient_name}},</p><p>This is a reminder that the document <strong>{{document_title}}</strong> is still awaiting your signature.</p><p><a href="{{signing_url}}">Sign Document Now</a></p><p>This link expires on {{expiry_date}}.</p>', true, ARRAY['recipient_name', 'document_title', 'signing_url', 'expiry_date']),
  
  ('signature_expired', 'Document Expired', 'signatures', 'Document Expired: {{document_title}}', '<p>Hello {{user_name}},</p><p>The document <strong>{{document_title}}</strong> has expired without all signatures being collected.</p><p>You may need to create a new signing request.</p>', true, ARRAY['user_name', 'document_title']),
  
  ('signature_download_ready', 'Signed Document Download Ready', 'signatures', 'Signed Document Ready: {{document_title}}', '<p>Hello {{recipient_name}},</p><p>The document <strong>{{document_title}}</strong> has been fully signed by all parties.</p><p><a href="{{download_url}}">Download Signed PDF</a></p><p>This download link is valid for 7 days.</p>', true, ARRAY['recipient_name', 'document_title', 'download_url']);

-- ============================================
-- MISSING AUTHENTICATION & SECURITY TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('login_new_device', 'Login from New Device', 'authentication', 'New Login Detected on Your Account', '<p>Hello {{user_name}},</p><p>A new login was detected on your account.</p><p><strong>Device:</strong> {{device_info}}<br/><strong>IP Address:</strong> {{ip_address}}<br/><strong>Time:</strong> {{login_time}}</p><p>If this was not you, please change your password immediately.</p>', true, ARRAY['user_name', 'device_info', 'ip_address', 'login_time']),
  
  ('admin_password_reset_by_admin', 'Admin: Password Reset by Admin', 'authentication', 'Your Password Has Been Reset by Admin', '<p>Hello {{user_name}},</p><p>Your account password has been reset by an administrator.</p><p>Your new temporary password is: <strong>{{temp_password}}</strong></p><p>Please login and change your password immediately.</p>', true, ARRAY['user_name', 'temp_password']),
  
  ('account_deleted', 'Account Deletion Notification', 'authentication', 'Your Account Has Been Deleted', '<p>Hello {{user_name}},</p><p>Your account has been deleted from our platform. All associated data has been removed.</p><p>If you believe this was done in error, please contact support immediately.</p>', true, ARRAY['user_name']);

-- ============================================
-- MISSING REVENUE / REPORTS TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('vevo_report_available', 'Vevo Report Available for User', 'revenue', 'New Vevo Report Available', '<p>Hello {{user_name}},</p><p>A new Vevo report for <strong>{{reporting_month}}</strong> is now available in your dashboard.</p><p>Login to view your updated Vevo analytics and revenue.</p>', true, ARRAY['user_name', 'reporting_month']),
  
  ('revenue_frozen', 'Revenue Frozen Notification', 'revenue', 'Revenue Report Finalized', '<p>Hello {{user_name}},</p><p>Your revenue report for <strong>{{reporting_month}}</strong> has been finalized and locked.</p><p>The finalized amount is <strong>{{currency}}{{amount}}</strong>.</p>', true, ARRAY['user_name', 'reporting_month', 'amount', 'currency']);

-- ============================================
-- MISSING GENERAL TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('maintenance_mode_enabled', 'Maintenance Mode Enabled', 'general', 'Platform Maintenance in Progress', '<p>Hello {{user_name}},</p><p>Our platform is currently undergoing scheduled maintenance.</p><p><strong>Message:</strong> {{maintenance_message}}</p><p>We will notify you once maintenance is complete.</p>', true, ARRAY['user_name', 'maintenance_message']),
  
  ('maintenance_mode_disabled', 'Maintenance Mode Disabled', 'general', 'Platform Maintenance Complete', '<p>Hello {{user_name}},</p><p>Our scheduled maintenance has been completed. The platform is now fully operational.</p><p>Thank you for your patience.</p>', true, ARRAY['user_name']),
  
  ('custom_support_reply', 'Support Reply', 'general', 'Support Reply: {{subject}}', '<p>Hello {{user_name}},</p><p>You have received a reply to your support request.</p><p><strong>Subject:</strong> {{subject}}</p><p>{{reply_message}}</p>', true, ARRAY['user_name', 'subject', 'reply_message']),
  
  ('ownership_transferred', 'Release Ownership Transferred', 'general', 'Release Ownership Transfer Notification', '<p>Hello {{user_name}},</p><p>The release <strong>{{release_name}}</strong> has been transferred {{transfer_direction}}.</p><p><strong>From:</strong> {{from_user}}<br/><strong>To:</strong> {{to_user}}</p>', true, ARRAY['user_name', 'release_name', 'transfer_direction', 'from_user', 'to_user']);

-- ============================================
-- MISSING SUB-LABEL TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('sub_label_agreement_renewed', 'Sub Label Agreement Renewed', 'sub_labels', 'Sub Label Agreement Renewed', '<p>Hello {{user_name}},</p><p>The agreement for sub-label <strong>{{sub_label_name}}</strong> has been renewed.</p><p><strong>New End Date:</strong> {{end_date}}</p>', true, ARRAY['user_name', 'sub_label_name', 'end_date']),
  
  ('sub_label_percentage_updated', 'Sub Label Percentage Updated', 'sub_labels', 'Sub Label Revenue Split Updated', '<p>Hello {{user_name}},</p><p>The revenue split for sub-label <strong>{{sub_label_name}}</strong> has been updated.</p><p><strong>New Split:</strong> {{percentage}}%</p>', true, ARRAY['user_name', 'sub_label_name', 'percentage']),
  
  ('admin_sub_label_notification', 'Admin: New Sub Label Request', 'sub_labels', 'New Sub Label Request', '<p>A new sub-label request has been submitted.</p><p><strong>Parent Label:</strong> {{parent_label_name}}<br/><strong>Sub Label:</strong> {{sub_label_name}}<br/><strong>Email:</strong> {{sub_label_email}}</p>', true, ARRAY['parent_label_name', 'sub_label_name', 'sub_label_email']);

-- ============================================
-- MISSING CONTENT REQUEST SPECIFIC TEMPLATES
-- ============================================
INSERT INTO email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables) VALUES
  ('takedown_completed', 'Takedown Completed', 'content_requests', 'Your Takedown Request Has Been Processed', '<p>Hello {{user_name}},</p><p>Your takedown request for <strong>{{song_title}}</strong> has been processed and completed.</p>', true, ARRAY['user_name', 'song_title']),
  
  ('copyright_claim_resolved', 'Copyright Claim Resolved', 'content_requests', 'Copyright Claim Resolved', '<p>Hello {{user_name}},</p><p>Your copyright claim for <strong>{{song_title}}</strong> has been resolved.</p><p><strong>Status:</strong> {{resolution_status}}</p>', true, ARRAY['user_name', 'song_title', 'resolution_status']),
  
  ('oac_request_approved', 'OAC Request Approved', 'content_requests', 'Your Official Artist Channel Request is Approved', '<p>Hello {{user_name}},</p><p>Your Official Artist Channel (OAC) request for <strong>{{artist_name}}</strong> has been approved.</p>', true, ARRAY['user_name', 'artist_name']),
  
  ('oac_request_rejected', 'OAC Request Rejected', 'content_requests', 'Your Official Artist Channel Request Was Rejected', '<p>Hello {{user_name}},</p><p>Your OAC request for <strong>{{artist_name}}</strong> has been rejected.</p><p><strong>Reason:</strong> {{rejection_reason}}</p>', true, ARRAY['user_name', 'artist_name', 'rejection_reason']);
