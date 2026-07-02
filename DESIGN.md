---
name: Expense Tracker
description: A quiet premium ledger for household money — white paper, near-black ink, one committed emerald.
colors:
  paper: "#ffffff"
  ink: "#37352f"
  ink-muted: "#787774"
  ink-faint: "#9b9a97"
  mist: "#f7f6f3"
  pressed: "#f1f1ef"
  hairline: "#37352f17"
  emerald: "#0f7b6c"
  emerald-dark-mode: "#2f9e89"
  spend-red: "#e03e3e"
  ledger-blue: "#0b6e99"
  ochre: "#cb912f"
  plum: "#6940a5"
  night: "#191919"
  night-card: "#202020"
  night-ink: "#e9e9e7"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.018em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  amount:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontVariation: "tabular-nums"
rounded:
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.506rem"
  2xl: "0.6375rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.emerald}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
---

# Design System: Expense Tracker

## 1. Overview

**Creative North Star: "The Quiet Premium Ledger"**

This interface is a ledger you trust: white paper, warm near-black ink, hairline rules, and tabular numerals that line up to the pixel. It borrows Notion's calm (soft gray surfaces, small radii, restrained color) and adds one committed voice: a deep emerald that means *money, positive, primary*. Everything else stays out of the way so the figures can speak.

The system explicitly rejects fintech-SaaS theatre: no gradient hero metrics, no glassmorphism-by-default, no AI-purple dark modes, no warm cream parchment. Personality arrives in committed moments (a bold net-position figure, an emerald-tinted chart fill, the active tab pill) rather than ambient decoration.

**Key Characteristics:**
- White paper / near-black ink (`#ffffff` / `#37352f`); true Notion-dark (`#191919` / `#e9e9e7`) in dark mode.
- One brand accent: emerald `#0f7b6c` (light) / `#2f9e89` (dark) for primary actions, active states, and positive money.
- Hairline borders (`rgba(55,53,47,0.09)`) instead of shadows for in-flow structure.
- Tabular numerals everywhere; money is the typography hero.
- Small radii (base 0.375rem) on controls; pills reserved for chips, badges, and the mobile tab bar.

## 2. Colors

A restrained cool-neutral family with one committed emerald and a strict semantic pair for money in/out.

