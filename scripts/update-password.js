import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const email = 'jackwee2020@gmail.com';
const password = 'admin123';

(async () => {
  try {
    console.log(`Setting password for ${email}...`);
    
    // Find user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.log('User not found, creating...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          vendor_id: '20000000-0000-0000-0000-000000000001',
          user_tier: 'institutional',
          is_internal: true,
          is_active: true,
        },
      });
      if (createError) throw createError;
      console.log('✅ User created with password:', password);
    } else {
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: password,
      });
      if (updateError) throw updateError;
      console.log('✅ Password updated to:', password);
    }
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

