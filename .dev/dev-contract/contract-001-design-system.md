# NexusCanon VMP Design System Contract

**Document ID:** CONTRACT-001  
**Title:** Design System Specification (GSS SSOT)  
**Version:** 2.1.0 (CURRENT - Figma Validated)  
**Date:** 2025-01-XX  
**Status:** Active (Updated with v2.0.0 Foundation vs. Design philosophy)  
**Owner:** NexusCanon VMP Development Team

---

## Abstract

This contract defines the **Single Source of Truth (SSOT)** for the NexusCanon Vendor Management Portal (VMP) design system. The system follows a **Foundation vs. Design** separation philosophy:

- **Foundation Layer (CSS)**: Typography hierarchy, spacing system, semantic color tokens
- **Design Layer (HTML/Templates)**: Full creative freedom for visual design, components, and effects

This approach ensures consistency where it matters (data presentation, typography) while allowing unlimited creative expression for visual design.

The foundation layer is scoped to `html[data-surface="vmp"]` and maintained in `public/globals.css`. The design layer allows inline styles and `<style>` blocks for creative work.

**CRITICAL RULES (v2.0.0):** 
- **Foundation Layer (Controlled):** Typography and spacing must use VMP semantic classes and tokens from `public/globals.css` - **ONLY for data presentation purposes**
- **Design Layer (Free Hand):** Inline styles and `<style>` blocks are **ALLOWED** for creative visual design - **Marketing and others have full freedom, no control**
- **NO CDS Template Design:** No prescriptive component templates or design system templates - visual components are free-form
- **NO SaaS Typical Design Model:** No typical SaaS design patterns, templates, or prescriptive UI models enforced
- No Tailwind custom config (CDN utilities only)

---

## 1. Architecture Overview

### 1.1 Foundation vs. Design Separation (v2.0.0)

The VMP design system separates **structural/functional concerns** (Foundation) from **visual/creative concerns** (Design):

#### Foundation Layer (CSS - `public/globals.css`)
**Purpose:** Ensure consistency for information architecture and **data presentation ONLY**

**Scope:** Only controls what is necessary for data presentation purposes

**Includes:**
- Typography hierarchy (`.vmp-h1` through `.vmp-h6`, `.vmp-body`, `.vmp-label`) - **For data presentation consistency**
- Spacing system (`--vmp-space-*` tokens) - **For data presentation consistency**
- Semantic color tokens (`--vmp-text`, `--vmp-ok`, `--vmp-danger` for meaning) - **For data presentation meaning**
- Data presentation components (`.vmp-table`, `.vmp-list`) - **For data presentation only**

**Rules:**
- Must use VMP semantic classes for typography in data presentation contexts
- Must use VMP spacing tokens for consistency in data presentation (recommended)
- Must use semantic color tokens for meaning in data presentation (success, error, text hierarchy)
- **NOT applicable to marketing pages, landing pages, or creative content**

#### Design Layer (HTML/Templates)
**Purpose:** Allow full creative freedom for visual design - **Marketing and others have free hand, without control**

**Scope:** All visual design, marketing content, landing pages, creative components

**Includes:**
- Visual components (buttons, cards, modals, badges) - **NO prescriptive templates**
- Layout variations - **Full freedom**
- Gradients, effects, shadows - **Full freedom**
- Custom styling - **Full freedom**
- Marketing pages - **Full freedom, no design system constraints**
- Landing pages - **Full freedom, no design system constraints**

**Rules:**
- Inline `style=""` attributes **ALLOWED** - **No restrictions**
- `<style>` blocks **ALLOWED** - **No restrictions**
- Custom component styling **ENCOURAGED** - **No prescriptive patterns**
- Figma designs can be implemented as-is - **Keep all visual design from Figma**
- **NO CDS Template Design:** No component design system templates or prescriptive component patterns
- **NO SaaS Typical Design Model:** No typical SaaS design patterns, templates, or prescriptive UI models enforced
- Marketing content is **exempt** from Foundation Layer rules

### 1.2 SSOT Structure

- **Foundation SSOT:** `public/globals.css` (GSS - Global Style Sheet)
- **HTML Scope:** `html[data-surface="vmp"]`
- **Framework Integration:** Tailwind CDN (utilities only, **NO custom config**)
- **AHA Stack:** Alpine.js + HTMX + Atom CSS
- **Template Rule:** Templates link to `/globals.css` via `<link rel="stylesheet" href="/globals.css" />`
- **Design Freedom:** Inline styles and `<style>` blocks allowed for creative work

### 1.3 IDE-Friendly Creativity Markers

**Purpose:** Help IDE understand when Foundation Layer rules do NOT apply

**IDE Creativity Markers (Design Layer):**
- `.vmp-creative` - Signals creative content (not data presentation)
- `.vmp-marketing` - Signals marketing/landing page content
- `.vmp-free-form` - Signals free-form creative component

