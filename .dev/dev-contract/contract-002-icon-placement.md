# NexusCanon VMP Icon Placement Contract

**Document ID:** CONTRACT-002  
**Title:** Icon & Logo Placement Specification (SSOT)  
**Version:** 1.1.0 (CURRENT - Figma Validated)  
**Date:** 2025-01-22  
**Status:** Active  
**Owner:** NexusCanon VMP Development Team  
**Figma Source:** [Container Design](https://www.figma.com/design/NgukXYR5aV19lk73VALPvt/Untitled?node-id=61-38&m=dev)

---

## Abstract

This contract defines the **Single Source of Truth (SSOT)** for icon and logo placement throughout the NexusCanon Vendor Management Portal (VMP). All specifications are validated against Figma designs and align with the design system contract (CONTRACT-001).

This contract establishes:
- **Icon Size Standards:** 36×36px for brand marks (Figma validated)
- **Logo Usage Patterns:** Full logo (274×92px) for footer/marketing contexts
- **Spacing Guidelines:** 8px grid system alignment
- **Placement Patterns:** Standardized implementations across all templates
- **Accessibility Requirements:** WCAG-compliant icon implementation

**CRITICAL RULES:**
- **Brand Mark Contexts:** MUST use 36×36px icon (`nexus-icon.svg`)
- **Full Logo Contexts:** MUST use full logo (`nexus-logo.svg`) for footer/marketing
- **Spacing:** MUST follow 8px grid system (12px gap to text, 8px container padding)
- **Accessibility:** MUST include `alt` attributes on all icon/logo images
- **Figma Compliance:** All sizes MUST match Figma specifications

---

## 1. Icon Assets

### 1.1 Available Assets

| Asset | File Path | Dimensions | ViewBox | Use Case |
|-------|-----------|------------|---------|----------|
| **Icon** | `/nexus-icon.svg` | 36×36px | `0 0 36 36` | Brand mark, navigation, sidebar |
| **Full Logo** | `/nexus-logo.svg` | 274×92px | `0 0 274 92` | Footer, headers, marketing |

### 1.2 File Locations

**Source Files:**
- `.dev/dev-contract/NexusIconObicle.svg` → `public/nexus-icon.svg`
- `.dev/dev-contract/NexusIconWord.svg` → `public/nexus-logo.svg`

**Web Access:**
- Icons accessible via `/nexus-icon.svg` and `/nexus-logo.svg`
- SVG format ensures scalability and crisp rendering at all sizes

### 1.3 Asset Validation

**Status:** ✅ **Figma Validated**
- Icon dimensions match Figma specification (36×36px)
- Logo dimensions match Figma specification (274×92px)
- Colors align with design system (CONTRACT-001)
- Accessibility attributes included in source SVG files

---

## 2. Size Standards

### 2.1 Brand Mark (Icon Only)

**Standard Size:** 36×36px (matches Figma specification)

**Usage Contexts:**
- Sidebar brand section
- Navigation brand
- Mobile navigation drawer
- Login page brand mark
- Any brand mark context requiring icon-only representation

**Implementation Pattern:**
```html
<div class="w-9 h-9 rounded-lg border border-opacity-10 grid place-items-center" 
     style="background: rgba(255, 255, 255, 0.02); border-color: rgba(237, 237, 237, 0.10);">
  <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" class="w-9 h-9" />
</div>
```

**Key Properties:**
- Container: `w-9 h-9` (36px × 36px)
- Icon: `width="36" height="36"` (fills container)
- Background: `rgba(255, 255, 255, 0.02)` (matches `--vmp-panel`)
- Border: `rgba(237, 237, 237, 0.10)` (matches `--vmp-border`)
- Border radius: `rounded-lg` (8px)

**Rule:** Brand mark contexts MUST use 36×36px icon. No exceptions.

### 2.2 Full Logo

**Standard Size:** Maintain aspect ratio (274×92px or scaled proportionally)

**Usage Contexts:**
- Footer sections
- Landing page headers (when space allows)
- Marketing pages
- Email signatures
- Print materials
- Any context requiring full brand representation

**Implementation Pattern:**
```html
<img src="/nexus-logo.svg" alt="NexusCanon Logo" width="200" height="67" style="height:auto;" />
```

**Key Properties:**
- Width: Scale proportionally (recommended: 200px for footer, 274px for full size)
- Height: Auto (maintains aspect ratio)
- Alt text: Always include descriptive alt text
- Footer size: 200×67px (maintains 274:92 aspect ratio)

**Rule:** Full logo contexts MUST use `nexus-logo.svg`. Footer logos MUST be at least 200×67px. Icon-only contexts MUST NOT use full logo.

### 2.3 Favicon

**Standard Size:** 32×32px (browser standard)

**Implementation:**
```html
<link rel="icon" href="/nexus-icon.svg" type="image/svg+xml" />
```

**Rule:** Favicon MUST use `nexus-icon.svg` (not full logo).

---

## 3. Spacing Guidelines

### 3.1 Icon to Text Spacing

**Standard Gap:** 12px (1.5× 8px grid)

**Implementation:**
```html
<div class="flex items-center gap-3">
  <!-- Icon container -->
  <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" />
  <!-- Text content -->
  <div>NexusCanon</div>
</div>
```

**Tailwind Class:** `gap-3` (12px)

**Rule:** Icon to text spacing MUST be 12px (1.5× grid). Use `gap-3` class.

### 3.2 Container Padding

**Standard Padding:** 8px (1× 8px grid)

**Implementation:**
```html
<div class="p-2">  <!-- 8px padding -->
  <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" />
</div>
```

**Tailwind Class:** `p-2` (8px)

**Rule:** Container padding MUST follow 8px grid system.

### 3.3 Border Width

**Standard Border:** 0.667px (matches Figma specification)

**Implementation:**
```html
<div style="border: 0.667px solid rgba(237, 237, 237, 0.10);">
```

**Note:** Tailwind's `border` class uses 1px. For exact Figma match, use inline style.

**Rule:** Border width SHOULD match Figma specification (0.667px) when exact match is required.

---

## 4. Placement Patterns

### 4.1 Sidebar Brand Section

**Location:** `src/views/layout.html`

**Pattern:**
```html
<div class="flex items-center gap-3 p-3 vmp-panel">
  <div class="w-9 h-9 rounded-lg border border-opacity-10 grid place-items-center" 
       style="background: rgba(255, 255, 255, 0.02); border-color: rgba(237, 237, 237, 0.10);">
    <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" class="w-9 h-9" />
  </div>
  <div class="min-w-0">
    <div class="vmp-label-kicker vmp-label-kicker-strong truncate">NexusCanon</div>
    <div class="vmp-caption truncate">GOVERNANCE SYSTEMS</div>
  </div>
</div>
```

**Key Elements:**
- Icon: 36×36px in 36px container
- Text: Brand name + subtitle
- Spacing: `gap-3` (12px between icon and text)
- Panel: Uses `vmp-panel` class (Foundation Layer)

**Rule:** Sidebar brand section MUST follow this pattern.

### 4.2 Navigation Brand

**Location:** `src/views/pages/landing.html`

**Pattern:**
```html
<div class="brand">
  <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" class="w-9 h-9" />
  NexusCanon
</div>
```

**Key Elements:**
- Icon: 36×36px
- Text: Brand name only
- Spacing: Inherited from `.brand` class

**Rule:** Navigation brand MUST use 36×36px icon.

### 4.3 Mobile Navigation Drawer

**Location:** `src/views/partials/mobile_nav_drawer.html`

**Pattern:**
```html
<div class="flex items-center gap-3">
  <div class="w-9 h-9 rounded-lg border border-opacity-10 grid place-items-center" 
       style="background: rgba(255, 255, 255, 0.02); border-color: rgba(237, 237, 237, 0.10);">
    <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" class="w-9 h-9" />
  </div>
  <div class="min-w-0">
    <div class="vmp-label-kicker vmp-label-kicker-strong truncate">NexusCanon</div>
    <div class="vmp-caption truncate">GOVERNANCE SYSTEMS</div>
  </div>
</div>
```

**Key Elements:**
- Same pattern as sidebar (consistency)
- Icon: 36×36px
- Responsive: Works on mobile screens

**Rule:** Mobile navigation drawer MUST match sidebar pattern for consistency.

### 4.4 Footer Logo

**Location:** `src/views/pages/landing.html`

**Pattern:**
```html
<img src="/nexus-logo.svg" alt="NexusCanon Logo" width="200" height="67" 
     style="margin-bottom:1rem; height:auto;" />
```

**Key Elements:**
- Full logo (not icon)
- Size: 200×67px (maintains 274:92 aspect ratio, ~73% of full size)
- Maintains aspect ratio
- Appropriate spacing below

**Rule:** Footer sections MUST use full logo (`nexus-logo.svg`) at 200×67px or larger.

---

## 5. Accessibility Requirements

### 5.1 Required Attributes

**All icons and logos MUST include:**
- `alt` attribute with descriptive text
- Proper semantic HTML

**Example:**
```html
<img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" />
```

**Rule:** All icon/logo images MUST have descriptive `alt` attributes.

### 5.2 SVG Source Compliance

**SVG files include (already implemented):**
- `role="img"` on `<svg>` element
- `aria-label` on `<svg>` element
- `<title>` element for screen readers
- `<desc>` element for detailed description

**Status:** ✅ Already implemented in source SVG files

**Rule:** SVG source files MUST maintain accessibility attributes.

---

## 6. Design System Alignment

### 6.1 Foundation Layer Compliance

**Colors:**
- Border: `rgba(237, 237, 237, 0.10)` (matches `--vmp-border`)
- Background: `rgba(255, 255, 255, 0.02)` (matches `--vmp-panel`)
- Text: Uses VMP typography classes (`.vmp-label-kicker`, `.vmp-caption`)

**Spacing:**
- Follows 8px grid system
- Uses `--vmp-space-*` tokens where applicable
- Icon to text: 12px (1.5× grid)

**Rule:** Icon placement MUST align with Foundation Layer colors and spacing.

### 6.2 Design Layer Compliance

**Creative Freedom:**
- Container styling uses inline styles (allowed per CONTRACT-001)
- Visual effects (gradients, masks) are creative design
- No restrictions on visual design

**Rule:** Icon container styling is Design Layer (inline styles allowed).

---

## 7. Anti-Patterns (Forbidden)

### 7.1 Size Violations

**❌ FORBIDDEN:**
```html
<!-- ❌ Icon too small -->
<img src="/nexus-icon.svg" width="18" height="18" />
```

**✅ REQUIRED:**
```html
<!-- ✅ 36px icon -->
<img src="/nexus-icon.svg" width="36" height="36" class="w-9 h-9" />
```

### 7.2 Missing Container

**❌ FORBIDDEN:**
```html
<!-- ❌ No container styling -->
<img src="/nexus-icon.svg" width="36" height="36" />
```

**✅ REQUIRED:**
```html
<!-- ✅ Container with styling -->
<div class="w-9 h-9 rounded-lg border border-opacity-10 grid place-items-center" 
     style="background: rgba(255, 255, 255, 0.02); border-color: rgba(237, 237, 237, 0.10);">
  <img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" class="w-9 h-9" />
</div>
```

### 7.3 Wrong Asset Usage

**❌ FORBIDDEN:**
```html
<!-- ❌ Using full logo in sidebar -->
<img src="/nexus-logo.svg" width="274" height="92" />
```

**✅ REQUIRED:**
```html
<!-- ✅ Icon for sidebar -->
<img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" />
```

### 7.4 Missing Alt Text

**❌ FORBIDDEN:**
```html
<!-- ❌ No accessibility -->
<img src="/nexus-icon.svg" width="36" height="36" />
```

**✅ REQUIRED:**
```html
<!-- ✅ Alt text included -->
<img src="/nexus-icon.svg" alt="NexusCanon Icon" width="36" height="36" />
```

---

## 8. Quick Reference

### 8.1 Icon Size Decision Tree

```
Is it a brand mark context?
├─ Yes → Use nexus-icon.svg (36×36px)
│  └─ Sidebar, Nav, Mobile Drawer, Login
│
└─ No → Is it a footer/header/marketing context?
   └─ Yes → Use nexus-logo.svg (274×92px or scaled)
      └─ Footer, Landing Headers, Marketing Pages
```

### 8.2 Spacing Quick Reference

| Element | Spacing | Tailwind Class |
|---------|---------|----------------|
| Icon to Text | 12px | `gap-3` |
| Container Padding | 8px | `p-2` |
| Panel Padding | 12px | `p-3` |

### 8.3 Size Quick Reference

| Context | Icon Size | Container Size | File |
|---------|-----------|----------------|------|
| Brand Mark | 36px | 36px | `nexus-icon.svg` |
| Full Logo | 274×92px | Auto | `nexus-logo.svg` |
| Footer Logo | 200×67px | Auto | `nexus-logo.svg` |
| Favicon | 32px | 32px | `nexus-icon.svg` |

---

## 9. Maintenance

### 9.1 When to Update This Contract

- New icon assets added
- Figma design changes
- New placement patterns discovered
- Accessibility requirements change
- Design system contract (CONTRACT-001) updates

### 9.2 Version History

- **v1.1.0** (2025-01-22): Updated footer logo size from 137×46px to 200×67px per Figma validation
- **v1.0.0** (2025-01-21): Initial contract based on Figma audit and validation

---

## 10. Related Contracts & Documents

- **CONTRACT-001:** `.dev/dev-contract/contract-001-design-system.md` (Design System SSOT)
- **ICON_VALIDATION_REPORT:** `.dev/dev-contract/ICON_VALIDATION_REPORT.md`
- **ICON_USAGE_VERIFICATION:** `.dev/dev-contract/ICON_USAGE_VERIFICATION.md`
- **ICON_PLACEMENT_AUDIT:** `.dev/dev-contract/ICON_PLACEMENT_AUDIT.md`

---

**Contract Status:** ✅ **Active**  
**Last Updated:** 2025-01-22  
**Next Review:** When Figma designs change or new patterns emerge  
**Compliance:** All implementations MUST follow this contract

