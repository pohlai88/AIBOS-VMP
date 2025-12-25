# Supabase Complete Design System - Usage Guide

## 📋 Overview

This guide covers the complete Supabase design system now integrated into your VMP application, including:
- ✅ Typography (fonts, sizes, weights, line heights)
- ✅ Spacing (margin, padding, gaps)
- ✅ Sizing (width, height)
- ✅ Border radius
- ✅ Shadows
- ✅ Colors (brand, destructive, warning, backgrounds, borders)
- ✅ Z-index
- ✅ Transitions & animations
- ✅ Opacity

## 🎨 Complete Token Reference

### 1️⃣ TYPOGRAPHY

#### Font Families
```css
font-family: var(--font-family-body);     /* Inter, system fonts */
font-family: var(--font-family-mono);     /* Monospace for code */
font-family: var(--font-family-heading);  /* Headings */
```

#### Font Sizes
```css
/* Standard scale (12px - 128px) */
font-size: var(--font-size-xs);      /* 12px */
font-size: var(--font-size-sm);      /* 14px */
font-size: var(--font-size-base);    /* 16px */
font-size: var(--font-size-lg);      /* 18px */
font-size: var(--font-size-xl);      /* 20px */
font-size: var(--font-size-2xl);     /* 24px */
font-size: var(--font-size-3xl);     /* 30px */
font-size: var(--font-size-4xl);     /* 36px */
font-size: var(--font-size-5xl);     /* 48px */
font-size: var(--font-size-6xl);     /* 60px */
font-size: var(--font-size-7xl);     /* 72px */
font-size: var(--font-size-8xl);     /* 96px */
font-size: var(--font-size-9xl);     /* 128px */

/* Component-specific sizes */
font-size: var(--font-size-tiny);    /* 12px - tiny components */
font-size: var(--font-size-small);   /* 14px - small components */
font-size: var(--font-size-medium);  /* 14px - medium components */
font-size: var(--font-size-large);   /* 16px - large components */
font-size: var(--font-size-xlarge);  /* 16px - xlarge components */
```

**HTML Examples:**
```html
<h1 style="font-size: var(--font-size-4xl); font-weight: var(--font-weight-bold);">
  Main Heading
</h1>
<p style="font-size: var(--font-size-base); line-height: var(--line-height-relaxed);">
  Body text with comfortable reading line height.
</p>
<small style="font-size: var(--font-size-xs); color: hsl(var(--foreground-muted));">
  Caption or helper text
</small>
```

#### Font Weights
```css
font-weight: var(--font-weight-light);      /* 300 */
font-weight: var(--font-weight-normal);     /* 400 */
font-weight: var(--font-weight-medium);     /* 500 */
font-weight: var(--font-weight-semibold);   /* 600 */
font-weight: var(--font-weight-bold);       /* 700 */
font-weight: var(--font-weight-extrabold);  /* 800 */
font-weight: var(--font-weight-black);      /* 900 */
```

#### Line Heights
```css
/* Relative line heights */
line-height: var(--line-height-none);     /* 1 */
line-height: var(--line-height-tight);    /* 1.25 */
line-height: var(--line-height-snug);     /* 1.375 */
line-height: var(--line-height-normal);   /* 1.5 */
line-height: var(--line-height-relaxed);  /* 1.625 */
line-height: var(--line-height-loose);    /* 2 */

/* Fixed line heights (12px - 40px) */
line-height: var(--line-height-3);  /* 12px */
line-height: var(--line-height-4);  /* 16px */
line-height: var(--line-height-5);  /* 20px */
line-height: var(--line-height-6);  /* 24px */
line-height: var(--line-height-7);  /* 28px */
line-height: var(--line-height-8);  /* 32px */
line-height: var(--line-height-9);  /* 36px */
line-height: var(--line-height-10); /* 40px */
```

#### Letter Spacing
```css
letter-spacing: var(--letter-spacing-tighter);  /* -0.05em */
letter-spacing: var(--letter-spacing-tight);    /* -0.025em */
letter-spacing: var(--letter-spacing-normal);   /* 0 */
letter-spacing: var(--letter-spacing-wide);     /* 0.025em */
letter-spacing: var(--letter-spacing-wider);    /* 0.05em */
letter-spacing: var(--letter-spacing-widest);   /* 0.1em */
```

---

### 2️⃣ SPACING (Margin, Padding, Gap)

Complete spacing scale from 0 to 384px:

