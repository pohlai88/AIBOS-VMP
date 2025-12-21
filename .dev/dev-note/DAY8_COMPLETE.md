# Day 8 — Evidence Upload + Versioning: COMPLETE ✅

**Date:** 2025-12-22  
**Status:** ✅ Complete  
**Time:** ~4 hours

---

## 🎯 What Was Accomplished

### 1. Added Evidence Methods to Adapter ✅

**File Modified:** `src/adapters/supabase.js`

**Methods Added:**

#### `getEvidence(caseId)`
- Fetches all evidence for a case from `vmp_evidence` table
- Orders by `created_at` DESC (newest first)
- Returns empty array if no evidence

#### `computeChecksum(fileBuffer)`
- Computes SHA-256 checksum of file buffer
- Used for file integrity verification
- Returns hexadecimal hash string

#### `getNextEvidenceVersion(caseId, evidenceType)`
- Gets the next version number for an evidence type
- Queries existing evidence to find max version
- Returns 1 if no existing evidence
- Returns max version + 1 if evidence exists
- **Enables versioning:** Same evidence type = new version

#### `generateEvidenceStoragePath(caseId, evidenceType, version, filename)`
- Generates storage path following structure:
  ```
  {case_id}/{evidence_type}/YYYY-MM-DD/v{version}_{filename}
  ```
- Sanitizes filename (removes special characters)
- Example: `a1b2c3d4/grn/2025-12-22/v1_signed_grn.pdf`

#### `uploadEvidenceToStorage(storagePath, fileBuffer, mimeType)`
- Uploads file buffer to Supabase Storage bucket `vmp-evidence`
- Uses `upsert: false` to prevent overwriting
- Returns upload data

#### `getEvidenceSignedUrl(storagePath, expiresIn)`
- Creates signed URL for evidence download
- Default expiry: 1 hour (3600 seconds)
- Required for private bucket access
- Returns signed URL string

#### `uploadEvidence(caseId, file, evidenceType, checklistStepId, uploaderType, uploaderUserId)`
- **Complete upload flow:**
  1. Gets next version for evidence type
  2. Generates storage path
  3. Computes SHA-256 checksum
  4. Uploads to Supabase Storage
  5. Creates evidence record in database
  6. Updates checklist step status to 'submitted' (if linked)
  7. Returns evidence record
- **Error handling:** Cleans up uploaded file if DB insert fails
- **Versioning:** Automatically increments version for same evidence type

**Features:**
- ✅ Automatic versioning (same evidence_type = new version)
- ✅ SHA-256 checksum for integrity
- ✅ Links to checklist steps
- ✅ Updates checklist step status
- ✅ Proper error handling and cleanup
- ✅ Timeout protection (10s)

---

### 2. Added Multer Configuration ✅

**File Modified:** `server.js`

**Configuration:**
- ✅ Memory storage (files stored in memory, then uploaded to Supabase)
- ✅ 50MB file size limit
- ✅ MIME type filtering:
  - PDF: `application/pdf`
  - Images: `image/jpeg`, `image/png`, `image/gif`
  - Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- ✅ File validation with error messages

---

### 3. Updated Evidence Route to Use Real Data ✅

**File Modified:** `server.js`

**Route:** `GET /partials/case-evidence.html`

**Changes:**
- ✅ Removed TODO comment
- ✅ Calls `vmpAdapter.getEvidence(caseId)` to fetch real evidence
- ✅ Generates signed URLs for each evidence file (1 hour expiry)
- ✅ Handles errors gracefully (returns empty evidence array)
- ✅ Passes evidence with download URLs to template

**Before:**
```javascript
// TODO: Implement getEvidence() in adapter (Day 8)
// For now, return empty state
res.render('partials/case_evidence.html', { caseId, evidence: [] });
```

**After:**
```javascript
// Fetch evidence from adapter
let evidence = [];
try {
  evidence = await vmpAdapter.getEvidence(caseId);
  
  // Generate signed URLs for each evidence file
  for (const ev of evidence) {
    try {
      ev.download_url = await vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600);
    } catch (urlError) {
      ev.download_url = '#';
    }
  }
} catch (adapterError) {
  console.error('Adapter error loading evidence:', adapterError);
}
res.render('partials/case_evidence.html', { caseId, evidence });
```

---

### 4. Implemented POST Endpoint for Evidence Upload ✅

**File Modified:** `server.js`

**Route:** `POST /cases/:id/evidence`

**Features:**
- ✅ Uses multer middleware (`upload.single('file')`)
- ✅ Extracts `caseId` from route parameter
- ✅ Extracts `evidence_type` and `checklist_step_id` from request body
- ✅ Validates case ID, file, and evidence type
- ✅ Gets user context from `req.user` (set by auth middleware)
- ✅ Verifies case belongs to vendor (security check)
- ✅ Calls `vmpAdapter.uploadEvidence()` with:
  - File buffer, name, MIME type, size
  - Evidence type
  - Checklist step ID (if provided)
  - Uploader type: 'vendor'
  - Uploader user ID