**IDE Behavior:**
- When IDE sees `.vmp-creative`, `.vmp-marketing`, or `.vmp-free-form`:
  - Foundation Layer rules do NOT apply
  - Inline styles and `<style>` blocks are ENCOURAGED
  - Figma designs can be implemented as-is
  - Font weight restrictions do NOT apply
  - Typography hierarchy restrictions do NOT apply

**Usage:**
```html
<!-- Marketing/Landing Page: Use creativity marker -->
<div class="vmp-marketing">
  <!-- IDE understands: Foundation rules do NOT apply -->
  <!-- IDE understands: Inline styles ENCOURAGED -->
  <h1 style="font-weight: 700; background: linear-gradient(...);">Hero Title</h1>
</div>

<!-- Creative Component: Use creativity marker -->
<div class="vmp-creative">
  <!-- IDE understands: Foundation rules do NOT apply -->
  <button style="background: radial-gradient(...); box-shadow: ...;">Creative Button</button>
</div>

<!-- Data Presentation: NO marker (Foundation rules apply) -->
<div>
  <!-- IDE understands: Foundation rules DO apply -->
  <h1 class="vmp-h1">Case Title</h1>
  <p class="vmp-body">Case description</p>
</div>
```

### 1.3 Design Philosophy

- **Foundation Consistency:** Typography hierarchy and spacing ensure readable, scannable interfaces
- **Creative Freedom:** Visual design is unlimited - gradients, effects, custom components
- **Monographic Typography:** JetBrains Mono for labels, Playfair Display for hero text
- **Policy Enforcement:** NO bold weights for data presentation (enforced via CSS !important)
- **Truth Surface:** Every interaction is auditable, every message becomes a case note

---

## 2. Color Palette

**CANONICAL VALUES** (aligned with `preview-aha2.html`):

### 2.1 Deep Void Base (HSL System - v1.3.0+)

```css
/* Dark Theme */
--vmp-bg:      hsl(0, 0%, 2%)   /* Primary background */
--vmp-bg2:     hsl(0, 0%, 1%)   /* Secondary background */

/* Light Theme */
--vmp-bg:      hsl(0, 0%, 98%)  /* Primary background */
--vmp-bg2:     hsl(0, 0%, 100%) /* Secondary background */
```

### 2.2 Glass System (HSL System - v1.3.0+)

```css
/* Dark Theme */
--vmp-panel:   hsla(0, 0%, 100%, 0.03)  /* Panel background */
--vmp-border:  hsla(0, 0%, 93%, 0.14)   /* Standard border */
--vmp-border2: hsla(0, 0%, 93%, 0.20)   /* Emphasized border */

/* Light Theme */
--vmp-panel:   hsla(0, 0%, 0%, 0.03)    /* Panel background */
--vmp-border:  hsla(0, 0%, 0%, 0.14)    /* Standard border */
--vmp-border2: hsla(0, 0%, 0%, 0.20)    /* Emphasized border */
```

### 2.3 Text Hierarchy (HSL System - v1.3.0+, WCAG AAA - v1.5.0+)

```css
/* Dark Theme */
--vmp-text:    hsl(0, 0%, 100%)         /* Primary text - 100% white */
--vmp-muted:   hsla(0, 0%, 100%, 0.90) /* Secondary text - 90% opacity (improved from 85%) */
--vmp-subtle:  hsla(0, 0%, 100%, 0.65) /* Tertiary text - 65% opacity (improved from 55%) */

/* Light Theme */
--vmp-text:    hsl(0, 0%, 9%)          /* Primary text - near black */
--vmp-muted:   hsla(0, 0%, 9%, 0.90)   /* Secondary text - 90% opacity */
--vmp-subtle:  hsla(0, 0%, 9%, 0.65)   /* Tertiary text - 65% opacity */
```

**CRITICAL:** 
- Use HSL system (v1.3.0+) for theme switching compatibility
- Use exact HSL/HSLA syntax with decimal points: `hsla(0, 0%, 100%, 0.03)` NOT `hsla(0, 0%, 100%, 03)`
- Missing decimal points will break CSS parsing

### 2.4 Signal Colors (HSL System - v1.3.0+)

```css
/* Dark Theme */
--vmp-ok:      hsl(155, 100%, 71%)  /* Success, active, verified */
--vmp-warn:    hsl(42, 100%, 74%)  /* Warning, pending, open */
--vmp-danger:  hsl(0, 100%, 71%)   /* Error, action required */

/* Light Theme */
--vmp-ok:      hsl(155, 70%, 50%)  /* Success, active, verified */
--vmp-warn:    hsl(42, 90%, 55%)   /* Warning, pending, open */
--vmp-danger:  hsl(0, 80%, 55%)    /* Error, action required */
```

