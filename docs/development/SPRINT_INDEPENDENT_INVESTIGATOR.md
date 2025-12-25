# Sprint: Independent Investigator Track

**Date:** 2025-12-22  
**Status:** Planning  
**Goal:** Enable individual users to sign up and use the platform immediately without organization approval

---

## Sprint Overview

### Objective
Implement a dual-track sign-up system:
1. **Institutional Node** - Requires organization approval (existing flow)
2. **Independent Investigator** - Immediate access, no approval needed

### Key Requirements
- ✅ Segmented control UI for tier selection
- ✅ Database schema updates (nullable vendor_id, user_tier field)
- ✅ Backend validation logic
- ✅ Immediate platform access for independent users
- ✅ Forensic branding/constraints for independent accounts

---

## Sprint Breakdown

### Phase 1: Database Schema Updates

#### Task 1.1: Create Migration for User Tier Support
**File:** `migrations/030_vmp_independent_investigators.sql`

**Changes:**
1. Add `user_tier` column to `vmp_vendor_users` (or create new table structure)
2. Make `vendor_id` nullable in `vmp_vendor_users`
3. Create default "Independent" tenant (or allow null tenant)
4. Add constraints and indexes

**SQL Structure:**
```sql
-- Add user_tier column
ALTER TABLE vmp_vendor_users 
ADD COLUMN IF NOT EXISTS user_tier TEXT DEFAULT 'institutional' 
CHECK (user_tier IN ('institutional', 'independent'));

-- Make vendor_id nullable (for independent users)
ALTER TABLE vmp_vendor_users 
ALTER COLUMN vendor_id DROP NOT NULL;

-- Add constraint: independent users must have null vendor_id
ALTER TABLE vmp_vendor_users 
ADD CONSTRAINT check_independent_no_vendor 
CHECK (
  (user_tier = 'independent' AND vendor_id IS NULL) OR
  (user_tier = 'institutional' AND vendor_id IS NOT NULL)
);

-- Create default "Independent Investigators" tenant
INSERT INTO vmp_tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Independent Investigators')
ON CONFLICT (id) DO NOTHING;

-- Add index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_tier ON vmp_vendor_users(user_tier);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_vendor_id_null ON vmp_vendor_users(vendor_id) WHERE vendor_id IS NULL;
```

**Dependencies:** None  
**Estimated Time:** 1 hour

---

### Phase 2: Backend Implementation

#### Task 2.1: Update Sign-Up Route Handler
**File:** `server.js` (POST `/sign-up`)

**Changes:**
1. Accept `user_tier` from request
2. Validate tier selection
3. Conditional organization requirement
4. Create Supabase Auth user
5. Create vendor_user record with appropriate tier
6. For independent: Create session immediately and redirect to home
7. For institutional: Store access request (existing flow)