- ✅ Returns refreshed evidence partial after upload
- ✅ Handles errors gracefully

**Request Flow:**
1. User uploads file via form → POST `/cases/:id/evidence`
2. Multer validates and stores file in memory
3. Server validates input and verifies case access
4. Server calls `vmpAdapter.uploadEvidence()`
5. Adapter uploads to Supabase Storage
6. Adapter creates evidence record in database
7. Adapter updates checklist step status (if linked)
8. Server fetches updated evidence with signed URLs
9. Server returns refreshed evidence partial
10. HTMX swaps evidence container with new content

---

### 5. Updated Evidence Template ✅

**File Modified:** `src/views/partials/case_evidence.html`

**Changes:**
- ✅ Updated download link to use `download_url` (signed URL) instead of `storage_path`
- ✅ Template already had proper file type icons and version display
- ✅ Empty state already in place

---

## 📊 Data Flow

### Evidence Display Flow
```
User opens case
  ↓
HTMX loads /partials/case-evidence.html?case_id=xxx
  ↓
Server calls vmpAdapter.getEvidence(caseId)
  ↓
Adapter queries vmp_evidence table
  ↓
For each evidence file:
  - Generate signed URL (1 hour expiry)
  - Add download_url to evidence object
  ↓
Template renders evidence with download links
```

### Evidence Upload Flow
```
User selects file and submits form
  ↓
HTMX POSTs to /cases/:id/evidence (multipart/form-data)
  ↓
Multer validates file (size, MIME type)
  ↓
Server validates case access
  ↓
Server calls vmpAdapter.uploadEvidence()
  ↓
Adapter:
  1. Gets next version for evidence type
  2. Generates storage path
  3. Computes SHA-256 checksum
  4. Uploads to Supabase Storage
  5. Creates evidence record in database
  6. Updates checklist step status
  ↓
Server fetches updated evidence
  ↓
Server generates signed URLs
  ↓
Server returns refreshed evidence partial
  ↓
HTMX swaps evidence container
```

### Versioning Logic
```
User uploads "invoice.pdf" (evidence_type: invoice_pdf)
  ↓
Adapter checks: existing invoice_pdf for this case?
  - No → version = 1
  - Yes → version = max(existing versions) + 1
  ↓
Storage path: {case_id}/invoice_pdf/2025-12-22/v{version}_invoice.pdf
  ↓
Database record: case_id, evidence_type, version, storage_path, checksum
```

---

## ✅ Success Criteria Met

- ✅ Evidence displays real files from `vmp_evidence` table
- ✅ File upload works (PDF, images, documents)
- ✅ Files stored in Supabase Storage
- ✅ Checksums computed and stored
- ✅ Versioning works (upload same type = new version)
- ✅ Evidence links to checklist steps
- ✅ Download links work (signed URLs)
- ✅ Checklist step status updates on upload

---

## 🔄 Integration Points

### Checklist → Evidence
- Upload button in checklist links to evidence upload
- Evidence upload updates checklist step status to 'submitted'
- Evidence can be linked to specific checklist step via `checklist_step_id`

### Evidence → Storage
- Files stored in `vmp-evidence` bucket
- Storage path: `{case_id}/{evidence_type}/YYYY-MM-DD/v{version}_{filename}`
- Signed URLs generated for download (1 hour expiry)

### Evidence → Database
- Evidence records in `vmp_evidence` table
- Version tracking via `(case_id, evidence_type, version)` unique constraint
- Checksum stored for integrity verification

---

## 📝 Notes

- **No Orphan Uploads:** Evidence must always attach to a case (enforced by `case_id` NOT NULL)
- **Versioning:** Same `evidence_type` for same `case_id` creates new version automatically
- **Storage Security:** Private bucket with signed URLs (1 hour expiry)
- **File Validation:** Multer validates file size (50MB) and MIME types
- **Error Handling:** Upload cleanup if database insert fails
- **Checklist Integration:** Uploading evidence updates checklist step status

---

## 🎯 Storage Path Examples

| Case ID | Evidence Type | Version | Filename | Storage Path |
|---------|---------------|---------|----------|--------------|
| `abc123` | `invoice_pdf` | 1 | `invoice.pdf` | `abc123/invoice_pdf/2025-12-22/v1_invoice.pdf` |
| `abc123` | `invoice_pdf` | 2 | `invoice_v2.pdf` | `abc123/invoice_pdf/2025-12-22/v2_invoice_v2.pdf` |
| `abc123` | `grn` | 1 | `grn_signed.pdf` | `abc123/grn/2025-12-22/v1_grn_signed.pdf` |

---

**Status:** ✅ **Day 8 Complete** - Days 5-8 Batch Complete! 🎉

