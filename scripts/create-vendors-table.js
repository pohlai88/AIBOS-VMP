// Simple script to create vmp_vendors table and sample data
// Run manually in Supabase SQL Editor or via psql

console.log(`
==============================================
CREATE VMP_VENDORS TABLE
==============================================

Copy and paste this SQL into your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS vmp_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert sample vendors
INSERT INTO vmp_vendors (name, code, contact_name, contact_email, status) VALUES
  ('Acme Corporation', 'ACME', 'John Doe', 'john@acme.com', 'active'),
  ('Tech Solutions Ltd', 'TECH', 'Jane Smith', 'jane@techsolutions.com', 'active'),
  ('Global Services Inc', 'GLOBAL', 'Bob Johnson', 'bob@globalservices.com', 'pending')
ON CONFLICT (code) DO NOTHING;

==============================================
DONE! Refresh your vendor management page.
==============================================
`);

process.exit(0);
