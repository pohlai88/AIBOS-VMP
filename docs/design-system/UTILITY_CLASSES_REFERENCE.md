# VMP Design System: Comprehensive Utility Classes Reference

**Date:** 2025-01-XX  
**Version:** 2.0.0  
**Status:** ✅ Complete  
**Purpose:** Complete reference guide for all utility classes in the VMP Design System

---

## 🎯 Overview

The VMP Design System now includes **200+ comprehensive utility classes** that map directly to design tokens. All utilities use the `vmp-` prefix for IDE autocomplete and follow Tailwind-like naming conventions.

**Key Benefits:**
- ✅ IDE-friendly autocomplete
- ✅ Direct mapping to design tokens
- ✅ Consistent spacing/colors
- ✅ Faster development
- ✅ Design system compliance

---

## 📚 Utility Classes by Category

### 1. Color Utilities

#### Background Colors
```css
.vmp-bg          /* Primary background */
.vmp-bg-2        /* Secondary background */
.vmp-bg-panel    /* Panel/glass background */
.vmp-bg-veil     /* Veil overlay */
.vmp-bg-ok       /* Success background */
.vmp-bg-warn     /* Warning background */
.vmp-bg-danger   /* Danger background */
```

#### Text Colors
```css
.vmp-text-primary  /* Primary text color */
.vmp-text-muted    /* Muted text (90% opacity) */
.vmp-text-subtle   /* Subtle text (65% opacity) */
.vmp-text-ok       /* Success text */
.vmp-text-warn     /* Warning text */
.vmp-text-danger   /* Danger text */
```

#### Border Colors
```css
.vmp-border-color    /* Standard border */
.vmp-border-color-2 /* Emphasized border */
.vmp-border-ok      /* Success border */
.vmp-border-warn    /* Warning border */
.vmp-border-danger  /* Danger border */
```

**Usage:**
```html
<div class="vmp-bg-panel vmp-text-primary vmp-border-color">
  Content with design system colors
</div>
```

---

### 2. Spacing Utilities

#### Padding (All Directions, All Tokens)
```css
/* All sides */
.vmp-p-0, .vmp-p-1, .vmp-p-2, .vmp-p-3, .vmp-p-4, .vmp-p-5, .vmp-p-6, 
.vmp-p-8, .vmp-p-10, .vmp-p-12, .vmp-p-16

/* Horizontal */
.vmp-px-0, .vmp-px-1, .vmp-px-2, .vmp-px-3, .vmp-px-4, .vmp-px-5, 
.vmp-px-6, .vmp-px-8, .vmp-px-10, .vmp-px-12, .vmp-px-16

/* Vertical */
.vmp-py-0, .vmp-py-1, .vmp-py-2, .vmp-py-3, .vmp-py-4, .vmp-py-5, 
.vmp-py-6, .vmp-py-8, .vmp-py-10, .vmp-py-12, .vmp-py-16

/* Individual directions */
.vmp-pt-0, .vmp-pt-1, .vmp-pt-2, ... /* Top */
.vmp-pb-0, .vmp-pb-1, .vmp-pb-2, ... /* Bottom */
.vmp-pl-0, .vmp-pl-1, .vmp-pl-2, ... /* Left */
.vmp-pr-0, .vmp-pr-1, .vmp-pr-2, ... /* Right */
```

**Token Mapping:**
- `0` = 0px
- `1` = 4px
- `2` = 8px (base unit)
- `3` = 12px
- `4` = 16px
- `5` = 20px
- `6` = 24px
- `8` = 32px
- `10` = 40px
- `12` = 48px
- `16` = 64px

#### Margin (All Directions, All Tokens)
```css
/* All sides */
.vmp-m-0, .vmp-m-1, .vmp-m-2, .vmp-m-3, .vmp-m-4, .vmp-m-5, .vmp-m-6, 
.vmp-m-8, .vmp-m-10, .vmp-m-12, .vmp-m-16

/* Horizontal */
.vmp-mx-0, .vmp-mx-1, .vmp-mx-2, .vmp-mx-3, .vmp-mx-4, .vmp-mx-5, 
.vmp-mx-6, .vmp-mx-8, .vmp-mx-10, .vmp-mx-12, .vmp-mx-16, .vmp-mx-auto

/* Vertical */
.vmp-my-0, .vmp-my-1, .vmp-my-2, .vmp-my-3, .vmp-my-4, .vmp-my-5, 
.vmp-my-6, .vmp-my-8, .vmp-my-10, .vmp-my-12, .vmp-my-16

/* Individual directions */
.vmp-mt-0, .vmp-mt-1, .vmp-mt-2, ..., .vmp-mt-auto /* Top */
.vmp-mb-0, .vmp-mb-1, .vmp-mb-2, ..., .vmp-mb-auto /* Bottom */
.vmp-ml-0, .vmp-ml-1, .vmp-ml-2, ..., .vmp-ml-auto /* Left */
.vmp-mr-0, .vmp-mr-1, .vmp-mr-2, ..., .vmp-mr-auto /* Right */
```

