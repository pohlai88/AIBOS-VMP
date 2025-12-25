# AHA Wireframe Blueprint — NexusCanon VMP

> **Stack:** A = Alpine.js (micro‑state) · H = HTMX (HTML swaps) · A = Atom CSS/Tailwind or your BioSkin globals
>
> **Principle:** *Each VMP Cell is a server-rendered HTML partial. HTMX swaps Cells. Alpine only handles local UI state (drawers, tabs, filters).*  
> **Truth:** Server is authoritative. Browser is a viewport.

---

## 1) Information Architecture (minimal but complete)

### Supplier Portal (external)
1. **/accept** — Invite Accept + Account Setup
2. **/login** — Login
3. **/home** — Supplier Home (Posture + Case Inbox)
4. **/cases/:id** — Case Detail (Thread + Checklist + Evidence)
5. **/invoices** — Invoice List (read-only facade)
6. **/invoices/:id** — Invoice Detail (3-way status + attach evidence to Case)
7. **/payments** — Payment History + Remittance
8. **/profile** — Vendor profile (docs/bank change is gated)

### Internal Console (optional v0 view; can be hidden)
1. **/ops/cases** — Case Queue (Procurement/AP triage)
2. **/ops/cases/:id** — Case Detail (same cells, different permissions)
3. **/ops/vendors** — Vendor directory + onboarding status

---

## 2) Route → Cell Map (server endpoints)

### Full pages (layout + shell)
- `GET /login`
- `GET /accept?token=...`
- `GET /home`
- `GET /cases/:id`
- `GET /invoices`
- `GET /invoices/:id`

### Partials (Cells)
> HTMX targets these. Each returns a fragment only.

#### Collaboration Spine
- `GET /partials/case-inbox` → **VMP-03-01 Case Inbox Cell**
- `GET /partials/case-row?case_id=...` → (single row refresh)
- `GET /partials/case-detail?case_id=...` → **Case Detail Shell Cell**
- `GET /partials/case-thread?case_id=...` → **VMP-03-02 Thread Cell**
- `GET /partials/case-checklist?case_id=...` → **VMP-03-03 Checklist Cell**
- `GET /partials/case-evidence?case_id=...` → **VMP-05 Evidence List Cell**
- `GET /partials/case-actions?case_id=...` → **Quick actions (upload, escalate)**

#### Evidence
- `POST /cases/:id/messages` → append message; returns refreshed **Thread Cell**
- `POST /cases/:id/evidence` → upload; returns refreshed **Checklist + Evidence**

#### Invoice Facade
- `GET /partials/invoice-list` → **VMP-04-01**
- `GET /partials/invoice-detail?invoice_id=...` → **VMP-04-02**
- `GET /partials/matching-status?invoice_id=...` → **VMP-04-03** (adapter-backed)
- `POST /invoices/:id/open-case` → create/attach Case; returns redirect/fragment

#### Safety Valve
- `GET /partials/escalation` → **Escalation Cell**
- `POST /cases/:id/escalate` → sets escalation status; returns updated escalation panel

---

## 3) Wireframe Layout System (NexusCanon Command Surface)

### Global Shell (Page Layout)
**A. Left Rail (optional)**
- Brand sigil + tenant/company context
- Primary nav: Home / Cases / Invoices / Payments / Profile

**B. Command Surface (main)**
- Top: “The Connection · The Law” strip (posture + counts)
- Main split:
  - Left: Case Inbox / Lists
  - Right: Case Detail panel

**C. Persistent Elements**
- **Posture Pill:** ENFORCING / WARNING / BLOCK
- **Escalation Cell:** always visible (Level 1/2/3)

---

## 4) Screen Wireframes (AHA-ready)

### 4.1 Accept Invite (/accept)
**Goal:** supplier gets onboarded without WhatsApp/email chaos.

**Sections:**
1) Verify invite token (company relationship shown)
2) Set password / MFA (optional)
3) Supplier profile essentials
4) Required docs checklist (upload components)
5) Submit → land on /home

**Cells used:**
- Onboarding Checklist Cell (same engine as Case checklist)
- Evidence Upload Cell

---

### 4.2 Login (/login)
**Goal:** clean, minimal, premium.

**Sections:**
- Email + password
- Optional OTP
- “Need help?” link opens escalation info (read-only)

---

### 4.3 Supplier Home (/home)
**Purpose:** the daily landing. This kills WhatsApp.

**Top strip (“The Law”)**
- Evidence Chain: VALID / WARN / BLOCK
- Open Cases count
- Items waiting supplier

