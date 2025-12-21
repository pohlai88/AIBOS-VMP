Alright — given your constraints (**AHA**, **3-week MVP**, **micro-team**, **multi-tenant/multi-company**, and you *don’t* want framework bloat), my best recommendation is:

## ✅ Recommended Backend: **Standalone VMP Service (Node + Express + Server Templates)**

**Stack**

* **Node.js (ESM)**
* **Express**
* **Nunjucks** (or EJS) for server-rendered HTML
* **HTMX + Alpine (CDN)** on the client
* **Supabase Postgres** as the database (direct `pg` connection, not heavy ORM)
* **Storage**: Supabase Storage (or S3) for evidence files
* **Sessions**: signed cookie + server session table

### Why this is the best fit for *your* situation

1. **Fastest path to shipping**: no bundler, no hydration, no build pipeline drama.
2. **Matches LEGO/hexagonal**: VMP becomes its own “Canon service” behind the AI-BOS gateway.
3. **Security by design**: server renders what exists; forbidden actions never ship to browser.
4. **Multi-tenant/multi-company is easier**: enforced at request context + query layer.
5. **You avoid Next/React complexity** but still keep your AI-BOS system clean.

---

## Alternatives (and why I’m not choosing them for MVP)

### Option B — Next.js server-rendered with HTMX

Works, but you still inherit Next’s routing/build conventions + more moving parts than needed.

### Option C — Fastify/Hono

Also good, but Express has the most “copy-paste velocity” with Copilot and the least friction.

So: **Express + templates wins for speedboat MVP.**

---

# What we lock now (5 decisions)

### 1) **VMP is a separate service**

* Path: `apps/vmp`
* Deployed behind your AI-BOS gateway like: `/vmp/*`

### 2) **Truth objects (tables) are the spine**

* `cases`, `messages`, `evidence`, `checklist_steps`, `sessions`, `invites`

### 3) **Every upload attaches to a Case**

No orphan uploads. Ever.

### 4) **AHA rule**

* HTMX swaps partials
* Alpine only does tiny UI toggles (tabs, drawer)
* All business logic stays server-side

### 5) **ERP integrations are ports**

Invoice/payment/SOA can be mocked initially. No MVP blocking.

---

# Folder structure (clean + LEGO-compatible)

```txt
apps/vmp/
  src/
    server.js                 # Express bootstrap
    http/
      pages.routes.js         # /login /home /cases/:id ...
      partials.routes.js      # /partials/case-inbox etc
      actions.routes.js       # POST messages/upload/escalate
    domain/
      case.service.js         # business rules (server truth)
      evidence.service.js
      permissions.service.js
    ports/
      invoice.read.port.js    # interface
      payment.read.port.js
    adapters/
      repo.supabase.pg.js     # repositories via pg
      storage.supabase.js     # evidence storage
      auth.local.js           # invite/login/session
    views/
      layout.html
      pages/
        login.html
        accept.html
        home.html
        case.html
      partials/
        case_inbox.html
        case_detail.html
        case_thread.html
        case_checklist.html
        case_evidence.html
        escalation.html
    public/
      globals.css
  package.json
```

This keeps your **Canon logic isolated** from HTTP/UI, which is exactly your LEGO doctrine.

---

# Endpoint map (what we’ll actually build)

### Pages (full shell)

* `GET /login`
* `GET /accept?token=...`
* `GET /home`
* `GET /cases/:id`

### Partials (HTMX cells)

* `GET /partials/case-inbox`
* `GET /partials/case-detail?case_id=...`
* `GET /partials/case-thread?case_id=...`
* `GET /partials/case-checklist?case_id=...`
* `GET /partials/case-evidence?case_id=...`
* `GET /partials/escalation?case_id=...`

### Actions

* `POST /cases/:id/messages`
* `POST /cases/:id/evidence` (multipart)
* `POST /cases/:id/escalate`
* (internal) `POST /cases/:id/verify-evidence`

---

# Auth model (best for vendor portal MVP)

For speed + control, use **Invite → Accept → Password**:

* `invites` table has token + vendor_id + company_id + expiry
* `/accept?token=...` creates vendor user + session
* `/login` normal email/password thereafter
* sessions stored in DB (so you can revoke)

This avoids tricky SSR auth wiring and keeps vendor onboarding “enterprise realistic”.

---

# What I need from you (one-time, no debate)

Pick **one**:

1. **Use Supabase Postgres + Storage** (recommended)
2. Or local Postgres + local disk storage for MVP

If you say “Supabase”, we proceed immediately.

---

## Next step (what I will produce next message)

I’ll output a **full MVP starter kit** (copy-paste):

* `server.js` + route files
* Nunjucks templates for `/login`, `/home`, and the 6 partials
* Minimal SQL schema for the 6 tables
* A seed script that generates 3 demo cases + threads

Just reply with:
**“Supabase”** or **“Local Postgres”** and I’ll lock the starter kit accordingly.
