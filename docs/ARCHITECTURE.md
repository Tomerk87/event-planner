# Architecture decisions

Records the technical decisions approved in `AGENTS.md` and `PLAN.md`, plus the choices that are still open. Product behavior lives in `docs/PRD.md`; this file does not restate it.

Update this file when a decision is made or changed. Do not record a choice here as decided until it has actually been adopted in the repository.

## Decided

| Area | Decision | Source |
|---|---|---|
| Delivery order | Frontend-first and mock-driven: interactive React prototype → UX approval gate (Phase 12) → NestJS/PostgreSQL backend → API integration → Docker/AWS | `AGENTS.md` Development strategy; `PLAN.md` |
| Frontend | React + TypeScript, built with Vite. Scaffolded in `frontend/` (Vite 8, React 19, TypeScript 6, npm) | `AGENTS.md` Technical direction; `PLAN.md` Phase 1 |
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
| Linter: keep oxlint (shipped by the Vite template) or switch to ESLint | Phase 1 |
| Formatter, unit/component test runner, end-to-end test tool | Phase 1 |
| Routing library | Phase 1 |
| Styling approach and design-token mechanism | Phase 2 |
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

Inside `frontend/src/`, feature-oriented folders and the locations for domain types and service contracts are defined in Phase 1 (`PLAN.md`, "Create feature-oriented folders…").