#### Gap (Flexbox/Grid)
```css
.vmp-gap-0, .vmp-gap-1, .vmp-gap-2, .vmp-gap-3, .vmp-gap-4, .vmp-gap-5, 
.vmp-gap-6, .vmp-gap-8, .vmp-gap-10, .vmp-gap-12, .vmp-gap-16
```

**Usage:**
```html
<div class="vmp-p-4 vmp-mb-6 vmp-gap-2">
  <div class="vmp-px-3 vmp-py-2">Item 1</div>
  <div class="vmp-px-3 vmp-py-2">Item 2</div>
</div>
```

---

### 3. Border Radius Utilities

```css
.vmp-rounded-sm    /* 6px */
.vmp-rounded-md    /* 8px */
.vmp-rounded-lg    /* 12px */
.vmp-rounded-xl    /* 14px */
.vmp-rounded-2xl   /* 20px */
.vmp-rounded-none  /* 0px */
.vmp-rounded-full  /* 9999px (circle) */
```

**Usage:**
```html
<button class="vmp-btn vmp-rounded-lg">Rounded Button</button>
<div class="vmp-bg-panel vmp-rounded-md vmp-p-4">Rounded Panel</div>
```

---

### 4. Typography Utilities

#### Font Size
```css
.vmp-text-xs    /* 12px */
.vmp-text-sm    /* 14px */
.vmp-text-base  /* 16px */
.vmp-text-md    /* 18px */
.vmp-text-lg    /* 20px */
.vmp-text-xl    /* 24px */
.vmp-text-2xl   /* 32px */
.vmp-text-3xl   /* 40px */
.vmp-text-4xl   /* 48px */
.vmp-text-5xl   /* 64px */
```

#### Line Height
```css
.vmp-leading-tight    /* 1.3 */
.vmp-leading-normal   /* 1.5 */
.vmp-leading-relaxed  /* 1.6 */
.vmp-leading-loose    /* 1.75 */
```

#### Letter Spacing
```css
.vmp-tracking-tighter  /* 0 */
.vmp-tracking-tight    /* 0 */
.vmp-tracking-normal   /* 0 */
.vmp-tracking-wide     /* 0.01em */
.vmp-tracking-wider    /* 0.02em */
```

**Usage:**
```html
<h1 class="vmp-text-4xl vmp-leading-loose vmp-tracking-tighter">
  Large Heading
</h1>
<p class="vmp-text-base vmp-leading-relaxed vmp-tracking-normal">
  Body text with optimal readability
</p>
```

---

### 5. Layout Utilities

#### Display
```css
.vmp-block         /* display: block */
.vmp-inline-block  /* display: inline-block */
.vmp-inline        /* display: inline */
.vmp-flex          /* display: flex */
.vmp-inline-flex   /* display: inline-flex */
.vmp-grid          /* display: grid */
.vmp-inline-grid   /* display: inline-grid */
.vmp-hidden        /* display: none */
```

#### Position
```css
.vmp-static    /* position: static */
.vmp-fixed     /* position: fixed */
.vmp-absolute  /* position: absolute */
.vmp-relative  /* position: relative */
.vmp-sticky    /* position: sticky */
```

#### Width
```css
.vmp-w-0, .vmp-w-1, .vmp-w-2, .vmp-w-3, .vmp-w-4, .vmp-w-5, 
.vmp-w-6, .vmp-w-8, .vmp-w-10, .vmp-w-12, .vmp-w-16
.vmp-w-full    /* 100% */
.vmp-w-auto    /* auto */
.vmp-w-fit     /* fit-content */
```

#### Height
```css
.vmp-h-0, .vmp-h-1, .vmp-h-2, .vmp-h-3, .vmp-h-4, .vmp-h-5, 
.vmp-h-6, .vmp-h-8, .vmp-h-10, .vmp-h-12, .vmp-h-16
.vmp-h-full    /* 100% */
.vmp-h-auto    /* auto */
.vmp-h-fit     /* fit-content */
.vmp-h-screen  /* 100vh */
```

