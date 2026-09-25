---
name: SBIC Consignment Webapp - Food And Beverages
description: A live-data order-entry tool for the online merch team, colored to optimize the pick-to-submit loop rather than to decorate it.
colors:
  deep-harbor-blue: "#2461A8"
  deep-harbor-blue-light: "#3970B3"
  deep-harbor-blue-dark: "#123159"
  deep-harbor-blue-pale: "#E4EDF7"
  storage-navy: "#12203A"
  login-field-navy: "#1A2C4C"
  fefo-gold: "#D4A72C"
  fefo-gold-light: "#D9B041"
  fefo-gold-dark: "#A9840F"
  fefo-gold-pale: "#FAF0D6"
  surface: "#FFFFFF"
  surface-alt: "#F4F7FB"
  border: "#DBE4F0"
  text-muted: "#6B7686"
  text: "#12203A"
  success: "#2DD36F"
  danger: "#EB445A"
typography:
  display:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.10em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.deep-harbor-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.deep-harbor-blue-light}"
  button-primary-active:
    backgroundColor: "{colors.deep-harbor-blue-dark}"
  badge-wayfinding:
    backgroundColor: "{colors.deep-harbor-blue-pale}"
    textColor: "{colors.deep-harbor-blue}"
    rounded: "{rounded.pill}"
    size: "32px"
  chip-expiry-warn:
    backgroundColor: "{colors.fefo-gold-pale}"
    textColor: "{colors.fefo-gold-dark}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System: SBIC Consignment Webapp - Food And Beverages

## 1. Overview

**Creative North Star: "The Consignment Optimizer"**

Every screen exists to optimize one loop: pick a customer, confirm what's actually available right now, catch what's expiring, submit, done. Nothing here is decorative — color, shape, and hierarchy all point at making that loop faster and less error-prone for someone standing in a storage room, phone or tablet in one hand, stock in the other. This is a tool, not a showcase; competence reads as calm, not flashy.

Before this pass, color lived only in the app's chrome (header, tab bar) — every content screen was effectively grayscale. That was a missed opportunity, not a stylistic choice: the interface had nothing to say about hierarchy, wayfinding, or the one piece of information that genuinely matters in food & beverage consignment — how soon something expires. This system fixes that with two disciplined moves: a single interactive blue (Deep Harbor Blue) for anything the user can act on or needs as a key value, and a single reserved gold (FEFO Gold) for exactly one meaning — expiry proximity — never used decoratively. Everything else stays a tinted, quiet neutral.

This system explicitly rejects: the sibling garments app's gold/dark, gold-sweep-animation identity (this is its own tool, not a reskin); generic admin-dashboard chrome; and consumer-app gloss (bounce, elastic motion, rounded-everything playfulness). None of those serve someone trying to finish an order in under a minute.

**Key Characteristics:**
- One interactive/key-value accent (blue), one strictly-semantic accent (gold), nothing else competing for attention
- Flat-to-quiet elevation — shadows exist but are barely-there, never a design statement
- Generous touch targets and high-contrast text, because this is used one-handed under inconsistent warehouse lighting
- Color always means the same thing wherever it appears — never one-off decoration

## 2. Colors

Deliberately narrow: two named accents, everything else is a tinted neutral. This is a Restrained palette on the "more color than usual for the register" edge, because the second accent (gold) carries real informational weight rather than decoration — it earns its place.

### Primary
- **Deep Harbor Blue** (`#2461A8`): every interactive element — primary buttons, focus rings, links, the wayfinding icon badges on Home and Scan (Customer, Posting Date, draft rows) — and every "this is the key result" value, like the confirmed Business Central document number on the Submit screen. If it's blue, you can act on it or it's the one number that matters.

### Secondary
- **Storage Navy** (`#12203A`): header and tab-bar chrome, the splash/login dark surface, and the base text color on light surfaces. Reads as "structure," not "action" — never used for buttons or links.

### Tertiary
- **FEFO Gold** (`#D4A72C`): reserved exclusively for expiry proximity (within 14 days). Appears as the `.expiry-badge` pill everywhere an expiry date is shown — Scan order lines, the Add Items detail view, Submit's review list, and Home's draft rows when any line in that draft is close to expiring. It never appears for anything else: not a hover state, not a second brand flourish, not a decorative accent. A near-navy variant of the same hue (`#A9840F`, "FEFO Gold Dark") also flags low remaining stock (≤10 units) in the Add Items quantity hint — a related-but-distinct warning that shares the hue family on purpose, since both mean "act on this soon."

