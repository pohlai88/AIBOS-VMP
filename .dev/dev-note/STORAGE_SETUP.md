# Supabase Storage Setup for VMP Evidence

**Last Updated:** 2025-12-22  
**Status:** Configuration Guide

---

## 📦 Storage Bucket Configuration

### Create Bucket via Supabase Dashboard

1. **Navigate to Storage**
   - Go to your Supabase project dashboard
   - Click on "Storage" in the left sidebar

2. **Create New Bucket**
   - Click "New Bucket"
   - **Name:** `vmp-evidence`
   - **Public:** `false` (private bucket - requires authentication)
   - **File size limit:** `50MB` (adjust as needed)
   - **Allowed MIME types:** 
     ```
     application/pdf
     image/jpeg
     image/png
     image/gif
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     application/vnd.ms-excel
     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
     ```

3. **Save Bucket**

---

## 🔒 Storage Policies (RLS)

After creating the bucket, configure Row Level Security policies:

### Policy 1: Vendors Can Upload Evidence

```sql
CREATE POLICY "Vendors can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vmp-evidence' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM vmp_cases WHERE vendor_id IN (
      SELECT vendor_id FROM vmp_vendor_users WHERE id = auth.uid()
    )
  )
);
```

### Policy 2: Vendors Can Read Their Evidence

```sql
CREATE POLICY "Vendors can read evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vmp-evidence' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM vmp_cases WHERE vendor_id IN (
      SELECT vendor_id FROM vmp_vendor_users WHERE id = auth.uid()
    )
  )
);
```

### Policy 3: Internal Users Can Read All Evidence

```sql
CREATE POLICY "Internal users can read all evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vmp-evidence' AND
  EXISTS (
    SELECT 1 FROM vmp_vendor_users
    WHERE id = auth.uid() AND is_active = true
  )
);
```

---

## 📁 Storage Path Structure

Evidence files are stored using this structure:

```
vmp-evidence/
  {case_id}/
    {evidence_type}/
      YYYY-MM-DD/
        v{version}_{original_filename}
```

**Example:**
```
vmp-evidence/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    PO/
      2025-12-22/
        v1_purchase_order_9921.pdf
```

---

## 🔧 Implementation in Code

### Upload Evidence

```javascript
// In src/adapters/supabase.js
async uploadEvidence(caseId, file, evidenceType, version) {
  const storagePath = generateEvidenceStoragePath(caseId, evidenceType, version, file.originalname);
  
  const { data, error } = await supabase.storage
    .from('vmp-evidence')
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false // Prevent overwriting
    });
  
  if (error) throw error;
  
  // Get public URL (if needed) or signed URL
  const { data: urlData } = await supabase.storage
    .from('vmp-evidence')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry
  
  return {
    storage_path: storagePath,
    url: urlData.signedUrl
  };
}
```

### Download Evidence

```javascript
async getEvidenceUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('vmp-evidence')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry
  
  if (error) throw error;
  return data.signedUrl;
}
```

---

## ✅ Verification Checklist

- [ ] Bucket `vmp-evidence` created
- [ ] Bucket is private (not public)
- [ ] File size limit configured (50MB)
- [ ] MIME types restricted
- [ ] RLS policies created
- [ ] Storage helper function deployed
- [ ] Test upload works
- [ ] Test download works
- [ ] Test access control (vendor can only see their cases)

---

## 🐛 Troubleshooting

### "Bucket not found"
- Ensure bucket name is exactly `vmp-evidence`
- Check bucket exists in Supabase Dashboard

### "Access denied"
- Verify RLS policies are active
- Check user has valid session
- Verify user has access to the case

### "File too large"
- Check bucket file size limit
- Verify file is under 50MB (or configured limit)

### "Invalid MIME type"
- Check file extension matches allowed MIME types
- Verify bucket MIME type restrictions

---

## 📚 Related Files

- `migrations/007_storage_bucket_setup.sql` - Storage setup SQL
- `src/adapters/supabase.js` - Adapter implementation
- `.dev/dev-note/VMP 21Sprint.md` - Sprint planning