**Usage:** Signal colors are used sparingly for status indicators, badges, and critical actions. Never use as primary text color.

---

## 3. Typography System

### 3.1 Font Families

- **Sans (Default):** Liter (weight: 300) - v1.5.0+
- **Mono:** JetBrains Mono (weights: 400, 500)
- **Serif:** Playfair Display (weights: 400, 600, italic)

**Note (v1.4.0+):** Font weight policy is STRICT - only weight 300 (light) allowed for data presentation. Marketing content excluded.

### 3.2 Typography Classes

**Font Family Utilities:**
- `.font-mono` → JetBrains Mono (for labels, codes, status)
- `.font-serif` → Playfair Display (for hero text, emphasis)
- Default → Liter (for body text, UI elements)

**Semantic Typography Hierarchy (v1.7.0+):**

**Headings:**
- `.vmp-h1` / `<h1>` → 64px, Playfair Display, 1.75 line-height (Hero titles)
- `.vmp-h2` / `<h2>` → 48px, Playfair Display, 1.75 line-height (Page titles)
- `.vmp-h3` / `<h3>` → 40px, Playfair Display, 1.75 line-height (Section headings)
- `.vmp-h4` / `<h4>` → 32px, Playfair Display, 1.3 line-height (Subsection headings)
- `.vmp-h5` / `<h5>` → 24px, Liter, 1.3 line-height (Card titles)
- `.vmp-h6` / `<h6>` → 20px, Liter, 1.5 line-height (Small headings)

**Body Text:**
- `.vmp-body` → 16px, Liter, 1.6 line-height (Primary body text)
- `.vmp-body-large` → 18px, Liter, 1.6 line-height (Important body text)
- `.vmp-body-small` → 14px, Liter, 1.5 line-height (Secondary body text)

**Labels & Metadata:**
- `.vmp-label` → 12px, JetBrains Mono, uppercase, 0.02em letter-spacing (Labels, captions)
- `.vmp-label-strong` → 12px, JetBrains Mono, uppercase, emphasized (Strong labels)
- `.vmp-caption` → 12px, Liter, normal (Captions, fine print)
- `.vmp-code` → 14px, JetBrains Mono, 0.01em letter-spacing (Code, IDs, references)
- `.vmp-code-small` → 12px, JetBrains Mono, 0.02em letter-spacing (Small code, IDs)

**Usage:**
```html
<!-- Semantic HTML + Classes (IDE-friendly) -->
<h1 class="vmp-h1">Hero Title</h1>
<h2 class="vmp-h2">Page Title</h2>
<p class="vmp-body">Primary body text content</p>
<span class="vmp-label">LABEL TEXT</span>
<code class="vmp-code">CASE-12345</code>
```

**Benefits:**
- IDE autocomplete knows semantic meaning
- Clear hierarchy for developers
- Consistent typography across codebase
- Easy to refactor and maintain

### 3.3 Font Weight Policy (v1.4.0+ - STRICT)

**ENFORCED:** Only font-weight 300 (light) across entire platform:

```css
/* STRICT: All text uses font-weight 300 (light) - NO exceptions for data presentation */
html[data-surface="vmp"] * {
  font-weight: 300 !important;
}

/* EXCEPTION: Marketing content ONLY (not data presentation) */
html[data-surface="vmp"] .vmp-marketing,
html[data-surface="vmp"] .vmp-marketing * {
  font-weight: initial !important; /* Marketing can use different weights if needed */
}
```

**Coverage:** 
- ALL elements use font-weight 300 (light)
- Semantic HTML tags (`<b>`, `<strong>`) are clamped to 300
- Tailwind utilities (`.font-semibold`, `.font-bold`, etc.) are clamped to 300
- Exception: `.vmp-marketing` class only (for marketing content, not data presentation)

**Rationale:** 
- Light weight (300) creates consistent, readable typography
- Eliminates visual noise and maintains monographic clarity
- Better human readability for data presentation (forms, tables, lists)
- Marketing content excluded from this strict policy

---

## 4. Visual Effects (FX Layers)

### 4.1 Noise Overlay

**Class:** `.vmp-noise`

