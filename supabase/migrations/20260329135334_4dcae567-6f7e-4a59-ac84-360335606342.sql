INSERT INTO public.email_templates (trigger_key, trigger_label, category, subject, body_html, is_enabled, variables)
VALUES
-- Authentication: Admin changed email
('admin_email_changed', 'Admin: Email Changed by Admin', 'authentication', 'Your email address has been changed', '<p>Hello {{user_name}},</p><p>Your account email has been changed to <strong>{{new_email}}</strong> by an administrator.</p><p>If you did not request this change, please contact support immediately.</p>', true, ARRAY['user_name', 'new_email', 'old_email']),

-- Authentication: Password changed by admin
('password_changed_notification', 'Password Changed Notification', 'authentication', 'Your password has been changed', '<p>Hello {{user_name}},</p><p>Your account password has been changed. If you did not make this change, please contact support immediately.</p>', true, ARRAY['user_name']),

-- Releases: Admin notification for resubmission
('admin_release_resubmitted_notification', 'Admin: Release Resubmitted', 'releases', 'Release Resubmitted: {{release_name}}', '<p>A release has been resubmitted for review.</p><p><strong>Release:</strong> {{release_name}}</p><p><strong>User ID:</strong> #{{user_display_id}}</p>', true, ARRAY['release_name', 'user_display_id', 'user_name']),

-- Video Distribution: Admin notification for Vevo channel request
('admin_vevo_channel_notification', 'Admin: New Vevo Channel Request', 'video_distribution', 'New Vevo Channel Request from #{{user_display_id}}', '<p>A new Vevo channel request has been submitted.</p><p><strong>User:</strong> {{user_name}} (#{{user_display_id}})</p>', true, ARRAY['user_name', 'user_display_id']),

-- Revenue: OTT report uploaded
('ott_report_uploaded', 'OTT Report Uploaded', 'revenue', 'New OTT Report Available', '<p>Hello {{user_name}},</p><p>A new OTT report for <strong>{{reporting_month}}</strong> has been uploaded and is now available in your dashboard.</p>', true, ARRAY['user_name', 'reporting_month']),

-- Revenue: CMS report available notification
('cms_report_available', 'CMS Report Available', 'revenue', 'New CMS Report Available', '<p>Hello {{user_name}},</p><p>A new CMS report for <strong>{{reporting_month}}</strong> is now available in your CMS Reports section.</p>', true, ARRAY['user_name', 'reporting_month']),

-- Smart Links: Smart link live
('smart_link_live', 'Smart Link is Live', 'smart_links', 'Your Smart Link is Live!', '<p>Hello {{user_name}},</p><p>Your smart link <strong>{{link_title}}</strong> has been approved and is now live!</p><p><strong>URL:</strong> {{smart_link_url}}</p>', true, ARRAY['user_name', 'link_title', 'smart_link_url']),

-- General: AI plan submitted
('ai_plan_submitted', 'AI Plan Order Submitted', 'general', 'AI Plan Order Received', '<p>Hello {{user_name}},</p><p>Your order for the <strong>{{plan_name}}</strong> AI plan has been received. We will review your payment and activate your credits shortly.</p>', true, ARRAY['user_name', 'plan_name', 'transaction_id']),

-- General: Admin AI plan notification
('admin_ai_plan_notification', 'Admin: New AI Plan Order', 'general', 'New AI Plan Order from #{{user_display_id}}', '<p>A new AI plan order has been submitted.</p><p><strong>User:</strong> {{user_name}} (#{{user_display_id}})</p><p><strong>Plan:</strong> {{plan_name}}</p><p><strong>Transaction ID:</strong> {{transaction_id}}</p>', true, ARRAY['user_name', 'user_display_id', 'plan_name', 'transaction_id'])

ON CONFLICT (trigger_key) DO NOTHING;