**Implementation:**
```javascript
app.post('/sign-up', async (req, res) => {
  try {
    const { 
      email, 
      name, 
      company, 
      customer_company, 
      message,
      user_tier = 'institutional' // Default to institutional
    } = req.body;

    // Validate tier
    if (!['institutional', 'independent'].includes(user_tier)) {
      return res.render('pages/sign_up.html', {
        error: 'Invalid access tier selected',
        success: null
      });
    }

    // Conditional validation
    if (user_tier === 'institutional') {
      // Institutional: Require organization
      if (!validateRequired(company, 'company')) {
        return res.render('pages/sign_up.html', {
          error: 'Organization name is required for Institutional Nodes',
          success: null
        });
      }
    } else {
      // Independent: No organization required
      // Clear any organization value
      company = null;
    }

    // Email validation
    if (!validateRequired(email, 'email')) {
      return res.render('pages/sign_up.html', {
        error: 'Email is required',
        success: null
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('pages/sign_up.html', {
        error: 'Please enter a valid email address',
        success: null
      });
    }

    // Handle Independent Investigator track
    if (user_tier === 'independent') {
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabaseAuth.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        email_confirm: true, // Auto-confirm for independent users
        user_metadata: {
          display_name: name.trim(),
          user_tier: 'independent',
          is_active: true
        }
      });

      if (authError || !authData.user) {
        logError(authError, { path: req.path, operation: 'create-independent-user' });
        return res.render('pages/sign_up.html', {
          error: 'Failed to create account. Please try again.',
          success: null
        });
      }

      // Create vendor_user record (without vendor_id)
      const { data: vendorUser, error: userError } = await supabase
        .from('vmp_vendor_users')
        .insert({
          email: email.toLowerCase().trim(),
          display_name: name.trim(),
          user_tier: 'independent',
          vendor_id: null, // Independent users have no vendor
          is_active: true
        })
        .select()
        .single();

      if (userError || !vendorUser) {
        logError(userError, { path: req.path, operation: 'create-vendor-user-independent' });
        // Clean up Supabase Auth user if vendor_user creation fails
        await supabaseAuth.auth.admin.deleteUser(authData.user.id);
        return res.render('pages/sign_up.html', {
          error: 'Failed to create account. Please try again.',
          success: null
        });
      }

      // Create session and log user in immediately
      req.session.userId = vendorUser.id;
      req.session.authToken = authData.session?.access_token || null;
      req.session.save((err) => {
        if (err) {
          logError(err, { path: req.path, operation: 'createSession-independent' });
          return res.render('pages/sign_up.html', {
            error: 'Account created but failed to log in. Please try logging in.',
            success: null
          });
        }
        // Redirect to home immediately
        res.redirect('/home?welcome=independent');
      });
      return;
    }

    // Institutional track (existing flow)
    // Store access request
    try {
      const { error: insertError } = await supabase
        .from('vmp_access_requests')
        .insert({
          email: email.toLowerCase().trim(),
          name: name.trim(),
          company: company.trim(),
          customer_company: customer_company?.trim() || null,
          message: message?.trim() || null,
          status: 'pending',
          user_tier: 'institutional'
        });

      if (insertError) {
        logError(insertError, { path: req.path, operation: 'store-access-request' });
      }
    } catch (dbError) {
      logError(dbError, { path: req.path, operation: 'store-access-request' });
    }

    // Show success message
    res.render('pages/sign_up.html', {
      error: null,
      success: 'Your access request has been submitted. An administrator will review your request and send an invitation email if approved.'
    });
  } catch (error) {
    logError(error, { path: req.path, operation: 'sign-up' });
    res.render('pages/sign_up.html', {
      error: 'An error occurred. Please try again later.',
      success: null
    });
  }
});
```

**Dependencies:** Task 1.1  
**Estimated Time:** 2 hours

---

#### Task 2.2: Update Adapter Methods
**File:** `src/adapters/supabase.js`

**Changes:**
1. Update `getVendorContext()` to handle null vendor_id
2. Add method to create independent user
3. Update user queries to handle independent tier

**Implementation:**
```javascript
// Update getVendorContext to handle independent users
async getVendorContext(authUserId) {
  // Get user from Supabase Auth
  const { data: { user }, error } = await supabase.auth.admin.getUserById(authUserId);
  
  if (error || !user) {
    return null;
  }
  
  const userTier = user.user_metadata?.user_tier || 'institutional';
  
  // For independent users, vendor_id is null
  if (userTier === 'independent') {
    // Get vendor_user record (without vendor)
    const { data: vendorUser } = await supabase
      .from('vmp_vendor_users')
      .select('*')
      .eq('email', user.email)
      .eq('user_tier', 'independent')
      .is('vendor_id', null)
      .single();
    
    if (!vendorUser) {
      return null;
    }
    
    return {
      id: vendorUser.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || vendorUser.display_name,
      vendor_id: null,
      vmp_vendors: null,
      user_tier: 'independent',
      is_internal: false,
      is_active: vendorUser.is_active !== false
    };
  }
  
  // Institutional users (existing logic)
  const vendorId = user.user_metadata?.vendor_id;
  const vendor = await this.getVendorById(vendorId);
  
  return {
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name,
    vendor_id: vendorId,
    vmp_vendors: vendor,
    user_tier: 'institutional',
    is_internal: user.user_metadata?.is_internal || false,
    is_active: user.user_metadata?.is_active !== false
  };
}
```

