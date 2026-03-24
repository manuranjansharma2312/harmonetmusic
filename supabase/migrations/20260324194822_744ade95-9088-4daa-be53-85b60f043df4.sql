-- Add demo bank details for user #1
INSERT INTO public.bank_details (user_id, payment_method, account_holder_name, bank_name, account_number, ifsc_code, branch_name, is_locked)
SELECT 'fcfcf133-42a6-492c-a623-d59c1705f5b8', 'bank_transfer', 'Manuranjan Sharma', 'State Bank of India', '32145678901234', 'SBIN0001234', 'Golaghat Branch', true
WHERE NOT EXISTS (SELECT 1 FROM public.bank_details WHERE user_id = 'fcfcf133-42a6-492c-a623-d59c1705f5b8');

-- Add demo bank details for user #2 (Wise/International)
INSERT INTO public.bank_details (user_id, payment_method, account_holder_name, bank_name, account_number, swift_bic, bank_address, country, is_locked)
SELECT '8c9cf06d-05cf-4e2f-be90-592ec33673dd', 'wise', 'Demo User Two', 'HSBC Bank', 'GB29NWBK60161331926819', 'HBUKGB4B', '1 Canada Square, London', 'United Kingdom', true
WHERE NOT EXISTS (SELECT 1 FROM public.bank_details WHERE user_id = '8c9cf06d-05cf-4e2f-be90-592ec33673dd');