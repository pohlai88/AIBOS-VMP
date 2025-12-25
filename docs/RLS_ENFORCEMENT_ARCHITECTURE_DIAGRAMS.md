# RLS Enforcement: Visual Architecture Diagram

## End-to-End Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER LOGS IN                                        │
│                    POST /login (email + password)                            │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE AUTH VALIDATES                                 │
│                                                                              │
│  signInWithPassword({email, password})                                       │
│    ├─ Validates against vmp_vendor_users table                             │
│    ├─ Checks bcrypt password_hash                                          │
│    └─ Returns: JWT (access_token) + refresh_token                          │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS SESSION STORES JWT                                │
│                                                                              │
│  req.session.authToken = access_token  (PostgreSQL session table)           │
│  req.session.refreshToken = refresh_token                                   │
│  req.session.userId = supabase_auth_user_id                                │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                       (User navigates /vendor/cases)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               MIDDLEWARE: ATTACH RLS-ENFORCED CLIENT                         │
│                                                                              │
│  app.use(attachSupabaseClient)  // Applied AFTER session                   │
│                                                                              │
│  Creates:                                                                    │
│    req.supabase = createClient(                                             │
│      SUPABASE_URL,                                                          │
│      SUPABASE_ANON_KEY  ← RLS enforced (NOT service_role)                  │
│    )                                                                         │
│                                                                              │
│  Sets JWT:                                                                   │
│    req.supabase.auth.setAuth(req.session.authToken)                         │
│    └─ Binds JWT to this request's Supabase client                          │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ROUTE HANDLER QUERIES DATABASE                             │
│                                                                              │
│  app.get('/vendor/cases/:id', async (req, res) => {                        │
│    const { data } = await req.supabase  // User-scoped client              │
│      .from('vmp_cases')                                                    │
│      .select('*')                                                           │
│      .eq('id', req.params.id);                                             │
│    res.json(data);                                                          │
│  });                                                                         │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUPABASE SENDS QUERY WITH JWT TO POSTGRES                      │
│                                                                              │
│  Query: SELECT * FROM vmp_cases WHERE id = ?                               │
│  Context: Authorization header contains JWT                                 │
│  JWT contains: sub = supabase_auth_user_id                                 │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           POSTGRES EVALUATES RLS POLICY + HELPER FUNCTIONS                  │
│                                                                              │
│  1. Extract auth.uid() from JWT → supabase_auth_user_id                    │
│                                                                              │
│  2. Call RLS helper function:                                               │
│     SELECT get_user_vendor_id()                                             │
│       ├─ Join: vmp_auth_user_mapping                                       │
│       │   WHERE auth_user_id = auth.uid()                                  │
│       ├─ Join: vmp_vendor_users                                            │
│       └─ Return: user's vendor_id (UUID)                                   │
│                                                                              │
│  3. Call another helper:                                                    │
│     SELECT get_user_company_ids()                                           │
│       ├─ Find vmp_vendor_users row for this auth.uid()                     │
│       ├─ Use scope_group_id OR scope_company_id                            │
│       ├─ Find all companies in that scope                                  │
│       └─ Return: array of company_ids                                      │
│                                                                              │
│  4. Apply RLS POLICY to query result:                                       │
│     SELECT * FROM vmp_cases                                                │
│     WHERE id = ? AND (                                                      │
│       vendor_id = get_user_vendor_id()  ← Own vendor?              [YES]   │
│       OR                                                                    │
│       company_id IN (get_user_company_ids())  ← Authorized companies? [?] │
│     );                                                                      │
│                                                                              │
│  5. RESULT:                                                                  │
│     ✅ Case found AND user can access → Return data                         │
│     ❌ Case not found OR RLS denies → Return 0 rows                        │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  EXPRESS RETURNS RESPONSE TO CLIENT                          │
│                                                                              │
│  Case found + authorized:                                                   │
│    ✅ HTTP 200 + case data JSON                                             │
│                                                                              │
│  Case not found or unauthorized:                                            │
│    ❌ HTTP 404 Not Found (NOT 403 - prevents enumeration)                   │
│                                                                              │
│  Any database error:                                                        │
│    ⚠️  HTTP 500 Internal Server Error                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Access Control Pyramid

