#!/usr/bin/env node
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString:
    'postgresql://postgres.vrawceruzokxitybkufk:Weepohlai88!@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
});

client
  .connect()
  .then(() => {
    console.log('Connected to Supabase...');
    return client.query("NOTIFY pgrst, 'reload schema';");
  })
  .then(() => {
    console.log('✓ NOTIFY pgrst command executed successfully');
    console.log('✓ PostgREST schema cache refresh triggered');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Error executing NOTIFY:', err.message);
    process.exit(1);
  })
  .finally(() => {
    client.end();
  });
