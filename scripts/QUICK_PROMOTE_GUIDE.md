# Quick Guide: Promote User to Admin/Internal

## Option 1: Using the Node.js Script (Recommended)

```bash
# Run with your actual email
node scripts/promote-user-to-admin.js your-email@example.com

# Example:
node scripts/promote-user-to-admin.js jackwee2020@gmail.com
```

## Option 2: Using Supabase SQL Editor

1. Go to Supabase Dashboard > SQL Editor
2. Run this SQL (replace `your-email@example.com` with your actual email):

```sql
-- Update Supabase Auth user_metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{is_internal}',
    'true'::jsonb
)
WHERE email = 'your-email@example.com';

-- Update vmp_vendor_users if record exists
UPDATE vmp_vendor_users 
SET is_internal = true 
WHERE email = 'your-email@example.com';

-- Verify
SELECT 
    email,
    raw_user_meta_data->>'is_internal' as is_internal_metadata
FROM auth.users 
WHERE email = 'your-email@example.com';
```

## Option 3: Using Supabase Dashboard

1. Go to **Supabase Dashboard** > **Authentication** > **Users**
2. Find your user by email
3. Click **Edit** (or the user row)
4. In **User Metadata**, add:
   ```json
   {
     "is_internal": true
   }
   ```
5. Click **Save**

## After Promotion

1. **Log out** and **log back in** (or refresh the page)
2. Check the sidebar - it should now show the organization tree
3. Your badge should show **"ADMIN"** instead of **"OPERATOR"**

## Troubleshooting

If the sidebar still shows "Access denied":
- Check server logs for your user's `isInternal` status
- Verify the update worked: Check `auth.users.raw_user_meta_data->>'is_internal'`
- Make sure you're logged in with the correct email

