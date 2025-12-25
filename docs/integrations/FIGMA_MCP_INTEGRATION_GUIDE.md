# Figma MCP Integration Guide: VMP Design System

**Date:** 2025-01-XX  
**Version:** 2.0.0  
**Status:** Ready for Figma Integration  
**Purpose:** Guide for using Figma MCP with VMP Design System

---

## Overview

This guide explains how to integrate Figma designs with the NexusCanon VMP Design System using Figma Model Context Protocol (MCP).

**Philosophy:** The VMP design system follows a **Foundation vs. Design** separation:
- **Foundation Layer (CSS)**: Typography hierarchy, spacing system, semantic color tokens
- **Design Layer (HTML/Templates)**: Full creative freedom for visual design, components, and effects

This approach ensures consistency where it matters (data presentation, typography) while allowing unlimited creative expression for visual design.

---

## Design System Structure

### 1. Token Definitions

**Location:** `public/globals.css`

**Format:** CSS Custom Properties (CSS Variables)

**Structure:**
```css
:root,
html[data-theme="dark"] {
  /* Colors (HSL) */
  --vmp-bg: hsl(0, 0%, 2%);
  --vmp-text: hsl(0, 0%, 100%);
  --vmp-ok: hsl(155, 100%, 71%);
  
  /* Typography */
  --vmp-font-xs: 0.75rem;     /* 12px */
  --vmp-font-sm: 0.875rem;    /* 14px */
  --vmp-font-base: 1rem;      /* 16px */
  --vmp-font-md: 1.125rem;    /* 18px */
  --vmp-font-lg: 1.25rem;     /* 20px */
  --vmp-font-xl: 1.5rem;      /* 24px */
  --vmp-font-2xl: 2rem;       /* 32px */
  --vmp-font-3xl: 2.5rem;     /* 40px */
  --vmp-font-4xl: 3rem;       /* 48px */
  --vmp-font-5xl: 4rem;       /* 64px */
  
  /* Spacing (8px grid) */
  --vmp-space-1: 0.25rem;     /* 4px */
  --vmp-space-2: 0.5rem;      /* 8px */
  --vmp-space-3: 0.75rem;     /* 12px */
  --vmp-space-4: 1rem;        /* 16px */
  --vmp-space-6: 1.5rem;      /* 24px */
  --vmp-space-8: 2rem;        /* 32px */
  
  /* Line Heights */
  --vmp-line-height-tight: 1.3;
  --vmp-line-height-normal: 1.5;
  --vmp-line-height-relaxed: 1.6;
  --vmp-line-height-loose: 1.75;
  
  /* Letter Spacing */
  --vmp-letter-spacing-normal: 0;
  --vmp-letter-spacing-wide: 0.01em;
  --vmp-letter-spacing-wider: 0.02em;
  
  /* Border Radius */
  --vmp-radius-sm: 6px;
  --vmp-radius-md: 8px;
  --vmp-radius-lg: 12px;
  --vmp-radius-xl: 14px;
  --vmp-radius-2xl: 20px;
}
```

**Token Transformation:** None - direct CSS variable usage

---

### 2. Foundation Layer (Typography & Spacing Only)

**Location:** `public/globals.css` (CSS classes)

**Architecture:** Semantic typography hierarchy + spacing tokens

**Foundation Classes (Required for Consistency):**

#### Typography Hierarchy
- `.vmp-h1` through `.vmp-h6` - Semantic heading classes
- `.vmp-body`, `.vmp-body-large`, `.vmp-body-small` - Body text
- `.vmp-label`, `.vmp-label-strong`, `.vmp-label-section` - Labels
- `.vmp-caption` - Captions
- `.vmp-code`, `.vmp-code-small` - Code/IDs

**Why:** Typography hierarchy ensures consistent information architecture and readability across all pages.

#### Data Presentation Components (Optional)
- `.vmp-table` - Tables (for consistent data display)
- `.vmp-list`, `.vmp-list-item` - Lists (for structured data)

**Why:** Data presentation components maintain consistency for information-heavy interfaces.

**Note:** Visual components (buttons, cards, modals, etc.) are **NOT** in the foundation layer. Designers have full creative freedom to style these as needed using inline styles, custom CSS, or Tailwind utilities.

---

### 3. Frameworks & Libraries

**UI Framework:** None (Vanilla HTML)

**Styling Framework:** 
- Tailwind CDN (utilities only, NO custom config)
- Custom CSS in `public/globals.css` (SSOT)

**JavaScript Framework:**
- Alpine.js (minimal state management)
- HTMX (server-side rendering, cell swapping)

**Build System:** None (server-side templates)

**Bundler:** None (CDN-based)

