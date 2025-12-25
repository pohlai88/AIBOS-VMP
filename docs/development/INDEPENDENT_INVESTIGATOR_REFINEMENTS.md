# Independent Investigator Track - Refinements & Technical Notes

**Date:** 2025-12-22  
**Status:** Implementation Notes  
**Based on:** Sprint Plan Review Feedback

---

## Technical Refinements Applied

### 1. UX Enhancement: Pulse Animation

**Location:** `src/views/pages/sign_up.html` (Tier Selector CSS)

**Implementation:**
```css
.tier-btn.active[data-tier="independent"] .tier-icon {
  animation: pulse-activate 2s ease-in-out infinite;
}

@keyframes pulse-activate {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}
```

**Purpose:** Makes "immediate access" feel like "system activation" - reinforces the professional tool nature.

---

### 2. Database Integrity: Tenant Mapping

**Issue:** Independent users need tenant context for permissions/queries that expect `tenant_id`.

**Solution:** Map all independent users to default tenant during login/context retrieval.

**Implementation Location:** `src/adapters/supabase.js` - `getVendorContext()`

```javascript
// For independent users, always map to default tenant
if (userTier === 'independent') {
  const DEFAULT_INDEPENDENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  
  return {
    id: vendorUser.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || vendorUser.display_name,
    vendor_id: null,
    tenant_id: DEFAULT_INDEPENDENT_TENANT_ID, // Always map to default tenant
    vmp_vendors: null,
    user_tier: 'independent',
    is_internal: false,
    is_active: vendorUser.is_active !== false
  };
}
```

**Rationale:** Ensures `req.user.tenantId` always exists, preventing permission/query failures.

---

### 3. Forensic Provenance: Email Verification

**Requirement:** Maintain "Chain of Custody" even for independent users.

**Implementation Strategy:**

#### Option A: Immediate Access with Nag Bar (Recommended)
- Allow immediate access after sign-up
- Show persistent nag bar until email verified
- Restrict export/forensic log export until verified

**UI Component:**
```html
<!-- Email Verification Nag Bar -->
<div id="email-verification-nag" class="verification-nag" style="display: none;">
  <div class="nag-content">
    <div class="nag-icon">⚠️</div>
    <div class="nag-text">
      <strong>Identity Not Yet Verified</strong>
      <span>Please verify your email to enable forensic log export and full chain of custody.</span>
    </div>
    <button class="nag-action" onclick="resendVerificationEmail()">Resend Verification</button>
  </div>
</div>
```

#### Option B: Require Email Verification Before Access
- Send verification email
- Require click before first login
- More secure but less "immediate"

**Recommendation:** Option A - balances immediate access with forensic requirements.

---

### 4. Security: Service Role Keys

**Issue:** Task 2.1 uses `supabaseAuth.auth.admin` which requires service role key.

**Verification Checklist:**
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`
- [ ] Ensure service role key has admin permissions
- [ ] Test user creation/deletion in development
- [ ] Document service role key requirements

**Error Handling:**
```javascript
// In sign-up route
if (authError || !authData.user) {
  // Check if it's a permissions error
  if (authError?.message?.includes('permission') || authError?.message?.includes('admin')) {
    logError(authError, { 
      path: req.path, 
      operation: 'create-independent-user',
      error_type: 'permissions',
      hint: 'Check SUPABASE_SERVICE_ROLE_KEY configuration'
    });
    return res.render('pages/sign_up.html', {
      error: 'System configuration error. Please contact support.',
      success: null
    });
  }
  // ... other error handling
}
```

---

### 5. Empty State UI

**Location:** `src/views/partials/independent_empty_state.html`

**Purpose:** Replace "broken" empty dashboard with "Ready for Data" professional state.

**Features:**
- Professional illustration (animated SVG)
- Clear call-to-action (Create First Case)
- Feature highlights (what they can do)
- Sandbox notice (forensic constraints)
- Responsive design

**Usage:**
```nunjucks
{% if user.user_tier == 'independent' and not user.vendor_id %}
  {% include "partials/independent_empty_state.html" %}
{% else %}
  <!-- Normal dashboard content -->
{% endif %}
```

---

## Implementation Checklist

### Phase 1: Database ✅
- [x] Migration file created
- [ ] Run migration in development
- [ ] Verify constraints work
- [ ] Test existing users unaffected

### Phase 2: Backend
- [ ] Update POST `/sign-up` with tier logic
- [ ] Add tenant mapping for independent users
- [ ] Update `getVendorContext()` adapter method
- [ ] Update `requireAuth()` helper
- [ ] Add email verification nag bar logic
- [ ] Test service role key permissions

### Phase 3: Frontend
- [ ] Add segmented control to sign_up.html
- [ ] Add pulse animation CSS
- [ ] Add conditional organization field
- [ ] Add forensic notice
- [ ] Test tier switching

### Phase 4: Home Page
- [ ] Add independent empty state partial
- [ ] Update home page to show empty state
- [ ] Add welcome message handling
- [ ] Test independent user dashboard

### Phase 5: Email Verification
- [ ] Create nag bar component
- [ ] Add resend verification function
- [ ] Add export restrictions logic
- [ ] Test verification flow

---

## Testing Scenarios

### Scenario 1: Independent Sign-Up → Immediate Access
1. User selects "Independent Investigator"
2. Fills name and email (no organization)
3. Submits form
4. **Expected:** Immediate redirect to `/home` with welcome message
5. **Expected:** Empty state shown (not broken dashboard)
6. **Expected:** Can create cases immediately

### Scenario 2: Institutional Sign-Up → Access Request
1. User selects "Institutional Node"
2. Fills organization name (required)
3. Submits form
4. **Expected:** Success message about approval needed
5. **Expected:** Access request stored in database
6. **Expected:** No immediate access

### Scenario 3: Email Verification Nag
1. Independent user signs up
2. Logs in (email not verified)
3. **Expected:** Nag bar appears at top
4. **Expected:** Export functions disabled
5. **Expected:** Can still use platform for local work

### Scenario 4: Database Constraints
1. Try to create independent user with vendor_id
2. **Expected:** Database constraint error
3. Try to create institutional user without vendor_id
4. **Expected:** Database constraint error

---

## Security Considerations

### 1. Service Role Key Protection
- Never expose in client-side code
- Store in environment variables only
- Rotate regularly
- Log all admin operations

### 2. Email Verification
- Rate limit resend requests
- Track verification status
- Enforce before sensitive operations

### 3. Independent User Limits
- Consider rate limits on case creation
- Monitor for abuse
- Add reporting mechanism

---

## Performance Considerations

### 1. Tenant Mapping
- Cache default tenant ID
- Use constant instead of query
- Index on user_tier for fast lookups

### 2. Empty State
- Lazy load empty state component
- Minimize initial render time
- Optimize SVG animations

---

## Brand Alignment

### Forensic Constraints
- ✅ Sandbox Node designation clearly stated
- ✅ Export restrictions until verified
- ✅ Professional empty state (not "broken")
- ✅ Clear value proposition

### Intellectual Honesty
- ✅ No false promises
- ✅ Clear limitations stated
- ✅ Professional tool positioning
- ✅ Forensic provenance maintained

---

## Next Steps

1. **Implement Database Migration** - Run in development first
2. **Update Backend Routes** - Start with sign-up handler
3. **Create Frontend Components** - Segmented control + empty state
4. **Add Email Verification** - Nag bar + restrictions
5. **Test End-to-End** - All scenarios
6. **Deploy to Staging** - User acceptance testing

---

**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Time:** 1-2 days with refinements

