# NexusCanon VMP HTML Boilerplate Templates

This directory contains reusable HTML boilerplate templates for the NexusCanon VMP system.

## Templates

### 1. `page-boilerplate.html`
**Purpose:** Template for creating new full pages that extend the main layout.

**Usage:**
1. Copy `page-boilerplate.html` to `src/views/pages/your-page-name.html`
2. Extend `layout.html` using `{% extends "layout.html" %}`
3. Fill in the `{% block content %}` section with your page content
4. Update the `{% block title %}` with your page title

**Features:**
- ✅ CONTRACT-001 compliant (no inline styles)
- ✅ Uses semantic `.vmp-*` classes
- ✅ Includes page header with label kicker pattern
- ✅ Optional status panel
- ✅ Card-based content sections
- ✅ Responsive grid layout examples

**Example:**
```html
{% extends "layout.html" %}
{% block title %}NexusCanon VMP — Your Page{% endblock %}
{% block content %}
  <!-- Your content here -->
{% endblock %}
```

---

### 2. `partial-boilerplate.html`
**Purpose:** Template for creating HTMX-swappable partial components (cells).

**Usage:**
1. Copy `partial-boilerplate.html` to `src/views/partials/your-component-name.html`
2. Remove the comment block at the top
3. Customize the structure for your component
4. Ensure it's a standalone, swappable fragment (no `{% extends %}`)

**Features:**
- ✅ Standalone HTMX-swappable component
- ✅ CONTRACT-001 compliant (no inline styles)
- ✅ Includes header, content, and footer sections
- ✅ Empty state pattern
- ✅ Form with HTMX integration
- ✅ Loading indicators
- ✅ Alpine.js data structure example

**HTMX Integration:**
```html
<!-- Load this partial -->
<div 
  id="target-element"
  hx-get="/partials/your-component-name?param=value"
  hx-trigger="load"
  hx-swap="innerHTML">
</div>
```

---

## Design System Compliance

Both templates follow **CONTRACT-001** design system rules:

### ✅ Required Practices
- **NO inline styles:** All styling via CSS classes from `globals.css`
- **Semantic classes:** Use `.vmp-*` classes (e.g., `.vmp-h2`, `.vmp-body-small`, `.vmp-panel`)
- **HTMX patterns:** Use `hx-get`, `hx-post`, `hx-target`, `hx-swap` for dynamic updates
- **Alpine.js:** Use `x-data` for client-side state (if needed)
- **Empty states:** Use `.vmp-empty` pattern for empty content
- **Loading states:** Use `.htmx-indicator` for loading feedback

### ❌ Forbidden Practices
- **NO inline `style=""` attributes** (use utility classes like `.vmp-border-color`, `.vmp-bg-panel`, etc.)
- **NO `<style>` blocks in templates**
- **NO Tailwind custom config** (CDN utilities only)
- **NO shadow utilities** (`.shadow-*`, `.ring-*`)
- **NO bold font weights** (use weight 300/light only)
- **NO hardcoded colors** (use CSS variables from `:root`)

**Note:** Some existing partials (e.g., `case_detail.html`) currently use inline styles, which is a drift from CONTRACT-001. The boilerplate templates follow CONTRACT-001 strictly and use utility classes instead. When creating new components, always use utility classes, not inline styles.

---

## Common Patterns

### Status Badges
```html
<span class="vmp-tag vmp-tag-mono">LABEL</span>
<div class="vmp-label vmp-signal-ok">STATUS</div>
```

### Signal Colors
```html
<!-- OK (green) -->
<div class="vmp-signal-ok">Text</div>
<div class="vmp-fill-ok">Background</div>

<!-- WARN (yellow) -->
<div class="vmp-signal-warn">Text</div>
<div class="vmp-fill-warn">Background</div>

<!-- DANGER (red) -->
<div class="vmp-signal-danger">Text</div>
<div class="vmp-fill-danger">Background</div>
```

### Typography Hierarchy
```html
<h1 class="vmp-h1">Heading 1</h1>
<h2 class="vmp-h2">Heading 2</h2>
<h3 class="vmp-h3">Heading 3</h3>
<p class="vmp-body">Body text</p>
<p class="vmp-body-small">Small body text</p>
<div class="vmp-label">Label</div>
<div class="vmp-label-kicker">Kicker</div>
<div class="vmp-caption">Caption</div>
<div class="vmp-code">Code/Mono</div>
```

### Form Controls
```html
<input type="text" class="vmp-form-input" placeholder="Enter value...">
<button type="submit" class="vmp-action-button vmp-action-button-primary">Submit</button>
<button type="button" class="vmp-action-button vmp-action-button-ghost">Cancel</button>
```

### Cards/Panels
```html
<section class="vmp-card">
  <header class="vmp-card-header">Header</header>
  <div class="p-6">Content</div>
</section>

<div class="vmp-panel p-4">Panel content</div>
```

---

## Verification

After creating a new template, verify CONTRACT-001 compliance:

```powershell
# 1) No inline styles
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "style=" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 2) No <style> blocks
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "<style" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 3) No tailwind.config overrides
Get-ChildItem -Path src\views -Recurse -File | Select-String -Pattern "tailwind\.config" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0
```

---

## Reference

- **Design System Contract:** `.dev/dev-contract/contract-001-design-system.md`
- **Global Styles:** `public/globals.css`
- **Main Layout:** `src/views/layout.html`
- **Example Pages:** `src/views/pages/`
- **Example Partials:** `src/views/partials/`

---

**Last Updated:** 2025-01-20  
**Version:** 1.0.0