**Implementation:**
```css
html[data-surface="vmp"] .vmp-noise{
  pointer-events:none; position:fixed; inset:0;
  opacity:.04; z-index:40;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

- **Purpose:** Subtle texture layer for depth
- **Opacity:** 0.04
- **Z-index:** 40
- **Implementation:** SVG fractal noise filter

### 4.2 Grid Background

**Class:** `.vmp-grid`

**Implementation:**
```css
html[data-surface="vmp"] .vmp-grid{
  pointer-events:none; position:fixed; inset:0;
  opacity:.28; z-index:30;
  background-image:
    linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
  background-size:60px 60px;
  mask-image: radial-gradient(circle at 50% 30%, black 40%, transparent 100%);
}
```

- **Purpose:** Subtle grid pattern for structure
- **Opacity:** 0.28
- **Z-index:** 30
- **Size:** 60px × 60px
- **Mask:** Radial gradient (fades at edges)

**Usage:** Both FX layers are fixed-position, pointer-events-none, and applied to the root layout via `<div class="vmp-noise"></div>` and `<div class="vmp-grid"></div>`.

---

## 5. Policy Clamps

### 5.1 Shadow Policy

**ENFORCED:** All Tailwind shadow utilities, ring utilities, and drop-shadow utilities are disabled:

```css
/* Standard shadows and rings (use box-shadow) */
html[data-surface="vmp"] .shadow,
html[data-surface="vmp"] .shadow-sm,
html[data-surface="vmp"] .shadow-md,
html[data-surface="vmp"] .shadow-lg,
html[data-surface="vmp"] .shadow-xl,
html[data-surface="vmp"] .shadow-2xl,
html[data-surface="vmp"] .ring,
html[data-surface="vmp"] .ring-0,
html[data-surface="vmp"] .ring-1,
html[data-surface="vmp"] .ring-2,
html[data-surface="vmp"] .ring-4,
html[data-surface="vmp"] .ring-8{
  box-shadow:none !important;
}

/* Drop-shadows (use filter, not box-shadow) */
html[data-surface="vmp"] .drop-shadow,
html[data-surface="vmp"] .drop-shadow-sm,
html[data-surface="vmp"] .drop-shadow-md,
html[data-surface="vmp"] .drop-shadow-lg,
html[data-surface="vmp"] .drop-shadow-xl,
html[data-surface="vmp"] .drop-shadow-2xl{
  filter:none !important;
  box-shadow:none !important;
}
```

**Coverage:** 
- Standard shadows and rings use `box-shadow` → clamped with `box-shadow:none`
- Drop-shadows use CSS `filter` → clamped with both `filter:none` and `box-shadow:none` (bulletproof)

**Rationale:** Shadows break the flat, void aesthetic. Use borders and opacity for depth instead.

### 5.2 Bold Policy

**ENFORCED:** All bold font weights (semantic HTML + Tailwind utilities) are clamped:

```css
html[data-surface="vmp"] b,
html[data-surface="vmp"] strong{
  font-weight:400 !important; /* avoid "loud" bold text */
}
html[data-surface="vmp"] .font-semibold,
html[data-surface="vmp"] .font-bold,
html[data-surface="vmp"] .font-extrabold,
html[data-surface="vmp"] .font-black{
  font-weight:500 !important; /* bold → medium */
}
```

**Coverage:** Semantic HTML (`<b>`, `<strong>`) + Tailwind utilities (`.font-semibold`, `.font-bold`, `.font-extrabold`, `.font-black`)

**Rationale:** Bold weights create visual hierarchy that conflicts with the monographic, dense typography system.

---

## 6. Typography Scale (v1.6.0 - Figma Standards)

### 6.1 Font Sizes (Figma-aligned)

```css
--vmp-font-xs: 0.75rem;     /* 12px - Figma minimum */
--vmp-font-sm: 0.875rem;    /* 14px - Figma small */
--vmp-font-base: 1rem;      /* 16px - Figma base/body - OPTIMAL READABILITY */
--vmp-font-md: 1.125rem;    /* 18px - Figma medium */
--vmp-font-lg: 1.25rem;     /* 20px - Figma large */
--vmp-font-xl: 1.5rem;      /* 24px - Figma xl */
--vmp-font-2xl: 2rem;       /* 32px - Figma 2xl */
--vmp-font-3xl: 2.5rem;     /* 40px - Figma 3xl */
--vmp-font-4xl: 3rem;       /* 48px - Figma 4xl */
--vmp-font-5xl: 4rem;       /* 64px - Figma 5xl */
```

**Justification:** 16px base body text is optimal for human eye reading (Figma standard). Research-backed for screen readability.

### 6.2 Line Heights (Figma-aligned)

```css
--vmp-line-height-tight: 1.3;   /* For headings - Figma minimum */
--vmp-line-height-normal: 1.5;  /* For small text - Figma standard */
--vmp-line-height-relaxed: 1.6; /* For body text - Figma recommended */
--vmp-line-height-loose: 1.75;   /* For large text - Figma optimal */
```

**Justification:** 1.5-1.6x line-height provides comfortable reading rhythm without excessive spacing.

### 6.3 Letter Spacing (Figma-aligned)

```css
--vmp-letter-spacing-tighter: 0;      /* For large headings - Figma: no negative */
--vmp-letter-spacing-tight: 0;        /* For medium headings - Figma: no negative */
--vmp-letter-spacing-normal: 0;      /* For body text - Figma standard */
--vmp-letter-spacing-wide: 0.01em;   /* For small caps - Figma recommended */
--vmp-letter-spacing-wider: 0.02em;  /* For labels - Figma recommended */
```

**Justification:** Positive letter spacing improves readability. No negative values per Figma standards.

**Note:** Typography scale applies to data presentation only. Marketing content (`.vmp-marketing`) excluded.

## 7. Spacing System (v1.5.0 - Figma 8px Grid)

### 7.1 Spacing Tokens (8px Grid)

```css
--vmp-space-0: 0;           /* 0px */
--vmp-space-1: 0.25rem;     /* 4px - 0.5x grid */
--vmp-space-2: 0.5rem;      /* 8px - 1x grid (base unit) */
--vmp-space-3: 0.75rem;     /* 12px - 1.5x grid */
--vmp-space-4: 1rem;        /* 16px - 2x grid */
--vmp-space-5: 1.25rem;     /* 20px - 2.5x grid */
--vmp-space-6: 1.5rem;      /* 24px - 3x grid */
--vmp-space-8: 2rem;        /* 32px - 4x grid */
--vmp-space-10: 2.5rem;     /* 40px - 5x grid */
--vmp-space-12: 3rem;       /* 48px - 6x grid */
--vmp-space-16: 4rem;       /* 64px - 8x grid */
```

**Justification:** 8px grid system ensures visual consistency and alignment across all components.

## 8. Semantic Aliases (v1.7.0 - IDE-Friendly)

### 8.1 Layout Aliases

For better IDE understanding, semantic aliases are provided for design jargon:

| Original (Design Jargon) | Semantic Alias | Purpose | Use Case |
|-------------------------|----------------|---------|----------|
| `.vmp-rail` | `.vmp-sidebar` | Sidebar container | Navigation sidebar |
| `.vmp-slab` | `.vmp-panel` | Panel container | Content panels, cards |
| `.vmp-mark` | `.vmp-brand` / `.vmp-logo` | Brand mark | Logo, brand identifier |

**Usage:**
```html
<!-- Old (still works) -->
<aside class="vmp-rail">Sidebar</aside>