```css
/* Common spacings */
margin: var(--spacing-0);    /* 0 */
margin: var(--spacing-1);    /* 4px */
margin: var(--spacing-2);    /* 8px */
margin: var(--spacing-3);    /* 12px */
margin: var(--spacing-4);    /* 16px */
margin: var(--spacing-5);    /* 20px */
margin: var(--spacing-6);    /* 24px */
margin: var(--spacing-8);    /* 32px */
margin: var(--spacing-10);   /* 40px */
margin: var(--spacing-12);   /* 48px */
margin: var(--spacing-16);   /* 64px */
margin: var(--spacing-20);   /* 80px */
margin: var(--spacing-24);   /* 96px */
margin: var(--spacing-32);   /* 128px */
margin: var(--spacing-64);   /* 256px */
margin: var(--spacing-96);   /* 384px */

/* Semantic spacings (Supabase recommended) */
gap: var(--spacing-xs);   /* 4px - tight spacing */
gap: var(--spacing-sm);   /* 8px - small spacing */
gap: var(--spacing-md);   /* 16px - medium spacing */
gap: var(--spacing-lg);   /* 32px - large spacing */
gap: var(--spacing-xl);   /* 64px - extra large spacing */
gap: var(--spacing-2xl);  /* 96px */
gap: var(--spacing-3xl);  /* 128px */
```

**HTML Examples:**
```html
<!-- Card with semantic spacing -->
<div style="
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-4);
  gap: var(--spacing-3);
">
  <h3 style="margin-bottom: var(--spacing-2);">Card Title</h3>
  <p style="margin-bottom: var(--spacing-4);">Card content</p>
</div>

<!-- Flex container with gap -->
<div style="display: flex; gap: var(--spacing-md);">
  <button>Button 1</button>
  <button>Button 2</button>
</div>

<!-- Section spacing -->
<section style="
  padding-top: var(--spacing-16);
  padding-bottom: var(--spacing-16);
  margin-bottom: var(--spacing-8);
">
  <!-- Content -->
</section>
```

#### Component Padding Presets
```css
/* Supabase button/input padding patterns */
padding: var(--padding-tiny);    /* 4px 10px */
padding: var(--padding-small);   /* 8px 12px */
padding: var(--padding-medium);  /* 8px 16px */
padding: var(--padding-large);   /* 8px 16px */
padding: var(--padding-xlarge);  /* 12px 24px */
```

**Button Example:**
```html
<button style="
  padding: var(--padding-medium);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-button);
">
  Medium Button
</button>

<button style="
  padding: var(--padding-xlarge);
  font-size: var(--font-size-base);
  border-radius: var(--radius-button);
">
  Extra Large Button
</button>
```

---

### 3️⃣ SIZING (Width, Height)

#### Component Heights
```css
/* Standard component heights (Supabase sizes) */
height: var(--height-tiny);     /* 26px */
height: var(--height-small);    /* 34px */
height: var(--height-medium);   /* 38px */
height: var(--height-large);    /* 42px */
height: var(--height-xlarge);   /* 50px */

/* Inner/nested component heights */
height: var(--height-inner-tiny);    /* 24px */
height: var(--height-inner-small);   /* 28px */
height: var(--height-inner-medium);  /* 32px */
height: var(--height-inner-large);   /* 36px */
height: var(--height-inner-xlarge);  /* 44px */
```

**Input Field Example:**
```html
<input 
  type="text" 
  style="
    height: var(--height-medium);
    padding: 0 var(--spacing-3);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-input);
    border: 1px solid hsl(var(--border-default));
  "
>
```

#### Width Scale
```css
/* Special widths */
width: var(--width-listbox);  /* 320px - Supabase dropdowns */

/* Standard widths */
width: var(--width-xs);   /* 320px */
width: var(--width-sm);   /* 384px */
width: var(--width-md);   /* 448px */
width: var(--width-lg);   /* 512px */
width: var(--width-xl);   /* 576px */
width: var(--width-2xl);  /* 672px */
width: var(--width-3xl);  /* 768px */
width: var(--width-4xl);  /* 896px */
width: var(--width-5xl);  /* 1024px */
width: var(--width-6xl);  /* 1152px */
width: var(--width-7xl);  /* 1280px */
```

**Modal Example:**
```html
<div style="
  width: var(--width-md);
  max-width: 90vw;
  padding: var(--spacing-6);
  border-radius: var(--radius-modal);
  background: hsl(var(--background-surface-100));
">
  <h2>Modal Title</h2>
  <!-- Content -->
</div>
```

#### General Sizing Scale (same as spacing)
```css
width: var(--sizing-4);   /* 16px */
width: var(--sizing-8);   /* 32px */
width: var(--sizing-12);  /* 48px */
width: var(--sizing-16);  /* 64px */
width: var(--sizing-20);  /* 80px */
/* ... up to var(--sizing-96) = 384px */
```

