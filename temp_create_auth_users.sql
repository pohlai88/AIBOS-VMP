-- Create auth.users for 8 demo users with Demo123! password
DO $$
DECLARE
  demo_users TEXT[][] := ARRAY[
    ['alice@alpha.com', 'USR-ALICE001'],
    ['adam@alpha.com', 'USR-ADAM0002'],
    ['bob@beta.com', 'USR-BOB00003'],
    ['beth@beta.com', 'USR-BETH0004'],
    ['greg@gamma.com', 'USR-GREG0005'],
    ['gina@gamma.com', 'USR-GINA0006'],
    ['dan@delta.com', 'USR-DAN00007'],
    ['diana@delta.com', 'USR-DIANA008']
  ];
  user_email TEXT;
  nexus_user_id TEXT;
  auth_id UUID;
BEGIN
  FOR i IN 1..array_length(demo_users, 1) LOOP
    user_email := demo_users[i][1];
    nexus_user_id := demo_users[i][2];

    -- Create auth.users entry
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      user_email,
      crypt('Demo123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      ''
    )
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO auth_id;

    -- Link to nexus_users
    UPDATE nexus_users
    SET auth_user_id = auth_id
    WHERE user_id = nexus_user_id;

    RAISE NOTICE 'Created auth.users for % (%) → %', user_email, nexus_user_id, auth_id;
  END LOOP;
END $$;
