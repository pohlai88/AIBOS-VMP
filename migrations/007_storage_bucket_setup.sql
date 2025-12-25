-- Migration: VMP Storage Bucket Setup
-- Created: 2025-12-22
-- Description: Creates Supabase Storage bucket for evidence files

-- ============================================================================
-- STORAGE BUCKET: vmp-evidence
-- ============================================================================
-- Note: This migration creates the bucket if it doesn't exist
-- Storage buckets are managed via Supabase Dashboard or Storage API
-- This SQL is for documentation purposes

-- To create the bucket via Supabase Dashboard:
-- 1. Go to Storage > New Bucket
-- 2. Name: vmp-evidence
-- 3. Public: false (private bucket)
-- 4. File size limit: 50MB (adjust as needed)
-- 5. Allowed MIME types: application/pdf, image/*, application/msword, application/vnd.openxmlformats-officedocument.*

-- To create via SQL (requires superuser):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'vmp-evidence',
--   'vmp-evidence',
--   false,
--   52428800, -- 50MB
--   ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES (RLS for Storage)
-- ============================================================================

-- Policy: Vendors can upload evidence to their own cases
-- CREATE POLICY "Vendors can upload evidence"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'vmp-evidence' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM vmp_cases WHERE vendor_id IN (
--       SELECT vendor_id FROM vmp_vendor_users WHERE id = auth.uid()
--     )
--   )
-- );

-- Policy: Vendors can read evidence for their cases
-- CREATE POLICY "Vendors can read evidence"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'vmp-evidence' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM vmp_cases WHERE vendor_id IN (
--       SELECT vendor_id FROM vmp_vendor_users WHERE id = auth.uid()
--     )
--   )
-- );

-- Policy: Internal users can read all evidence
-- CREATE POLICY "Internal users can read all evidence"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'vmp-evidence' AND
--   EXISTS (
--     SELECT 1 FROM vmp_vendor_users
--     WHERE id = auth.uid() AND is_active = true
--   )
-- );

-- ============================================================================
-- STORAGE HELPER FUNCTION
-- ============================================================================

-- Function to generate storage path for evidence
CREATE OR REPLACE FUNCTION generate_evidence_storage_path(
  case_id UUID,
  evidence_type TEXT,
  version INTEGER,
  filename TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN format(
    '%s/%s/%s/v%d_%s',
    case_id,
    evidence_type,
    to_char(now(), 'YYYY-MM-DD'),
    version,
    filename
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_evidence_storage_path IS 'Generates storage path for evidence files: case_id/evidence_type/YYYY-MM-DD/v{version}_{filename}';