<!-- New (IDE-friendly) -->
<aside class="vmp-sidebar">Sidebar</aside>
```

### 8.2 Typography Aliases

| Original (Design Jargon) | Semantic Alias | Purpose | Use Case |
|-------------------------|----------------|---------|----------|
| `.vmp-kicker` | `.vmp-label-section` | Section label | Section headers, kickers |
| `.vmp-kicker-strong` | `.vmp-label-section-strong` | Emphasized section label | Strong section labels |

**Usage:**
```html
<!-- Old (still works) -->
<div class="vmp-kicker">// SECTION</div>

<!-- New (IDE-friendly) -->
<div class="vmp-label-section">// SECTION</div>
```

### 8.3 Token/Badge Aliases

| Original (Generic) | Semantic Alias | Purpose | Use Case |
|-------------------|----------------|---------|----------|
| `.vmp-inline` | `.vmp-token` | Inline token/badge | IDs, statuses, tags |
| `.vmp-inline-mono` | `.vmp-token-mono` | Monospace token | Code-like tokens |
| `.vmp-inline-ok` | `.vmp-token-ok` | Success token | Success status |
| `.vmp-inline-warn` | `.vmp-token-warn` | Warning token | Warning status |
| `.vmp-inline-danger` | `.vmp-token-danger` | Danger token | Error status |

**Usage:**
```html
<!-- Old (still works) -->
<span class="vmp-inline vmp-inline-mono">CASE-123</span>

<!-- New (IDE-friendly) -->
<span class="vmp-token vmp-token-mono">CASE-123</span>
```

**Benefits:**
- ✅ IDE autocomplete suggests semantic names
- ✅ New developers understand purpose immediately
- ✅ Backward compatible (old names still work)
- ✅ No breaking changes

---

## 9. Component Patterns

### 9.1 Panels

```html
<div class="rounded-2xl border border-white/10 bg-white/[0.02]">
  <!-- Panel content -->
</div>
```

- **Border:** `border-white/10`
- **Background:** `bg-white/[0.02]`
- **Radius:** `rounded-2xl` (20px)

### 9.2 Headers

```html
<header class="p-4 border-b border-white/10 bg-black/20">
  <div class="font-mono text-[11px] tracking-[0.22em] text-white/60">LABEL</div>
  <div class="text-[11px] text-white/40">Description text</div>
</header>
```

- **Padding:** `p-4`
- **Border:** Bottom border with `border-white/10`
- **Background:** `bg-black/20` for subtle contrast

### 9.3 Status Badges

```html
<span class="px-2 py-1 rounded-full border border-white/10 bg-white/[0.02] font-mono text-[9px] tracking-[0.22em]">
  STATUS
