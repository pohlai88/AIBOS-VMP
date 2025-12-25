import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
});

async function createExecSqlFunction() {
  const sql = readFileSync(
    join(__dirname, '..', 'migrations', '036_create_exec_sql_function.sql'),
    'utf-8'
  );

  console.log('📦 Creating exec_sql function...');

  // Use Supabase REST API to execute DDL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ sql_query: sql }),
  });

  if (!response.ok) {
    // Try using pg_net or direct connection
    // For now, we'll use the Supabase Dashboard approach
    console.log('⚠️  Cannot create function via API (requires direct DB access)');
    console.log('\n📋 Please apply this migration via Supabase Dashboard:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy the SQL from: migrations/036_create_exec_sql_function.sql');
    console.log('   3. Paste and Run');
    console.log('\n   Or use Supabase CLI:');
    console.log('   supabase db execute --file migrations/036_create_exec_sql_function.sql');
    return false;
  }

  const result = await response.json();
  console.log('✅ exec_sql function created');
  return true;
}

createExecSqlFunction().catch(console.error);