---

### 4️⃣ BORDER RADIUS

```css
/* Standard radius scale */
border-radius: var(--radius-none);  /* 0 */
border-radius: var(--radius-sm);    /* 2px */
border-radius: var(--radius-base);  /* 4px */
border-radius: var(--radius-md);    /* 6px */
border-radius: var(--radius-lg);    /* 8px */
border-radius: var(--radius-xl);    /* 12px */
border-radius: var(--radius-2xl);   /* 16px */
border-radius: var(--radius-3xl);   /* 24px */
border-radius: var(--radius-full);  /* 9999px - fully rounded */
border-radius: var(--radius);       /* 8px - default */

/* Component-specific */
border-radius: var(--radius-button);  /* 6px */
border-radius: var(--radius-input);   /* 6px */
border-radius: var(--radius-card);    /* 8px */
border-radius: var(--radius-modal);   /* 8px */
```

**Usage Examples:**
```html
<!-- Button with standard radius -->
<button style="border-radius: var(--radius-button);">Click Me</button>

<!-- Card with larger radius -->
<div style="border-radius: var(--radius-card); padding: var(--spacing-6);">
  Card content
</div>

<!-- Fully rounded avatar -->
<img src="avatar.jpg" style="
  width: var(--sizing-12);
  height: var(--sizing-12);
  border-radius: var(--radius-full);
">

<!-- Badge with full rounding -->
<span style="
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  background: hsl(var(--brand-200));
">
  New
</span>
```

---

### 5️⃣ SHADOWS

```css
/* Standard shadows (light theme friendly) */
box-shadow: var(--shadow-xs);    /* Very subtle */
box-shadow: var(--shadow-sm);    /* Small */
box-shadow: var(--shadow);       /* Default */
box-shadow: var(--shadow-md);    /* Medium */
box-shadow: var(--shadow-lg);    /* Large */
box-shadow: var(--shadow-xl);    /* Extra large */
box-shadow: var(--shadow-2xl);   /* Massive */
box-shadow: var(--shadow-inner); /* Inset shadow */
box-shadow: var(--shadow-none);  /* No shadow */

/* Dark mode optimized shadows (stronger) */
box-shadow: var(--shadow-dark-sm);
box-shadow: var(--shadow-dark);
box-shadow: var(--shadow-dark-md);
box-shadow: var(--shadow-dark-lg);
```

**Usage Examples:**
```html
<!-- Elevated card -->
<div style="
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-card);
  padding: var(--spacing-6);
">
  Elevated card content
</div>

<!-- Dropdown menu -->
<div style="
  box-shadow: var(--shadow-xl);
  border-radius: var(--radius-md);
  background: hsl(var(--background-surface-100));
">
  <ul><!-- Menu items --></ul>
</div>

<!-- Button with subtle shadow on hover -->
<button style="
  transition: var(--transition-shadow);
" 
onmouseover="this.style.boxShadow='var(--shadow-md)'"
onmouseout="this.style.boxShadow='var(--shadow-sm)'">
  Hover Me
</button>
```

---

### 6️⃣ Z-INDEX

```css
/* Standard z-index */
z-index: var(--z-0);   /* 0 */
z-index: var(--z-10);  /* 10 */
z-index: var(--z-20);  /* 20 */
z-index: var(--z-30);  /* 30 */
z-index: var(--z-40);  /* 40 */
z-index: var(--z-50);  /* 50 */

/* Semantic component z-index (proper stacking) */
z-index: var(--z-dropdown);        /* 1000 */
z-index: var(--z-sticky);          /* 1020 */
z-index: var(--z-fixed);           /* 1030 */
z-index: var(--z-modal-backdrop);  /* 1040 */
z-index: var(--z-modal);           /* 1050 */
z-index: var(--z-popover);         /* 1060 */
z-index: var(--z-tooltip);         /* 1070 */
z-index: var(--z-toast);           /* 1080 */
z-index: var(--z-notification);    /* 1090 */
```

**Usage:**
```html
<!-- Fixed header -->
<header style="position: fixed; z-index: var(--z-fixed);">
  Navigation
</header>

<!-- Modal backdrop -->
<div style="
  position: fixed;
  inset: 0;
  background: var(--background-overlay);
  z-index: var(--z-modal-backdrop);
"></div>

<!-- Modal -->
<div style="
  position: fixed;
  z-index: var(--z-modal);
">
  Modal content
</div>

<!-- Toast notification -->
<div style="
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  z-index: var(--z-toast);
">
  Success notification
</div>
```

---

