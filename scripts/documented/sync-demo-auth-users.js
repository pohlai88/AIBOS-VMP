/**
 * Sync Demo Users to Supabase Auth
 *
 * Creates auth.users entries for demo nexus_users and links them via auth_user_id.
 * Password: Demo123! for all demo users
 *
 * Usage: node scripts/sync-demo-auth-users.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Demo password for all users
const DEMO_PASSWORD = 'Demo123!';

// Demo users to create
const DEMO_USERS = [
  {
    user_id: 'USR-ALIC0001',
    email: 'alice@alpha.com',
    name: 'Alice Anderson',
    tenant_id: 'TNT-ALPH0001',
    role: 'owner',
  },
  {
    user_id: 'USR-ALEX0001',
    email: 'alex@alpha.com',
    name: 'Alex Adams',
    tenant_id: 'TNT-ALPH0001',
    role: 'member',
  },
  {
    user_id: 'USR-BOBB0001',
    email: 'bob@beta.com',
    name: 'Bob Baker',
    tenant_id: 'TNT-BETA0001',
    role: 'owner',
  },
  {
    user_id: 'USR-BELL0001',
    email: 'bella@beta.com',
    name: 'Bella Brown',
    tenant_id: 'TNT-BETA0001',
    role: 'admin',
  },
  {
    user_id: 'USR-GRAC0001',
    email: 'grace@gamma.com',
    name: 'Grace Garcia',
    tenant_id: 'TNT-GAMM0001',
    role: 'owner',
  },
  {
    user_id: 'USR-GARY0001',
    email: 'gary@gamma.com',
    name: 'Gary Green',
    tenant_id: 'TNT-GAMM0001',
    role: 'member',
  },
  {
    user_id: 'USR-DANN0001',
    email: 'dan@delta.com',
    name: 'Dan Davis',
    tenant_id: 'TNT-DELT0001',
    role: 'owner',
  },
  {
    user_id: 'USR-DIAN0001',
    email: 'diana@delta.com',
    name: 'Diana Drake',
    tenant_id: 'TNT-DELT0001',
    role: 'admin',
  },
];

async function syncDemoAuthUsers() {
  console.log('🚀 Starting demo auth user sync...\n');

  const results = {
    created: [],
    linked: [],
    errors: [],
  };

  for (const user of DEMO_USERS) {
    try {
      console.log(`Processing ${user.email}...`);

      // Check if auth user already exists
      const { data: existingUsers } = await supabase
        .from('nexus_users')
        .select('auth_user_id')
        .eq('user_id', user.user_id)
        .single();

      if (existingUsers?.auth_user_id) {
        console.log(`  ⏭️  Already linked to auth.users`);
        results.linked.push(user.email);
        continue;
      }

      // Check if email already exists in auth.users
      const { data: authData } = await supabase.auth.admin.listUsers();
      const existingAuthUser = authData?.users?.find(u => u.email === user.email);

      let authUserId;

      if (existingAuthUser) {
        console.log(`  📧 Auth user already exists, linking...`);
        authUserId = existingAuthUser.id;
      } else {
        // Create new auth user
        const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: {
            display_name: user.name,
            tenant_id: user.tenant_id,
            nexus_user_id: user.user_id,
            role: user.role,
            data_source: 'demo',
          },
        });

        if (createError) {
          console.error(`  ❌ Failed to create auth user: ${createError.message}`);
          results.errors.push({ email: user.email, error: createError.message });
          continue;
        }

        authUserId = newAuthUser.user.id;
        console.log(`  ✅ Created auth user: ${authUserId}`);
        results.created.push(user.email);
      }

      // Link auth user to nexus_user
      const { error: updateError } = await supabase
        .from('nexus_users')
        .update({ auth_user_id: authUserId })
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error(`  ❌ Failed to link: ${updateError.message}`);
        results.errors.push({ email: user.email, error: updateError.message });
      } else {
        console.log(`  🔗 Linked to nexus_user`);
        results.linked.push(user.email);
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      results.errors.push({ email: user.email, error: err.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Created: ${results.created.length}`);
  console.log(`🔗 Linked:  ${results.linked.length}`);
  console.log(`❌ Errors:  ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(e => console.log(`   - ${e.email}: ${e.error}`));
  }

  // Verify final state
  console.log('\n📋 Verification:');
  const { data: verifyData } = await supabase
    .from('nexus_users')
    .select('user_id, email, auth_user_id')
    .eq('data_source', 'demo');

  console.log('\n| Email | Nexus User ID | Auth User ID |');
  console.log('|-------|---------------|--------------|');
  verifyData?.forEach(u => {
    const linked = u.auth_user_id
      ? '✅ ' + u.auth_user_id.substring(0, 8) + '...'
      : '❌ Not linked';
    console.log(`| ${u.email} | ${u.user_id} | ${linked} |`);
  });

  console.log('\n✨ Sync complete!');
  console.log('📝 Demo password for all users: Demo123!');
}

syncDemoAuthUsers().catch(console.error);
