# Event Planner

Web application for event organizers: guests, WhatsApp invitations, public RSVP, attendance dashboard, tables and seating, exports, and event-level permissions.

The project is being built frontend-first. The React frontend runs on its own, with browser-local demo data. The NestJS backend (`backend/`) exists and is tested, but the frontend does not use it yet (`PLAN.md` Phase 16).

## Prerequisites

- Node.js (developed and tested on v26)
- npm

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and choose **Try Demo** to explore the generated demo events, or **Sign Up** to start with an empty account. Accounts are a preview: they are kept in your browser only and no password is saved or checked.

## Commands

Run from `frontend/`.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build static assets into `dist/` |
| `npm run preview` | Serve the built assets locally |
| `npm run typecheck` | Type-check only |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm test` | Run unit and component tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with a coverage report; fails below 80% |
| `npm run test:e2e` | Run end-to-end tests, including accessibility checks (Playwright) |

The first end-to-end run needs a browser: `npx playwright install chromium`.

## Configuration

Copy `frontend/.env.example` to `frontend/.env.local` to override defaults. `VITE_DATA_PROVIDER` selects the data source: `mock` (default, browser-local demo data) or `api` (backend, not yet available).

The demo and the preview accounts keep their data in the browser's local storage. To review loading and error states, add `?demoDelay=2000` (milliseconds) or `?demoFail=events.get` (a comma-separated list of operations) to the address when opening the app.

## Run the backend

Needs Docker for the development database.

```sh
cd backend
cp .env.example .env
npm install          # also generates the Prisma client
npm run db:up        # PostgreSQL in Docker, with a separate test database
npm run db:deploy    # apply the migrations
npm run start:dev
```

The API listens on http://localhost:3000/api; its documentation is at http://localhost:3000/api/docs and `GET /api/health` reports the database. See `backend/README.md` for every command.

## Documentation

- `AGENTS.md` — engineering rules
- `PLAN.md` — implementation plan and progress log
- `docs/PRD.md` — product requirements
- `docs/ARCHITECTURE.md` — technical decisions and repository structure
- `docs/DOMAIN.md` — glossary and open decisions
- `docs/DEVELOPMENT.md` — workflow, validation and tooling
- `docs/MOCKUP_NOTES.md` — differences between mockups and requirements
- `docs/FUTURE_FEATURES.md` — features left out of the MVP
- `mockups/README.md` — page-to-mockup mapping