</span>
```

- **Shape:** `rounded-full`
- **Typography:** Mono, uppercase, letter-spacing `0.22em`
- **Colors:** Use CSS variables (`var(--vmp-ok)`, `var(--vmp-danger)`, etc.)

### 9.4 Kicker Labels (Legacy)

**Note:** Use `.vmp-label-section` (semantic alias) for new code. `.vmp-kicker` is kept for backward compatibility.

```html
<div class="font-mono text-[10px] tracking-[0.22em] text-white/45">// LABEL</div>
```

- **Format:** `//` prefix for section labels
- **Size:** `text-[10px]`
- **Tracking:** `0.22em`
- **Color:** `text-white/45`

---

## 10. AHA Stack Integration

### 10.1 HTMX Patterns

**Cell Swapping:**
```html
<div id="target-cell"
     hx-get="/partials/endpoint"
     hx-trigger="load"
     hx-target="#target-cell"
     hx-swap="innerHTML">
  <!-- Loading state -->
</div>
```

**Loading Indicators:**
```html
<div id="loading-indicator" class="htmx-indicator">
  <!-- Shown during HTMX requests -->
</div>
```

### 10.2 Alpine.js Usage

Alpine.js is loaded but used minimally. Reserve for:
- Tab switching
- Modal toggles
- Small UI state management

**Avoid:** Complex state management (use HTMX + server state instead).

### 10.3 Tailwind CDN

**CRITICAL RULE:** 
- **NO custom config:** Use default Tailwind utilities only
- **NO `tailwind.config` scripts:** Remove any `tailwind.config = { ... }` blocks
- **No build step:** CDN version for development
- **Utilities only:** Layout, spacing, colors (via CSS variables)
- **Arbitrary values allowed:** `bg-white/[0.02]`, `text-[10px]`, etc.

**Template Implementation:**
```html
<script src="https://cdn.tailwindcss.com"></script>
<!-- NO tailwind.config scripts below -->
```

---

## 11. Accessibility (a11y)

### 11.1 Focus States

```css
html[data-surface="vmp"] :where(a,button,[role="button"],input,textarea,select):focus-visible{
  outline:2px solid rgba(255,255,255,.25);
  outline-offset:3px;
  border-radius:12px;
}
```

**Applied to:** `a`, `button`, `[role="button"]`, `input`, `textarea`, `select`

### 11.2 ARIA Patterns

- Use `aria-live="polite"` for dynamic content updates
- Use `aria-label` for icon-only buttons
- Use semantic HTML (`<nav>`, `<section>`, `<header>`)

### 11.3 Color Contrast

- **Text:** Minimum 4.5:1 contrast ratio (WCAG AA)
- **Signals:** Use high-contrast colors for status indicators
- **Borders:** `border-white/10` provides sufficient contrast on Deep Void background

---

## 12. Scrollbar Styling

```css
html[data-surface="vmp"] ::-webkit-scrollbar{ width:6px; }
html[data-surface="vmp"] ::-webkit-scrollbar-track{ background:transparent; }
html[data-surface="vmp"] ::-webkit-scrollbar-thumb{ 
  background:rgba(255,255,255,.12); 
  border-radius:6px; 
}
html[data-surface="vmp"] ::-webkit-scrollbar-thumb:hover{ 
  background:rgba(255,255,255,.20); 
}
```

**Design:** Minimal, transparent track with subtle thumb. Matches Deep Void aesthetic.

---

## 13. Responsive Breakpoints

Use Tailwind default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

**Sidebar:** Hidden on mobile (`hidden md:flex`)

---

## 14. File Structure

```
public/
  └── globals.css          # SSOT CSS (this contract's implementation)

src/views/
  ├── layout.html          # Root shell (links to /globals.css, NO inline styles)
  ├── pages/
  │   └── home.html        # Console page
  └── partials/
      ├── case_inbox.html  # HTMX cell
      └── case_detail.html # HTMX cell
```

**CRITICAL RULES (v2.0.0):** 
- `layout.html` must link to `/globals.css` via `<link rel="stylesheet" href="/globals.css" />`
- **Foundation Layer:** Typography must use VMP semantic classes (`.vmp-h*`, `.vmp-body`, `.vmp-label`)
- **Design Layer:** Inline `<style>` blocks and `style=""` attributes **ALLOWED** for creative visual design
- **NO `tailwind.config` scripts** in any template
- Foundation tokens (typography, spacing, semantic colors) exist in `public/globals.css`

---

## 15. Version History

