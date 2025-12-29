# Vendor Management: Advanced Features & Cryptographic Audit Trail

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Strategic Planning  
**Purpose:** Document advanced vendor management features including cryptographic audit trails, vendor evaluation, break-glass escalation, and vendor lifecycle management  
**Related:** [VENDOR_PORTAL_FEATURE_ANALYSIS.md](./VENDOR_PORTAL_FEATURE_ANALYSIS.md)  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Cryptographic Audit Trail & Document Certification](#cryptographic-audit-trail--document-certification)
2. [Vendor Evaluation System](#vendor-evaluation-system)
3. [Break-Glass Escalation Protocol](#break-glass-escalation-protocol)
4. [Vendor Lifecycle Management](#vendor-lifecycle-management)
5. [GitHub Repository Analysis](#github-repository-analysis)
6. [Implementation Recommendations](#implementation-recommendations)

---

## Cryptographic Audit Trail & Document Certification

### Current State

**Found in Codebase:**
- **Manifesto Reference:** "No Evidence, No Coin" doctrine states: *"A payment cycle cannot proceed unless the evidence pack (Invoice + GRN + Approvals) is cryptographically linked and complete."*
- **Location:** `src/views/pages/manifesto.html` (Line 754-756)

**Current Implementation Status:** ❌ **NOT IMPLEMENTED** (Conceptual only)

### Proposed Implementation

#### 1. Cryptographic Hash Chain for Evidence Packs

**Concept:** Create an immutable audit trail by cryptographically linking documents in an evidence pack.

**Implementation Strategy:**

```javascript
// src/utils/cryptographic-audit.js
import crypto from 'crypto';

/**
 * Generate cryptographic hash for a document
 * @param {Buffer} documentContent - Raw document content
 * @param {string} documentId - Document identifier
 * @param {string} previousHash - Hash of previous document in chain (null for first)
 * @returns {Object} Hash metadata
 */
export function generateDocumentHash(documentContent, documentId, previousHash = null) {
  const hash = crypto.createHash('sha256');
  
  // Include document content
  hash.update(documentContent);
  
  // Include document ID
  hash.update(documentId);
  
  // Include previous hash (creates chain)
  if (previousHash) {
    hash.update(previousHash);
  }
  
  // Include timestamp
  const timestamp = new Date().toISOString();
  hash.update(timestamp);
  
  const documentHash = hash.digest('hex');
  
  return {
    document_id: documentId,
    hash: documentHash,
    previous_hash: previousHash,
    timestamp: timestamp,
    algorithm: 'SHA-256'
  };
}

/**
 * Generate evidence pack hash (links all documents)
 * @param {Array} documentHashes - Array of document hash objects
 * @param {string} caseId - Case identifier
 * @returns {Object} Evidence pack hash
 */
export function generateEvidencePackHash(documentHashes, caseId) {
  const hash = crypto.createHash('sha256');
  
  // Include case ID
  hash.update(caseId);
  
  // Include all document hashes in order
  documentHashes.forEach(docHash => {
    hash.update(docHash.hash);
  });
  
  const packHash = hash.digest('hex');
  
  return {
    case_id: caseId,
    pack_hash: packHash,
    document_count: documentHashes.length,
    created_at: new Date().toISOString(),
    algorithm: 'SHA-256'
  };
}

/**
 * Verify evidence pack integrity
 * @param {Object} evidencePack - Evidence pack object with hashes
 * @param {Array} documents - Array of document contents
 * @returns {boolean} True if pack is valid
 */
export function verifyEvidencePackIntegrity(evidencePack, documents) {
  // Recalculate hashes and compare
  let previousHash = null;
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const expectedHash = evidencePack.document_hashes[i];
    
    const calculatedHash = generateDocumentHash(
      doc.content,
      doc.id,
      previousHash
    );
    
    if (calculatedHash.hash !== expectedHash.hash) {
      return false; // Hash mismatch - document tampered
    }
    
    previousHash = calculatedHash.hash;
  }
  
  // Verify pack hash
  const calculatedPackHash = generateEvidencePackHash(
    evidencePack.document_hashes,
    evidencePack.case_id
  );
  
  return calculatedPackHash.pack_hash === evidencePack.pack_hash;
}
```

#### 2. Database Schema for Cryptographic Audit Trail

```sql
-- Cryptographic hash table for documents
CREATE TABLE nexus_document_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL, -- References nexus_case_evidence or nexus_document_requests
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'grn', 'approval', 'evidence', 'other')),
  hash TEXT NOT NULL, -- SHA-256 hash
  previous_hash TEXT, -- Hash of previous document in chain (creates immutable chain)
  algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL, -- USR-* who created/uploaded
  
  UNIQUE(document_id, hash)
);

CREATE INDEX idx_document_hashes_document_id ON nexus_document_hashes(document_id);
CREATE INDEX idx_document_hashes_hash ON nexus_document_hashes(hash);
CREATE INDEX idx_document_hashes_previous_hash ON nexus_document_hashes(previous_hash);

-- Evidence pack hash table (links all documents in a case)
CREATE TABLE nexus_evidence_pack_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES nexus_cases(case_id),
  pack_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of entire evidence pack
  document_count INTEGER NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL, -- USR-* who created pack
  
  UNIQUE(case_id, pack_hash)
);

CREATE INDEX idx_evidence_pack_hashes_case_id ON nexus_evidence_pack_hashes(case_id);
CREATE INDEX idx_evidence_pack_hashes_pack_hash ON nexus_evidence_pack_hashes(pack_hash);

-- Audit log for hash verification
CREATE TABLE nexus_hash_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  pack_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('valid', 'invalid', 'tampered')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT NOT NULL, -- USR-* who verified
  notes TEXT
);

CREATE INDEX idx_hash_verification_case_id ON nexus_hash_verification_log(case_id);
CREATE INDEX idx_hash_verification_pack_hash ON nexus_hash_verification_log(pack_hash);
```

#### 3. Integration with Payment Flow

**Business Rule:** Payment cannot proceed unless evidence pack is cryptographically verified.

```javascript
// src/middleware/evidence-verification.js
export async function requireVerifiedEvidencePack(req, res, next) {
  const { caseId } = req.params;
  
  try {
    // Get evidence pack for case
    const evidencePack = await nexusAdapter.getEvidencePack(caseId);
    
    if (!evidencePack) {
      return res.status(400).json({
        error: 'Evidence pack not found',
        code: 'EVIDENCE_PACK_MISSING'
      });
    }
    
    // Verify cryptographic integrity
    const isValid = await verifyEvidencePackIntegrity(
      evidencePack,
      evidencePack.documents
    );
    
    if (!isValid) {
      return res.status(400).json({
        error: 'Evidence pack integrity verification failed',
        code: 'EVIDENCE_PACK_TAMPERED',
        message: 'Documents may have been modified. Payment cannot proceed.'
      });
    }
    
    // Attach verification status to request
    req.evidencePackVerified = true;
    req.evidencePackHash = evidencePack.pack_hash;
    
    next();
  } catch (error) {
    logError(error, { path: req.path, caseId });
    return res.status(500).json({
      error: 'Failed to verify evidence pack',
      code: 'VERIFICATION_ERROR'
    });
  }
}

// Usage in payment route
app.post('/api/payments/process', 
  requireVerifiedEvidencePack,
  async (req, res) => {
    // Payment processing logic
    // Evidence pack is guaranteed to be verified
  }
);
```

#### 4. Document Certification Export

**Feature:** Export cryptographic proof for auditors.

```javascript
// src/routes/audit-export.js
app.get('/api/cases/:caseId/audit-proof', async (req, res) => {
  const { caseId } = req.params;
  
  try {
    const evidencePack = await nexusAdapter.getEvidencePackWithHashes(caseId);
    const verificationLog = await nexusAdapter.getHashVerificationLog(caseId);
    
    // Generate audit proof document
    const auditProof = {
      case_id: caseId,
      evidence_pack_hash: evidencePack.pack_hash,
      document_hashes: evidencePack.document_hashes,
      verification_history: verificationLog,
      exported_at: new Date().toISOString(),
      exported_by: req.user.id
    };
    
    res.json(auditProof);
  } catch (error) {
    logError(error, { path: req.path, caseId });
    res.status(500).json({ error: 'Failed to generate audit proof' });
  }
});
```

---

## Vendor Evaluation System

### Current State

**Status:** ❌ **NOT IMPLEMENTED**

### Proposed Implementation

#### 1. Vendor Evaluation Schema

```sql
-- Vendor evaluation table
CREATE TABLE nexus_vendor_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id TEXT NOT NULL, -- TV-*
  client_id TEXT NOT NULL, -- TC-*
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  
  -- Evaluation scores (0-100)
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  delivery_score INTEGER CHECK (delivery_score >= 0 AND delivery_score <= 100),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  overall_score DECIMAL(5,2), -- Calculated average
  
  -- Evaluation details
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT,
  evaluator_notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL, -- USR-*
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT, -- USR-*
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- USR-*
  
  UNIQUE(vendor_id, client_id, evaluation_period_start, evaluation_period_end)
);

CREATE INDEX idx_vendor_evaluations_vendor_id ON nexus_vendor_evaluations(vendor_id);
CREATE INDEX idx_vendor_evaluations_client_id ON nexus_vendor_evaluations(client_id);
CREATE INDEX idx_vendor_evaluations_period ON nexus_vendor_evaluations(evaluation_period_start, evaluation_period_end);

-- Vendor evaluation criteria (configurable per client)
CREATE TABLE nexus_vendor_evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL, -- TC-*
  criterion_name TEXT NOT NULL,
  criterion_weight DECIMAL(5,2) NOT NULL CHECK (criterion_weight >= 0 AND criterion_weight <= 1),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(client_id, criterion_name)
);
```

#### 2. Automated Evaluation Metrics

**Data Sources:**
- Invoice accuracy rate (from invoice matching)
- On-time delivery rate (from PO/GRN matching)
- Response time (from case message timestamps)
- Compliance rate (from document expiration tracking)
- Dispute rate (from case types)

```javascript
// src/utils/vendor-evaluation.js
export async function calculateVendorMetrics(vendorId, clientId, periodStart, periodEnd) {
  const metrics = {
    quality_score: 0,
    delivery_score: 0,
    communication_score: 0,
    compliance_score: 0
  };
  
  // 1. Quality Score: Invoice accuracy
  const invoiceStats = await nexusAdapter.getInvoiceAccuracyStats(
    vendorId, clientId, periodStart, periodEnd
  );
  metrics.quality_score = (invoiceStats.accurate_count / invoiceStats.total_count) * 100;
  
  // 2. Delivery Score: On-time delivery rate
  const deliveryStats = await nexusAdapter.getDeliveryStats(
    vendorId, clientId, periodStart, periodEnd
  );
  metrics.delivery_score = (deliveryStats.on_time_count / deliveryStats.total_count) * 100;
  
  // 3. Communication Score: Average response time
  const communicationStats = await nexusAdapter.getCommunicationStats(
    vendorId, clientId, periodStart, periodEnd
  );
  // Convert average response time (hours) to score (0-100)
  // Lower response time = higher score
  metrics.communication_score = Math.max(0, 100 - (communicationStats.avg_response_hours * 2));
  
  // 4. Compliance Score: Document compliance rate
  const complianceStats = await nexusAdapter.getComplianceStats(
    vendorId, clientId, periodStart, periodEnd
  );
  metrics.compliance_score = (complianceStats.compliant_days / complianceStats.total_days) * 100;
  
  // Calculate overall score (weighted average)
  const weights = await nexusAdapter.getEvaluationWeights(clientId);
  metrics.overall_score = (
    metrics.quality_score * weights.quality +
    metrics.delivery_score * weights.delivery +
    metrics.communication_score * weights.communication +
    metrics.compliance_score * weights.compliance
  );
  
  return metrics;
}
```

#### 3. Vendor Evaluation Routes

```javascript
// src/routes/nexus-client.js

// GET: View vendor evaluation
router.get('/vendors/:vendorId/evaluation', async (req, res) => {
  const { vendorId } = req.params;
  const { period_start, period_end } = req.query;
  
  const evaluation = await nexusAdapter.getVendorEvaluation(
    vendorId,
    req.user.tenantId,
    period_start,
    period_end
  );
  
  res.render('nexus/pages/vendor_evaluation.html', {
    evaluation,
    vendor: await nexusAdapter.getVendor(vendorId)
  });
});

// POST: Create/Update vendor evaluation
router.post('/vendors/:vendorId/evaluation', async (req, res) => {
  const { vendorId } = req.params;
  const evaluationData = req.body;
  
  const evaluation = await nexusAdapter.createOrUpdateVendorEvaluation(
    vendorId,
    req.user.tenantId,
    evaluationData,
    req.user.id
  );
  
  res.redirect(`/nexus/client/vendors/${vendorId}/evaluation`);
});

// GET: Vendor evaluation dashboard
router.get('/vendors/evaluations', async (req, res) => {
  const evaluations = await nexusAdapter.getVendorEvaluations(
    req.user.tenantId,
    req.query
  );
  
  res.render('nexus/pages/vendor_evaluations_dashboard.html', {
    evaluations
  });
});
```

---

## Break-Glass Escalation Protocol

### Current State

**Status:** ✅ **PARTIALLY IMPLEMENTED**

**Found in Codebase:**
- **Location:** `server.js` (Lines 3528-3661)
- **Implementation:** Level 3 escalation triggers break-glass protocol
- **Function:** `logBreakGlass(caseId, userId, groupId, directorInfo)`

**Current Features:**
- ✅ Escalation levels (1-3)
- ✅ Level 3 triggers break-glass
- ✅ Break-glass logging
- ❌ Break-glass approval workflow
- ❌ Break-glass audit trail
- ❌ Break-glass notifications

### Proposed Enhancements

#### 1. Break-Glass Schema

```sql
-- Break-glass escalation log
CREATE TABLE nexus_break_glass_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES nexus_cases(case_id),
  escalated_by TEXT NOT NULL, -- USR-*
  escalation_reason TEXT NOT NULL,
  director_info JSONB, -- Director contact information
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT, -- USR-* (director or authorized approver)
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(case_id, created_at)
);

CREATE INDEX idx_break_glass_case_id ON nexus_break_glass_log(case_id);
CREATE INDEX idx_break_glass_status ON nexus_break_glass_log(status);
CREATE INDEX idx_break_glass_escalated_by ON nexus_break_glass_log(escalated_by);

-- Break-glass approval rules (configurable per client)
CREATE TABLE nexus_break_glass_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL, -- TC-*
  requires_approval BOOLEAN DEFAULT true,
  approval_required_from TEXT[], -- Array of roles: ['director', 'cfo', 'ceo']
  auto_approve_after_hours INTEGER, -- Auto-approve if no response after X hours
  notification_recipients TEXT[], -- Array of email addresses
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 2. Break-Glass Approval Workflow

```javascript
// src/routes/break-glass.js

// POST: Approve break-glass escalation
router.post('/break-glass/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  // Verify user has approval authority
  const breakGlass = await nexusAdapter.getBreakGlassLog(id);
  const rules = await nexusAdapter.getBreakGlassRules(breakGlass.client_id);
  
  if (!hasBreakGlassApprovalAuthority(req.user, rules)) {
    return res.status(403).json({
      error: 'Insufficient authority to approve break-glass escalation',
      code: 'BREAK_GLASS_UNAUTHORIZED'
    });
  }
  
  // Approve break-glass
  await nexusAdapter.approveBreakGlass(id, req.user.id, notes);
  
  // Notify stakeholders
  await notifyBreakGlassApproval(breakGlass);
  
  res.json({ success: true, message: 'Break-glass escalation approved' });
});

// GET: Break-glass dashboard (for directors/approvers)
router.get('/break-glass/pending', async (req, res) => {
  const pendingEscalations = await nexusAdapter.getPendingBreakGlassEscalations(
    req.user.tenantId
  );
  
  res.render('nexus/pages/break_glass_dashboard.html', {
    escalations: pendingEscalations
  });
});
```

---

## Vendor Lifecycle Management

### Current State

**Status:** ⚠️ **PARTIAL**

**Found in Codebase:**
- ✅ Vendor onboarding via invites (`/accept` route)
- ✅ Onboarding case creation
- ❌ Vendor suspension
- ❌ Vendor reactivation
- ❌ Vendor termination

### Proposed Implementation

#### 1. Vendor Status Schema

```sql
-- Vendor status history
CREATE TABLE nexus_vendor_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id TEXT NOT NULL, -- TV-*
  client_id TEXT NOT NULL, -- TC-*
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'terminated')),
  reason TEXT,
  changed_by TEXT NOT NULL, -- USR-*
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_vendor_status_vendor_id ON nexus_vendor_status_history(vendor_id);
CREATE INDEX idx_vendor_status_client_id ON nexus_vendor_status_history(client_id);
CREATE INDEX idx_vendor_status_status ON nexus_vendor_status_history(status);

-- Add status to nexus_tenant_relationships
ALTER TABLE nexus_tenant_relationships 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('pending', 'active', 'suspended', 'terminated'));

CREATE INDEX idx_relationships_status ON nexus_tenant_relationships(status);
```

#### 2. Vendor Suspension Workflow

```javascript
// src/routes/nexus-client.js

// POST: Suspend vendor
router.post('/vendors/:vendorId/suspend', async (req, res) => {
  const { vendorId } = req.params;
  const { reason, suspension_duration_days } = req.body;
  
  // Validate suspension reason
  if (!reason || reason.length < 10) {
    return res.status(400).json({
      error: 'Suspension reason is required (minimum 10 characters)',
      code: 'SUSPENSION_REASON_REQUIRED'
    });
  }
  
  // Suspend vendor
  await nexusAdapter.suspendVendor(
    vendorId,
    req.user.tenantId,
    reason,
    suspension_duration_days,
    req.user.id
  );
  
  // Create suspension case
  await nexusAdapter.createCase({
    case_type: 'vendor_suspension',
    vendor_id: vendorId,
    client_id: req.user.tenantId,
    subject: `Vendor Suspension: ${reason}`,
    description: `Vendor suspended for: ${reason}`,
    created_by: req.user.id
  });
  
  // Notify vendor
  await notifyVendorSuspension(vendorId, reason, suspension_duration_days);
  
  res.json({ success: true, message: 'Vendor suspended successfully' });
});

// POST: Reactivate vendor
router.post('/vendors/:vendorId/reactivate', async (req, res) => {
  const { vendorId } = req.params;
  const { reason } = req.body;
  
  // Reactivate vendor
  await nexusAdapter.reactivateVendor(
    vendorId,
    req.user.tenantId,
    reason,
    req.user.id
  );
  
  // Notify vendor
  await notifyVendorReactivation(vendorId);
  
  res.json({ success: true, message: 'Vendor reactivated successfully' });
});
```

#### 3. Vendor Suspension Impact

**Business Rules:**
- Suspended vendors cannot submit new invoices
- Suspended vendors cannot create new cases
- Suspended vendors can view existing cases and payments
- Suspended vendors receive notification of suspension

```javascript
// src/middleware/vendor-status-check.js
export async function checkVendorStatus(req, res, next) {
  if (!req.user.vendorId) {
    return next(); // Not a vendor request
  }
  
  const vendorStatus = await nexusAdapter.getVendorStatus(
    req.user.vendorId,
    req.user.tenantId
  );
  
  if (vendorStatus === 'suspended') {
    // Allow read-only access
    if (req.method === 'GET') {
      return next();
    }
    
    // Block write operations
    return res.status(403).json({
      error: 'Vendor account is suspended',
      code: 'VENDOR_SUSPENDED',
      message: 'Your vendor account has been suspended. Please contact your client for more information.'
    });
  }
  
  if (vendorStatus === 'terminated') {
    return res.status(403).json({
      error: 'Vendor account is terminated',
      code: 'VENDOR_TERMINATED'
    });
  }
  
  next();
}
```

---

## GitHub Repository Analysis

### Search Results Summary

**Searched For:**
- Vendor evaluation
- Break-glass escalation
- Cryptographic audit trail
- Vendor onboarding
- Vendor suspension

**Results:** ❌ **No relevant open-source implementations found**

**Analysis:**
- GitHub search returned mostly dictionary/vocabulary files (unrelated)
- No vendor management platforms with these specific features found
- These features appear to be **competitive differentiators** not commonly implemented

**Conclusion:** These features represent **unique value propositions** for the VMP platform.

---

## Implementation Recommendations

### Priority Matrix

| Feature | Priority | Effort | Impact | Dependencies |
|---------|----------|--------|--------|--------------|
| **Cryptographic Audit Trail** | 🔴 **CRITICAL** | 5 days | 🔴 **SILENT KILLER** | Document storage, Case management |
| **Vendor Evaluation** | 🟡 **HIGH** | 7 days | 🟡 **HIGH** | Invoice matching, Case metrics |
| **Break-Glass Enhancement** | 🟡 **HIGH** | 3 days | 🟡 **HIGH** | Existing break-glass (partial) |
| **Vendor Suspension** | 🟡 **HIGH** | 4 days | 🟡 **HIGH** | Vendor status tracking |

### Implementation Phases

#### Phase 1: Cryptographic Audit Trail (Week 1-2)

**Why First:**
- Core to "No Evidence, No Coin" doctrine
- Required for payment processing
- Provides legal/audit compliance

**Tasks:**
1. Create database schema for document hashes
2. Implement hash generation utilities
3. Integrate with document upload flow
4. Add evidence pack verification middleware
5. Create audit proof export endpoint

#### Phase 2: Vendor Evaluation (Week 3-4)

**Why Second:**
- Builds on existing invoice/case data
- Provides vendor performance insights
- Enables data-driven vendor management

**Tasks:**
1. Create evaluation schema
2. Implement automated metrics calculation
3. Build evaluation UI (client-side)
4. Create evaluation dashboard
5. Add evaluation export/reporting

#### Phase 3: Break-Glass Enhancement (Week 5)

**Why Third:**
- Enhances existing break-glass implementation
- Adds approval workflow
- Improves audit trail

**Tasks:**
1. Create break-glass approval schema
2. Implement approval workflow
3. Add break-glass dashboard
4. Create notification system

#### Phase 4: Vendor Suspension (Week 6)

**Why Fourth:**
- Completes vendor lifecycle management
- Provides risk mitigation
- Enables compliance enforcement

**Tasks:**
1. Create vendor status schema
2. Implement suspension workflow
3. Add status check middleware
4. Create suspension notification system

---

## Database Migrations Needed

```sql
-- Migration: Cryptographic Audit Trail
-- File: migrations/060_cryptographic_audit_trail.sql

-- Migration: Vendor Evaluation
-- File: migrations/061_vendor_evaluation.sql

-- Migration: Break-Glass Enhancement
-- File: migrations/062_break_glass_enhancement.sql

-- Migration: Vendor Status Management
-- File: migrations/063_vendor_status_management.sql
```

---

## Related Documentation

- [VENDOR_PORTAL_FEATURE_ANALYSIS.md](./VENDOR_PORTAL_FEATURE_ANALYSIS.md) - Vendor Portal features
- [DATABASE_STANDARDS.md](./architecture/DATABASE_STANDARDS.md) - Database design standards
- [METADATA_CONTROL_PROTOCOL.md](./architecture/METADATA_CONTROL_PROTOCOL.md) - Metadata strategy

---

**Document Status:** ✅ Complete  
**Next Review:** After Phase 1 implementation  
**Owner:** Product Team