### Neutral
- **Surface** (`#FFFFFF`): cards, list items, input backgrounds.
- **Surface Alt** (`#F4F7FB`): page background — a cool-tinted near-white, never pure `#fff`.
- **Border** (`#DBE4F0`): hairline dividers and card borders.
- **Text Muted** (`#6B7686`): secondary text, captions, field labels.
- **Text** (`#12203A`): primary body text — same value as Storage Navy, used at text scale rather than surface scale.

### Named Rules
**The One Meaning Rule.** Every color means exactly one thing, everywhere it appears. Gold is expiry/low-stock, full stop — if a future screen wants a decorative highlight, it does not reach for gold; it reaches for weight, size, or a blue-pale tint instead. Blue is "act on this or read this key value," full stop.

**The No-Reskin Rule.** This app does not borrow the garments app's gold-primary/dark-secondary identity. Blue leads here; gold is a narrow, functional signal, not the second half of a matching color pair.

## 3. Typography

**Body & Display Font:** Outfit (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` fallback)

**Character:** One typeface, used entirely through weight and size contrast rather than pairing — appropriate for a tool where every extra typographic decision is one more thing standing between the user and a submitted order.

### Hierarchy
- **Display** (700, 1.75rem / 28px, line-height 1.15): the Home screen's "Welcome back, [name]" hero name and the Splash/Login wordmark. Appears once per screen, at most.
- **Headline** (700, 1.625rem / 26px): the confirmed Business Central document number on the Submit confirmation screen — colored Deep Harbor Blue as the one number that matters most in that moment.
- **Title** (600, 1rem / 16px): list-item primary text (`<h2>` inside `ion-label`) — customer names, item descriptions, draft summaries.
- **Body** (400, 0.875rem / 14px, line-height 1.5): everything else — metadata lines, form values, list secondary text. Capped conceptually at short single lines; this is a form-and-list app, not long-form reading.
- **Label** (700, 0.6875rem / 11px, letter-spacing 0.10em, uppercase): field labels (`.field-label`), section labels (`.section-label`), and the "Welcome back" eyebrow — always muted-gray or FEFO-gold-dark, never the interactive blue (labels describe, they don't act).

### Named Rules
**The Single-Voice Rule.** One font family, always. Hierarchy is entirely scale + weight + color, never a second typeface pretending to be "editorial contrast" — that would work against the tool's plain-spoken character.

## 4. Elevation

Flat by default, with the barest possible lift on cards and toolbars to separate them from the page background — never a design statement. Two shadow tokens exist and both stay under `rgba(...,0.12)`; nothing in this system uses shadow for drama or depth theater.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 2px 12px rgba(36, 97, 168, 0.10), 0 1px 4px rgba(0,0,0,0.06)`, token `--app-shadow`): default card lift — just enough to read as "surface," tinted faintly blue rather than neutral gray so it never looks like generic Bootstrap chrome.
- **Elevated** (`box-shadow: 0 4px 20px rgba(18, 32, 58, 0.12), 0 1px 6px rgba(0, 0, 0, 0.06)`, token `--app-shadow-md`): reserved for anything that should read as clearly "above" the page — currently unused by any shipped component, held in reserve for modals/sheets that need more separation than a card.

### Named Rules
**The Whisper Rule.** If a shadow is visible enough to describe out loud, it's too strong. Elevation here is a structural cue, not a visual flourish.

## 5. Components

### Buttons
- **Shape:** 8px radius (`--app-radius-sm`), consistent across every button in the app.
- **Primary:** Deep Harbor Blue background (`#2461A8`), white text, 600 weight, 0.3px letter-spacing. Used for every primary action: Sign In, Start New Session, Add Item, Add to Order, Submit to Business Central, and the quantity stepper's +/- controls (outline variant, blue border/text) in the Add Items modal.
- **Hover / Active:** background shifts to Deep Harbor Blue Light (`#3970B3`) on hover, Deep Harbor Blue Dark (`#123159`) on press — a single consistent interaction ramp, no color hue-shift.
- **Ghost / Outline:** used for secondary/destructive-adjacent actions ("Save as Draft & Go Back," pagination Prev/Next) — text-colored, no fill, inherits the ambient primary color so it still reads as "blue = interactive" without competing with the true primary action on the same screen.

