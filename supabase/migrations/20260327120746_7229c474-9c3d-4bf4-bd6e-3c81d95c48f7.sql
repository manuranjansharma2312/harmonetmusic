
-- Email settings table for self-hosted SMTP configuration
CREATE TABLE public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'smtp',
  smtp_host text DEFAULT '',
  smtp_port integer DEFAULT 587,
  smtp_username text DEFAULT '',
  smtp_password text DEFAULT '',
  smtp_encryption text DEFAULT 'tls',
  from_email text DEFAULT '',
  from_name text DEFAULT '',
  reply_to_email text DEFAULT '',
  is_enabled boolean DEFAULT false,
  test_email_sent_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Insert default row
INSERT INTO public.email_settings (id) VALUES (gen_random_uuid());

-- RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_settings"
  ON public.email_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email_settings"
  ON public.email_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL UNIQUE,
  trigger_label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  is_enabled boolean DEFAULT true,
  variables text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email_templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email_templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email_templates"
  ON public.email_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default templates for all triggers
INSERT INTO public.email_templates (trigger_key, trigger_label, category, subject, body_html, variables) VALUES
  -- Authentication
  ('new_registration', 'New User Registration', 'authentication', 'Welcome to {{app_name}}!', '<h2>Welcome, {{user_name}}!</h2><p>Your account has been created successfully. You can now log in and start using our platform.</p><p>If you have any questions, feel free to reach out to our support team.</p>', ARRAY['user_name', 'user_email', 'app_name']),
  ('email_verification', 'Email Verification', 'authentication', 'Verify your email - {{app_name}}', '<h2>Verify Your Email</h2><p>Hi {{user_name}},</p><p>Please click the link below to verify your email address:</p><p><a href="{{verification_link}}">Verify Email</a></p>', ARRAY['user_name', 'user_email', 'verification_link', 'app_name']),
  ('password_reset', 'Password Reset', 'authentication', 'Reset your password - {{app_name}}', '<h2>Password Reset</h2><p>Hi {{user_name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>', ARRAY['user_name', 'user_email', 'reset_link', 'app_name']),
  ('account_suspended', 'Account Suspended', 'authentication', 'Account Suspended - {{app_name}}', '<h2>Account Suspended</h2><p>Hi {{user_name}},</p><p>Your account has been suspended. Reason: {{reason}}</p><p>If you believe this is an error, please contact support.</p>', ARRAY['user_name', 'user_email', 'reason', 'app_name']),
  ('account_reactivated', 'Account Reactivated', 'authentication', 'Account Reactivated - {{app_name}}', '<h2>Account Reactivated</h2><p>Hi {{user_name}},</p><p>Your account has been reactivated. You can now log in and continue using our platform.</p>', ARRAY['user_name', 'user_email', 'app_name']),

  -- Releases
  ('release_submitted', 'Release Submitted', 'releases', 'Release Submitted - {{release_name}}', '<h2>Release Submitted</h2><p>Hi {{user_name}},</p><p>Your release "{{release_name}}" has been submitted and is under review.</p>', ARRAY['user_name', 'release_name', 'app_name']),
  ('release_approved', 'Release Approved', 'releases', 'Release Approved - {{release_name}}', '<h2>Release Approved! 🎉</h2><p>Hi {{user_name}},</p><p>Your release "{{release_name}}" has been approved and will be distributed to stores.</p>', ARRAY['user_name', 'release_name', 'app_name']),
  ('release_rejected', 'Release Rejected', 'releases', 'Release Rejected - {{release_name}}', '<h2>Release Rejected</h2><p>Hi {{user_name}},</p><p>Your release "{{release_name}}" has been rejected.</p><p>Reason: {{rejection_reason}}</p><p>Please make the necessary changes and resubmit.</p>', ARRAY['user_name', 'release_name', 'rejection_reason', 'app_name']),
  ('release_takedown', 'Release Takedown', 'releases', 'Release Taken Down - {{release_name}}', '<h2>Release Taken Down</h2><p>Hi {{user_name}},</p><p>Your release "{{release_name}}" has been taken down.</p><p>Reason: {{reason}}</p>', ARRAY['user_name', 'release_name', 'reason', 'app_name']),
  ('release_live', 'Release Live on Stores', 'releases', 'Your Release is Live! - {{release_name}}', '<h2>Your Release is Live! 🎶</h2><p>Hi {{user_name}},</p><p>Your release "{{release_name}}" is now live on stores.</p>', ARRAY['user_name', 'release_name', 'app_name']),

  -- Revenue & Payouts
  ('payout_threshold_reached', 'Payout Threshold Reached', 'revenue', 'Payout Threshold Reached - {{app_name}}', '<h2>Payout Threshold Reached</h2><p>Hi {{user_name}},</p><p>Your balance of {{amount}} has reached the payout threshold. You can now request a withdrawal.</p>', ARRAY['user_name', 'amount', 'app_name']),
  ('withdrawal_requested', 'Withdrawal Request Submitted', 'revenue', 'Withdrawal Request Submitted - {{app_name}}', '<h2>Withdrawal Request</h2><p>Hi {{user_name}},</p><p>Your withdrawal request for {{amount}} has been submitted and is being processed.</p>', ARRAY['user_name', 'amount', 'app_name']),
  ('withdrawal_approved', 'Withdrawal Approved', 'revenue', 'Withdrawal Approved - {{app_name}}', '<h2>Withdrawal Approved</h2><p>Hi {{user_name}},</p><p>Your withdrawal of {{amount}} has been approved and will be transferred to your bank account.</p>', ARRAY['user_name', 'amount', 'app_name']),
  ('withdrawal_rejected', 'Withdrawal Rejected', 'revenue', 'Withdrawal Rejected - {{app_name}}', '<h2>Withdrawal Rejected</h2><p>Hi {{user_name}},</p><p>Your withdrawal request for {{amount}} has been rejected.</p><p>Reason: {{reason}}</p>', ARRAY['user_name', 'amount', 'reason', 'app_name']),
  ('new_report_uploaded', 'New Report Uploaded', 'revenue', 'New Revenue Report Available - {{app_name}}', '<h2>New Report Available</h2><p>Hi {{user_name}},</p><p>A new revenue report for {{reporting_month}} has been uploaded. Log in to view your earnings.</p>', ARRAY['user_name', 'reporting_month', 'app_name']),

  -- Labels
  ('label_approved', 'Label Approved', 'labels', 'Label Approved - {{label_name}}', '<h2>Label Approved</h2><p>Hi {{user_name}},</p><p>Your label "{{label_name}}" has been approved.</p>', ARRAY['user_name', 'label_name', 'app_name']),
  ('label_rejected', 'Label Rejected', 'labels', 'Label Rejected - {{label_name}}', '<h2>Label Rejected</h2><p>Hi {{user_name}},</p><p>Your label "{{label_name}}" has been rejected.</p><p>Reason: {{rejection_reason}}</p>', ARRAY['user_name', 'label_name', 'rejection_reason', 'app_name']),

  -- Content Requests
  ('content_request_approved', 'Content Request Approved', 'content_requests', 'Content Request Approved - {{app_name}}', '<h2>Request Approved</h2><p>Hi {{user_name}},</p><p>Your {{request_type}} request has been approved.</p>', ARRAY['user_name', 'request_type', 'app_name']),
  ('content_request_rejected', 'Content Request Rejected', 'content_requests', 'Content Request Rejected - {{app_name}}', '<h2>Request Rejected</h2><p>Hi {{user_name}},</p><p>Your {{request_type}} request has been rejected.</p><p>Reason: {{rejection_reason}}</p>', ARRAY['user_name', 'request_type', 'rejection_reason', 'app_name']),

  -- Sub Labels
  ('sub_label_approved', 'Sub Label Approved', 'sub_labels', 'Sub Label Approved - {{sub_label_name}}', '<h2>Sub Label Approved</h2><p>Hi {{user_name}},</p><p>Your sub label "{{sub_label_name}}" has been approved.</p>', ARRAY['user_name', 'sub_label_name', 'app_name']),
  ('sub_label_rejected', 'Sub Label Rejected', 'sub_labels', 'Sub Label Rejected - {{sub_label_name}}', '<h2>Sub Label Rejected</h2><p>Hi {{user_name}},</p><p>Your sub label "{{sub_label_name}}" has been rejected.</p><p>Reason: {{rejection_reason}}</p>', ARRAY['user_name', 'sub_label_name', 'rejection_reason', 'app_name']),

  -- Smart Links
  ('smart_link_approved', 'Smart Link Approved', 'smart_links', 'Smart Link Approved - {{title}}', '<h2>Smart Link Approved</h2><p>Hi {{user_name}},</p><p>Your smart link "{{title}}" has been approved and is now live.</p>', ARRAY['user_name', 'title', 'app_name']),
  ('smart_link_rejected', 'Smart Link Rejected', 'smart_links', 'Smart Link Rejected - {{title}}', '<h2>Smart Link Rejected</h2><p>Hi {{user_name}},</p><p>Your smart link "{{title}}" has been rejected.</p><p>Reason: {{rejection_reason}}</p>', ARRAY['user_name', 'title', 'rejection_reason', 'app_name']),

  -- Promotions
  ('promotion_order_approved', 'Promotion Order Approved', 'promotions', 'Promotion Order Approved - {{app_name}}', '<h2>Order Approved</h2><p>Hi {{user_name}},</p><p>Your promotion order has been approved and will be processed.</p>', ARRAY['user_name', 'product_name', 'app_name']),
  ('promotion_order_rejected', 'Promotion Order Rejected', 'promotions', 'Promotion Order Rejected - {{app_name}}', '<h2>Order Rejected</h2><p>Hi {{user_name}},</p><p>Your promotion order has been rejected.</p><p>Reason: {{rejection_reason}}</p>', ARRAY['user_name', 'product_name', 'rejection_reason', 'app_name']),

  -- General
  ('release_transferred', 'Release Transferred', 'general', 'Release Transferred - {{release_name}}', '<h2>Release Transferred</h2><p>Hi {{user_name}},</p><p>The release "{{release_name}}" has been transferred to your account.</p>', ARRAY['user_name', 'release_name', 'app_name']),
  ('new_notice', 'New Notice Published', 'general', 'New Notice - {{notice_title}}', '<h2>New Notice</h2><p>Hi {{user_name}},</p><p>A new notice has been published: {{notice_title}}</p><p>{{notice_content}}</p>', ARRAY['user_name', 'notice_title', 'notice_content', 'app_name']);