### Primary
- **Ledger Emerald** (#0f7b6c light / #2f9e89 dark): primary buttons, focus rings, active tab pill, positive amounts, brand icon tile, selection tint. The single voice of the interface.

### Secondary
- **Spend Red** (#e03e3e light / #ff7369 dark): outgoing money and destructive actions only. Never decorative.

### Tertiary
- **Ledger Blue** (#0b6e99), **Ochre** (#cb912f), **Plum** (#6940a5): categorical data-viz (charts, category tiles) and the tinted icon squares in menus. Chart order: emerald, blue, ochre, red, plum.

### Neutral
- **Paper** (#ffffff): page and card background (light).
- **Ink** (#37352f): body text (light). **Night Ink** (#e9e9e7) on **Night** (#191919) in dark.
- **Muted Ink** (#787774 / #9b9a97 dark): secondary text, labels, captions.
- **Mist** (#f7f6f3) and **Pressed** (#f1f1ef): muted fills, hover states, skeletons.
- **Hairline** (rgba(55,53,47,0.09) / rgba(255,255,255,0.094) dark): every border and divider.

### Named Rules
**The One Emerald Rule.** Emerald carries primary action, active state, and positive money — and nothing else. If emerald is on more than ~10% of a screen, something is wrong (the mobile tab bar's active pill and one hero figure is the intended dose).
**The Signed Money Rule.** Income/expense is never color alone: every amount carries a +/− sign or explicit In/Out label alongside green/red.
**The No-Cream Rule.** Backgrounds are white or true Notion-dark. Warm cream/parchment neutrals are prohibited.

## 3. Typography

**Display Font:** Geist (system-ui fallback)
**Body Font:** Geist — one family carries the whole product
**Mono:** Geist Mono (pagination counters, code-like values)

**Character:** A single modern grotesk tuned by weight and size, never by family-switching. Headings sit at -0.018em; large money figures at -0.01em with tabular numerals.

### Hierarchy
- **Display** (600, 1.875rem, 1.15): the one hero money figure per screen (net position, account balance).
- **Headline** (600, 1.125rem, 1.3): page/card titles ("Expense Tracker", dialog titles).
- **Title** (600, 0.875rem, 1.4): card section headers, list group labels.
- **Body** (400, 0.875rem, 1.5): rows, descriptions, forms. Dense data may run 0.8125rem.
- **Label** (500, 0.75rem): field labels, stat captions, tab labels (10.5px on the mobile bar).
- **Amount** (600, tabular-nums, -0.01em): any money figure; scales from row (0.875rem) to hero (1.875rem+).

### Named Rules
**The Tabular Rule.** Every numeral in the product renders tabular (`font-variant-numeric: tabular-nums`, global on body); money columns must align digit-for-digit.
**The One Hero Rule.** Exactly one Display-scale figure per screen. Everything else steps down the scale.

## 4. Elevation

Flat by default: structure comes from hairline borders and the Mist/Paper two-layer neutral system, not shadows. Shadows exist only on floating chrome — dialogs, popovers, dropdowns, toasts, and the fixed mobile tab bar — where physical lift is real information.

### Shadow Vocabulary
- **Floating chrome** (`shadow-md` Tailwind default): dialogs, sheets, popovers.
- **Brand glow** (`shadow-sm shadow-brand/25`): the brand icon tile and primary CTA only; a whisper, not a glow effect.

### Named Rules
**The Hairline Rule.** If an element is in the page flow, it gets a 1px hairline border and no shadow. If it floats above the flow, it gets a shadow.

## 5. Components

### Buttons
- **Shape:** small radius (0.3rem), 36px height (`h-9`), 32px small (`h-8`).
- **Primary:** Ledger Emerald fill, white text; hover darkens ~8%; `active:scale-96` press feedback via `.press` on app-like surfaces.
- **Outline (default):** Paper fill, Ink text, hairline border; hover fills Mist.
- **Ghost:** borderless; hover Mist. Destructive uses Spend Red fill or red-text outline.
- **Focus:** 3px emerald ring at 50% (`outline-ring/50`).

### Cards / Containers
- **Corner Style:** rounded-xl (0.506rem) to rounded-2xl for hero cards.
- **Background:** Paper; Mist for inset/nested panels (never card-on-card borders).
- **Shadow Strategy:** none (Hairline Rule).
- **Border:** 1px Hairline.
- **Internal Padding:** 16px (p-4); dense lists run p-0 with row dividers.

### Inputs / Fields
- **Style:** 36px height, hairline stroke (`--input` at 16% ink), Paper fill, small radius.
- **Focus:** emerald ring + border shift.
- **Error:** Spend Red border + caption text.

### Navigation
- **Desktop:** inline header with brand tile, workspace switcher, an outline-button action row, and a segmented tab list (Overview / Transactions / Analytics).
- **Mobile (<640px):** a fixed, always-visible labeled tab bar — five items (Home, Activity, Add, Insights, More), icon over 10.5px label, active tab in a soft emerald pill (`bg-brand/15 text-brand`); frosted `bg-background/90 backdrop-blur` over content; safe-area padding. "More" opens a bottom sheet of secondary tools as rows (tinted icon square + label + chevron).
- **States:** active = emerald pill; inactive = muted ink; press = scale-95.

### Transaction Row (signature component)
A 44px+ row: tinted category icon square (category color at 13% alpha background, full color glyph), note + category/tag line in Body, right-aligned signed Amount (emerald + / red −), hairline divider between rows. This row is the product's fingerprint; keep it identical on web and native.

## 6. Do's and Don'ts

### Do:
- **Do** keep money figures tabular, signed, and right-aligned (The Tabular Rule, The Signed Money Rule).
- **Do** use hairline borders for in-flow structure and reserve shadows for floating chrome (The Hairline Rule).
- **Do** give every screen exactly one Display-scale hero figure (The One Hero Rule).
- **Do** keep the mobile web experience app-like: fixed labeled tab bar, bottom sheets, `.press` feedback, safe-area insets, no tap-highlight flash.
- **Do** use the category color system (13% alpha tile + full-color glyph) for all category/account iconography.

### Don't:
- **Don't** ship gradient hero metrics, glassmorphism-by-default, or purple-on-dark AI aesthetics (PRODUCT.md anti-references).
- **Don't** introduce warm cream/parchment backgrounds; paper is white, dark is `#191919`.
- **Don't** use emerald decoratively — it means primary, active, or positive money only.
- **Don't** encode in/out by color alone; the sign or label always rides along.
- **Don't** exceed the two-layer neutral system (Paper + Mist); no card-in-card-in-card nesting.
- **Don't** let mobile feel like a squeezed website: no horizontal overflow, touch targets ≥44px, one-tap reach to every core destination.
