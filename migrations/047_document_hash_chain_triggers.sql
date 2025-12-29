-- Migration: Document Hash Chain with PostgreSQL Triggers
-- Created: 2025-01-22
-- Description: Implements immutable hash chain for document integrity
-- Purpose: Enforce "No Evidence, No Coin" doctrine with database-level guarantees
-- Based on: Cryptographic Finalization Report (PostgreSQL trigger approach)

-- ============================================================================
-- 1. SETUP: Schema & Crypto Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The main ledger table
CREATE TABLE IF NOT EXISTS vmp_document_hash_chain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL, -- Link to your actual document/invoice
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Who did this?
    
    -- payload_hash: Hash of the actual document content (calculated by app)
    payload_hash TEXT NOT NULL, 
    
    -- metadata: JSON blob of context (timestamp, action type, ip, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- THE CHAIN 🔗
    previous_hash TEXT, -- Pointer to the record before this one
    chain_hash TEXT,    -- The final seal: SHA256(prev_hash + payload + meta)
    
    -- Sequence number for easier human auditing (1, 2, 3...)
    sequence_id BIGINT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimization: Fast lookups for the chain validation
CREATE INDEX idx_hash_chain_prev ON vmp_document_hash_chain(previous_hash);
CREATE INDEX idx_hash_chain_seq ON vmp_document_hash_chain(sequence_id DESC);
CREATE INDEX idx_hash_chain_document ON vmp_document_hash_chain(document_id);
CREATE INDEX idx_hash_chain_user ON vmp_document_hash_chain(user_id);

COMMENT ON TABLE vmp_document_hash_chain IS 
    'Immutable hash chain for document integrity. Enforces "No Evidence, No Coin" doctrine.';
COMMENT ON COLUMN vmp_document_hash_chain.chain_hash IS 
    'SHA-256 hash of: previous_hash + payload_hash + metadata + user_id';
COMMENT ON COLUMN vmp_document_hash_chain.sequence_id IS 
    'Sequential number for human-readable auditing (1, 2, 3...)';

-- ============================================================================
-- 2. FUNCTION: The "Enforcer" Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_audit_chain_link()
RETURNS TRIGGER AS $$
DECLARE
    last_record RECORD;
    new_chain_hash TEXT;
    lock_key CONSTANT BIGINT := 8899776655; -- Magic number for advisory lock
BEGIN
    -----------------------------------------------------------------------
    -- A. CONCURRENCY CONTROL
    -- Acquire a transaction-level advisory lock.
    -- This forces inserts to queue up one by one, preventing chain forks.
    -- It releases automatically when the transaction commits.
    -----------------------------------------------------------------------
    PERFORM pg_advisory_xact_lock(lock_key);

    -----------------------------------------------------------------------
    -- B. FETCH TAIL OF CHAIN
    -- Get the most recent record based on the highest sequence_id
    -----------------------------------------------------------------------
    SELECT * INTO last_record 
    FROM vmp_document_hash_chain 
    ORDER BY sequence_id DESC 
    LIMIT 1;

    -----------------------------------------------------------------------
    -- C. CALCULATE SEQUENCE & LINKS
    -----------------------------------------------------------------------
    IF last_record IS NULL THEN
        -- 🌟 GENESIS BLOCK (First ever record)
        NEW.sequence_id := 1;
        NEW.previous_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    ELSE
        -- 🔗 STANDARD BLOCK
        NEW.sequence_id := last_record.sequence_id + 1;
        NEW.previous_hash := last_record.chain_hash;
    END IF;

    -----------------------------------------------------------------------
    -- D. CRYPTOGRAPHIC SEALING (SHA-256)
    -- Formula: SHA256( previous_hash + payload_hash + metadata_json + user_id )
    -- We force this calculation here. Even if the API sends a 'chain_hash',
    -- we ignore it and calculate the TRUE hash to prevent spoofing.
    -----------------------------------------------------------------------
    new_chain_hash := encode(
        digest(
            NEW.previous_hash || 
            NEW.payload_hash || 
            NEW.metadata::text || 
            NEW.user_id::text,
            'sha256'
        ),
        'hex'
    );
    
    NEW.chain_hash := new_chain_hash;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_audit_chain_link() IS 
    'Trigger function that calculates hash chain links. Uses advisory locks for concurrency control.';

-- ============================================================================
-- 3. FUNCTION: The "Immutable" Guard
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_chain_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'Security Violation: Deleting records from the audit chain is strictly forbidden. (User: %, Record: %)', auth.uid(), OLD.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        RAISE EXCEPTION 'Security Violation: Modifying the immutable audit chain is strictly forbidden. (User: %, Record: %)', auth.uid(), OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_chain_tampering() IS 
    'Trigger function that prevents UPDATE/DELETE operations on the immutable hash chain.';

-- ============================================================================
-- 4. ATTACH TRIGGERS
-- ============================================================================

-- Trigger 1: Before Insert -> Calculate Hash & Sequence
DROP TRIGGER IF EXISTS tr_chain_calculation ON vmp_document_hash_chain;
CREATE TRIGGER tr_chain_calculation
BEFORE INSERT ON vmp_document_hash_chain
FOR EACH ROW
EXECUTE FUNCTION generate_audit_chain_link();

-- Trigger 2: Before Update/Delete -> BLOCK IT
DROP TRIGGER IF EXISTS tr_chain_protection ON vmp_document_hash_chain;
CREATE TRIGGER tr_chain_protection
BEFORE UPDATE OR DELETE ON vmp_document_hash_chain
FOR EACH ROW
EXECUTE FUNCTION prevent_chain_tampering();

-- ============================================================================
-- 5. VERIFICATION FUNCTION (For Auditors)
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_chain_integrity()
RETURNS TABLE (
    is_valid BOOLEAN,
    broken_sequence_id BIGINT,
    broken_id UUID,
    details TEXT
) AS $$
DECLARE
    r RECORD;
    calculated_hash TEXT;
    prev_hash_pointer TEXT;
BEGIN
    prev_hash_pointer := '0000000000000000000000000000000000000000000000000000000000000000';

    -- Iterate through the entire chain in order
    FOR r IN SELECT * FROM vmp_document_hash_chain ORDER BY sequence_id ASC LOOP
        
        -- 1. Check Link Continuity
        IF r.previous_hash != prev_hash_pointer THEN
            RETURN QUERY SELECT false, r.sequence_id, r.id, 'Broken Link: previous_hash does not match parent.';
            RETURN;
        END IF;

        -- 2. Re-calculate Hash
        calculated_hash := encode(digest(r.previous_hash || r.payload_hash || r.metadata::text || r.user_id::text, 'sha256'), 'hex');

        -- 3. Verify Integrity
        IF r.chain_hash != calculated_hash THEN
            RETURN QUERY SELECT false, r.sequence_id, r.id, 'Data Corruption: Content has been altered; hash mismatch.';
            RETURN;
        END IF;

        -- Move pointer
        prev_hash_pointer := r.chain_hash;
    END LOOP;

    RETURN QUERY SELECT true, NULL::BIGINT, NULL::UUID, 'Chain is intact.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_chain_integrity() IS 
    'Verifies the integrity of the entire hash chain. Returns validation result and details of any breaks.';

-- ============================================================================
-- 6. RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS
ALTER TABLE vmp_document_hash_chain ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own audit entries
CREATE POLICY "Users can insert own audit entries"
    ON vmp_document_hash_chain
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view audit entries (read-only)
CREATE POLICY "Users can view audit chain"
    ON vmp_document_hash_chain
    FOR SELECT
    USING (true); -- All authenticated users can view (audit trail is public record)

-- Policy: Service role has full access (for system operations)
CREATE POLICY "Service role has full access to hash chain"
    ON vmp_document_hash_chain
    FOR ALL
    USING ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- 7. HELPER FUNCTION: Get Chain Statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_chain_statistics()
RETURNS TABLE (
    total_entries BIGINT,
    first_entry_at TIMESTAMPTZ,
    last_entry_at TIMESTAMPTZ,
    chain_length BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_entries,
        MIN(created_at) as first_entry_at,
        MAX(created_at) as last_entry_at,
        MAX(sequence_id) as chain_length
    FROM vmp_document_hash_chain;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_chain_statistics() IS 
    'Returns statistics about the hash chain (total entries, first/last timestamps, chain length).';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the chain integrity function (should return valid on empty chain)
SELECT * FROM verify_chain_integrity();

-- Get chain statistics
SELECT * FROM get_chain_statistics();

