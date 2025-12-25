-- Create remaining 7 auth users
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  email,
  crypt('Demo123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
FROM (VALUES
  ('adam@alpha.com'),
  ('bob@beta.com'),
  ('beth@beta.com'),
  ('greg@gamma.com'),
  ('gina@gamma.com'),
  ('dan@delta.com'),
  ('diana@delta.com')
) AS emails(email);

-- Link all auth_user_id
UPDATE nexus_users nu
SET auth_user_id = au.id
FROM auth.users au
WHERE nu.email = au.email
  AND nu.auth_user_id IS NULL;

-- Verify
SELECT u.user_id, u.email, u.auth_user_id IS NOT NULL as linked
FROM nexus_users u
ORDER BY u.user_id;