**Template Engine:** Server-side (appears to be Python/Jinja2 based on template syntax)

---

### 4. Asset Management

**Location:** `public/` directory

**Storage:** Local filesystem

**Asset Optimization:** Not specified (likely handled by server)

**CDN Configuration:** None (local assets)

**Image Formats:** Standard web formats (SVG, PNG, JPG)

---

### 5. Icon System

**Location:** Inline SVG in templates

**Usage Pattern:**
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="..."/>
</svg>
```

**Naming Convention:** None (inline SVG)

**Icon Library:** Heroicons (based on viewBox patterns)

**Size Classes:** Tailwind utilities (`w-4 h-4`, `w-5 h-5`, etc.)

---

### 6. Styling Approach

**CSS Methodology:** Utility-first with semantic classes

**Global Styles:** `public/globals.css` (SSOT - Single Source of Truth)

**Scoping:** `html[data-surface="vmp"]` - All styles scoped to VMP surface

**Responsive Design:** Tailwind breakpoints (sm, md, lg, xl)

**CSS Architecture:**
- CSS Custom Properties (design tokens) - Foundation layer
- Semantic typography classes (`.vmp-h*`, `.vmp-body`, `.vmp-label`) - Foundation layer
- Spacing tokens (`--vmp-space-*`) - Foundation layer
- Tailwind CDN utilities (layout, spacing) - Available for creative use
- **Inline styles ALLOWED** - For creative visual design
- **`<style>` blocks ALLOWED** - For component-specific styling
- NO CSS Modules
- NO Styled Components

---

### 7. Project Structure

```
AIBOS-VMP/
├── public/
│   └── globals.css          # SSOT - All styling
├── src/
│   └── views/
│       ├── layout.html       # Root layout
│       ├── pages/            # Page templates
│       └── partials/         # Reusable partials
├── .dev/
│   └── dev-contract/
│       └── contract-001-design-system.md  # Design system contract
└── [documentation files]
```

**Pattern:** Server-side templates with partials

**Feature Organization:** By page/partial, not by feature

---

## Figma MCP Integration Patterns

### Mapping Figma Text Styles to VMP Classes

| Figma Text Style | VMP Class | Size | Font | Use Case |
|------------------|-----------|------|------|----------|
| Heading 1 / H1 | `.vmp-h1` | 64px | Playfair Display | Hero titles |
| Heading 2 / H2 | `.vmp-h2` | 48px | Playfair Display | Page titles |
| Heading 3 / H3 | `.vmp-h3` | 40px | Playfair Display | Section headings |
| Heading 4 / H4 | `.vmp-h4` | 32px | Playfair Display | Subsection headings |
| Heading 5 / H5 | `.vmp-h5` | 24px | Liter | Card titles |
| Heading 6 / H6 | `.vmp-h6` | 20px | Liter | Small headings |
| Body / Body Large | `.vmp-body-large` | 18px | Liter | Important body text |
| Body | `.vmp-body` | 16px | Liter | Primary body text |
| Body Small | `.vmp-body-small` | 14px | Liter | Secondary body text |
| Label / Caption | `.vmp-label` | 12px | JetBrains Mono | Labels, captions |
| Code | `.vmp-code` | 14px | JetBrains Mono | Code, IDs |

### Mapping Figma Colors to VMP Tokens

| Figma Color | VMP Token | Usage |
|-------------|-----------|-------|
| Background Primary | `var(--vmp-bg)` | Main background |
| Background Secondary | `var(--vmp-bg2)` | Secondary background |
| Panel | `var(--vmp-panel)` | Panel backgrounds |
| Text Primary | `var(--vmp-text)` | Primary text |
| Text Muted | `var(--vmp-muted)` | Secondary text |
| Text Subtle | `var(--vmp-subtle)` | Tertiary text |
| Success | `var(--vmp-ok)` | Success states |
| Warning | `var(--vmp-warn)` | Warning states |
| Error | `var(--vmp-danger)` | Error states |
| Border | `var(--vmp-border)` | Standard borders |
| Border Emphasized | `var(--vmp-border2)` | Emphasized borders |

### Mapping Figma Spacing to VMP Tokens

| Figma Spacing | VMP Token | Value |
|---------------|-----------|-------|
| 4px | `var(--vmp-space-1)` | 0.25rem |
| 8px | `var(--vmp-space-2)` | 0.5rem |
| 12px | `var(--vmp-space-3)` | 0.75rem |
| 16px | `var(--vmp-space-4)` | 1rem |
| 20px | `var(--vmp-space-5)` | 1.25rem |
| 24px | `var(--vmp-space-6)` | 1.5rem |
| 32px | `var(--vmp-space-8)` | 2rem |
| 40px | `var(--vmp-space-10)` | 2.5rem |
| 48px | `var(--vmp-space-12)` | 3rem |
| 64px | `var(--vmp-space-16)` | 4rem |

### Visual Components: Creative Freedom

**Important:** Visual components (buttons, cards, modals, badges, etc.) are **NOT** mapped to prescriptive VMP classes. Designers have full creative freedom to:

1. **Use Figma's generated code directly** - Keep the visual design as-is
2. **Apply custom styling** - Use inline styles, `<style>` blocks, or Tailwind utilities
3. **Reference foundation tokens** - Use `var(--vmp-space-*)` for spacing, semantic colors for meaning

**Example:**
```html
<!-- Creative button design from Figma -->
<button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               padding: var(--vmp-space-4) var(--vmp-space-6);
               border-radius: var(--vmp-radius-lg);">
  Get Started
