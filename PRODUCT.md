# Product

## Register

product

## Users

The RGMC/SBIC online merch team, using the app while physically in a storage room or warehouse to fulfill consignment orders for food & beverage customers. They are standing, often holding stock, working on a phone or tablet, sometimes one-handed, under lighting that is not guaranteed to be bright or even. Their job: pick a customer, add items with the correct quantity/unit of measure/expiry, and submit the order straight into Business Central — quickly, and trusting that what the screen shows (availability, expiry) is true right now, not from an earlier sync.

## Product Purpose

SBIC Consignment Webapp - Food And Beverages lets the online merch team record consignment sales and see real-time inventory availability as items are picked from storage, submitting orders directly to Business Central (no queue, no background sync). Success looks like: an order entered and submitted in under a minute, quantity never oversold because availability is always live, and no work lost if the network drops mid-session (the one thing the app persists locally is the in-progress draft).

## Brand Personality

Efficient, clear, dependable. A well-made internal tool that gets out of the way — not a marketing surface, not a consumer app. It should feel calm and competent under a busy, hands-full, mildly stressful warehouse workflow, not decorative or performative.

## Anti-references

- **Not a reskin of the sibling garments app** (`rgmc-consignment-webapp`'s gold/dark, gold-sweep-animation theme). Same company, deliberately different tool with its own identity — not "swap the accent color and ship."
- **Not a generic admin dashboard.** No stock Bootstrap-template chrome, no default Material-admin look.
- **Not consumer-app gloss.** No bouncy/elastic motion, no rounded-everything playfulness, no lifestyle-app styling — this isn't a shopping app, it's a work tool.

## Design Principles

1. **Speed over decoration** — every screen optimizes for the fastest path from "pick a customer" to "submitted order." Visual flourish never slows down a tap-heavy warehouse workflow.
2. **Trustworthy through clarity, not chrome** — because data is always fetched live (never cached), the UI communicates "this is current" through legible states (loading, availability, expiry, error) rather than through polish for its own sake.
3. **Built for one-handed, variable-light use** — this tool is used while physically holding stock in a storage room, not at a desk. Touch target size, contrast, and legibility are first-class constraints, not an accessibility afterthought.
4. **Its own identity, not a reskin** — distinct from the garments app's gold/dark aesthetic; this app earns its color language from its own brand mark (`logo-main.png`'s blue/gold), used deliberately rather than copied wholesale.
5. **Restraint as craft** — utilitarian doesn't mean bare. Color, spacing, and type hierarchy are used sparingly and deliberately to guide attention, not to decorate.

## Accessibility & Inclusion

WCAG AA baseline. Touch targets (buttons, list rows, quantity steppers) sized generously for phone/tablet use, including one-handed operation. Text and key actions maintain strong contrast to stay legible under the inconsistent lighting typical of storage rooms and warehouses.
