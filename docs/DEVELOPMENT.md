# Development workflow

How work is carried out and checked in this repository. `AGENTS.md` holds the rules; this file describes the day-to-day procedure and the tooling in use. Setup commands belong in `README.md`.

## Unit of work

1. Take the earliest unchecked item in the active phase of `PLAN.md`.
2. Read the related sections of `docs/PRD.md`. For UI work, open every mockup mapped to that page in `resources/mockups/README.md`, desktop and mobile.
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
| Automated accessibility check (axe) with zero violations, in English, Hebrew and Portuguese, desktop and phone | Every new page and every new visual state of a shared component |
| Coverage at or above the 80% threshold (`npm run test:coverage`) | Every code change |
| Mockup comparison in desktop LTR, desktop RTL, mobile LTR, mobile RTL | Every UI change |
| New or changed texts in all three locales (`en`, `he`, `pt`; the type check refuses a missing key), and the review sheets regenerated | Every change to user-facing text |
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
| End-to-end tests | Playwright on Chromium. `npm run test:e2e` runs the `desktop`, `mobile` (Pixel 7 viewport) and `email` projects; `npm run test:performance` runs the `performance` project. Hebrew/RTL and Portuguese are covered by tests that switch the language. `playwright.deploy.config.ts` runs the smoke tests in `e2e-deploy/` against a deployed site | In place |
| Backend checks | In `backend/`: the same type-check, oxlint, Prettier and Vitest, plus integration tests against the test database (`npm run test:e2e`) | In place |
| Backend coverage | In `backend/`, `npm run test:coverage` runs the unit and integration tests together (`vitest.config.coverage.ts`, needs the test database) and fails below today's level: 95% statements, 88% branches, 97% functions, 96% lines. Raise these when coverage rises; never lower them | In place (Phase 23) |
| Tests on every pull request | GitHub Actions, `.github/workflows/tests.yml`, on every pull request to `main` or `v2_ui_demo`. Jobs:<br>• **Frontend:** lint, typecheck, format, unit tests with the 80% minimum, build.<br>• **Backend:** lint, typecheck, format, unit and integration tests with the coverage minimum against a PostgreSQL service, build.<br>• **Browser and API contract tests:** the API contract suite and Playwright desktop, phone and email, with PostgreSQL and Mailpit services.<br>• **All tests passed:** the single check to require before merging.<br>A failed Playwright run keeps its results as a downloadable artifact for 7 days. A dependency audit (`npm audit`, all dependencies) fails the run on any high or critical issue | In place (Phase 23) |
| Translation review | `npm run hebrew-review` and `npm run translation-review -- pt` write side-by-side sheets for native speakers (`docs/hebrew-review.xlsx`, `docs/portuguese-review.xlsx`). `npm run translation-review-pdf -- <he\|pt>` writes the matching PDF from the running app (`npm run dev`), with a picture of each screen and email in English (the source) and in the reviewed language; its line numbers match the sheet's `#` column, so a translator reads the PDF and corrects in the sheet. The PDFs are sent to translators and not kept in git | In place |
| Versions | GitHub Actions: `.github/workflows/version.yml` raises the versions after a merge (see Versions below) | In place |

Update this table when a tool is adopted.

## Versions

The frontend and the backend each have a version, `MAJOR.MINOR`, in `frontend/VERSION` and `backend/VERSION` (D107). They start at 1.0 and move independently.

- When a pull request is merged into `main`, the Version workflow raises the minor number of each side the pull request changed: 1.9 becomes 1.10. Files under `frontend/` or `deploy/web/` count for the frontend, files under `backend/` for the backend; Markdown files count for neither, so a docs-only pull request raises nothing.
- `main` accepts changes only through a pull request (the repository rule "Require pull request to main"), so the workflow opens a small pull request of its own ("Version: frontend 1.4 (#31)", branch `version/pr-31`), merges it, and tags the merged commit (`frontend-v1.4`). This needs the setting Actions → General → "Allow GitHub Actions to create and approve pull requests". Pull `main` after each merge before starting a new branch.
- Do not edit a `VERSION` file by hand, except to start a new major version: a pull request that sets `2.0` keeps it, and the workflow only tags it.
- To try the rules: `printf 'frontend/src/a.ts\n' | .github/scripts/bump-versions.sh --dry-run`.
- To see what is running: `/version.json` (frontend) and `/api/system/version` (backend), both with the commit; a Super User sees both on the System page.

## Branches, commits and review

- Work happens on a feature branch, not on `main`.
- V2.2 demo work branches from `v2_ui_demo` and returns to it by pull request; `v2_ui_demo` merges into `main` when the demo is finished. The V2.2 backend merges into `main` only when every test passes (D116).
- A pull request merges only when the **Tests** workflow's "All tests passed" check is green.
- One commit or small group of commits per `PLAN.md` checklist item, so progress can be reviewed item by item.
- The product owner reviews and approves changes. The frontend must be explicitly approved at the Phase 12 gate before large-scale backend work starts.
- Already-applied production database migrations are never edited; a new migration is added.

## Secrets and data

- No secrets, tokens, passwords or production credentials in the repository. `.env` files are ignored by the root `.gitignore`; only `.env.example` with safe placeholder values is committed.
- No real personal data in fixtures, tests, demo data or documentation. Use fictional names, `example.com` addresses and non-routable contact details.
