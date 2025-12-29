# Supabase Storage: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Storage - file uploads, image transformations, and RLS policies  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Basic Operations](#basic-operations)
3. [Image Transformations](#image-transformations)
4. [RLS Policies](#rls-policies)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)
7. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is Supabase Storage?

Supabase Storage provides **S3-compatible object storage** with:
- ✅ **File Upload/Download** - REST API for files
- ✅ **Image Transformations** - On-the-fly image processing
- ✅ **CDN Integration** - Global content delivery
- ✅ **RLS Policies** - Row-level security for files
- ✅ **Public/Private Buckets** - Access control
- ✅ **Large File Support** - Handle GB-sized files

---

## 📤 Basic Operations

### Upload File

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Upload file
const { data, error } = await supabase.storage
  .from('documents')
  .upload('invoice-123.pdf', file)

if (error) {
  console.error('Upload error:', error)
} else {
  console.log('File uploaded:', data.path)
}
```

### Download File

```javascript
// Download file
const { data, error } = await supabase.storage
  .from('documents')
  .download('invoice-123.pdf')

if (error) {
  console.error('Download error:', error)
} else {
  // data is a Blob
  const url = URL.createObjectURL(data)
}
```

### Get Public URL

```javascript
// Get public URL
const { data } = supabase.storage
  .from('documents')
  .getPublicUrl('invoice-123.pdf')

console.log('Public URL:', data.publicUrl)
```

### List Files

```javascript
// List files in bucket
const { data, error } = await supabase.storage
  .from('documents')
  .list('invoices', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  })
```

### Delete File

```javascript
// Delete file
const { error } = await supabase.storage
  .from('documents')
  .remove(['invoice-123.pdf'])
```

---

## 🖼️ Image Transformations

### Resize Images

```javascript
// Resize image on-the-fly
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('user-123.jpg', {
    transform: {
      width: 200,
      height: 200,
      resize: 'cover'  // cover, contain, fill
    }
  })
```

### Image Formats

```javascript
// Convert to WebP
const { data } = supabase.storage
  .from('images')
  .getPublicUrl('photo.jpg', {
    transform: {
      width: 800,
      format: 'webp',
      quality: 80
    }
  })
```

### Image Options

```javascript
const { data } = supabase.storage
  .from('images')
  .getPublicUrl('photo.jpg', {
    transform: {
      width: 1200,
      height: 800,
      resize: 'cover',
      format: 'webp',
      quality: 90,
      flip: 'horizontal',  // horizontal, vertical
      rotate: 90,  // 90, 180, 270
      blur: 5,  // 0-100
      sharpen: 10  // 0-100
    }
  })
```

### Responsive Images

```javascript
// Generate multiple sizes
const sizes = [400, 800, 1200, 1600]

const imageUrls = sizes.map(size => 
  supabase.storage
    .from('images')
    .getPublicUrl('photo.jpg', {
      transform: { width: size, format: 'webp' }
    }).data.publicUrl
)

// Use in <img srcset>
const srcset = imageUrls.map((url, i) => `${url} ${sizes[i]}w`).join(', ')
```

---

## 🔒 RLS Policies

### Create Bucket

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

### RLS Policy Examples

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Multi-Tenant Storage

```sql
-- Tenant-scoped storage
CREATE POLICY "Tenant-scoped storage"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )::text
);
```

---

## 🚀 Advanced Features

### Large File Uploads

```javascript
// Upload large files in chunks
async function uploadLargeFile(file, bucket, path) {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE)
  
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    
    const { error } = await supabase.storage
      .from(bucket)
      .upload(`${path}.part${i}`, chunk, {
        upsert: true
      })
    
    if (error) throw error
  }
  
  // Merge chunks (server-side)
  // Or use resumable upload API
}
```

### File Versioning

```javascript
// Upload with version
const timestamp = Date.now()
const versionedPath = `invoices/v1/${timestamp}-invoice-123.pdf`

await supabase.storage
  .from('documents')
  .upload(versionedPath, file)
```

### Signed URLs

```javascript
// Generate signed URL (temporary access)
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl('invoice-123.pdf', 3600) // 1 hour expiry

if (data) {
  console.log('Signed URL:', data.signedUrl)
}
```

### Copy/Move Files

```javascript
// Copy file
await supabase.storage
  .from('documents')
  .copy('invoice-123.pdf', 'archive/invoice-123.pdf')

// Move file (copy + delete)
await supabase.storage
  .from('documents')
  .move('invoice-123.pdf', 'archive/invoice-123.pdf')
```

---

## 📊 Best Practices

### 1. Organize Files

```javascript
// Good: Organized structure
const path = `${tenantId}/cases/${caseId}/evidence/${fileId}.pdf`

// Bad: Flat structure
const path = `${fileId}.pdf`
```

### 2. Use Appropriate Buckets

```javascript
// Separate buckets by purpose
- 'avatars' - User avatars (public)
- 'documents' - Private documents (private)
- 'public-assets' - Public assets (public)
- 'uploads' - Temporary uploads (private)
```

### 3. Optimize Images

```javascript
// Always use WebP for web
const { data } = supabase.storage
  .from('images')
  .getPublicUrl('photo.jpg', {
    transform: {
      format: 'webp',
      quality: 80,
      width: 1200
    }
  })
```

### 4. Clean Up Temporary Files

```javascript
// Delete temporary files after processing
await supabase.storage
  .from('uploads')
  .remove([`temp/${fileId}`])
```

### 5. Monitor Storage Usage

```sql
-- Check storage usage
SELECT 
  bucket_id,
  SUM(metadata->>'size')::bigint as total_size
FROM storage.objects
GROUP BY bucket_id;
```

---

## 🔗 Integration Patterns

### Pattern 1: Case Evidence Upload

```javascript
// Upload evidence for case
async function uploadCaseEvidence(caseId, file) {
  const path = `cases/${caseId}/evidence/${file.name}`
  
  // Upload file
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, file)
  
  if (error) throw error
  
  // Create evidence record
  const { error: dbError } = await supabase
    .from('nexus_case_evidence')
    .insert({
      case_id: caseId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type
    })
  
  if (dbError) throw dbError
  
  return data
}
```

### Pattern 2: Avatar Upload with Transformation

```javascript
// Upload and transform avatar
async function uploadAvatar(userId, file) {
  const path = `avatars/${userId}.jpg`
  
  // Upload original
  await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  
  // Get transformed URLs
  const sizes = [64, 128, 256, 512]
  const urls = sizes.map(size => 
    supabase.storage
      .from('avatars')
      .getPublicUrl(path, {
        transform: {
          width: size,
          height: size,
          resize: 'cover',
          format: 'webp'
        }
      }).data.publicUrl
  )
  
  // Update user record
  await supabase
    .from('users')
    .update({ avatar_urls: urls })
    .eq('id', userId)
  
  return urls
}
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [RLS Policies](./database/RLS_POLICIES.md) - Row Level Security
- [Storage Official Docs](https://supabase.com/docs/guides/storage) - Official documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

