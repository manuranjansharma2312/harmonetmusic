
-- Drop the old submit_signature function (without _geolocation param) that still checks otp_verified
DROP FUNCTION IF EXISTS public.submit_signature(text, text, text, text, text);
