<div align="center">
  <img src="./logo-main.png" alt="SBIC Consignment Webapp logo" width="140" />

  <h1><span style="color:#2461A8">SBIC Consignment Webapp — Food And Beverages</span></h1>
  <p><span style="color:#666">A live, no-cache consignment order entry app for the online merch team — record sales and see inventory availability in real time as items are picked from storage.</span></p>

  [![Vue](https://img.shields.io/badge/Vue-3.4-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
  [![Ionic](https://img.shields.io/badge/Ionic-8.3-3880ff?logo=ionic&logoColor=white)](https://ionicframework.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.2-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Pinia](https://img.shields.io/badge/Pinia-2.1-ffd859?logo=pinia&logoColor=black)](https://pinia.vuejs.org/)
  [![Axios](https://img.shields.io/badge/Axios-1.7-5A29E4?logo=axios&logoColor=white)](https://axios-http.com/)
</div>

---

## <span style="color:#2461A8">📑 Table of Contents</span>

- [🍱 Overview](#-overview)
- [🧰 Tech Stack](#-tech-stack)
- [✨ Features](#-features)
- [🗺️ Screens / Routes](#️-screens--routes)
- [📁 Project Structure](#-project-structure)
- [⚙️ Setup & Installation](#️-setup--installation)
- [🔑 Environment Variables](#-environment-variables)
- [▶️ Running the App](#️-running-the-app)
- [📦 Building for Production](#-building-for-production)
- [📱 Mobile Deployment](#-mobile-deployment)
- [🌐 API Endpoints](#-api-endpoints)
- [💾 Data & Caching Strategy](#-data--caching-strategy)
- [🔐 Authentication Flow](#-authentication-flow)
- [🔄 Core Data Flow / Order Lifecycle](#-core-data-flow--order-lifecycle)
- [🎨 Brand / Design Tokens](#-brand--design-tokens)
- [📄 License](#-license)

---

## <span style="color:#2461A8">🍱 Overview</span>

This app is a **sibling, purpose-built rebuild** of RGMC's garments consignment app — for a different audience (the **online merch team**, ordering **food & beverage** consignment stock) and a different technical philosophy.

> 💡 **Design decision:** unlike the garments app (which pre-syncs an entire product/customer/price catalog to the device and works offline-first), this app assumes a **connected online team** and is built **live-first**. There is no catalog cache, no background sync job, and no offline order queue. Every list is fetched from the backend on demand, server-paginated, with loading states — because inventory availability has to reflect what's actually in Business Central *right now*, not what was true at the last sync.

Key facts baked into the design:

- **Company visibility** is driven by a `foodConsignmentVisible` flag (not the garments app's `consignmentAppVisible`), so the same Business Central tenant can host both apps side by side without their company pickers colliding.
- **No Brand concept at all** — the garments app scopes everything by brand/dimension; this app has no brand dropdown and no brand-based item filtering.
- **No sync step at login** — authentication is a single live lookup, not a "download everything, then log in" flow.
- **Quantity is capped by real, live inventory** — every item's orderable quantity is bounded by the sum of open lot quantities fetched from Business Central at the moment of adding it to an order, sorted oldest-expiration-first (FEFO).
- **Submission is direct and synchronous** — no background task queue, no polling. The app calls a dedicated backend endpoint that creates the Sales Header + Sales Lines in Business Central and returns the real document number immediately (or fails cleanly with nothing posted).
- The only client-side persistence is a **single autosave slot for the in-progress order**, so a network drop doesn't lose a half-built order — never a data cache.

This repository is the **frontend only**. It talks to a dedicated `/food/*` router added to the shared `rgmc-bc-api` backend, which in turn talks to Business Central through two new/adjusted AL API pages (Item Unit of Measure, Item Available Lot).

---

## <span style="color:#2461A8">🧰 Tech Stack</span>

| Layer | Technology | Version |
|---|---|---|
| Framework | Vue 3 (`<script setup>`, Composition API) | `^3.4.21` |
| UI Component Library | Ionic Vue | `^8.3.0` |
| Routing | Ionic Vue Router / Vue Router | `^8.3.0` / `^4.3.3` |
| Language | TypeScript | `^5.4.5` |
| Build Tool | Vite | `^5.2.8` |
| State Management | Pinia | `^2.1.7` |
| HTTP Client | Axios | `^1.7.2` |
| Password Hashing | bcryptjs (lazy-loaded, login-only chunk) | `^3.0.3` |
| Icons | Ionicons | `^7.4.0` |
| Type-checking | vue-tsc | `^2.0.11` |

> ⚠️ **Not included by design:** no Capacitor, no service worker / PWA manifest, no IndexedDB, no offline sync engine, no Cloud Tasks polling — all deliberately dropped relative to the sibling garments app (`rgmc-consignment-webapp`).

---

## <span style="color:#2461A8">✨ Features</span>

### <span style="color:#D4A72C">🔐 Authentication</span>

- Company picker sourced live from Business Central, filtered to `foodConsignmentVisible = true` (no brand picker — this app has no brand concept).
- Username + password login against a Business Central Contact record (`username` / `passwordHash` fields), looked up **live** per attempt — no bulk contact prefetch.
- Supports bcrypt hashes, legacy plaintext passwords (silently upgraded to bcrypt on first successful login), and forced password setup on first login or when the password is still the default (`12345678`).
- No sync step of any kind on login — a successful login goes straight to the Home screen.

### <span style="color:#D4A72C">🏠 Home & Drafts</span>

- Welcome header with the signed-in user's name and today's date.
- "Start New Session" begins a fresh order against the signed-in user.
- **Open Drafts** list — every not-yet-submitted session autosaved on this device, resumable with one tap, deletable with a swipe.

### <span style="color:#D4A72C">📷 Scan (Order Entry)</span>

- **Customer** — searched live against Business Central, restricted server-side to `chain = true` customers.
- **Posting Date** — native date picker.
- **Add Item** — opens the item selector modal (see below); disabled until a customer is chosen.
- **Order Lines** — swipe-to-delete list showing item, quantity, unit of measure, and expiry date per line; a sticky bar surfaces line/quantity totals and a "Review & Submit" action once at least one line exists.
- The active session autosaves to `localStorage` on every field change and on navigating away.

### <span style="color:#D4A72C">➕ Add Items Modal</span>

- Search bar matches on **item number, ID, or description** — server-side filtered and paginated, never a full client-side list.
- Selecting an item live-fetches:
  - its **open lots** (oldest expiration first, filtered to remaining quantity > 0) to compute total orderable quantity and the expiry date to display,
  - its **valid Units of Measure**.
- Quantity stepper is hard-capped at the live available quantity — it is not possible to order more than what Business Central currently reports as available.
- Selected Item Number, Description, Quantity, Unit of Measure, and Expiry Date are confirmed before the line is added to the order.

### <span style="color:#D4A72C">📤 Submit</span>

- Requires an **Order Number** (the online team's own order reference) before submission.
- Submits directly and synchronously to Business Central — creates the Sales Header + Sales Lines in one request, no background queue.
- On success: shows the real Business Central document number and the entered Order Number as confirmation, then clears the draft.
- On failure: nothing is posted (the header is rolled back if any line fails), the error is shown inline, and the draft is preserved for retry.

---

## <span style="color:#2461A8">🗺️ Screens / Routes</span>

```
/                     → redirect to /splash
/splash               → splash screen; routes to /login or /app/home based on auth state
/login                → company + username + password login
/app                  → tab shell (TabsPage)
  /app/home           → welcome header, "Start New Session", open drafts list
  /app/scan           → customer, posting date, add-item, order lines for the active session
/app/submit           → order number entry, final review, direct BC submission, confirmation
```

---

## <span style="color:#2461A8">📁 Project Structure</span>

```
sbic-consignment-food/
├── .env                             # dev env vars (VITE_API_BASE_URL) — committed, no secrets
├── .env.production                  # prod bake-in vars (currently none needed)
├── .dockerignore
├── .gitignore
├── Dockerfile                       # 2-stage build: Node build → nginx serve
├── nginx.conf                       # proxies /food/* to rgmc-bc-api; SPA fallback
├── docker-entrypoint.sh             # envsubst $PORT/$VITE_API_BASE_URL at container start
├── index.html                       # SPA shell, loads /src/main.ts
├── logo-main.png                    # source brand logo
├── package.json
├── public/
│   └── logo-main.png               # served logo (favicon + in-app)
├── src/
│   ├── App.vue                     # root shell — online/offline toast only
│   ├── main.ts                     # app bootstrap, Ionic/Pinia setup, route guard
│   ├── env.d.ts                    # Vite env typing (VITE_API_BASE_URL, __APP_VERSION__)
│   ├── version.ts                  # human-readable app version constant
│   ├── components/
│   │   ├── AppLogo.vue             # reusable logo + wordmark
│   │   ├── CustomerSelectorModal.vue  # live, paginated customer search modal
│   │   └── ItemSelectorModal.vue      # live, paginated item search + lot/UOM/qty modal
│   ├── composables/
│   │   └── useNetworkStatus.ts     # online/offline ref, browser event driven
│   ├── router/
│   │   └── index.ts                # route table (see Screens / Routes above)
│   ├── services/
│   │   ├── api.service.ts          # single Axios instance + every /food/* call
│   │   ├── draft.service.ts        # the ONLY localStorage usage — auth + draft autosave
│   │   └── item-prefetch.service.ts  # splash-time item warm-up, consumed once, never a cache
│   ├── stores/
│   │   ├── auth.store.ts           # login, bcrypt/legacy password logic, session identity
│   │   └── session.store.ts        # active order + drafts (Pinia)
│   ├── theme/
│   │   └── variables.css           # blue/gold brand theme, Ionic variable overrides
│   ├── types/
│   │   └── index.ts                # every shared TS interface (see Data Flow below)
│   ├── utils/
│   │   ├── bcrypt.ts               # lazy bcryptjs loader (login-only bundle chunk)
│   │   └── format.ts               # date formatting, today's-date helper
│   └── views/
│       ├── SplashPage.vue
│       ├── LoginPage.vue
│       ├── TabsPage.vue            # bottom tab bar shell (Home, Scan)
│       ├── HomePage.vue
│       ├── ScanPage.vue
│       └── SubmitPage.vue
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts                  # dev proxy (/food → VITE_API_BASE_URL), manual chunking
```

---

## <span style="color:#2461A8">⚙️ Setup & Installation</span>

**Prerequisites**

- Node.js 18+ and npm
- A running instance of `rgmc-bc-api` (the shared backend) with its `/food/*` router registered
- A Business Central environment with the `RGMC API Extension` AL app published (specifically the `companySettings`, `contacts`, `customers`, `items`, `itemAvailableLots`, `itemUnitsOfMeasure`, and `salesOrders`/`salesOrderLines` entities)

**Install**

```bash
git clone <this-repo-url>
cd sbic-consignment-food
npm install
```

`.env` already ships with a working staging `VITE_API_BASE_URL` — edit it if you need to point at a different `rgmc-bc-api` instance.

---

## <span style="color:#2461A8">🔑 Environment Variables</span>

Same setup as the sibling garments app (`rgmc-consignment-webapp`): a committed `.env` for local dev, a committed `.env.production` for values that must be baked into the production bundle, and `.env.local` / `.env.*.local` gitignored for personal overrides.

| Variable | File | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `.env` (dev only) | Base URL of the `rgmc-bc-api` backend. Used **only** by the Vite dev server to proxy `/food/*` requests locally (`vite.config.ts`). **Not present in `.env.production`** — in production it's supplied as a real Cloud Run environment variable and substituted into `nginx.conf` at container startup by `docker-entrypoint.sh` (identical mechanism to the garments app). |

> 📌 The app itself never reads `VITE_API_BASE_URL` at runtime — `api.service.ts` always calls relative paths (`/food/...`), so the exact same build artifact works in dev, staging, and production; only nginx's proxy target changes.

---

## <span style="color:#2461A8">▶️ Running the App</span>

```bash
npm run dev
```

Runs the Vite dev server on **port 8200** with hot module reload. If `VITE_API_BASE_URL` is set in `.env`, requests to `/food/*` are proxied to that backend so the app can be exercised against a real (or staging) Business Central connection without a separate reverse proxy.

```bash
npm run preview
```

Serves the production build locally for a final check before deploying.

---

## <span style="color:#2461A8">📦 Building for Production</span>

```bash
npm run build
```

This runs `vue-tsc` (type-check, no emit) followed by `vite build`. Output is written to `dist/`. The build:

- Splits Ionic, Vue/Pinia, and other vendor code into separate cached chunks (`vite.config.ts` → `manualChunks`).
- Keeps `bcryptjs` as its own lazily-loaded chunk, fetched only when the login screen actually needs it.

**Container deployment** mirrors `rgmc-consignment-webapp` exactly — a two-stage `Dockerfile` (Node build → nginx serve), `nginx.conf` proxying `/food/*` to the backend, and `docker-entrypoint.sh` running `envsubst` on `$PORT`/`$VITE_API_BASE_URL` at container startup (Cloud Run injects both as real env vars — nothing is baked into the image):

```bash
docker build -t sbic-consignment-food .
docker run -p 8080:8080 -e VITE_API_BASE_URL=https://rgmc-bc-api-staging-935246372408.asia-southeast1.run.app sbic-consignment-food
```

---

## <span style="color:#2461A8">📱 Mobile Deployment</span>

**Not applicable.** This is an intentional, explicit difference from the sibling garments app: there is no Capacitor project, no `capacitor.config.ts`, and no native Android/iOS packaging here. Ionic Vue's components are touch-friendly and work well on a tablet or phone browser, but this app ships as a **web-only single-page app** — the online merch team is expected to use it from a browser, not an installed app.

---

## <span style="color:#2461A8">🌐 API Endpoints</span>

All endpoints live under the `/food` prefix on `rgmc-bc-api` and are **always live** — none of them read from that backend's shared in-memory/GCS/Firestore caches. Every request carries a `?company=<code>` query parameter, injected automatically by the Axios request interceptor in `api.service.ts` once a company is selected.

| Method | Path | Description |
|---|---|---|
| `GET` | `/food/companies` | Companies with `foodConsignmentVisible = true` |
| `GET` | `/food/contacts?username=` | Live single-contact lookup for login (no prefetch) |
| `PATCH` | `/food/contacts/{id}` | Update a contact's password hash (bcrypt upgrade / first-time setup) |
| `GET` | `/food/customers?search=&limit=&offset=` | Paginated, live customer search — `chain = true` enforced server-side |
| `GET` | `/food/items?search=&limit=&offset=` | Paginated, live item search by number or description |
| `GET` | `/food/items/{itemNo}/lots?limit=&offset=` | Open lots for an item, oldest expiration first, `remainingQuantity > 0` |
| `GET` | `/food/items/{itemNo}/uom` | Valid Units of Measure for an item |
| `POST` | `/food/sales-orders` | Direct, synchronous Sales Order + Lines creation in Business Central |

**`POST /food/sales-orders` request body:**

```json
{
  "customerNumber": "C001234",
  "postingDate": "2026-09-25",
  "orderNumber": "ONLINE-ORD-00981",
  "lines": [
    {
      "itemNumber": "FB-1002",
      "description": "Canned Tomatoes 400g",
      "quantity": 24,
      "unitOfMeasureCode": "CASE"
    }
  ]
}
```

**Response:**

```json
{
  "documentNumber": "SO-104432",
  "externalDocumentNo": "ONLINE-ORD-00981"
}
```

---

## <span style="color:#2461A8">💾 Data & Caching Strategy</span>

This app stores exactly three things in `localStorage` — and nothing else. There is no IndexedDB, no service worker cache, and no catalog of items/customers/prices kept on the device.

| Key | Written by | What it holds | Refreshed |
|---|---|---|---|
| `sbic_food_auth_v1` | `draft.service.ts` (`setAuth`) | The signed-in Contact, so a page refresh doesn't force a re-login | On every successful login; cleared on logout |
| `sbic_food_company_v1` | `draft.service.ts` (`setCompanyCode`) | The selected company code, restored on boot | On login; cleared on logout |
| `sbic_food_drafts_v1` | `draft.service.ts` (`saveDraft` / `removeDraft`) | Every not-yet-submitted order (customer, posting date, order number, lines) | On nearly every field change in Scan, and on navigating away — this is the app's **only** answer to a network outage: work in progress survives, catalog data does not |

> 💡 Every customer, item, lot, and unit-of-measure list you see on screen was fetched moments ago and will be fetched again the next time that screen is shown — there is no "last synced" timestamp anywhere in this app, because there is nothing to keep in sync.

**One narrow, deliberate exception:** `item-prefetch.service.ts`. For a *returning* user (company already known from `sbic_food_company_v1`, no login step needed), `SplashPage` fires a fire-and-forget `GET /food/items` for the first unfiltered page while the splash delay/redirect plays out, purely to warm up the backend's BC access token and connection before the user reaches Add Items. It is **not a cache**:

- It's held in a module-level variable, not `localStorage` — gone on refresh.
- It's consumed **exactly once**, by the very next `ItemSelectorModal` open, and only if that open is an unfiltered first page (any search or page 2+ always fetches live).
- It expires after 30 seconds even if unconsumed.
- It's cleared on logout.

The effect is purely on perceived latency for the *first* Add Items open after login — it never changes what data reaches the screen, since it's the exact same endpoint/params the modal would have called anyway.

---

## <span style="color:#2461A8">🔐 Authentication Flow</span>

1. `SplashPage` checks `authStore.isAuthenticated` and routes to `/login` or `/app/home`.
2. `LoginPage` calls `GET /food/companies` and renders the company picker (only `foodConsignmentVisible = true` companies appear).
3. The user picks a company, enters username + password, and submits.
4. `auth.store.login()` sets the active company on the Axios interceptor, then calls `GET /food/contacts?username=` — a **live**, single-record lookup, not a cached list scan.
5. Password verification branches on the stored `passwordHash`:
   - **Empty** → force the "Set Your Password" modal (first login).
   - **Not a bcrypt hash** (legacy plaintext) → compare directly; on match, hash it with bcrypt and `PATCH /food/contacts/{id}` to upgrade it silently.
   - **Bcrypt hash** → `bcrypt.compare()` against the entered password, and in parallel check whether it equals the default password `12345678` (if so, force password setup instead of logging in).
6. On success, the company + user are written to `sbic_food_auth_v1` / `sbic_food_company_v1`, and the router sends the user straight to `/app/home` — **no sync step**.

---

## <span style="color:#2461A8">🔄 Core Data Flow / Order Lifecycle</span>

```
Home                     Scan                          Add Items Modal
─────                    ─────                         ────────────────
Start New Session   →    Pick Customer (live search)
                         Set Posting Date
                         Tap "Add Item"           →     Search item (live, paginated)
                                                         Select item
                                                            ├─ GET .../lots   (oldest expiry, remaining qty)
                                                            └─ GET .../uom    (valid units of measure)
                                                         Set Quantity (capped by live available qty)
                                                         Set Unit of Measure
                                                    ←    Confirm → line added to order
                         Line appears in Order Lines
                         (session autosaved to localStorage on every change)
                         Tap "Review & Submit"    →

Submit
──────
Enter Order Number
Tap "Submit to Business Central"
   → POST /food/sales-orders
        ├─ success → BC returns real Sales Order document number
        │            draft cleared, confirmation shown
        └─ failure → nothing posted (header rolled back if a line failed)
                     draft preserved, error shown, retry available
```

---

## <span style="color:#2461A8">🎨 Brand / Design Tokens</span>

Defined in `src/theme/variables.css`, derived from `logo-main.png`'s blue/gold palette.

| Token | Hex | Role |
|---|---|---|
| `--app-blue` / `--ion-color-primary` | `#2461A8` | Primary brand color — buttons, active states, header accents |
| `--app-blue-dark` / `--app-dark` | `#12203A` | Header/tab bar background, dark surfaces |
| `--app-gold` / `--ion-color-tertiary` | `#D4A72C` | Accent — highlights, chips, tab-selected state |
| `--app-gold-dark` | `#A9840F` | Gold text-on-light-background (chips) |
| `--app-surface` | `#FFFFFF` | Card / list-item background |
| `--app-surface-alt` | `#F4F7FB` | Page background |
| `--app-border` | `#DBE4F0` | Dividers, card borders |
| `--app-text-muted` | `#6B7686` | Secondary text, captions |

---

## <span style="color:#2461A8">📄 License</span>

Private and proprietary — internal RGMC / SBIC tooling. Not licensed for external use or redistribution.
