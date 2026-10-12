# Architecture decisions

Records the technical decisions approved in `AGENTS.md` and `PLAN.md`, plus the choices that are still open. Product behavior lives in `docs/PRD.md`; this file does not restate it.

Update this file when a decision is made or changed. Do not record a choice here as decided until it has actually been adopted in the repository.

## Decided

| Area | Decision | Source |
|---|---|---|
| Delivery order | Frontend-first and mock-driven: interactive React prototype → UX approval gate (Phase 12) → NestJS/PostgreSQL backend → API integration → Docker/AWS | `AGENTS.md` Development strategy; `PLAN.md` |
| Frontend | React + TypeScript, built with Vite. Scaffolded in `frontend/` (Vite 8, React 19, TypeScript 6, npm) | `AGENTS.md` Technical direction; `PLAN.md` Phase 1 |
| Frontend tooling | oxlint (lint), Prettier (format), Vitest + React Testing Library + jsdom (unit/component tests), Playwright (end-to-end), React Router (routing) | Adopted in Phase 1 |
| Styling | Plain CSS with design tokens as custom properties (`frontend/src/styles/tokens.css`) and CSS Modules per component. No CSS framework. Logical properties only, so one stylesheet serves LTR and RTL | Adopted in Phase 2 |
| Icons | `lucide-react` | Adopted in Phase 2 |
| Overlays | Dialogs, drawers and the mobile navigation use the native `<dialog>` element, which provides focus containment, Escape to close and focus return | Adopted in Phase 2 |
| Interface language | `i18next` initialised in `frontend/src/i18n/i18n.ts`; resources in `src/i18n/locales/{en,he}.json`; keys are type-checked. The chosen language is remembered in `localStorage` by `src/i18n/languageStorage.ts` — the one use of browser storage outside the demo persistence adapter, kept out of presentation components | Adopted in Phase 2 |
| Guest-facing language | `LocaleScope` (`src/i18n/LocaleScope.tsx`) renders a subtree in a fixed language and direction, independent of the interface language | Adopted in Phase 2 |
| Breakpoints | Below 768px: phone presentation (tables become cards). Below 1024px: sidebar becomes a drawer. 1024px and up: fixed sidebar | Adopted in Phase 2 |
| Data provider switch | `VITE_DATA_PROVIDER` = `mock` (default) or `api`, validated by `frontend/src/services/providerConfig.ts` | Adopted in Phase 1 |
| Localization | `i18next` + `react-i18next`; locales `en` and `he`; root `lang`/`dir` follow the active locale; CSS logical properties | `AGENTS.md` Internationalization |
| Backend | Node.js + NestJS; thin controllers, rules in application/domain services | `AGENTS.md` Technical direction, Backend standards |
| Database | PostgreSQL, with Prisma for ORM and migrations | `AGENTS.md` Technical direction |
| Data access boundary | UI reads and writes only through typed feature service interfaces. A mock provider and an API provider implement the same contracts; the provider is chosen once at the application boundary | `AGENTS.md` Frontend standards |
| Page tree | One shared set of pages and components for Demo Mode and the real app; no separate demo page tree | `AGENTS.md` Development strategy |
| Demo Mode | Permanent public capability. Deterministic seeded fictional data, versioned, stored per browser profile, resettable, with simulated side effects. Never touches PostgreSQL and never authorizes anything server-side | `AGENTS.md` Demo Mode implementation; PRD §12 |
| Browser storage | Used only inside the demo persistence adapter, never from presentation components | `AGENTS.md` Frontend standards |
| Authorization | Enforced on the server for every event-scoped operation. Frontend permission checks are UX only | `AGENTS.md` Permissions, Security |
| Uploads | Stored through an abstraction that supports local storage now and object storage later | `AGENTS.md` Technical direction |
| Deployment target | One small EC2 instance (or comparable VM) running Docker Compose: Nginx serving the static React build and reverse-proxying NestJS, NestJS, PostgreSQL with a persistent volume. Images are built off-host where practical | `AGENTS.md` Technical direction; `PLAN.md` Phase 18 |
| Excluded infrastructure | No Kubernetes, microservices, Redis, message queues, managed RDS or background workers without a measured need and explicit approval | `AGENTS.md` Technical direction |
| Local development | The frontend runs without Docker, NestJS or PostgreSQL until the integration phases | `AGENTS.md` Technical direction |

## Not yet decided

These are implementation choices that the approved documents leave open. Each is settled in the phase that first needs it and then moved to the table above.

| Choice | Decide in |
|---|---|
| Server-state and UI-state management libraries | Phase 2–3 |
| Demo persistence: `localStorage` or IndexedDB (depends on measured dataset size) | Phase 3 |
| Phone normalization implementation | Phase 3 |
| CSV/XLSX parsing and export library | Phase 6 |
| Authentication and session mechanism | Phase 14 |
| API contract format and whether types are generated or shared | Phase 13 |

## Repository structure

Current:

```text
/
  AGENTS.md          engineering rules (authoritative)
  CLAUDE.md          redirect to AGENTS.md
  PLAN.md            living implementation plan and progress log
  docs/              PRD and durable product/architecture documentation
  mockups/           UI reference images and their index (README.md)
  frontend/          React + TypeScript app (Vite)
```

Added when their phase begins:

```text
  backend/           NestJS + Prisma (Phase 13)
  scripts/           shared helper scripts, if needed
  docker-compose.yml single-VM stack (Phase 18)
```

Inside `frontend/`:

```text
  e2e/               Playwright end-to-end tests
  src/
    app/             router, route table, application-level layout and provider selection
    features/        one folder per page/feature (events, dashboard, guests, messages,
                     rsvp-settings, event-layout, event-settings, permissions, public-rsvp)
    domain/          domain types and business rules, independent of React and data source
    services/        typed service contracts and their mock/API providers
    shared/          UI shared across features
      ui/            design-system components (buttons, fields, cards, tabs, dialogs, …)
      access/        read-only and role-restricted primitives
    app/shell/       application frame: sidebar, top bar, event selector, language switcher
    i18n/            language setup, translation resources, LocaleScope
    styles/          design tokens and base styles
    test/            test setup
```

Unit and component tests sit next to the code they cover as `*.test.ts(x)`.

## Routes

| Path | Page |
|---|---|
| `/` | Homepage / Events |
| `/events/:eventId` | Redirects to the event's dashboard |
| `/events/:eventId/dashboard` | Dashboard |
| `/events/:eventId/guests` | Guests |
| `/events/:eventId/rsvp` | RSVP Settings |
| `/events/:eventId/messages` | WhatsApp Messages |
| `/events/:eventId/layout` | Event Layout |
| `/events/:eventId/settings` | Event Settings |
| `/events/:eventId/permissions` | Permissions |
| `/rsvp/:rsvpId` | Public RSVP (outside the event layout) |
| `/showcase` | Design-system showcase: the application frame and every shared component, with sample values |
| anything else | Not-found page |

These are client-side routes, so the production web server must serve `index.html` for unknown paths (tracked in `PLAN.md` Phase 18).