**Dependencies:** Task 1.1  
**Estimated Time:** 1.5 hours

---

#### Task 2.3: Update Route Helpers
**File:** `src/utils/route-helpers.js`

**Changes:**
1. Update `requireAuth()` to handle independent users
2. Add helper to check user tier
3. Update vendor context checks

**Implementation:**
```javascript
// Add helper to check user tier
export function getUserTier(req) {
  return req.user?.user_tier || 'institutional';
}

// Update requireAuth to handle independent users
export function requireAuth(req, res) {
  if (!req.user) {
    res.status(401).redirect('/login');
    return false;
  }
  
  // Independent users don't need vendor context
  if (req.user.user_tier === 'independent') {
    return true;
  }
  
  // Institutional users need vendor context
  if (!req.user.vendorId) {
    res.status(403).render('pages/error.html', {
      error: { status: 403, message: 'Access denied. Vendor context required.' }
    });
    return false;
  }
  
  return true;
}
```

**Dependencies:** Task 2.2  
**Estimated Time:** 1 hour

---

### Phase 3: Frontend Implementation

#### Task 3.1: Update Sign-Up Page UI
**File:** `src/views/pages/sign_up.html`

**Changes:**
1. Add segmented control for tier selection
2. Conditional organization field visibility
3. Add forensic branding message for independent users
4. Update form validation JavaScript

**UI Components:**
```html
<!-- Tier Selector -->
<div class="tier-selector">
  <div class="tier-buttons">
    <button type="button" class="tier-btn active" id="tier-institutional" onclick="setTier('institutional')">
      <span class="tier-icon">🏢</span>
      <span class="tier-label">Institutional Node</span>
      <span class="tier-desc">Organization-based access</span>
    </button>
    <button type="button" class="tier-btn" id="tier-independent" onclick="setTier('independent')">
      <span class="tier-icon">🔬</span>
      <span class="tier-label">Independent Investigator</span>
      <span class="tier-desc">Immediate access, no approval</span>
    </button>
  </div>
  <input type="hidden" name="user_tier" id="user_tier_input" value="institutional">
</div>

<!-- Independent User Notice -->
<div id="independent-notice" class="forensic-notice" style="display: none;">
  <div class="notice-icon">⚠️</div>
  <div class="notice-content">
    <strong>Sandbox Node Designation</strong>
    <p>Independent accounts are designated as <strong>Sandbox Nodes</strong>. All forensic reasoning is stored locally and cannot be used for multi-party financial settlement without Institutional Verification.</p>
  </div>
</div>

<!-- Organization Field (Conditional) -->
<div id="org-container" class="input-group">
  <label for="company">Organization Name <span class="required">*</span></label>
  <input type="text" id="company" name="company" required>
</div>
```

**JavaScript:**
```javascript
function setTier(tier) {
  const isInstitutional = (tier === 'institutional');
  
  // Update button states
  document.getElementById('tier-institutional').classList.toggle('active', isInstitutional);
  document.getElementById('tier-independent').classList.toggle('active', !isInstitutional);
  
  // Update hidden input
  document.getElementById('user_tier_input').value = tier;
  
  // Toggle organization field
  const orgContainer = document.getElementById('org-container');
  const orgInput = document.getElementById('company');
  const independentNotice = document.getElementById('independent-notice');
  
  if (isInstitutional) {
    orgContainer.style.display = 'block';
    orgInput.setAttribute('required', 'required');
    independentNotice.style.display = 'none';
  } else {
    orgContainer.style.display = 'none';
    orgInput.removeAttribute('required');
    orgInput.value = '';
    independentNotice.style.display = 'block';
  }
}
```