### 7️⃣ TRANSITIONS

```css
/* Duration */
transition-duration: var(--transition-duration-75);
transition-duration: var(--transition-duration-150);   /* Common default */
transition-duration: var(--transition-duration-300);
transition-duration: var(--transition-duration-500);

/* Timing functions */
transition-timing-function: var(--transition-timing-linear);
transition-timing-function: var(--transition-timing-in);
transition-timing-function: var(--transition-timing-out);
transition-timing-function: var(--transition-timing-in-out);  /* Common default */

/* Common transition presets (ready to use) */
transition: var(--transition-all);       /* All properties */
transition: var(--transition-colors);    /* Color, bg, border */
transition: var(--transition-opacity);   /* Opacity only */
transition: var(--transition-shadow);    /* Box shadow */
transition: var(--transition-transform); /* Transform */
```

**Usage Examples:**
```html
<!-- Button with color transition -->
<button style="
  background: hsl(var(--brand-default));
  transition: var(--transition-colors);
"
onmouseover="this.style.background='hsl(var(--brand-600))'"
onmouseout="this.style.background='hsl(var(--brand-default))'">
  Hover Me
</button>

<!-- Fade in element -->
<div style="
  opacity: 0;
  transition: var(--transition-opacity);
  transition-duration: var(--transition-duration-300);
">
  Content fades in
</div>

<!-- Scale on hover -->
<div style="
  transition: var(--transition-transform);
  transition-duration: var(--transition-duration-150);
"
onmouseover="this.style.transform='scale(1.05)'"
onmouseout="this.style.transform='scale(1)'">
  Hover to scale
</div>
```

---

### 8️⃣ OPACITY

```css
opacity: var(--opacity-0);    /* 0 */
opacity: var(--opacity-5);    /* 0.05 */
opacity: var(--opacity-10);   /* 0.1 */
opacity: var(--opacity-25);   /* 0.25 */
opacity: var(--opacity-50);   /* 0.5 */
opacity: var(--opacity-75);   /* 0.75 */
opacity: var(--opacity-100);  /* 1 */
```

---

### 9️⃣ COLORS

All colors already documented in your `SUPABASE_DESIGN_TOKENS_GUIDE.md`, including:
- Brand (Supabase green)
- Destructive (red)
- Warning (amber)
- Success (green - different from brand)
- Foreground/text colors
- Background/surface colors
- Border colors
- Chart colors

---

## 🎯 Common Component Patterns

### Button Styles

```html
<!-- Primary Button (Supabase Green) -->
<button style="
  padding: var(--padding-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-button);
  height: var(--height-medium);
  background: hsl(var(--brand-default));
  color: #000000;
  border: 1px solid hsl(var(--brand-default));
  transition: var(--transition-colors);
  cursor: pointer;
">
  Primary Action
</button>

<!-- Danger Button -->
<button style="
  padding: var(--padding-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-button);
  height: var(--height-medium);
  background: hsl(var(--destructive-default));
  color: #ffffff;
  border: 1px solid hsl(var(--destructive-default));
  transition: var(--transition-colors);
  cursor: pointer;
">
  Delete
</button>

<!-- Ghost Button -->
<button style="
  padding: var(--padding-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-button);
  height: var(--height-medium);
  background: transparent;
  color: hsl(var(--foreground-default));
  border: 1px solid hsl(var(--border-default));
  transition: var(--transition-all);
  cursor: pointer;
">
  Secondary
</button>
```

### Input Fields

```html
<input 
  type="text" 
  placeholder="Enter text..."
  style="
    width: 100%;
    height: var(--height-medium);
    padding: 0 var(--spacing-3);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-body);
    border-radius: var(--radius-input);
    border: 1px solid hsl(var(--border-default));
    background: hsl(var(--background-surface-200));
    color: hsl(var(--foreground-default));
    transition: var(--transition-colors);
  "
  onfocus="this.style.borderColor='hsl(var(--brand-default))'"
  onblur="this.style.borderColor='hsl(var(--border-default))'"
>
```

### Card Component

```html
<div style="
  background: hsl(var(--background-surface-100));
  border: 1px solid hsl(var(--border-default));
  border-radius: var(--radius-card);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-shadow);
"
onmouseover="this.style.boxShadow='var(--shadow-md)'"
onmouseout="this.style.boxShadow='var(--shadow-sm)'">
  
  <h3 style="
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--spacing-2);
    color: hsl(var(--foreground-default));
  ">
    Card Title
  </h3>
  
  <p style="
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
    color: hsl(var(--foreground-light));
    margin-bottom: var(--spacing-4);
  ">
    Card description text goes here.
  </p>
  
  <button style="
    padding: var(--padding-small);
    font-size: var(--font-size-xs);
    border-radius: var(--radius-button);
    background: hsl(var(--brand-default));
    color: #000000;
    border: none;
  ">
    Action
  </button>
</div>
```

