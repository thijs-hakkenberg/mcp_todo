# Order Fulfillment Dashboard Design System
## Complete Design Documentation & Guidelines

**Version:** 2.0.0
**Last Updated:** November 2025
**Status:** Production
**Design Language:** DaVinci Resolve-Inspired Dark Theme

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Library](#component-library)
6. [Interaction Patterns](#interaction-patterns)
7. [Iconography](#iconography)
8. [Motion & Animation](#motion--animation)
9. [Accessibility](#accessibility)
10. [Usage Guidelines](#usage-guidelines)
11. [Code Standards](#code-standards)
12. [Best Practices](#best-practices)

---

## Design Philosophy

### Core Principles

#### 1. **Action-First Design**
Every element serves the primary workflow: shipping orders faster.

**Guidelines:**
- Every UI element must have a verb (Ship, Print, Scan, Filter)
- Passive display elements are secondary or removed
- Information without action is relegated to analytics views
- The fastest path to action is always prioritized

**Example:**
```
❌ Bad: "Order #003416 - Status: Ready"
✅ Good: "Order #003416 [Ship Now Button]"
```

#### 2. **Progressive Disclosure**
Show what's needed now, hide what's needed later.

**Hierarchy:**
1. **Immediate:** Urgent orders, bulk actions, primary filters
2. **Contextual:** Carrier selection, notes, sort options
3. **Secondary:** Export, column settings, help
4. **Hidden:** Advanced features, analytics

#### 3. **Speed Over Beauty**
Function trumps form. If it slows the workflow, it's removed.

**Decisions:**
- Reduced animations (0.12s vs 0.3s)
- Eliminated page navigation (everything inline)
- Keyboard shortcuts for power users
- Bulk operations as first-class features

#### 4. **Professional Restraint**
Inspired by DaVinci Resolve's surgical precision.

**Characteristics:**
- No gradients (depth through layering)
- Subtle interactions (not flashy)
- Muted colors (until action is needed)
- Typography as hierarchy (not decoration)

#### 5. **Respect the Workflow**
Design follows the mental model of warehouse operations.

**Workflow:**
```
See Alert → Select Orders → Choose Carrier → Ship → Confirm
```

Every screen element supports this flow or gets out of the way.

---

## Color System

### Philosophy

Colors serve **meaning**, not decoration. The palette is intentionally limited to reduce cognitive load. Each color has a specific semantic purpose.

### Background Colors

Our backgrounds use DaVinci Resolve's signature subtle blue tint (#28282E discovered through research), creating depth through layering rather than gradients.

#### Primary Backgrounds

| Name | Hex | RGB | Use Case | Example |
|------|-----|-----|----------|---------|
| **Darkest** | `#0e0e10` | `rgb(14, 14, 16)` | Body background, deepest layer | Main app background |
| **Darker** | `#141416` | `rgb(20, 20, 22)` | Top bars, sticky headers | Navigation bar |
| **Dark** | `#191a1c` | `rgb(25, 26, 28)` | Cards, panels, elevated surfaces | Alert cards, stat cards |
| **Medium** | `#1e1f22` | `rgb(30, 31, 34)` | Input fields, dropdowns | Form inputs, selects |
| **Light** | `#232528` | `rgb(35, 37, 40)` | Subtle elevation | Hover states on cards |
| **Lighter** | `#28292e` | `rgb(40, 41, 46)` | Highest elevation | Modal overlays |
| **Hover** | `#2a2b30` | `rgb(42, 43, 48)` | Interactive hover state | Button hover |

#### Usage Rules

```css
/* Layering principle - each level is one step lighter */
body { background: #0e0e10; }           /* Darkest */
.header { background: #141416; }        /* Darker */
.card { background: #191a1c; }          /* Dark */
.card:hover { background: #1e1f22; }    /* Medium */
```

**Never skip levels** - maintain consistent depth perception.

### Border Colors

Borders are intentionally subtle to avoid visual clutter. We use a three-tier system.

| Name | Hex | RGB | Opacity Feel | Use Case |
|------|-----|-----|--------------|----------|
| **Subtle** | `#23252a` | `rgb(35, 37, 42)` | Barely visible | Gentle separators, secondary dividers |
| **Default** | `#2a2c32` | `rgb(42, 44, 50)` | Standard | Card borders, input borders, table dividers |
| **Emphasis** | `#36383e` | `rgb(54, 56, 62)` | Noticeable | Focused elements, important boundaries |

#### Border Usage

```css
/* Principle: Borders suggest, not shout */
.subtle-divide { border: 1px solid #23252a; }    /* Whisper */
.standard-card { border: 1px solid #2a2c32; }    /* Normal */
.focused-input { border: 1px solid #36383e; }    /* Emphasis */
```

### Text Colors

Five-tier hierarchy for maximum clarity while maintaining readability in dark environments.

| Name | Hex | RGB | WCAG Ratio | Use Case |
|------|-----|-----|------------|----------|
| **Muted** | `#606268` | `rgb(96, 98, 104)` | 4.5:1 | Placeholder text, disabled states |
| **Dim** | `#7a7c82` | `rgb(122, 124, 130)` | 6.5:1 | Secondary info, timestamps, meta |
| **Normal** | `#9a9ca2` | `rgb(154, 156, 162)` | 9:1 | Body text, table cells |
| **Bright** | `#d4d5d9` | `rgb(212, 213, 217)` | 14:1 | Headings, emphasized text |
| **White** | `#e8e9ec` | `rgb(232, 233, 236)` | 16:1 | Primary headings, critical info |

#### Text Hierarchy Examples

```html
<!-- Correct text hierarchy in order info -->
<div>
  <span style="color: #e8e9ec">Order #003416</span>     <!-- White: Primary -->
  <span style="color: #d4d5d9">Carol White</span>       <!-- Bright: Secondary -->
  <span style="color: #9a9ca2">3 items</span>          <!-- Normal: Tertiary -->
  <span style="color: #7a7c82">2 days ago</span>       <!-- Dim: Meta -->
  <span style="color: #606268">Placeholder</span>       <!-- Muted: Disabled -->
</div>
```

### Accent Colors

Functional colors that convey meaning. Used sparingly for maximum impact.

#### Orange (Primary Action)

| State | Hex | RGB | Use Case |
|-------|-----|-----|----------|
| **Primary** | `#e8724e` | `rgb(232, 114, 78)` | Primary buttons, selection |
| **Hover** | `#f07d55` | `rgb(240, 125, 85)` | Hover state (lighter) |
| **Dim** | `#c86343` | `rgb(200, 99, 67)` | Disabled/muted state |

**Usage:**
- Primary action buttons (Ship Now)
- Selected table rows
- Active state indicators
- Focus rings (50% opacity)

```css
.primary-btn {
  background: #e8724e;
}
.primary-btn:hover {
  background: #f07d55;
}
.primary-btn:disabled {
  background: #c86343;
  opacity: 0.4;
}
```

#### Red (Urgent/Error)

| State | Hex | RGB | Use Case |
|-------|-----|-----|----------|
| **Primary** | `#d84855` | `rgb(216, 72, 85)` | Late orders, errors |
| **Dim** | `#b83d48` | `rgb(184, 61, 72)` | Secondary red info |

**Usage:**
- Late/overdue orders
- Error states
- Critical alerts
- Destructive actions

#### Yellow (Warning)

| State | Hex | RGB | Use Case |
|-------|-----|-----|----------|
| **Primary** | `#e8a84e` | `rgb(232, 168, 78)` | Payment issues, review needed |
| **Dim** | `#c98f42` | `rgb(201, 143, 66)` | Secondary yellow info |

**Usage:**
- Payment issues
- Items needing review
- Caution states
- Incomplete info

#### Blue (Information)

| State | Hex | RGB | Use Case |
|-------|-----|-----|----------|
| **Primary** | `#4a9aef` | `rgb(74, 154, 239)` | High-value orders, info |
| **Dim** | `#3d82ca` | `rgb(61, 130, 202)` | Secondary blue info |

**Usage:**
- High-value orders
- Informational states
- Shipped status
- Secondary actions

#### Green (Success)

| State | Hex | RGB | Use Case |
|-------|-----|-----|----------|
| **Primary** | `#5cb365` | `rgb(92, 179, 101)` | Revenue up, positive metrics |
| **Dim** | `#4d9756` | `rgb(77, 151, 86)` | Secondary green info |

**Usage:**
- Positive metrics
- Revenue/totals
- Confirmation messages
- Success states

### Color Usage Rules

#### 1. **Background on Background**
Always use one background color on another (never skip levels).

```css
/* ✅ Correct */
.app { background: #0e0e10; }
  .card { background: #191a1c; }
    .input { background: #1e1f22; }

/* ❌ Wrong - skips levels */
.app { background: #0e0e10; }
  .card { background: #1e1f22; } /* Skipped #191a1c */
```

#### 2. **Text on Background**
Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text.

```css
/* ✅ Correct - sufficient contrast */
.card {
  background: #191a1c;
  color: #9a9ca2; /* 9:1 ratio */
}

/* ❌ Wrong - insufficient contrast */
.card {
  background: #191a1c;
  color: #606268; /* Only 4.5:1 */
}
```

#### 3. **Accent Sparingly**
Accent colors are for meaning, not decoration.

**Good:**
- Orange: Action required
- Red: Urgent attention
- Yellow: Review needed
- Blue: High value
- Green: Success/positive

**Bad:**
- Orange: Generic decoration
- Multiple accents on one element
- Accent as primary background

#### 4. **Semantic Consistency**
Colors must always mean the same thing.

| Color | ALWAYS Means | NEVER Means |
|-------|--------------|-------------|
| Orange | Action, Primary | Error, Success |
| Red | Urgent, Error | Success, Info |
| Yellow | Warning, Review | Success, Action |
| Blue | Info, Value | Error, Urgent |
| Green | Success, Positive | Error, Warning |

### Color Accessibility

#### Contrast Ratios (WCAG 2.1 Level AA)

| Background | Text Color | Ratio | Pass |
|------------|------------|-------|------|
| `#0e0e10` | `#9a9ca2` | 9.1:1 | ✅ AAA |
| `#191a1c` | `#9a9ca2` | 8.8:1 | ✅ AAA |
| `#1e1f22` | `#9a9ca2` | 8.2:1 | ✅ AAA |
| `#0e0e10` | `#7a7c82` | 6.5:1 | ✅ AA |
| `#0e0e10` | `#606268` | 4.6:1 | ✅ AA (Large) |

#### Color Blindness Considerations

**Deuteranopia (Red-Green):**
- Red + Blue distinctly different ✅
- Red + Yellow distinctly different ✅
- Never rely on red vs green alone

**Protanopia:**
- Orange + Blue distinctly different ✅
- All accent colors distinguishable ✅

**Tritanopia:**
- Yellow + Red distinctly different ✅
- Blue distinguishable from all ✅

**Universal Rule:** Always pair color with:
- Icon (visual marker)
- Text label
- Position/context

---

## Typography

### Philosophy

Typography creates information hierarchy without decoration. Font weights and sizes are the primary tools, not color or effects.

### Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Rationale:**
1. **Inter** - Primary (humanist, excellent at small sizes)
2. **-apple-system** - SF Pro on macOS (native Resolve font)
3. **BlinkMacSystemFont** - SF Pro rendering engine
4. **Segoe UI** - Windows native (Resolve on Windows)
5. **sans-serif** - Universal fallback

### Font Weights

We use 5 weights from Inter's 9-weight family.

| Weight | Value | Use Case | Example |
|--------|-------|----------|---------|
| **Regular** | `400` | Body text, table cells | Order details, descriptions |
| **Medium** | `500` | Labels, buttons, emphasis | Button text, form labels |
| **Semibold** | `600` | Subheadings, card titles | "Bulk Ship Orders" |
| **Bold** | `700` | Numbers, statistics | "$18,432", "247" |

**Not Used:**
- `300` Light - Too subtle for dark backgrounds
- `800` Extra Bold - Too heavy, breaks hierarchy
- `900` Black - Overwhelming

### Font Sizes

12-point modular scale (1.200 ratio) with practical adjustments.

| Name | Size | Line Height | Use Case |
|------|------|-------------|----------|
| **Micro** | `10px` | `14px` (1.4) | Uppercase labels, kbd shortcuts |
| **XS** | `12px` | `18px` (1.5) | Secondary info, timestamps, meta |
| **SM** | `14px` | `20px` (1.43) | Body text, table cells, buttons |
| **Base** | `16px` | `24px` (1.5) | Form inputs, large body |
| **LG** | `18px` | `28px` (1.56) | Page titles, section headings |
| **XL** | `20px` | `28px` (1.4) | Modal titles |
| **2XL** | `24px` | `32px` (1.33) | Statistics, big numbers |
| **3XL** | `28px` | `36px` (1.29) | Hero statistics |
| **4XL** | `32px` | `40px` (1.25) | Major headings |

### Typography Scale

```css
/* Practical implementation */
.micro { font-size: 10px; line-height: 14px; } /* Labels */
.xs { font-size: 12px; line-height: 18px; }    /* Meta */
.sm { font-size: 14px; line-height: 20px; }    /* Body */
.base { font-size: 16px; line-height: 24px; }  /* Default */
.lg { font-size: 18px; line-height: 28px; }    /* Titles */
.xl { font-size: 20px; line-height: 28px; }    /* Headings */
.2xl { font-size: 24px; line-height: 32px; }   /* Stats */
.3xl { font-size: 28px; line-height: 36px; }   /* Big stats */
.4xl { font-size: 32px; line-height: 40px; }   /* Hero */
```

### Letter Spacing

Adjusted for optimal readability at various sizes.

| Context | Tracking | Use Case |
|---------|----------|----------|
| **Micro (10px)** | `0.05em` (0.5px) | Uppercase labels need breathing room |
| **XS-SM (12-14px)** | `0.01em` (0.1px) | Slight opening for clarity |
| **Base+ (16px+)** | `0` | Default, well-balanced |
| **Numbers** | `-0.02em` | Tighter for tabular alignment |
| **All Caps** | `0.1em` (wider) | Uppercase always needs more space |

```css
/* Examples */
.uppercase-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em; /* 1px */
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em; /* Tighter */
}

.body-text {
  font-size: 14px;
  letter-spacing: 0.01em; /* Slight open */
}
```

### Typography Patterns

#### Headers & Titles

```html
<!-- Page Title -->
<h1 style="
  font-size: 18px;
  font-weight: 600;
  color: #e8e9ec;
  letter-spacing: -0.01em;
">Order Fulfillment</h1>

<!-- Section Title -->
<h2 style="
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #7a7c82;
">Needs Attention</h2>

<!-- Card Title -->
<h3 style="
  font-size: 14px;
  font-weight: 500;
  color: #e8e9ec;
">Bulk Ship Orders</h3>
```

#### Body Text & Tables

```html
<!-- Table Cell - Primary -->
<td style="
  font-size: 14px;
  font-weight: 500;
  color: #e8e9ec;
">Carol White</td>

<!-- Table Cell - Secondary -->
<td style="
  font-size: 12px;
  color: #7a7c82;
">carol@example.com</td>

<!-- Body Text -->
<p style="
  font-size: 14px;
  line-height: 20px;
  color: #9a9ca2;
">Orders past promised delivery date</p>
```

#### Statistics & Numbers

```html
<!-- Large Stat -->
<div style="
  font-size: 24px;
  font-weight: 700;
  color: #e8e9ec;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
">247</div>

<!-- Currency -->
<span style="
  font-size: 14px;
  font-weight: 600;
  color: #5cb365;
  font-variant-numeric: tabular-nums;
">$314.50</span>

<!-- Stat Label -->
<div style="
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: #7a7c82;
">Orders Today</div>
```

#### Buttons & Interactive

```html
<!-- Primary Button -->
<button style="
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
">Ship Now</button>

<!-- Secondary Button -->
<button style="
  font-size: 12px;
  font-weight: 500;
">Export</button>

<!-- Keyboard Shortcut -->
<kbd style="
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px;
  font-weight: 600;
">⌘K</kbd>
```

### Special Typography

#### Tabular Numbers

Always use for financial data, statistics, and quantities.

```css
.stat-number {
  font-variant-numeric: tabular-nums;
  /* or */
  font-feature-settings: 'tnum' 1;
}
```

**Why:** Ensures columns align perfectly in tables.

```
❌ Without tabular-nums:
247
18
1,432

✅ With tabular-nums:
  247
   18
1,432
```

#### Monospace (Code/IDs)

```css
.order-id {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 14px;
}
```

**Use for:**
- Order numbers (#003416)
- Tracking numbers
- SKUs
- Time displays (13:29:06)
- Keyboard shortcuts

### Typography Hierarchy

Visual example of complete hierarchy:

```
██████████ 32px Bold White       → Hero heading
████████   24px Bold White       → Section number
██████     18px Semibold White   → Page title
████       16px Medium Bright    → Subheading
███        14px Medium Normal    → Body text
██         12px Regular Dim      → Secondary info
█          10px Semibold Muted   → LABELS (uppercase)
```

### Font Loading

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Critical:**
- `antialiased` - Crisp rendering on macOS
- `grayscale` - Better subpixel rendering
- `display=swap` - Prevent FOIT (Flash of Invisible Text)

---

## Spacing & Layout

### Philosophy

Consistent spacing creates rhythm and predictability. We use an 8px base unit (except where 4px precision is needed).

### Spacing Scale

Based on Tailwind's spacing with Resolve adjustments.

| Token | Value | Use Case |
|-------|-------|----------|
| `0.5` | `2px` | Micro adjustments, badge padding |
| `1` | `4px` | Tight spacing, icon gaps |
| `1.5` | `6px` | Button padding vertical |
| `2` | `8px` | Default gap, icon margins |
| `2.5` | `10px` | Button padding |
| `3` | `12px` | Card padding small |
| `4` | `16px` | Card padding standard |
| `5` | `20px` | Section padding |
| `6` | `24px` | Page margins, large gaps |
| `8` | `32px` | Section spacing |
| `12` | `48px` | Major section breaks |
| `16` | `64px` | Hero spacing |

### Layout Grid

#### Main Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header (py-3 = 12px top/bottom)                         │
├─────────────────────────────────────────────────────────┤
│ Alert Banner (py-2.5 = 10px top/bottom)                │
├─────────────────────────────────────────────────────────┤
│ Stats Bar (p-4 = 16px all sides)                       │
├─────────────────────────────────────────────────────────┤
│ Bulk Actions Bar (px-6 py-3 = 24px h, 12px v)          │
├─────────────────────────────────────────────────────────┤
│ Table (flex-1)                                          │
├─────────────────────────────────────────────────────────┤
│ Footer (px-6 py-3 = 24px h, 12px v)                    │
└─────────────────────────────────────────────────────────┘
```

#### Card Spacing

```css
.card {
  padding: 16px;           /* Standard card */
  gap: 12px;              /* Between card elements */
  border-radius: 8px;      /* Rounded corners */
}

.card-large {
  padding: 24px;           /* Large card */
  gap: 16px;              /* Larger gaps */
}

.card-compact {
  padding: 12px;           /* Tight card */
  gap: 8px;               /* Minimal gaps */
}
```

#### Component Spacing

```css
/* Buttons */
.btn {
  padding: 6px 12px;       /* Vertical 6px, Horizontal 12px */
  gap: 6px;               /* Between icon and text */
}

.btn-large {
  padding: 10px 16px;
  gap: 8px;
}

.btn-small {
  padding: 4px 8px;
  gap: 4px;
}

/* Form inputs */
input, select {
  padding: 6px 12px;       /* Match button size */
  height: 32px;           /* Fixed height for alignment */
}

/* Table cells */
td, th {
  padding: 16px 24px;      /* Generous cell padding */
}
```

### Layout Rules

#### 1. **8px Grid**
All spacing should be multiples of 8px (with 4px exceptions).

```css
/* ✅ Good */
margin: 8px;
padding: 16px;
gap: 24px;

/* ⚠️ Acceptable (4px precision) */
padding: 6px 12px;  /* Buttons */
gap: 10px;          /* Fine adjustments */

/* ❌ Bad */
margin: 13px;       /* Arbitrary */
padding: 17px;      /* Off-grid */
```

#### 2. **Consistent Gaps**
Use the same gap value within a component.

```css
/* ✅ Good */
.card {
  padding: 16px;
  gap: 16px;        /* Same as padding */
}

/* ❌ Bad */
.card {
  padding: 16px;
  gap: 14px;        /* Inconsistent */
}
```

#### 3. **Nested Spacing**
Inner elements use smaller spacing than outer.

```css
.section { padding: 32px; }
  .card { padding: 16px; }
    .item { gap: 8px; }
```

### Responsive Spacing

```css
/* Mobile - tighter spacing */
@media (max-width: 768px) {
  .section { padding: 16px; }
  .card { padding: 12px; }
  td, th { padding: 12px 16px; }
}

/* Desktop - comfortable spacing */
@media (min-width: 769px) {
  .section { padding: 32px; }
  .card { padding: 16px; }
  td, th { padding: 16px 24px; }
}
```

### Border Radius

Consistent rounding for all elements.

| Element | Radius | Use Case |
|---------|--------|----------|
| `3px` | Extra small | Checkboxes, kbd tags |
| `4px` | Small | Buttons, badges |
| `6px` | Medium | Inputs, small cards |
| `8px` | Large | Cards, panels |
| `12px` | Extra large | Modals, major sections |
| `50%` | Circle | Status dots, avatars |

```css
.checkbox { border-radius: 3px; }
.button { border-radius: 4px; }
.input { border-radius: 6px; }
.card { border-radius: 8px; }
.modal { border-radius: 12px; }
.status-dot { border-radius: 50%; }
```

---

## Motion & Animation

### Principles

1. **Fast but not instant** - 120-150ms feels responsive
2. **Ease curves** - Natural deceleration
3. **Purposeful** - Every animation has meaning
4. **Skippable** - Respect reduced motion preferences

### Timing Functions

```css
/* Standard ease - most transitions */
transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

/* Snappy - buttons, hovers */
transition: all 0.12s ease;

/* Smooth - large movements */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Bounce - success states */
transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Animation Durations

| Duration | Use Case |
|----------|----------|
| `0.1s` | Instant feedback (hover color change) |
| `0.12s` | Button press, checkbox toggle |
| `0.15s` | Standard transitions |
| `0.3s` | Slide in, fade in |
| `0.5s` | Complex animations |
| `2s` | Ambient animations (pulse) |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

**End of Design System Documentation**