</button>

<!-- Or use Figma's generated classes directly -->
<button class="figma-button-primary">Get Started</button>
```

**Data Presentation Only:**
- Tables → Use `.vmp-table` for consistent data display
- Lists → Use `.vmp-list` for structured data presentation

---

## Using Figma MCP Tools

### 1. Get Design Context from Figma

**Tool:** `mcp_Figma_get_design_context`

**Usage:**
```javascript
// Extract code from Figma node
mcp_Figma_get_design_context({
  nodeId: "123:456",
  fileKey: "abc123",
  clientLanguages: "html,css,javascript",
  clientFrameworks: "tailwindcss,alpinejs,htmx"
})
```

**Output:** HTML/CSS code that can be adapted to use VMP classes

**Mapping Strategy (Foundation Layer Only):**
1. **Typography:** Replace Figma text styles with VMP semantic classes (`.vmp-h1` through `.vmp-h6`, `.vmp-body`, `.vmp-label`)
2. **Spacing:** Replace Figma spacing with VMP spacing tokens (`var(--vmp-space-*)`)
3. **Semantic Colors:** Replace Figma semantic colors (success, error, text hierarchy) with VMP tokens
4. **Visual Design:** Keep Figma's visual components as-is or customize freely (no prescriptive mapping)

### 2. Get Screenshot from Figma

**Tool:** `mcp_Figma_get_screenshot`

**Usage:**
```javascript
mcp_Figma_get_screenshot({
  nodeId: "123:456",
  fileKey: "abc123"
})
```

**Use Case:** Visual reference for implementation

### 3. Get Variable Definitions

**Tool:** `mcp_Figma_get_variable_defs`

**Usage:**
```javascript
mcp_Figma_get_variable_defs({
  nodeId: "123:456",
  fileKey: "abc123"
})
```

**Use Case:** Extract design tokens from Figma to sync with VMP tokens

### 4. Generate Diagram

**Tool:** `mcp_Figma_generate_diagram`

**Usage:**
```javascript
mcp_Figma_generate_diagram({
  name: "User Flow",
  mermaidSyntax: "graph LR\nA[Start] --> B[Process] --> C[End]"
})
```

**Use Case:** Create flowcharts, sequence diagrams in FigJam

---

## Code Generation Workflow

### Step 1: Extract from Figma

```javascript
// Get design context from Figma
const figmaCode = await mcp_Figma_get_design_context({
  nodeId: "123:456",
  fileKey: "abc123",
  clientLanguages: "html,css,javascript",
  clientFrameworks: "tailwindcss,alpinejs,htmx"
});
```

### Step 2: Map Foundation Layer Only

**Example Transformation:**

**Figma Output:**
```html
<div class="text-base text-gray-900">
  <h1 class="text-4xl font-bold">Welcome</h1>
  <p class="text-base">Get started today</p>
  <button class="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
    Get Started
  </button>
</div>
```

**VMP Foundation Mapped (Typography + Spacing):**
```html
<div>
  <h1 class="vmp-h2">Welcome</h1>
  <p class="vmp-body">Get started today</p>
  <!-- Keep Figma's creative button design -->
  <button class="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg"
          style="padding: var(--vmp-space-4) var(--vmp-space-6);">
    Get Started
  </button>