| Version | Date       | Changes                          |
|---------|------------|----------------------------------|
| 1.0.0   | 2025-12-20 | Initial SSOT contract established |
| 1.0.1   | 2025-12-20 | LOCKED: Fixed RGBA syntax, expanded clamps, removed config conflicts, enforced SSOT-only styling |
| 1.1.0   | 2025-12-XX | Added .vmp-glow, .vmp-glass, unlocked font-weight:700 for .font-serif headers |
| 1.1.1   | 2025-12-XX | Enterprise primitives whitelist (vmp-rail, vmp-slab, vmp-card, etc.) |
| 1.1.2   | 2025-12-XX | Readability rescue: boosted contrast (muted 62%→85%, subtle 36%→55%) |
| 1.2.0   | 2025-12-XX | Supabase UI integration: form controls, buttons, badges, alerts, tables, modals |
| 1.3.0   | 2025-12-XX | Supabase color system: HSL-based theme switching, dark/light theme support |
| 1.3.1   | 2025-12-XX | Smooth background: disabled noise/grid overlays (opacity: 0) for readability |
| 1.4.0   | 2025-12-XX | Font weight policy (STRICT): Only font-weight 300 (light) across platform |
| 1.5.0   | 2025-12-XX | Figma + Supabase design system: 8px grid, spacing tokens, Liter font (300) |
| 1.6.0   | 2025-01-XX | Figma typography standards: 12px/14px/16px scale, line-height 1.3/1.5/1.6/1.75, letter-spacing 0/+0.01em/+0.02em |
| 1.7.0   | 2025-01-XX | Semantic typography hierarchy + IDE-friendly aliases: Added .vmp-h1 through .vmp-h6, .vmp-body, .vmp-label, .vmp-code classes. Added semantic aliases (.vmp-sidebar, .vmp-panel, .vmp-brand, .vmp-label-section, .vmp-token) for better IDE understanding |
| 2.0.0   | 2025-01-XX | Foundation vs. Design separation: Foundation layer (typography, spacing, semantic colors) for consistency; Design layer (visual components, effects) allows full creative freedom with inline styles and style blocks |
| 2.1.0   | 2025-01-XX | Figma validated: Foundation layer scope clarified to **data presentation ONLY**. Design layer explicitly allows marketing/creative free hand. **NO CDS Template Design** - no prescriptive component templates enforced. **NO SaaS Typical Design Model** - no typical SaaS design patterns or templates enforced. |

---

## 16. Compliance Checklist (v2.1.0)

### Foundation Layer (Required - Data Presentation ONLY)

**Scope:** Only applies to data presentation contexts (tables, forms, lists, case details, invoice details, etc.)

- [ ] Typography uses VMP semantic classes (`.vmp-h1` through `.vmp-h6`, `.vmp-body`, `.vmp-label`) - **Data presentation only**
- [ ] Spacing uses VMP tokens (`var(--vmp-space-*)`) for consistency (recommended) - **Data presentation only**
- [ ] Semantic colors use VMP tokens (`var(--vmp-ok)`, `var(--vmp-danger)`, `var(--vmp-text)`) for meaning - **Data presentation only**
- [ ] Data presentation uses VMP classes (`.vmp-table`, `.vmp-list`) for consistency
- [ ] Typography follows Figma standards (v1.6.0+): 12px/14px/16px scale - **Data presentation only**
- [ ] Spacing follows 8px grid system (v1.5.0+) - **Data presentation only**
- [ ] No bold font weights for data presentation (use weight 300/light only - v1.4.0+)
- [ ] No `<b>` or `<strong>` tags for data presentation (use CSS variables for emphasis)
- [ ] Uses HSL color system (v1.3.0+) for semantic tokens
- [ ] Scoped to `html[data-surface="vmp"]`

### Design Layer (Free Hand - Marketing & Creative)

**Scope:** Marketing pages, landing pages, creative content, visual components

- [ ] Marketing content has full creative freedom - **No Foundation Layer constraints**
- [ ] Landing pages can use any styling - **No Foundation Layer constraints**
- [ ] Visual components (buttons, cards, modals) are free-form - **NO prescriptive templates**
- [ ] Inline styles and `<style>` blocks used freely - **No restrictions**
- [ ] Figma designs implemented as-is - **Keep all visual design**
- [ ] **NO CDS Template Design:** No component design system templates enforced
- [ ] **NO SaaS Typical Design Model:** No typical SaaS design patterns, templates, or prescriptive UI models enforced
- [ ] Creative effects (gradients, shadows, animations) are allowed - **No restrictions**
- [ ] Custom component styling is encouraged - **No prescriptive patterns**

### General Rules

- [ ] No shadow utilities for data presentation (use borders/opacity instead)
- [ ] No ring utilities for data presentation (use borders instead)
- [ ] No drop-shadow utilities for data presentation (use borders instead)
- [ ] HTMX patterns follow cell-swapping convention
- [ ] Focus states are visible and accessible
- [ ] No `tailwind.config` scripts in templates
- [ ] RGBA values use decimal points: `rgba(255,255,255,.03)` NOT `rgba(255,255,255,03)`

---

## 17. Doctrine

> **"No evidence, no movement. Every message becomes a case note. Every case is auditable."**

This doctrine guides all design decisions:
- **Truth Surface:** UI must support audit trails
- **Evidence Gates:** Actions require evidence
- **Monographic Clarity:** Dense, readable, no decoration