```
┌────────────────────────────────────────────────────────────────┐
│                   POSTGRES RLS POLICIES                         │
│                   (Enforced at DB level)                        │
│                                                                  │
│  Policies:                                                       │
│  - vmp_cases: vendor_id = get_user_vendor_id()                │
│  - vmp_messages: can_access_case(case_id) = true              │
│  - vmp_evidence: can_access_case(case_id) = true              │
│  - vmp_payments: vendor_id = get_user_vendor_id()             │
│                                                                  │
│  Result: Unauthorized rows NEVER leave Postgres               │
├────────────────────────────────────────────────────────────────┤
│              SUPABASE HELPER FUNCTIONS                          │
│            (Postgres-level authorization logic)                 │
│                                                                  │
│  Functions:                                                      │
│  - get_user_vendor_id() → Maps JWT → vendor_id                │
│  - get_user_company_ids() → Maps JWT → authorized companies   │
│  - can_access_case(id) → Checks vendor OR company access      │
│  - get_user_tenant_id() → Ensures tenant isolation            │
│                                                                  │
│  Result: Policies use these functions for authorization       │
├────────────────────────────────────────────────────────────────┤
│                  SUPABASE CLIENT + JWT                          │
│              (Bound at request middleware level)                │
│                                                                  │
│  Middleware:                                                     │
│  - Reads JWT from req.session.authToken                        │
│  - Creates Supabase client with ANON_KEY (RLS enforced)       │
│  - Calls client.auth.setAuth(jwt)                              │
│  - Attaches to req.supabase                                    │
│                                                                  │
│  Result: JWT travels with every request                        │
├────────────────────────────────────────────────────────────────┤
│                    SUPABASE AUTH JWT                            │
│            (Created at login, stored in session)                │
│                                                                  │
│  Login:                                                          │
│  - Validates email + password                                   │
│  - Returns JWT with sub = supabase_auth_user_id               │
│  - Stored in req.session.authToken (HttpOnly cookie)          │
│                                                                  │
│  Result: Each user has unique JWT identifying them            │
└────────────────────────────────────────────────────────────────┘
```

---

## Tenant & Vendor Isolation Model

```
┌──────────────────────────────────────────────────────────────────┐
│                   MULTI-TENANT ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Tenant A (Company perspective)                                   │
│  ├─ vmp_tenants.id = tenant-a-uuid                              │
│  ├─ vmp_companies (Companies in Tenant A)                        │
│  │  ├─ Company X (buyer)                                         │
│  │  └─ Company Y (buyer)                                         │
│  ├─ vmp_vendors (Suppliers for Tenant A)                        │
│  │  ├─ Vendor A (supplier)                                       │
│  │  └─ Vendor B (supplier)                                       │
│  └─ vmp_cases                                                    │
│     ├─ Case 1: vendor_id=A, company_id=X, tenant_id=A          │
│     ├─ Case 2: vendor_id=B, company_id=Y, tenant_id=A          │
│                                                                    │
│  Tenant B (Different tenant - ISOLATED)                          │
│  ├─ vmp_tenants.id = tenant-b-uuid                              │
│  ├─ vmp_companies (Companies in Tenant B)                        │
│  │  └─ Company Z (buyer)                                         │
│  ├─ vmp_vendors (Suppliers for Tenant B)                        │
│  │  └─ Vendor C (supplier)                                       │
│  └─ vmp_cases                                                    │
│     └─ Case 3: vendor_id=C, company_id=Z, tenant_id=B          │
│                                                                    │
│  Isolation: Tenant A user can NEVER see Tenant B data           │
│            (RLS policy: tenant_id = get_user_tenant_id())       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              VENDOR ↔ COMPANY RELATIONSHIP MODEL                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  vmp_vendor_company_links (Many-to-many authorization)           │
│  ├─ vendor_id: Vendor A                                          │
│  ├─ company_id: Company X                                        │
│  └─ status: 'active' (Vendor A is authorized supplier for Co X) │
│                                                                    │
│  Case Access Logic:                                              │
│  ┌─ Vendor A user querying cases:                               │
│  │  SELECT * FROM vmp_cases                                     │
│  │  WHERE vendor_id = A                      ✅ Own vendor      │
│  │     OR company_id IN (                                       │
│  │        SELECT company_id FROM                                │
│  │        vmp_vendor_company_links                              │
│  │        WHERE vendor_id = A                                   │
│  │     )                                      ✅ Authorized co  │
│  │                                                               │
│  └─ Result: Can see cases where:                                │
│     - Vendor A is supplier (vendor_id=A)                         │
│     - OR Vendor A works with that company (linked)              │
│                                                                    │
│  Isolation Guarantees:                                           │
│  - Vendor A cannot see cases from Vendor B                       │
│  - Vendor A cannot see cases where they're not linked            │
│  - Company users only see cases for their company               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Scope-Based Hierarchy (Director/Manager)

```
┌──────────────────────────────────────────────────────────────────┐
│                   SCOPE-BASED ACCESS CONTROL                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  vmp_vendor_users (User record)                                  │
│  ├─ id: user-uuid                                                │
│  ├─ vendor_id: vendor-uuid                                       │
│  ├─ email: user@vendor.com                                       │
│  ├─ scope_company_id: company-1 (direct access)                │
│  └─ scope_group_id: group-123 (group-level access)             │
│                                                                    │
│  Manager/Director View (scope_group_id):                         │
│  ┌─ Director is member of group-123                            │
│  ├─ Group-123 includes companies: [Company X, Company Y]        │
│  └─ Director can see cases for ALL companies in group:          │
│     ├─ Cases with company_id = Company X  ✅                    │
│     ├─ Cases with company_id = Company Y  ✅                    │
│     └─ Cases with company_id = Company Z  ❌ (not in group)     │
│                                                                    │
│  Regular User View (scope_company_id):                           │
│  ┌─ User assigned to company-1 only                            │
│  └─ User can see:                                                │
│     ├─ Cases with company_id = Company 1  ✅                    │
│     └─ Cases with company_id ≠ Company 1  ❌                    │
│                                                                    │
│  RLS Helper Function:                                            │
│  SELECT DISTINCT c.id FROM vmp_companies c                      │
│  WHERE c.id = user.scope_company_id                             │
│     OR c.group_id = user.scope_group_id                         │
│                                                                    │
│  Result: Scope determines data visibility automatically         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Cascade Security: Messages & Evidence

