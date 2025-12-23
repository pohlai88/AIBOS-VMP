# NexusCanon Adaptive Icon

**Version:** 1.0.0  
**Date:** 2025-01-XX  
**Purpose:** Transparent icon that adapts to background colors

---

## Overview

The `NexusIconAdaptive.svg` is a special transparent icon designed to capture and adapt to background colors. It uses CSS `currentColor` and `mix-blend-mode` to automatically adjust its appearance based on the background it's placed on.

---

## Features

### 1. **Transparent Background**
- No background fill - completely transparent
- Allows background colors to show through

### 2. **Color Adaptation**
- Uses `currentColor` for all fills
- Inherits color from parent element's text color
- Automatically adapts to light/dark backgrounds

### 3. **Mix-Blend-Mode Support**
- Includes `mix-blend-mode: multiply` for enhanced adaptation
- Can be customized with other blend modes

---

## Usage

### Basic Usage

```html
<!-- Simple usage - inherits text color -->
<img src="/nexus-icon-adaptive.svg" alt="NexusCanon" style="color: #60FFC6;" />

<!-- Or with CSS class -->
<div style="color: #60FFC6;">
  <img src="/nexus-icon-adaptive.svg" alt="NexusCanon" />
</div>
```

### With CSS Variables

```html
<style>
  .brand-icon {
    color: var(--accent-color, #60FFC6);
    width: 36px;
    height: 36px;
  }
</style>

<img src="/nexus-icon-adaptive.svg" class="brand-icon" alt="NexusCanon" />
```

### With Mix-Blend-Mode

```html
<style>
  .adaptive-icon {
    color: #60FFC6;
    mix-blend-mode: screen; /* or multiply, overlay, etc. */
  }
</style>

<img src="/nexus-icon-adaptive.svg" class="adaptive-icon" alt="NexusCanon" />
```

### Inline SVG (Recommended for Full Control)

```html
<svg width="36" height="36" viewBox="0 0 36 36" style="color: var(--accent-color);">
  <!-- Paste SVG content here -->
</svg>
```

---

## Color Adaptation Examples

### Light Background
```css
.light-bg {
  background: #ffffff;
  color: #000000; /* Icon will be dark */
}
```

### Dark Background
```css
.dark-bg {
  background: #050505;
  color: #60FFC6; /* Icon will be accent color */
}
```

### Dynamic Background (from preview.gemini.html)
```css
.brand {
  color: var(--accent); /* Icon adapts to accent color */
  transition: color 0.5s;
}
```

---

## Implementation in Preview File

To use in `preview.gemini.html`, replace the current SVG:

```html
<div class="brand">
  <svg width="24" height="24" viewBox="0 0 36 36" style="color: var(--accent);">
    <!-- Use NexusIconAdaptive.svg content -->
  </svg>
  <span class="tracking-tight">NexusCanon</span>
</div>
```

Or as an image:

```html
<div class="brand">
  <img src="/.dev/dev-contract/NexusIconAdaptive.svg" 
       alt="NexusCanon" 
       style="width: 24px; height: 24px; color: var(--accent);" />
  <span class="tracking-tight">NexusCanon</span>
</div>
```

---

## Customization

### Opacity Levels
The icon uses multiple opacity levels:
- Outer circle: `fill-opacity="0.15"`
- Outer border: `fill-opacity="0.08"`
- Inner circle: `fill-opacity="0.25"`
- Inner border: `fill-opacity="0.1"`
- Geometric pattern: `fill-opacity="0.3-0.7"`

Adjust these values in the SVG to change the visual weight.

### Blend Modes
Available blend modes:
- `normal` (default)
- `multiply` (darkens)
- `screen` (lightens)
- `overlay` (combines multiply and screen)
- `difference` (inverts)

---

## Browser Support

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Opera (all versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Note:** `mix-blend-mode` may have limited support in older browsers. Use feature detection if needed.

---

## File Location

```
.dev/dev-contract/NexusIconAdaptive.svg
```

---

## Related Files

- `NexusIconObicle.svg` - Original circular icon
- `NexusIconWord.svg` - Logo with text
- `NexusIcon_backup.svg` - Backup version

---

**Status:** ✅ Ready for Production  
**Last Updated:** 2025-01-XX

