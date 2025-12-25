# Set Password for jackwee2020@gmail.com

## Quick Method (If Server is Running)

### Option 1: Using curl
```bash
curl -X POST http://localhost:9000/admin/set-password \
  -H "Content-Type: application/json" \
  -d '{"email":"jackwee2020@gmail.com","password":"admin123"}'
```

### Option 2: Using PowerShell
```powershell
Invoke-RestMethod -Uri "http://localhost:9000/admin/set-password" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"jackwee2020@gmail.com","password":"admin123"}'
```

### Option 3: Using Browser/Postman
- URL: `POST http://localhost:9000/admin/set-password`
- Body (JSON):
```json
{
  "email": "jackwee2020@gmail.com",
  "password": "admin123"
}
```

## Alternative: Via Supabase Dashboard

1. Go to Supabase Dashboard → Authentication → Users
2. Find user: `jackwee2020@gmail.com`
3. Click on user → Reset Password
4. Or use "Update User" to set password directly

## After Setting Password

**IMPORTANT:** Remove the temporary admin route from `server.js` after use for security.

The route is at line ~10240:
```javascript
// TEMPORARY: Admin route to set user password (REMOVE AFTER USE)
app.post('/admin/set-password', ...)
```

## Login Credentials

- **Email:** jackwee2020@gmail.com
- **Password:** admin123
- **Status:** Internal user
- **Vendor:** Default Vendor (DE LETTUCE BEAR BERHAD)