**Usage:**
```html
<div class="vmp-flex vmp-relative vmp-w-full vmp-h-screen">
  <div class="vmp-w-1/2 vmp-h-auto">Half width</div>
</div>
```

---

### 6. Flexbox Utilities

```css
/* Direction */
.vmp-flex-row      /* flex-direction: row */
.vmp-flex-col      /* flex-direction: column */

/* Wrap */
.vmp-flex-wrap     /* flex-wrap: wrap */
.vmp-flex-nowrap   /* flex-wrap: nowrap */

/* Align Items */
.vmp-items-start     /* align-items: flex-start */
.vmp-items-end       /* align-items: flex-end */
.vmp-items-center    /* align-items: center */
.vmp-items-baseline  /* align-items: baseline */
.vmp-items-stretch   /* align-items: stretch */

/* Justify Content */
.vmp-justify-start      /* justify-content: flex-start */
.vmp-justify-end        /* justify-content: flex-end */
.vmp-justify-center     /* justify-content: center */
.vmp-justify-between    /* justify-content: space-between */
.vmp-justify-around     /* justify-content: space-around */
.vmp-justify-evenly     /* justify-content: space-evenly */

/* Flex */
.vmp-flex-1      /* flex: 1 1 0% */
.vmp-flex-auto   /* flex: 1 1 auto */
.vmp-flex-none   /* flex: none */
.vmp-grow        /* flex-grow: 1 */
.vmp-shrink      /* flex-shrink: 1 */
.vmp-shrink-0    /* flex-shrink: 0 */
```

**Usage:**
```html
<div class="vmp-flex vmp-flex-col vmp-items-center vmp-justify-between vmp-gap-4">
  <div class="vmp-flex-1">Flexible item</div>
  <div class="vmp-shrink-0">Fixed item</div>
</div>
```

---

### 7. Grid Utilities

```css
.vmp-grid-cols-1   /* 1 column */
.vmp-grid-cols-2   /* 2 columns */
.vmp-grid-cols-3   /* 3 columns */
.vmp-grid-cols-4   /* 4 columns */
.vmp-grid-cols-5   /* 5 columns */
.vmp-grid-cols-6   /* 6 columns */
.vmp-grid-cols-12  /* 12 columns */
```

**Usage:**
```html
<div class="vmp-grid vmp-grid-cols-3 vmp-gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

---

### 8. Opacity Utilities

```css
.vmp-opacity-0    /* opacity: 0 */
.vmp-opacity-10   /* opacity: 0.1 */
.vmp-opacity-20   /* opacity: 0.2 */
.vmp-opacity-30   /* opacity: 0.3 */
.vmp-opacity-40   /* opacity: 0.4 */
.vmp-opacity-50   /* opacity: 0.5 */
.vmp-opacity-60   /* opacity: 0.6 */
.vmp-opacity-70   /* opacity: 0.7 */
.vmp-opacity-80   /* opacity: 0.8 */
.vmp-opacity-90   /* opacity: 0.9 */
.vmp-opacity-100  /* opacity: 1 */
```

**Usage:**
```html
<div class="vmp-bg-panel vmp-opacity-50">Semi-transparent panel</div>
```

---

### 9. Overflow Utilities

```css
.vmp-overflow-auto      /* overflow: auto */
.vmp-overflow-hidden    /* overflow: hidden */
.vmp-overflow-visible   /* overflow: visible */
.vmp-overflow-scroll    /* overflow: scroll */
.vmp-overflow-x-auto    /* overflow-x: auto */
.vmp-overflow-y-auto    /* overflow-y: auto */
.vmp-overflow-x-hidden  /* overflow-x: hidden */
.vmp-overflow-y-hidden  /* overflow-y: hidden */
```

---

### 10. Text Utilities

```css
/* Alignment */
.vmp-text-left      /* text-align: left */
.vmp-text-center    /* text-align: center */
.vmp-text-right     /* text-align: right */
.vmp-text-justify   /* text-align: justify */

/* Transform */
.vmp-uppercase      /* text-transform: uppercase */
.vmp-lowercase      /* text-transform: lowercase */
.vmp-capitalize     /* text-transform: capitalize */
.vmp-normal-case    /* text-transform: none */