**Left column: Case Inbox**
- Tabs: Action Required / Waiting / Resolved
- Each row shows:
  - Case type + subject
  - Status pill
  - SLA due
  - Last message snippet

**Right column: Case Detail (empty state)**
- “Select a case to view thread & checklist.”

**Bottom: Escalation Cell**
- Level 1 AI agent
- Level 2 AP manager (ticket)
- Level 3 Break-glass contact

**HTMX behavior:**
- Inbox loads on page load
- Clicking a row loads Case Detail fragment

---

### 4.4 Case Detail (/cases/:id)
**Purpose:** this is 90% of usage.

**Header**
- Case title
- Status + owner team
- SLA timer

**Two-column interior**
- Left: **Checklist + Evidence panel**
  - Required evidence tiles
  - Upload action pinned
  - Evidence list
- Right: **Thread panel**
  - Messages (vendor/internal/AI)
  - Reply composer

**Actions bar**
- Upload evidence
- Mark resolved (internal only)
- Escalate

**HTMX behavior:**
- Posting message refreshes thread only
- Upload refreshes checklist+evidence only

---

### 4.5 Invoices (/invoices)
**Purpose:** read-only transparency.

**Invoice list**
- invoice no, date, amount
- matching state pill: READY / WARN / BLOCK
- CTA: “Open Case” (if blocked/warn)

**HTMX behavior:**
- List loads on page load
- Clicking invoice loads invoice detail (same page split view) OR navigates to /invoices/:id

---

### 4.6 Invoice Detail (/invoices/:id)
**Purpose:** show 3-way truth + route to action.

**Panels**
- Matching Status (PO/GRN/Invoice)
- Exceptions list (reason → action)
- “Attach missing evidence” action → uploads go to linked Case

---

### 4.7 Payments (/payments)
**Purpose:** adoption carrot.

**List**
- paid date, amount, ref
- remittance link

---

## 5) HTMX Interaction Blueprint (targets & swaps)

### 5.1 Home loads inbox
- `hx-get="/partials/case-inbox" hx-trigger="load" hx-target="#caseInbox"`

### 5.2 Selecting a case loads detail
- row anchor: `hx-get="/partials/case-detail?case_id=..." hx-target="#caseDetail"`

### 5.3 Message send updates thread only
- form target: `hx-target="#caseThread" hx-swap="innerHTML"`

### 5.4 Upload updates checklist + evidence
- upload returns a combined partial (checklist+evidence), target `#caseChecklist`

### 5.5 Polling (optional)
- `hx-trigger="every 20s"` for inbox row refresh
- Keep modest to avoid noise

---

## 6) Alpine usage (only micro-state)

Use Alpine for:
- Tabs (Action Required / Waiting / Resolved)
- Drawer open/close (mobile)
- Filter dropdown open/close

Do NOT use Alpine for:
- business rules
- permission checks
- invoice matching logic

---

## 7) Minimal File/Template Structure

```
apps/vmp/
  server/
    app.ts
    routes/
      pages.ts
      partials.ts
      actions.ts
    views/
      layout.html
      pages/
        login.html
        accept.html
        home.html
        invoices.html
        invoice_detail.html
        case_page.html
        payments.html
      partials/
        case_inbox.html
        case_detail.html
        case_thread.html
        case_checklist.html
        case_evidence.html
        matching_status.html
        escalation.html
  public/
    globals.css
```

---

## 8) Wireframe Component Inventory (Cells)

### Shell Components
- Surface
- Panel
- Rail (metrics)
- Pill (status)

### Case Components
- CaseRow
- CaseHeader
- Thread
- Composer
- Checklist
- EvidenceList
- Upload
- Escalation

### Invoice Components
- InvoiceRow
- MatchingStatus
- ExceptionList

---

## 9) Activation toggles (optional, keep simple)

- `FEATURE_INVOICES` (on/off)
- `FEATURE_PAYMENTS` (on/off)
- `FEATURE_SOA` (on/off)
- `FEATURE_WHATSAPP_PORT` (on/off pilot)

> Even if modules are off, keep navigation stable (disabled state) to avoid redesign later.

---

## 10) Next Deliverables (what to generate next)

1) **AHA HTML Wireframes Pack** (copy-paste):
   - /login
   - /accept
   - /home (split view)
   - /partials/case-inbox
   - /partials/case-detail
   - /partials/case-thread
   - /partials/case-checklist
   - /partials/escalation

2) **Ports/Adapters contracts** (thin):
   - invoice list + invoice detail + matching status

3) **Case schema** (minimal) + seed data for demo.

