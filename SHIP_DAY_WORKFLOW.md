# Ship Day Workflow – Vendor MVP

## Pre-Deployment Checklist (Run in order)

### Step 1: Automated Regression Scan

```powershell
npm run guardrails
```

**Expected output**:
```
Guardrails check PASSED (warnings may exist).
```

**If it fails** (shows ERRORS):
- Review the file + line numbers
- Likely issue: `403` used in vendor ownership context (should be `404`)
- Fix and re-run until it passes

### Step 2: Quick Manual Smoke Test

```powershell
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Manual checks
# Browser: http://localhost:9000/vendor/dashboard
# Expected: Dashboard loads, inbox visible

# Test 1 - Owned case loads
# Navigate to a case owned by DEMO_VENDOR_ID
# Expected: case-detail, case-thread, etc. render

# Test 2 - Non-owned case denied
# Try accessing a case with different vendor_id
# Expected: 404 (not 403, not full error page)

# Test 3 - POST on owned case works
# Click "Add Message" on owned case
# Expected: message posts, thread refreshes

# Test 4 - POST on non-owned case denied
# Try crafting a POST to /cases/{non-owned-id}/messages
# Expected: 404 response body, no writes in DB
```

### Step 3: Code Review Gate

Before merge, confirm:
- [ ] All vendor partials have vendorId + case ownership checks
- [ ] All vendor POSTs have requireAuth + ownership checks before writes
- [ ] Ownership denies return 404 (not 403)
- [ ] Decision engine flag set to `USE_DECISION_ENGINE=false`

### Step 4: Deployment

```powershell
# Set environment (example for staging)
$env:USE_DECISION_ENGINE = "false"
$env:BASE_PATH = "/vendor"
$env:DEMO_VENDOR_ID = "<your-uuid>"

# Deploy (your platform-specific command)
# e.g. Vercel: vercel deploy --prod
# e.g. Heroku: git push heroku main
```

### Step 5: Post-Deployment Verification

```powershell
# Check production dashboard loads
# curl https://your-domain/vendor/dashboard

# Verify 404 on non-owned case
# curl https://your-domain/api/cases/{random-uuid} -i
# Expected: 404 (not 403, not 500)

# Check logs for ownership denies
# grep -i "404\|ownership" production-logs.txt
```

## Rollback Plan

If regressions detected post-deploy:

1. **Immediate**: Set `USE_DECISION_ENGINE=true` (reverts to old logic if wired)
2. **Or**: Revert commit to last known good state
3. **Then**: Run `npm run guardrails` on buggy code to identify pattern
4. **Debug**: Check if new route was added without ownership checks

## Common Issues & Fixes

| Issue | Fix |
| --- | --- |
| `404` returns full error page instead of JSON | Check that route doesn't render HTML on 404; should `res.status(404).json({error: '...'})` |
| `npm run guardrails` reports false positive `403` | Check if message contains "vendor context required"—that's OK (it's a setup error, not access denial) |
| Vendor can still see non-owned cases | Grep for the case ID in vendor partials; likely missing `vmpAdapter.getCaseDetail(id, vendorId)` call |
| POST succeeds on non-owned case | Check `requireAuth` + ownership check runs BEFORE `await` on DB write |

## Support Resources

- **Vendor endpoint reference**: `README_VENDOR_MVP.md`
- **Guardrails script help**: `GUARDRAILS_USAGE.md`
- **Full ship readiness**: `VENDOR_MVP_SHIP_READINESS.md`

---

**Shipped**: 2025-12-24 | **Version**: v0.1.0-vendor-mvp
