
-- Update first user to be a record_label type for testing
UPDATE profiles SET user_type = 'record_label', record_label_name = 'Sharma Music Records' WHERE user_id = 'fcfcf133-42a6-492c-a623-d59c1705f5b8';

-- Insert demo sub_labels entries (without actual auth users, just for display testing)
INSERT INTO sub_labels (parent_user_id, sub_user_id, parent_label_name, sub_label_name, agreement_start_date, agreement_end_date, email, phone, percentage_cut, status)
VALUES 
  ('fcfcf133-42a6-492c-a623-d59c1705f5b8', NULL, 'Sharma Music Records', 'Beats Factory', '2026-01-01', '2027-01-01', 'beatsfactory@demo.com', '9876543210', 15, 'pending'),
  ('fcfcf133-42a6-492c-a623-d59c1705f5b8', NULL, 'Sharma Music Records', 'Melody House', '2026-03-01', '2027-03-01', 'melodyhouse@demo.com', '9876543211', 10, 'active'),
  ('fcfcf133-42a6-492c-a623-d59c1705f5b8', NULL, 'Sharma Music Records', 'Rhythm Studios', '2026-02-01', '2026-12-31', 'rhythmstudios@demo.com', '9876543212', 20, 'rejected');

-- Set rejection reason for the rejected one
UPDATE sub_labels SET rejection_reason = 'Incomplete documentation provided' WHERE sub_label_name = 'Rhythm Studios';