```
┌──────────────────────────────────────────────────────────────────┐
│              CASCADE SECURITY: MESSAGES EXAMPLE                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  User can access Case A?                                         │
│  ├─ vendor_id = user's vendor ✅    ← YES                       │
│  └─ Result: User can see messages in Case A                     │
│                                                                    │
│  User can access Case B?                                         │
│  ├─ vendor_id ≠ user's vendor ❌                                │
│  ├─ company_id ∉ authorized companies ❌                        │
│  └─ Result: RLS blocks Case B                                   │
│     - SELECT * FROM vmp_messages WHERE case_id = B              │
│     - → RLS policy: can_access_case(B) = false                  │
│     - → Returns 0 messages (not "permission denied")             │
│                                                                    │
│  Benefits:                                                        │
│  ✅ No need to check authorization on each message              │
│  ✅ Single source of truth: case access                         │
│  ✅ Automatic for evidence, checklist, payments too             │
│  ✅ One bug fix fixes authorization across all child resources  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Anti-Enumeration: 404 vs 403

```
┌──────────────────────────────────────────────────────────────────┐
│           ANTI-ENUMERATION: 404 vs 403 COMPARISON                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ❌ BAD (403 Forbidden): Reveals data exists                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ User queries: GET /cases/{vendor-b-case-uuid}               ││
│  │ Response: 403 Forbidden                                      ││
│  │ Attacker inference: ✅ UUID exists, but I lack access      ││
│  │                     (Can enumerate valid UUIDs)             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ✅ GOOD (404 Not Found): Doesn't reveal data exists             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ User queries: GET /cases/{vendor-b-case-uuid}               ││
│  │ Response: 404 Not Found                                      ││
│  │ Attacker inference: ❓ UUID may not exist, or I lack        ││
│  │                     access (Cannot enumerate easily)         ││
│  │                                                               ││
│  │ How it works:                                                ││
│  │ 1. RLS query returns 0 rows (case filtered by RLS)           ││
│  │ 2. Express checks: if (!data) → res.status(404)             ││
│  │ 3. Same response for "case exists but denied" vs            ││
│  │    "case doesn't exist" (indistinguishable)                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                    │
│  Current VMP Implementation:                                     │
│  ✅ RLS query returns 0 rows for unauthorized cases             │
│  ✅ Express returns 404 (anti-enumeration)                      │
│  ✅ No information leak (attacker can't tell why denied)        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                         MULTIPLE DEFENSE LAYERS                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Layer 1: Express Route Guards                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ app.get('/vendor/cases/:id', requireAuth, async (req, res) => {  │  │
│  │   // Guard 1: requireAuth middleware checks session              │  │
│  │   if (!req.session?.userId) return 401;                          │  │
│  │ });                                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Layer 2: Express Application Logic                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ const data = await req.supabase.from('vmp_cases')              │  │
│  │   .select('*').eq('id', id);                                    │  │
│  │ // Guard 2: Check if case exists (RLS filtered)                │  │
│  │ if (!data) return 404;                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Layer 3: Database RLS Policies                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL RLS evaluates:                                        │  │
│  │   vendor_id = get_user_vendor_id()                             │  │
│  │   OR company_id IN (get_user_company_ids())                    │  │
│  │                                                                  │  │
│  │ // Guard 3: Postgres blocks unauthorized rows before           │  │
│  │ // they reach Express (most important layer)                   │  │
│  │                                                                  │  │
│  │ Result: Even if Express layer has bug, RLS prevents            │  │
│  │ unauthorized data access                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Why multiple layers matter:                                            │
│  ✅ Layer 1 (Auth): Ensures user identity is valid                     │
│  ✅ Layer 2 (App): Ensures response is not leaked via 403              │
│  ✅ Layer 3 (DB): Ensures query result is actually filtered            │
│  ✅ Even if Layer 1-2 have bugs, Layer 3 prevents data leak            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                         BROWSER                                           │
│                       (user@vendor.com)                                   │
│                                                                            │
│                              │                                            │
│                              │ POST /login                               │
│                              │ email + password                          │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      EXPRESS                                      │    │
│  │                      SERVER                                       │    │
│  │                                                                   │    │
│  │  /login route                                                    │    │
│  │  ├─ Call: supabaseAuth.auth.signInWithPassword()                │    │
│  │  ├─ Store JWT: req.session.authToken = JWT                      │    │
│  │  └─ Redirect: /home                                             │    │
│  │                                                                   │    │
│  │  Middleware (attachSupabaseClient)                              │    │
│  │  ├─ Read: req.session.authToken                                │    │
│  │  ├─ Create: req.supabase = createClient(ANON_KEY)              │    │
│  │  └─ Set: req.supabase.auth.setAuth(JWT)                        │    │
│  │                                                                   │    │
│  │  /vendor/cases/:id route                                        │    │
│  │  ├─ Query: req.supabase.from('vmp_cases').select(...)         │    │
│  │  ├─ Result: RLS filtered data                                  │    │
│  │  └─ Return: 200 (if data) or 404 (if no data)                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              │                                            │
│                              │ HTTP requests with                        │
│                              │ session cookie                            │
│                              │ (contains JWT)                            │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    SUPABASE                                      │    │
│  │                                                                   │    │
│  │  Auth service                                                    │    │
│  │  ├─ Validate password against Postgres                          │    │
│  │  ├─ Issue JWT with sub = auth.uid()                             │    │
│  │  └─ Store in auth.users table                                   │    │
│  │                                                                   │    │
│  │  JS Client (with JWT set)                                       │    │
│  │  ├─ Include JWT in Authorization header                         │    │
│  │  ├─ Send queries to Postgres                                    │    │
│  │  └─ Return filtered results                                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              │                                            │
│                              │ Queries with JWT                          │
│                              │ in Authorization header                   │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                     POSTGRES RLS                                 │    │
│  │                                                                   │    │
│  │  Extract JWT context: auth.uid() = user_id                      │    │
│  │                                                                   │    │
│  │  Call helper functions:                                          │    │
│  │  ├─ get_user_vendor_id() → vendor-a-uuid                        │    │
│  │  ├─ get_user_company_ids() → [company-x-uuid, ...]            │    │
│  │  └─ get_user_tenant_id() → tenant-a-uuid                       │    │
│  │                                                                   │    │
│  │  Apply RLS policies:                                             │    │
│  │  WHERE vendor_id = vendor-a-uuid                                │    │
│  │     OR company_id IN [company-x-uuid, ...]                      │    │
│  │                                                                   │    │
│  │  Return: Only authorized rows                                    │    │
│  │  (Unauthorized rows are never sent to Express)                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                              │                                            │
│                              │ Filtered results                          │
│                              │ (already RLS-checked)                     │
│                              ▼                                            │
│                         EXPRESS                                           │
│                       (formats response)                                  │
│                              │                                            │
│                              │ JSON response                             │
│                              ▼                                            │
│                         BROWSER                                           │
│                    (displays case detail)                                │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: What Changed

```
BEFORE (RLS Bypassed):
┌─────────────────────────────────────────┐
│ Express                                  │
├─────────────────────────────────────────┤
│ const supabase = createClient(          │
│   URL,                                   │
│   SERVICE_ROLE_KEY  ← BYPASSES RLS!     │
│ );                                       │
│                                          │
│ All routes use this client               │
│ RLS policies: IGNORED                    │
│ Vendor A can see Vendor B data (danger!)│
└─────────────────────────────────────────┘

AFTER (RLS Enforced):
┌─────────────────────────────────────────┐
│ Express                                  │
├─────────────────────────────────────────┤
│ Middleware creates:                      │
│   req.supabase = createClient(          │
│     URL,                                 │
│     ANON_KEY  ← RLS ENFORCED ✅         │
│   )                                      │
│   req.supabase.auth.setAuth(JWT)        │
│                                          │
│ All routes use req.supabase              │
│ RLS policies: ENFORCED                   │
│ Vendor A cannot see Vendor B data ✅    │
└─────────────────────────────────────────┘
```

---

**The RLS enforcement is complete and ready for deployment!** 🚀