### Modal

```html
<!-- Backdrop -->
<div style="
  position: fixed;
  inset: 0;
  background: hsl(var(--background-overlay));
  z-index: var(--z-modal-backdrop);
  opacity: var(--opacity-80);
"></div>

<!-- Modal -->
<div style="
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: var(--width-md);
  max-width: 90vw;
  background: hsl(var(--background-surface-100));
  border: 1px solid hsl(var(--border-default));
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-2xl);
  z-index: var(--z-modal);
">
  <!-- Header -->
  <div style="
    padding: var(--spacing-6);
    border-bottom: 1px solid hsl(var(--border-default));
  ">
    <h2 style="
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: hsl(var(--foreground-default));
    ">
      Modal Title
    </h2>
  </div>
  
  <!-- Content -->
  <div style="padding: var(--spacing-6);">
    <p style="
      font-size: var(--font-size-sm);
      line-height: var(--line-height-relaxed);
      color: hsl(var(--foreground-light));
    ">
      Modal content goes here.
    </p>
  </div>
  
  <!-- Footer -->
  <div style="
    padding: var(--spacing-4) var(--spacing-6);
    background: hsl(var(--background-surface-200));
    border-top: 1px solid hsl(var(--border-default));
    border-radius: 0 0 var(--radius-modal) var(--radius-modal);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-2);
  ">
    <button style="
      padding: var(--padding-medium);
      border-radius: var(--radius-button);
      background: transparent;
      border: 1px solid hsl(var(--border-default));
    ">
      Cancel
    </button>
    <button style="
      padding: var(--padding-medium);
      border-radius: var(--radius-button);
      background: hsl(var(--brand-default));
      color: #000000;
      border: none;
    ">
      Confirm
    </button>
  </div>
</div>
```

---

## 📁 Files Updated

1. **`public/supabase-design-system-complete.css`** (NEW)
   - Complete Supabase design tokens
   - 600+ lines of design tokens
   - Dark + light theme support

2. **`public/globals.css`**
   - Now imports `supabase-design-system-complete.css`
   - All existing Supabase color usage remains compatible

---

## 🚀 Next Steps

1. **Test the design system:**
   ```bash
   npm run dev
   ```

2. **Start using new tokens:**
   - Replace hardcoded font sizes with `var(--font-size-*)`
   - Replace hardcoded spacing with `var(--spacing-*)`
   - Use semantic component heights `var(--height-*)`
   - Apply consistent border radius `var(--radius-*)`

3. **Build components with tokens:**
   - All values are now consistent and themeable
   - Easy to adjust globally
   - Professional Supabase design patterns

---

## 🎨 Typography Examples in Real HTML

```html
<!-- Heading Hierarchy -->
<h1 style="font-size: var(--font-size-4xl); font-weight: var(--font-weight-bold); margin-bottom: var(--spacing-4);">
  Page Title (36px, Bold)
</h1>

<h2 style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold); margin-bottom: var(--spacing-3);">
  Section Heading (24px, Semibold)
</h2>

<h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); margin-bottom: var(--spacing-2);">
  Subsection (18px, Medium)
</h3>

<!-- Body Text -->
<p style="font-size: var(--font-size-base); line-height: var(--line-height-relaxed); color: hsl(var(--foreground-default));">
  Regular body paragraph (16px, 1.625 line height)
</p>

<p style="font-size: var(--font-size-sm); line-height: var(--line-height-normal); color: hsl(var(--foreground-light));">
  Smaller secondary text (14px, 1.5 line height)
</p>

<small style="font-size: var(--font-size-xs); color: hsl(var(--foreground-muted));">
  Caption or helper text (12px, muted color)
</small>

<!-- Code/Monospace -->
<code style="
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  padding: var(--spacing-1) var(--spacing-2);
  background: hsl(var(--background-surface-200));
  border-radius: var(--radius-sm);
">
  const greeting = 'Hello';
</code>
```

---

## ✅ Benefits

- **Complete design system** - All tokens in one place
- **Professional patterns** - Following Supabase's proven designs
- **Easy theming** - Switch light/dark with one attribute
- **Consistent spacing** - No more random pixel values
- **Accessible** - WCAG-compliant contrast ratios built-in
- **Maintainable** - Change once, update everywhere
- **Developer-friendly** - Clear naming conventions

---

Enjoy your complete Supabase design system! 🎉
