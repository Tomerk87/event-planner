# Event Planner

Web application for event organizers: guests, WhatsApp invitations, public RSVP, attendance dashboard, tables and seating with a floor plan, exports, event-level permissions, notifications and account emails. The interface and the public RSVP page are in English, Hebrew (right to left) and Brazilian Portuguese, and each event reads phone numbers as Israeli or Brazilian.

The React frontend (`frontend/`) and the NestJS API (`backend/`, PostgreSQL) run together. The public demo needs no backend: its data is generated and kept in the visitor's browser. Accounts, their events and the public RSVP page of a real event use the API.

**Contents:** [Run it](#prerequisites) · [The demo](#the-demo) · [Settings](#settings) · [Fixed limits](#limits-fixed-in-the-code) · [Versions](#versions) · [Translations](#translations) · [Commands](#commands) · [Deploy](#deploy) · [Documentation](#documentation)

## Prerequisites

- Node.js (developed and tested on v26, the version the Dockerfiles and `netlify.toml` use)
- npm
- Docker, for the backend's development database

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and choose **Try Demo** to explore the generated demo events. **Sign Up** and **Sign In** need the backend running (below): the development server forwards `/api` to http://localhost:3000.

## Run the backend

```sh
cd backend
cp .env.example .env
npm install          # also generates the Prisma client
npm run db:up        # PostgreSQL in Docker, with a separate test database
npm run db:deploy    # apply the migrations
npm run start:dev
```

The API listens on http://localhost:3000/api; its documentation is at http://localhost:3000/api/docs and `GET /api/health` reports the database. Email is off by default; `backend/README.md` explains how to turn it on locally with Mailpit, and lists every command.

## The demo

A public preview of the whole product that anyone can open with **Try Demo**, with no account and no server.

**How it works**
- The same pages as the real product; only the data source differs. Every action (adding a guest, seating, "sending" a WhatsApp message) goes to a demo engine that runs in the browser and applies the same rules as the server.
- **Try Demo** generates 6 fictional sample events with guests, RSVP answers, tables and permissions. They are the same for every visitor; a demo started in Portuguese gets the Brazilian sample events.
- The data is kept in the visitor's own browser (local storage): it survives a reload but never reaches anyone else. **Reset Demo** brings back the original sample data.
- WhatsApp works for real: it opens WhatsApp with the message ready. The sample phone numbers are fictional, so nothing reaches a real person.
- Owner, Admin and Viewer can be tried with the role switcher; this only changes what the demo allows.

**Where it runs**
- On the full product's site, beside the accounts (`VITE_DEMO_ENABLED=true`, the default).
- On its own as a **demo-only site on Netlify**, free and with no server: `netlify.toml` builds `frontend/` with `VITE_ACCOUNTS_ENABLED=false` (no Sign In or Sign Up). Every merge to `main` makes Netlify build and publish the site; what it serves is plain files (HTML, JavaScript, pictures) from its network, with every page address opening the app. With the [Version workflow](#versions), a merge makes two builds (the merge and the version pull request). Setup and checks: `docs/DEPLOYMENT.md`, "Demo-only site".

**Its limits** (all adjustable, see [Demo settings](#demo-settings))
- **Time:** a demo ends on its own **3 days** after it started, or after **12 hours without activity** (a click or key press in a demo tab), whichever comes first. Its data is then cleared and the visitor sees why, with a Try Demo button for a fresh one.
- **Size:** at most **10 events** (the 6 samples and 4 of the visitor's own), **3,000 guests in an event**, and about **4 million characters** of stored data, pictures included. Browsers keep about 5 MB for a site, so the demo stays well inside it.
- **Full storage:** a change past a limit, or one the browser refuses to store, is **refused with a message** (for example "The demo's storage in this browser is full, so this change was not saved…") instead of being lost on the next visit. Deleting always works, so room can always be made. Where the browser stores nothing at all (some private windows), the demo still runs for that visit.
- **Pictures** are reduced in the browser before they are kept: an event photo to about 300 KB, an RSVP background to about 700 KB, a floor picture to about 1 MB.
- **Nothing is shared:** another visitor, or the same person on another device, never sees the changes. Clearing the browser's data, or a private window, loses the demo.
- **No accounts, emails or server features.** On the demo-only site, the System page and the sign-in pages lead back to the landing page.

**RSVP in the demo**
- An event the visitor creates, and any change to an event's RSVP page, exist only in that browser: its RSVP link does not open on a phone or another computer.
- The 6 sample events are the exception: their links open anywhere, because every browser generates the same sample data. The other device shows the **original** sample page, and an answer given there is kept **only on that device**; the organizer's browser never sees it.
- A link works for as long as the demo in that browser lives (3 days, or 12 hours without activity). Like any event, its RSVP also closes when the event starts.

To review loading and error states in the demo, add `?demoDelay=2000` (milliseconds) or `?demoFail=events.get` (a comma-separated list of operations) to the address when opening the app.

## Settings

Values set outside the code. Anything not set takes its default; a value that is not valid stops the server (or the demo's build) with a message naming the setting, so a typo is never taken silently.

### Product limits (server)

The server is the authority: it applies these limits, and the screens read them from the server when a signed-in session starts (`GET /api/system/features`), so both always agree. Change a value and restart the server.

| Setting | Default | What it limits | Most it may be set to |
|---|---|---|---|
| `TABLE_MAX_SEATS` | 30 | Seats (chairs) at one table | 1000 |
| `EVENT_MAX_ATTENDEES_MIN` | 50 | The lowest Maximum Attendees an event may have | 100,000 |
| `EVENT_MAX_ATTENDEES_MAX` | 3000 | The highest Maximum Attendees | 100,000 |
| `EVENT_MAX_ATTENDEES_DEFAULT` | 50 | A new event's Maximum Attendees | between the two above |
| `GUEST_MAX_ATTENDEES_MAX` | 10 | The highest Maximum Attendees per Guest (people one invitation may confirm) | 100 |
| `GUEST_MAX_ATTENDEES_DEFAULT` | 5 | A new event's Maximum Attendees per Guest | up to the one above |
| `IMPORT_MAX_ROWS` | 5000 | Rows in one guest import | 100,000 |
| `IMPORT_MAX_FILE_MB` | 5 | Size of an imported guest file, in MB | 50 |
| `IMAGE_MAX_FILE_MB` | 5 | Size of a chosen picture, in MB, before it is reduced | 50 |

The database keeps only the wide safety ranges in the last column, so a raised setting is accepted. A table or event stored under an older, lower limit is kept as it is.

**Where to set them:** in `backend/.env` when running locally (the lines are in `backend/.env.example`), and in `deploy/.env` on the production server (in `deploy/.env.example`; `deploy/docker-compose.yml` passes them to the API).

### Other server settings

| Setting | Default | What it does |
|---|---|---|
| `DATABASE_URL` | — (required) | The PostgreSQL database |
| `TEST_DATABASE_URL` | — | The test database, for the backend's integration tests and the end-to-end tests |
| `CORS_ORIGIN` | — (required) | The frontend's address, allowed to call the API |
| `PUBLIC_APP_URL` | `CORS_ORIGIN` | The address used in RSVP links and emails |
| `PORT` | 3000 | The API's port |
| `NODE_ENV` | development | `production` requires HTTPS addresses and secure cookies |
| `UPLOAD_DIR` | `./uploads` | Where pictures are stored |
| `TRUST_PROXY_HOPS` | 0 | Proxies in front of the API (1 behind Nginx in production) |
| `AUTH_ATTEMPTS_PER_MINUTE` | 10 | Sign-in and sign-up attempts per minute from one address |
| `RSVP_LIMIT_PER_IP` / `RSVP_LIMIT_PER_PHONE` | 10 / 3 | Public RSVP answers per address and per phone in each window |
| `RSVP_LIMIT_WINDOW_MINUTES` | 10 | That window |
| `EMAIL_MODE` | off | `off` sends nothing; `smtp` sends through `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` |
| `EMAIL_VERIFY_HOURS` / `PASSWORD_RESET_MINUTES` | 24 / 60 | How long an email's verification or password-reset link works |
| `EMAIL_LIMIT_PER_HOUR` | 3 | Emails of each kind per address per hour |
| `GIT_COMMIT` | — | Set by the image build; reported with the version |

The production server also needs `DOMAIN`, `POSTGRES_PASSWORD` and the others described in `deploy/.env.example` and `docs/DEPLOYMENT.md`.

### Frontend build settings

Read when the site is built (`frontend/.env.local` locally, `netlify.toml` or Netlify's site settings for the demo-only site). Every `VITE_` value is visible in the public site: never a secret.

| Setting | Default | What it does |
|---|---|---|
| `VITE_DEMO_ENABLED` | true | `false` hides Try Demo; nothing else changes |
| `VITE_ACCOUNTS_ENABLED` | true | `false` makes a demo-only site with no accounts and no server (the Netlify build) |
| `VITE_GOOGLE_MAPS_KEY` | empty | A Google Maps browser key for place suggestions in location fields; empty leaves them plain text (`docs/DEPLOYMENT.md`, "Google location suggestions") |
| `API_URL` | http://localhost:3000 | Where the development server forwards `/api` (an environment variable of `npm run dev`) |

### Demo settings

The demo has no server, so its limits are read when the site is built. Each product limit has a demo twin with the `VITE_` prefix and the `_DEMO` suffix, and the demo has settings of its own. Set them in `netlify.toml` (`[build.environment]`) or in Netlify's site settings (Environment variables) for the demo-only site, or in `frontend/.env.local`; the lines are in `frontend/.env.example`. They change only the demo: the product's limits come from the server.

| Setting | Default | What it limits |
|---|---|---|
| `VITE_TABLE_MAX_SEATS_DEMO` | 30 | Seats at one table |
| `VITE_EVENT_MAX_ATTENDEES_MIN_DEMO` / `_MAX_DEMO` / `_DEFAULT_DEMO` | 50 / 3000 / 50 | An event's Maximum Attendees |
| `VITE_GUEST_MAX_ATTENDEES_MAX_DEMO` / `_DEFAULT_DEMO` | 10 / 5 | People one invitation may confirm |
| `VITE_IMPORT_MAX_ROWS_DEMO` | 5000 | Rows in one guest import |
| `VITE_IMPORT_MAX_FILE_MB_DEMO` | 5 | Size of an imported guest file, in MB |
| `VITE_IMAGE_MAX_FILE_MB_DEMO` | 5 | Size of a chosen picture, in MB |
| `VITE_EVENTS_MAX_DEMO` | 10 | Events one demo holds, the 6 samples included (1–100) |
| `VITE_GUESTS_PER_EVENT_MAX_DEMO` | 3000 | Guests in one demo event (1–100,000) |
| `VITE_STORAGE_MAX_CHARS_DEMO` | 4,000,000 | Characters of stored data, pictures included (500,000–5,000,000; browsers keep about 5 million) |
| `VITE_LIFETIME_DAYS_DEMO` | 3 | Days a demo lasts (1–365) |
| `VITE_IDLE_HOURS_DEMO` | 12 | Hours without activity before a demo ends (1–8760) |

## Limits fixed in the code

These are not settings; they rarely need changing, and some depend on how the screens are laid out.

| What | Limit |
|---|---|
| Table numbers | 1 to 9,999, unique in an event |
| Texts | WhatsApp message 1,000 characters; RSVP messages 500; RSVP title 80; group name 40; floor-plan labels 40 |
| Floor plan | room 3 to 200 m a side; up to 200 venue objects |
| Stored pictures | event photo about 300 KB, RSVP background about 700 KB, floor picture about 1 MB, after reduction |
| Sessions | 30 days |

## Versions

The frontend and the backend each have a version, `MAJOR.MINOR`, in `frontend/VERSION` and `backend/VERSION` (decision D107). They move independently, starting at 1.0.

- When a pull request is merged into `main`, the Version workflow (`.github/workflows/version.yml`) raises the minor number of each side it changed (1.9 becomes 1.10). Files under `frontend/` or `deploy/web/` count for the frontend, files under `backend/` for the backend; Markdown files count for neither.
- `main` takes changes only through a pull request, so the workflow opens a small pull request of its own ("Version: frontend 1.4 (#31)"), merges it, and tags the result (`frontend-v1.4`). This needs the repository setting Actions → General → "Allow GitHub Actions to create and approve pull requests". Pull `main` after each merge.
- Do not edit a `VERSION` file by hand, except to start a new major version: a pull request that sets `2.0` keeps it, and the workflow only tags it.
- What is running: `/version.json` (frontend) and `/api/system/version` (backend), each with its commit. Clients never see a version; a Super User sees both on the System page.

## Translations

English is the source; every text is also in Hebrew and Brazilian Portuguese (`frontend/src/i18n/locales/`, and the server's emails in `backend/src/email/templates.ts`). For a review round, each translator gets a pack:

1. `npm run translation-review-pdf -- he` (or `pt`) in `frontend/`, with `npm run dev` running, writes `docs/hebrew-review.pdf`: every text, screen by screen, numbered, with a picture of each screen and email in English and in the reviewed language. The PDFs are not kept in git.
2. `npm run hebrew-review` and `npm run translation-review -- pt` write the matching spreadsheets (`docs/hebrew-review.xlsx`, `docs/portuguese-review.xlsx`), with the same numbers and empty columns for corrections and comments.
3. The translator reads the PDF and writes corrections in the spreadsheet; the returned spreadsheet is applied text by text, by its number and key.

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
| `npm run test:e2e` | Run end-to-end tests, including accessibility checks (Playwright): the demo and real accounts on desktop and phone, and the email flows against Mailpit. Starts the built API on the backend's test database (ports 3102 and 3103, the second with email on) and its own development servers (ports 5174 and 5175) |
| `npm run test:performance` | The 3,000-guest performance check (PLAN.md Phase 17), on its own |
| `npm run hebrew-review` | Write `docs/hebrew-review.xlsx`, every text in English and Hebrew for review |
| `npm run translation-review -- pt` | Write `docs/portuguese-review.xlsx`, every text in English and Portuguese for review (`he` writes the Hebrew sheet) |
| `npm run translation-review-pdf -- pt` | Write `docs/portuguese-review.pdf` for a translator (see [Translations](#translations); `he` for Hebrew) |
| `npm run email-images` | Redraw the pictures inside the server's emails (`backend/src/email/images.ts`) |
| `npm run test:api` | Builds the backend and runs the provider contract suite on the real API, against the test database |

Every pull request to `main` or `v2_ui_demo` runs all of these automatically (`.github/workflows/tests.yml`, docs/DEVELOPMENT.md "Tooling"). In `backend/`, `npm run test:coverage` runs the unit and integration tests together with their coverage minimum.

The first end-to-end run needs a browser: `npx playwright install chromium`. `npm run test:e2e` and `npm run test:api` need the development database and Mailpit running (`npm run db:up` in `backend/`). The end-to-end suite takes a few minutes; run it with the computer awake and not busy, since a pause can drop its servers' connections.

## Deploy

The production stack (Nginx, the API and PostgreSQL in Docker Compose on one small AWS server) is in `deploy/`. `docs/DEPLOYMENT.md` covers the first-time setup step by step, then deploying, rollback, logs, backups and restore. The demo-only site is published free on Netlify from `netlify.toml` (see [The demo](#the-demo)). Try the same stack on this machine with `deploy/scripts/local-test.sh up` (after `ALLOW_DIRTY=1 deploy/scripts/build-images.sh`).

## Documentation

- `AGENTS.md` — engineering rules
- `PLAN.md` — implementation plan and progress log
- `docs/PRD.md` — product requirements
- `docs/ARCHITECTURE.md` — technical decisions and repository structure
- `docs/DOMAIN.md` — glossary and decisions (D1…D110)
- `docs/DEVELOPMENT.md` — workflow, validation and tooling
- `docs/DEPLOYMENT.md` — production stack, AWS setup guide and operations
- `docs/MOCKUP_NOTES.md` — differences between mockups and requirements
- `docs/FUTURE_FEATURES.md` — features left out of the MVP
- `resources/mockups/README.md` — page-to-mockup mapping
- `resources/screenshots/` — the application as built, every page and tab, desktop and mobile
- `resources/DESIGN_GUIDE.md` — the visual language, for designers drawing new mockups
