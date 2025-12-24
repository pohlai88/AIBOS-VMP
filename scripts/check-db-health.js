import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// SQL queries to check for database errors and warnings
const healthChecks = [
  {
    name: 'Foreign Key Violations',
    query: `
            SELECT 
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name LIKE 'vmp_%'
            ORDER BY tc.table_name;
        `,
  },
  {
    name: 'Tables Missing RLS',
    query: `
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'vmp_%'
            AND rowsecurity = false
            ORDER BY tablename;
        `,
  },
  {
    name: 'Tables with RLS but No Policies',
    query: `
            SELECT t.tablename
            FROM pg_tables t
            LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
            WHERE t.schemaname = 'public'
            AND t.tablename LIKE 'vmp_%'
            AND t.rowsecurity = true
            AND p.policyname IS NULL
            ORDER BY t.tablename;
        `,
  },
  {
    name: 'Missing Indexes on Foreign Keys',
    query: `
            SELECT
                tc.table_name,
                kcu.column_name,
                tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            LEFT JOIN pg_indexes pi
                ON pi.tablename = tc.table_name
                AND pi.indexdef LIKE '%' || kcu.column_name || '%'
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name LIKE 'vmp_%'
            AND pi.indexname IS NULL
            ORDER BY tc.table_name, kcu.column_name;
        `,
  },
  {
    name: 'Check Constraint Violations',
    query: `
            SELECT
                tc.table_name,
                tc.constraint_name,
                cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc
                ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name LIKE 'vmp_%'
            ORDER BY tc.table_name, tc.constraint_name;
        `,
  },
  {
    name: 'Orphaned Records (Potential FK Violations)',
    query: `
            SELECT 
                'vmp_cases' as table_name,
                COUNT(*) as orphaned_count
            FROM vmp_cases c
            LEFT JOIN vmp_vendors v ON c.vendor_id = v.id
            WHERE v.id IS NULL
            UNION ALL
            SELECT 
                'vmp_messages' as table_name,
                COUNT(*) as orphaned_count
            FROM vmp_messages m
            LEFT JOIN vmp_cases c ON m.case_id = c.id
            WHERE c.id IS NULL
            UNION ALL
            SELECT 
                'vmp_evidence' as table_name,
                COUNT(*) as orphaned_count
            FROM vmp_evidence e
            LEFT JOIN vmp_cases c ON e.case_id = c.id
            WHERE c.id IS NULL;
        `,
  },
  {
    name: 'Unused Indexes',
    query: `
            SELECT
                schemaname,
                tablename,
                indexname,
                idx_scan as index_scans
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            AND tablename LIKE 'vmp_%'
            AND idx_scan = 0
            AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname;
        `,
  },
  {
    name: 'Tables Missing Primary Keys',
    query: `
            SELECT t.tablename
            FROM pg_tables t
            LEFT JOIN pg_indexes i 
                ON t.tablename = i.tablename 
                AND i.indexdef LIKE '%PRIMARY KEY%'
            WHERE t.schemaname = 'public'
            AND t.tablename LIKE 'vmp_%'
            AND i.indexname IS NULL
            ORDER BY t.tablename;
        `,
  },
  {
    name: 'Functions with Security Issues',
    query: `
            SELECT
                p.proname as function_name,
                pg_get_functiondef(p.oid) as definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND (
                pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
                OR pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%'
            )
            ORDER BY p.proname;
        `,
  },
  {
    name: 'Database Warnings - Large Tables',
    query: `
            SELECT
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'vmp_%'
            AND pg_total_relation_size(schemaname||'.'||tablename) > 100000000
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        `,
  },
];

async function executeRawSQL(query) {
  // Try using RPC function first
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: query,
    });

    if (error) {
      // Try REST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ sql_query: query }),
      });

      if (response.ok) {
        return await response.json();
      }

      throw error;
    }

    return data;
  } catch (err) {
    console.error(`SQL execution error: ${err.message}`);
    return null;
  }
}

async function runHealthCheck(check) {
  try {
    const data = await executeRawSQL(check.query);

    if (data === null) {
      console.log(`\n❌ ${check.name}: Could not execute query`);
      return { name: check.name, error: 'Query execution failed', data: null };
    }

    if (Array.isArray(data) && data.length > 0) {
      console.log(`\n⚠️  ${check.name}: Found ${data.length} issue(s)`);
      if (data.length <= 10) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify(data.slice(0, 10), null, 2));
        console.log(`   ... and ${data.length - 10} more`);
      }
      return { name: check.name, error: null, data, hasIssues: true };
    } else {
      console.log(`\n✅ ${check.name}: No issues found`);
      return { name: check.name, error: null, data: [], hasIssues: false };
    }
  } catch (err) {
    console.log(`\n❌ ${check.name}:`);
    console.log(`   Exception: ${err.message}`);
    return { name: check.name, error: err.message, data: null };
  }
}

async function main() {
  console.log('🔍 Database Health Check Starting...\n');
  console.log(`Project: ${supabaseUrl}\n`);

  const results = [];

  for (const check of healthChecks) {
    const result = await runHealthCheck(check);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n\n📊 Summary:');
  console.log('='.repeat(50));

  const issues = results.filter(r => r.hasIssues || r.error);
  const clean = results.filter(r => !r.hasIssues && !r.error);

  console.log(`✅ Clean checks: ${clean.length}`);
  console.log(`⚠️  Issues found: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\n⚠️  Issues to address:');
    issues.forEach(issue => {
      console.log(`   - ${issue.name}`);
      if (issue.error) {
        console.log(`     Error: ${issue.error}`);
      }
      if (issue.data && issue.data.length > 0) {
        console.log(`     Records: ${issue.data.length}`);
      }
    });
  }

  console.log('\n✅ Health check complete!');
}

main().catch(console.error);