**CSS (Add to existing styles):**
```css
.tier-selector {
  margin-bottom: 2rem;
}

.tier-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tier-btn {
  background: rgba(255, 255, 255, .02);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 14px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.tier-btn:hover {
  background: rgba(255, 255, 255, .04);
  border-color: rgba(255, 255, 255, .12);
}

.tier-btn.active {
  background: rgba(96, 255, 198, .08);
  border-color: hsl(155, 100%, 69%);
  box-shadow: 0 0 20px rgba(96, 255, 198, .1);
}

.tier-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.tier-label {
  display: block;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #fff;
}

.tier-desc {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, .5);
}

.forensic-notice {
  background: rgba(255, 193, 7, .08);
  border: 1px solid rgba(255, 193, 7, .2);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notice-content strong {
  display: block;
  color: #ffc107;
  margin-bottom: 4px;
  font-size: 13px;
}

.notice-content p {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, .7);
  line-height: 1.5;
}
```

**Dependencies:** None  
**Estimated Time:** 2 hours

---

### Phase 4: Home Page Updates

#### Task 4.1: Handle Independent User Welcome
**File:** `server.js` (GET `/home`)

**Changes:**
1. Check for `?welcome=independent` query param
2. Show welcome message for independent users
3. Handle null vendor context gracefully

**Implementation:**
```javascript
async function renderHomePage(req, res) {
  try {
    // Handle independent users (no vendor context needed)
    if (req.user?.user_tier === 'independent') {
      return res.render('pages/home5.html', {
        user: req.user,
        actionCount: 0,
        openCount: 0,
        soaCount: 0,
        paidCount: 0,
        welcomeMessage: req.query.welcome === 'independent' ? 'Welcome! Your Independent Investigator account is ready.' : null
      });
    }

    // Existing institutional user logic...
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
    // ... rest of existing code
  } catch (error) {
    // ... error handling
  }
}
```

**Dependencies:** Task 2.2  
**Estimated Time:** 30 minutes

---

### Phase 5: Testing & Validation

#### Task 5.1: Create Test Cases
**File:** `docs/development/INDEPENDENT_INVESTIGATOR_TESTS.md`

**Test Scenarios:**
1. ✅ Independent user sign-up → Immediate access
2. ✅ Institutional user sign-up → Access request stored
3. ✅ Tier switching in UI → Fields show/hide correctly
4. ✅ Independent user login → Works without vendor
5. ✅ Independent user accessing protected routes → Works
6. ✅ Database constraints → Independent users have null vendor_id

**Dependencies:** All previous tasks  
**Estimated Time:** 1 hour

---

## Sprint Timeline

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|----------------|--------------|
| 1. Database | 1.1 | 1 hour | None |
| 2. Backend | 2.1, 2.2, 2.3 | 4.5 hours | Phase 1 |
| 3. Frontend | 3.1 | 2 hours | None |
| 4. Home Page | 4.1 | 0.5 hours | Phase 2 |
| 5. Testing | 5.1 | 1 hour | All phases |
| **Total** | | **9 hours** | |

---

## Implementation Order

1. **Database Migration** (Task 1.1) - Foundation
2. **Backend Sign-Up Route** (Task 2.1) - Core functionality
3. **Adapter Updates** (Task 2.2) - Support independent users
4. **Route Helpers** (Task 2.3) - Auth middleware
5. **Frontend UI** (Task 3.1) - User interface
6. **Home Page** (Task 4.1) - Welcome flow
7. **Testing** (Task 5.1) - Validation

---

## Success Criteria

- ✅ Independent users can sign up without organization
- ✅ Independent users get immediate platform access
- ✅ Institutional flow remains unchanged
- ✅ UI clearly distinguishes between tiers
- ✅ Database constraints enforce tier rules
- ✅ All existing functionality works for both tiers

---

## Risk Mitigation

### Risk 1: Breaking Existing Institutional Flow
**Mitigation:** Keep institutional flow as default, add independent as new path

### Risk 2: Database Schema Changes
**Mitigation:** Use nullable columns, add constraints, test migrations thoroughly

### Risk 3: Auth Middleware Issues
**Mitigation:** Update helpers to handle both tiers, test all protected routes

---

## Next Steps

1. Review and approve sprint plan
2. Create database migration file
3. Implement backend changes
4. Update frontend UI
5. Test end-to-end flows
6. Deploy to staging
7. User acceptance testing

---

**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Completion:** 1-2 days