---

## 18. Anti-Drift Guarantees (v2.0.0)

This contract serves as the immutable SSOT. To prevent drift:

1. **Single Contract ID:** Only CONTRACT-001 exists. Any other document IDs (e.g., DS-NEXUS-01) are superseded.
2. **Foundation SSOT:** Typography and spacing tokens in `public/globals.css` only. Must use VMP semantic classes for typography.
3. **Design Freedom:** Inline styles and `<style>` blocks allowed for creative visual design.
4. **Config Prohibition:** No Tailwind custom config. CDN utilities only.
5. **Syntax Validation:** RGBA values must use decimal points. Contract examples are canonical.

---

## 19. Definition of Done (DoD)

A component, template, or styling change is considered **DONE** when all of the following criteria are met:

### 19.1 Foundation Layer Compliance (v2.0.0)

- [ ] Typography uses VMP semantic classes (`.vmp-h*`, `.vmp-body`, `.vmp-label`) from `public/globals.css`
- [ ] Spacing uses VMP tokens (`var(--vmp-space-*)`) for consistency
- [ ] Semantic colors use VMP tokens (`var(--vmp-ok)`, `var(--vmp-danger)`, `var(--vmp-text)`) for meaning
- [ ] All foundation CSS variables use canonical values from `:root`

### 19.1.2 Design Layer Compliance (v2.0.0)

- [ ] Inline `style=""` attributes **ALLOWED** for creative visual design
- [ ] Inline `<style>` blocks **ALLOWED** for component-specific styling
- [ ] Visual components can use custom styling (gradients, effects, shadows)
- [ ] Figma designs can be implemented as-is

### 19.2 Tailwind CDN Compliance

- [ ] No `tailwind.config` scripts or overrides in any template
- [ ] No `@tailwind` directives in `globals.css` (CDN doesn't require these)
- [ ] Only standard Tailwind CDN utilities are used (no custom config)
- [ ] Arbitrary values are allowed (e.g., `bg-white/[0.02]`, `text-[10px]`)

### 19.3 Policy Enforcement

- [ ] No shadow utilities (`.shadow-*`, `.ring-*`, `.drop-shadow-*`)
- [ ] No bold font weights (`.font-bold`, `.font-semibold`, etc. - all clamped to 300/light - v1.4.0+)
- [ ] No semantic HTML bold tags (`<b>`, `<strong>`) used for emphasis
- [ ] No custom `nexus-*` semantic class system (use standard Tailwind utilities)

### 19.4 Syntax Validation

- [ ] All HSL/HSLA values use decimal points: `hsla(0, 0%, 100%, 0.03)` NOT `hsla(0, 0%, 100%, 03)`
- [ ] All RGBA values use decimal points: `rgba(255,255,255,.03)` NOT `rgba(255,255,255,03)` (legacy support)
- [ ] All CSS is scoped to `html[data-surface="vmp"]`
- [ ] All signal classes (`.vmp-signal-*`, `.vmp-fill-*`) are defined in `globals.css`

### 19.5 Verification Gates (v2.0.0)

Foundation layer verification (required):

```powershell
# 1) Typography uses VMP semantic classes (check for .vmp-h*, .vmp-body, .vmp-label)
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "\.vmp-h[1-6]|\.vmp-body|\.vmp-label" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: > 0 (should find semantic classes)

# 2) No tailwind.config overrides
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "tailwind\.config" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 3) No nexus-* semantic classes
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "\bnexus-" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 4) No @tailwind directives in globals.css
Select-String -Path public\globals.css -Pattern "@tailwind" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0
```

**Note (v2.0.0):** Inline styles and `<style>` blocks are now **ALLOWED** for creative design. Verification gates focus on foundation layer compliance (typography, spacing, semantic colors).

### 19.6 Documentation

- [ ] Changes align with CONTRACT-001 (this document)
- [ ] No drift from "Deep Void" aesthetic
- [ ] Typography follows monographic system (Liter 300/JetBrains Mono/Playfair Display - v1.5.0+)
- [ ] Font sizes follow Figma standards: 12px/14px/16px/18px/20px/24px/32px/40px/48px/64px (v1.6.0+)
- [ ] Line heights follow Figma standards: 1.3/1.5/1.6/1.75 (v1.6.0+)
- [ ] Letter spacing uses positive values only: 0/+0.01em/+0.02em (v1.6.0+)

**Status:** A change is **NOT DONE** until all verification gates pass and all compliance criteria are met.

---

## Footer

**Document Classification:** Internal Development Contract (ACTIVE)  
**Last Updated:** 2025-01-XX  
**Status:** Current (v1.6.0) - Updated with all amendments  
**Next Review:** When design system fundamentally evolves  
**Contact:** NexusCanon VMP Development Team

---

**End of Contract**

