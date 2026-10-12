# Development workflow

How work is carried out and checked in this repository. `AGENTS.md` holds the rules; this file describes the day-to-day procedure and the tooling in use. Setup commands belong in `README.md`.

## Unit of work

1. Take the earliest unchecked item in the active phase of `PLAN.md`.
2. Read the related sections of `docs/PRD.md`. For UI work, open every mockup mapped to that page in `mockups/README.md`, desktop and mobile.
3. Implement the smallest complete change. Split the checklist item in `PLAN.md` first if it turns out to be large.
4. Run the validation below.
5. Check the item off in `PLAN.md` only after validation passes, and append a progress-log entry listing the commands actually run.

Requirement or mockup conflicts are recorded (in `docs/MOCKUP_NOTES.md` or `docs/DOMAIN.md`) and raised with the product owner. They are not resolved by picking one silently.

## Validation before an item is checked off

| Check | Applies to |
|---|---|
| Type-check | Every code change |
| Lint and format | Every code change |
| Unit tests for domain and business rules | Any change to rules, mock services, or backend services |
| Component tests | Important UI behavior |
| End-to-end tests | Critical flows listed in `AGENTS.md` |
| Automated accessibility check (axe) with zero violations, in English and Hebrew, desktop and phone | Every new page and every new visual state of a shared component |
| Coverage at or above the 80% threshold (`npm run test:coverage`) | Every code change |
| Mockup comparison in desktop LTR, desktop RTL, mobile LTR, mobile RTL | Every UI change |
| Demo Mode still uses the shared UI | UI and service changes |
| Broader regression run | Changes to shared components, contracts or rules |

Coverage target: at least 80% on relevant application logic (`AGENTS.md`), never as a replacement for covering the critical flows. A bug fix comes with a regression test where practical.

## Code quality

- TypeScript in strict mode; no `any` without a documented reason.
- No hard-coded user-facing strings; everything goes through translation resources.
- CSS logical properties rather than left/right.
- Presentation components do not call `fetch`, browser storage or a database; they use the typed service interfaces.
- No commented-out code, dead branches, speculative abstractions or unrelated refactors.
- Find the root cause of a failure before changing code.

## Tooling

| Purpose | Tool | Status |
|---|---|---|
| Build and dev server | Vite | In place (`frontend/`) |
| Type-check | `tsc -b` (`npm run typecheck`), strict mode with `noUncheckedIndexedAccess` | In place |
| Lint | oxlint (`npm run lint`) | In place |
| Format | Prettier (`npm run format`, `npm run format:check`) | In place |
| Unit and component tests | Vitest + React Testing Library + jsdom (`npm test`) | In place |
| Coverage | `@vitest/coverage-v8` (`npm run test:coverage`); the run fails below 80% statements, branches, functions or lines | In place |
| Accessibility | `@axe-core/playwright`, run inside the end-to-end suite (`e2e/accessibility.spec.ts`). It catches what a tool can detect, including colour contrast; it does not replace manual keyboard and screen-reader checks | In place |
| End-to-end tests | Playwright on Chromium with two projects, `desktop` and `mobile` (Pixel 7 viewport); Hebrew/RTL is covered by tests that switch the language (`npm run test:e2e`) | In place |

Update this table when a tool is adopted.

## Branches, commits and review

- Work happens on a feature branch, not on `main`.
- One commit or small group of commits per `PLAN.md` checklist item, so progress can be reviewed item by item.
- The product owner reviews and approves changes. The frontend must be explicitly approved at the Phase 12 gate before large-scale backend work starts.
- Already-applied production database migrations are never edited; a new migration is added.

## Secrets and data

- No secrets, tokens, passwords or production credentials in the repository. `.env` files are ignored by the root `.gitignore`; only `.env.example` with safe placeholder values is committed.
- No real personal data in fixtures, tests, demo data or documentation. Use fictional names, `example.com` addresses and non-routable contact details.
