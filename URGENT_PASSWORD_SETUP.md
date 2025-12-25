# URGENT: Set Password for jackwee2020@gmail.com

## ✅ Quick Setup (Choose One Method)

### Method 1: Run Script (Recommended)
```bash
cd AIBOS-VMP
npm run setup-jack-password
```

Or directly:
```bash
cd AIBOS-VMP
node scripts/setup-jack-password.js
```

### Method 2: Via Server API (If Server is Running)
```powershell
$body = @{email='jackwee2020@gmail.com';password='admin123'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:9000/admin/set-password' -Method POST -ContentType 'application/json' -Body $body
```

### Method 3: Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: Authentication → Users
4. Search for: `jackwee2020@gmail.com`
5. Click on the user
6. Click "Reset Password" or "Update User"
7. Set password to: `admin123`

## ✅ After Setup

**Login Credentials:**
- Email: `jackwee2020@gmail.com`
- Password: `admin123`
- Status: Internal user (can create vendor invites)
- Vendor: Default Vendor
- Tenant: DE LETTUCE BEAR BERHAD

## 🔒 Security Note

**IMPORTANT:** After setting the password, remove the temporary admin route from `server.js`:
- Location: Line ~10240
- Route: `POST /admin/set-password`
- Remove this entire route block for security

## ✅ Verification

After setting password, test login:
1. Go to: `http://localhost:9000/login` (or your production URL)
2. Enter: `jackwee2020@gmail.com` / `admin123`
3. Should redirect to `/home` or dashboard

## 🚀 Ready to Create Vendor Invites

Once logged in as `jackwee2020@gmail.com`, you can:
1. Navigate to `/ops/invites/new`
2. Create invites for vendors
3. Vendors will receive Supabase invitation emails
4. Vendors can onboard and access dashboard

