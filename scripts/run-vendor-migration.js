import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const sql = readFileSync('./migrations/015_vmp_vendors.sql', 'utf8');

console.log('Running migration: 015_vmp_vendors.sql');

// Split by semicolons and execute each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

for (const statement of statements) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: statement });
    if (error) {
      console.error('Error executing statement:', error.message);
      console.error('Statement:', statement.substring(0, 100));
    } else {
      console.log('✓ Statement executed successfully');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

console.log('Migration complete!');
process.exit(0);
