-- Migration: Create vmp_vendors table for vendor management
-- Purpose: Store vendor profiles and metadata
-- Author: System
-- Date: 2025-12-25

-- Create vmp_vendors table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_code ON vmp_vendors(code);
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_status ON vmp_vendors(status);
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_created_at ON vmp_vendors(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER set_vmp_vendors_updated_at
  BEFORE UPDATE ON vmp_vendors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE vmp_vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Internal users can view all vendors
CREATE POLICY "Internal users can view all vendors"
  ON vmp_vendors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vmp_internal_users
      WHERE vmp_internal_users.id = auth.uid()
    )
  );

-- RLS Policy: Internal users can create vendors
CREATE POLICY "Internal users can create vendors"
  ON vmp_vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vmp_internal_users
      WHERE vmp_internal_users.id = auth.uid()
    )
  );

-- RLS Policy: Internal users can update vendors
CREATE POLICY "Internal users can update vendors"
  ON vmp_vendors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vmp_internal_users
      WHERE vmp_internal_users.id = auth.uid()
    )
  );

-- RLS Policy: Internal users can delete vendors
CREATE POLICY "Internal users can delete vendors"
  ON vmp_vendors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vmp_internal_users
      WHERE vmp_internal_users.id = auth.uid()
    )
  );

-- Insert sample vendors for testing
INSERT INTO vmp_vendors (name, code, contact_name, contact_email, status) VALUES
  ('Acme Corporation', 'ACME', 'John Doe', 'john@acme.com', 'active'),
  ('Tech Solutions Ltd', 'TECH', 'Jane Smith', 'jane@techsolutions.com', 'active'),
  ('Global Services Inc', 'GLOBAL', 'Bob Johnson', 'bob@globalservices.com', 'pending')
ON CONFLICT (code) DO NOTHING;