### Chips / Badges
- **Wayfinding badge:** a 32-36px circle, Deep Harbor Blue Pale background, Deep Harbor Blue icon — precedes the Customer and Posting Date fields on Scan, and each draft row on Home. Purely navigational, never used for status.
- **Expiry-warn chip** (`.expiry-badge`): FEFO Gold Pale background, FEFO Gold Dark text, pill radius, uppercase 10px label reading "Expiring soon." The single most important colored element in the app — appears identically in the Scan order-line list, the Add Items detail view, the Submit review list, and Home's draft rows.

### Cards / Containers
- **Corner Style:** 16px radius (`--app-radius-lg`).
- **Background:** pure white (`#FFFFFF`) against the cool-tinted page background (`#F4F7FB`) — the contrast between the two is what separates a card from the page, not a heavy shadow.
- **Shadow Strategy:** Ambient shadow (see Elevation) plus a 1px hairline border in `--app-border` — the two together do the separation work so neither has to be strong alone.
- **Border:** 1px, `#DBE4F0`, full perimeter always (this system has an absolute ban on colored side-stripe borders as a status indicator — see Do's and Don'ts).
- **Internal Padding:** 16-24px depending on density; list items use Ionic's default item padding.

### Inputs / Fields
- **Style:** no visible stroke at rest; sits flush inside its `ion-item` row, separated by the row's hairline bottom border.
- **Focus:** Deep Harbor Blue highlight color on focus (`--highlight-color-focused`), applied globally to every `ion-input`/`ion-select`/`ion-searchbar`.
- **Login fields specifically:** dark surface (`#1A2C4C`, "Login Field Navy") against the Storage Navy page background, white text — a deliberately different, darker field treatment only on the Login screen, where the whole page is dark.
- **Error:** `--ion-color-danger` (`#EB445A`) text for validation/submission failures — reserved for hard failures only (invalid login, zero available stock, a failed BC submission), never for "please pay attention" (that's gold's job).

### Navigation
- **Header/tab bar:** Storage Navy (`#12203A`) background, white title text, FEFO Gold Light (`#D9B041`) for back-buttons/toolbar icons — the one place gold appears outside its expiry-signal role, functioning here as the brand mark's accent rather than a semantic flag. Tab-selected state also uses gold for the same reason (brand accent, not data).
- **Bottom tab bar:** two tabs only (Home, Scan); the Scan tab carries a blue badge showing the current order-line count when non-zero.

### Signature Component: Expiry Badge
The `.expiry-badge` is this app's one truly distinctive pattern: a small gold pill that means exactly one thing (within 14 days of expiry) and appears with byte-for-byte identical markup and styling on every screen that shows an expiry date. It is the visual proof of the North Star: color here exists to help someone standing in a storage room make a correct, fast decision about what to pick first.

## 6. Do's and Don'ts

### Do:
- **Do** use Deep Harbor Blue (`#2461A8`) for every interactive element and every "this is the key value" moment — buttons, links, focus states, wayfinding icons, the confirmed document number.
- **Do** reserve FEFO Gold (`#D4A72C` / `#A9840F` dark) exclusively for expiry-proximity and low-stock signals. If a future design wants a "pop" of color for something else, use weight/size/blue-pale instead — never reach for gold.
- **Do** keep every neutral tinted (cool blue-gray), never pure `#fff` or `#000` for large surfaces.
- **Do** keep shadows barely-visible (`rgba(...,0.06-0.12)`) — elevation is structural, not decorative.
- **Do** size touch targets generously (buttons, list rows, quantity steppers) for one-handed, tablet/phone use in variable lighting.

### Don't:
- **Don't** reskin the garments app's gold-primary/dark-secondary identity. This app leads with blue; gold is a narrow functional signal, not a matching brand pair.
- **Don't** build a generic admin-dashboard look — no default Material-admin chrome, no stock Bootstrap-template styling.
- **Don't** add consumer-app gloss: no bounce/elastic motion curves, no rounded-everything playfulness, no lifestyle-app styling. This is a work tool.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored status stripe on any card, list item, or callout. Use a full hairline border, a background tint, a leading icon/badge, or nothing.
- **Don't** use gradient text (`background-clip: text` with a gradient) anywhere. Emphasis comes from weight, size, or the Deep Harbor Blue / FEFO Gold system — never a gradient.
- **Don't** introduce a second decorative accent color. If it's not blue (interactive/key-value) or gold (expiry/stock warning), it's a neutral.