/* Truncate */
.vmp-truncate       /* overflow: hidden; text-overflow: ellipsis; white-space: nowrap */

/* Whitespace */
.vmp-whitespace-nowrap    /* white-space: nowrap */
.vmp-whitespace-pre       /* white-space: pre */
.vmp-whitespace-pre-wrap  /* white-space: pre-wrap */
```

---

### 11. Border Utilities

```css
.vmp-border       /* border-width: 1px */
.vmp-border-0     /* border-width: 0 */
.vmp-border-2     /* border-width: 2px */
.vmp-border-t     /* border-top-width: 1px */
.vmp-border-b     /* border-bottom-width: 1px */
.vmp-border-l     /* border-left-width: 1px */
.vmp-border-r     /* border-right-width: 1px */
.vmp-border-x     /* border-left + border-right: 1px */
.vmp-border-y     /* border-top + border-bottom: 1px */
.vmp-border-none  /* border: none */
```

**Usage:**
```html
<div class="vmp-border vmp-border-color vmp-rounded-md vmp-p-4">
  Bordered container
</div>
```

---

### 12. Cursor Utilities

```css
.vmp-cursor-pointer      /* cursor: pointer */
.vmp-cursor-default      /* cursor: default */
.vmp-cursor-not-allowed  /* cursor: not-allowed */
.vmp-cursor-wait         /* cursor: wait */
.vmp-cursor-text         /* cursor: text */
.vmp-cursor-move         /* cursor: move */
```

---

### 13. Pointer Events Utilities

```css
.vmp-pointer-events-none  /* pointer-events: none */
.vmp-pointer-events-auto  /* pointer-events: auto */
```

---

### 14. User Select Utilities

```css
.vmp-select-none  /* user-select: none */
.vmp-select-text  /* user-select: text */
.vmp-select-all   /* user-select: all */
.vmp-select-auto  /* user-select: auto */
```

---

### 15. Z-Index Utilities

```css
.vmp-z-0     /* z-index: 0 */
.vmp-z-10    /* z-index: 10 */
.vmp-z-20    /* z-index: 20 */
.vmp-z-30    /* z-index: 30 */
.vmp-z-40    /* z-index: 40 */
.vmp-z-50    /* z-index: 50 */
.vmp-z-auto  /* z-index: auto */
```

---

## 🎨 Complete Example

```html
<div class="vmp-flex vmp-flex-col vmp-gap-4 vmp-p-6 vmp-bg-panel vmp-rounded-lg vmp-border vmp-border-color">
  <h2 class="vmp-text-2xl vmp-leading-loose vmp-text-primary vmp-mb-2">
    Card Title
  </h2>
  <p class="vmp-text-base vmp-leading-relaxed vmp-text-muted vmp-mb-4">
    Card description with proper spacing and typography.
  </p>
  <div class="vmp-flex vmp-items-center vmp-justify-between vmp-gap-3">
    <button class="vmp-action-button vmp-action-button-primary vmp-px-4 vmp-py-2">
      Primary Action
    </button>
    <button class="vmp-action-button vmp-action-button-ghost vmp-px-4 vmp-py-2">
      Secondary Action
    </button>
  </div>
</div>
```

---

## 📊 Utility Class Count

| Category | Count |
|----------|-------|
| **Color Utilities** | 15 |
| **Spacing Utilities** | 120+ |
| **Border Radius** | 7 |
| **Typography** | 19 |
| **Layout** | 30+ |
| **Flexbox** | 20+ |
| **Grid** | 7 |
| **Opacity** | 11 |
| **Overflow** | 8 |
| **Text** | 12 |
| **Border** | 10 |
| **Cursor** | 6 |
| **Pointer Events** | 2 |
| **User Select** | 4 |
| **Z-Index** | 7 |
| **TOTAL** | **280+ utilities** |

---

## ✅ Benefits

1. **IDE-Friendly:** All utilities use `vmp-` prefix for autocomplete
2. **Token-Based:** All values map to design system tokens
3. **Comprehensive:** Covers all common use cases
4. **Consistent:** Enforces design system values
5. **Fast Development:** Quick application of design tokens
6. **Maintainable:** Single source of truth for all utilities

---

## 🚀 Next Steps

1. Use utility classes in HTML templates
2. Combine with semantic component classes
3. Leverage IDE autocomplete for faster development
4. Maintain design system compliance

---

**Version:** 2.0.0  
**Last Updated:** 2025-01-XX  
**Status:** ✅ Complete

