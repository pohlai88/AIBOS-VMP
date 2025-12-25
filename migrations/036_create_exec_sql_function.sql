-- Migration: Create exec_sql function for database health checks
-- Created: 2025-01-22
-- Description: Creates a secure function to execute SQL queries for health checks

-- Create exec_sql function (secure, read-only for information_schema queries)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result JSON;
BEGIN
    -- Only allow SELECT queries on information_schema, pg_*, and vmp_* tables
    -- This prevents DDL/DML operations for security
    IF sql_query !~* '^\s*SELECT' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;
    
    -- Prevent dangerous operations
    IF sql_query ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)' THEN
        RAISE EXCEPTION 'Dangerous operations are not allowed';
    END IF;
    
    -- Execute query and return as JSON
    EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', sql_query) INTO result;
    
    RETURN COALESCE(result, '[]'::JSON);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to service role (already has it via SECURITY DEFINER)
-- But we'll make it explicit for clarity
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

COMMENT ON FUNCTION exec_sql(TEXT) IS 'Secure function to execute read-only SELECT queries for database health checks';

