# Set Password for jackwee2020@gmail.com

## ⚠️ Supabase MCP Limitation

**Supabase MCP does not have a direct password update tool.** Passwords in Supabase Auth are encrypted and must be updated via the Admin API, not SQL.

## ✅ Solution: Use Server Admin Route

Since the Supabase Dashboard doesn't show "Update Password" option, use the server's admin route:

### Method 1: PowerShell Script (Easiest)

```powershell
cd AIBOS-VMP
.\scripts\set-password-via-api.ps1
```

**Prerequisites:**
- Server must be running (`npm run dev` or `npm start`)
- Server accessible at `http://localhost:9000`

### Method 2: Manual PowerShell Request

```powershell
$body = @{email='jackwee2020@gmail.com';password='admin123'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:9000/admin/set-password' -Method POST -ContentType 'application/json' -Body $body
```

### Method 3: Start Server & Use Admin Route

1. Start the server:
   ```powershell
   cd AIBOS-VMP
   npm run dev
   ```

2. In another terminal, run:
   ```powershell
   $body = @{email='jackwee2020@gmail.com';password='admin123'} | ConvertTo-Json
   Invoke-RestMethod -Uri 'http://localhost:9000/admin/set-password' -Method POST -ContentType 'application/json' -Body $body
   ```

### Method 4: Supabase CLI (If Installed)

```bash
supabase auth admin update-user cb431435-02f4-45cb-83fa-abc12104cc8f --password admin123
```

## ✅ User Details (From Validation)

- **Email:** jackwee2020@gmail.com
- **Auth User ID:** cb431435-02f4-45cb-83fa-abc12104cc8f
- **VMP User ID:** a0e31824-51d1-436c-8c7d-a7602dd2823d
- **Status:** Active, Internal user
- **Vendor:** Default Vendor
- **Tenant:** DE LETTUCE BEAR BERHAD

## 🔒 Security Note

**IMPORTANT:** After setting the password, remove the temporary admin route from `server.js` (line ~10517-10561) for security.

## ✅ After Password is Set

User can login with:
- **Email:** jackwee2020@gmail.com
- **Password:** admin123

Then proceed to create vendor invites at `/ops/invites/new`.