</div>
```

### Step 3: Apply Foundation Tokens

**Replace (Foundation Only):**
- **Typography** → Semantic classes (`.vmp-h*`, `.vmp-body`, `.vmp-label`)
- **Spacing** → `var(--vmp-space-*)` tokens (optional, for consistency)
- **Semantic Colors** → `var(--vmp-text)`, `var(--vmp-ok)`, `var(--vmp-danger)` (for meaning, not visual design)

**Keep (Creative Freedom):**
- Visual colors, gradients, effects
- Component styling
- Layout variations

---

## Best Practices

### 1. Foundation Layer: Typography Hierarchy (Required)

**❌ Don't:**
```html
<div class="text-4xl font-bold">Title</div>
```

**✅ Do:**
```html
<h1 class="vmp-h2">Title</h1>
```

**Why:** Typography hierarchy ensures consistent information architecture and accessibility.

### 2. Foundation Layer: Spacing Tokens (Recommended)

**❌ Don't:**
```html
<div style="padding: 24px; margin: 16px;">Content</div>
```

**✅ Do:**
```html
<div style="padding: var(--vmp-space-6); margin: var(--vmp-space-4);">Content</div>
<!-- Or use Tailwind: class="p-6 m-4" -->
```

**Why:** Consistent spacing creates visual rhythm and alignment.

### 3. Foundation Layer: Semantic Colors (For Meaning Only)

**❌ Don't:**
```html
<div style="color: #10b981;">Success message</div>
```

**✅ Do:**
```html
<div style="color: var(--vmp-ok);">Success message</div>
```

**Why:** Semantic colors convey meaning (success, error, warning) consistently.

### 4. Design Layer: Creative Freedom (Encouraged)

**✅ Allowed:**
```html
<!-- Creative button design -->
<button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
               box-shadow: 0 10px 25px rgba(0,0,0,0.2);
               transform: translateY(-2px);">
  Get Started
</button>

<!-- Component-specific styles -->
<style>
  .hero-section {
    background: radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent);
    backdrop-filter: blur(10px);
  }
</style>
```

**Why:** Visual creativity should not be limited by prescriptive component classes.

### 5. Data Presentation: Use Foundation Classes

**✅ Do:**
```html
<table class="vmp-table">
  <tr>
    <th>Name</th>
    <th>Status</th>
  </tr>
</table>
```

**Why:** Data presentation benefits from consistency for readability and scanning.

---

## Example: Converting Figma Design to VMP

### Figma Design
- Heading: "Welcome" (48px, Playfair Display, gradient text)
- Body: "Welcome to the portal" (16px, Liter)
- Button: "Get Started" (Custom gradient background, shadow, hover effects)

### VMP Implementation (Foundation + Creative)

```html
<h1 class="vmp-h2" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                           -webkit-background-clip: text;
                           -webkit-text-fill-color: transparent;">
  Welcome
</h1>
<p class="vmp-body">Welcome to the portal</p>
<button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: var(--vmp-space-4) var(--vmp-space-6);
              border-radius: var(--vmp-radius-lg);
              box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
              transition: transform 0.2s;">
  Get Started
</button>
```

**Key Points:**
- Typography uses foundation classes (`.vmp-h2`, `.vmp-body`)
- Spacing uses foundation tokens (`var(--vmp-space-*)`)
- Visual design (gradients, shadows, effects) is creative and free

---

## Troubleshooting

### Issue: Figma colors don't match VMP

**Solution:** Map Figma colors to VMP CSS variables:
- Figma "Primary" → `var(--vmp-ok)`
- Figma "Error" → `var(--vmp-danger)`
- Figma "Text" → `var(--vmp-text)`

### Issue: Figma spacing doesn't match VMP

**Solution:** Use VMP spacing tokens (8px grid):
- Figma 16px → `var(--vmp-space-4)` or `p-4`
- Figma 24px → `var(--vmp-space-6)` or `p-6`

### Issue: Figma typography doesn't match VMP

**Solution:** Use VMP semantic typography classes:
- Figma "Heading 1" → `.vmp-h1`
- Figma "Body" → `.vmp-body`
- Figma "Label" → `.vmp-label`

---

## Next Steps

1. **Connect Figma File:** Provide Figma file URL or file key
2. **Extract Design Context:** Use `mcp_Figma_get_design_context`
3. **Map Foundation Layer:** 
   - Replace typography with VMP semantic classes (`.vmp-h*`, `.vmp-body`)
   - Replace spacing with VMP tokens (optional, for consistency)
   - Replace semantic colors with VMP tokens (for meaning)
4. **Keep Creative Design:** Preserve Figma's visual components, gradients, effects
5. **Generate Components:** Create reusable partials with foundation + creative styling

---

## Philosophy Summary

**Foundation Layer (CSS):**
- Typography hierarchy (required)
- Spacing system (recommended)
- Semantic color tokens (for meaning)

**Design Layer (HTML/Templates):**
- Full creative freedom
- Inline styles allowed
- `<style>` blocks allowed
- Custom component styling encouraged

**Result:** Consistent information architecture + unlimited visual creativity

---

**Ready to integrate with Figma!** Provide a Figma file URL or node ID to get started.

---

**End of Guide**

