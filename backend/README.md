# Event Planner API

NestJS 12, PostgreSQL 17 and Prisma 7. The frontend reaches it at `/api` (its development server forwards there).

## Setup

```sh
cp .env.example .env
npm install          # also runs prisma generate
npm run db:up        # PostgreSQL (event_planner, event_planner_test) and Mailpit in Docker
npm run db:deploy    # apply the migrations
npm run start:dev    # http://localhost:3000/api, documentation at /api/docs
```

## Commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | Run the API, restarting on changes |
| `npm run build` / `npm run start:prod` | Build to `dist/` and run the build |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | Checks |
| `npm test` / `npm run test:cov` | Unit tests (business rules, configuration) |
| `npm run test:e2e` / `npm run test:e2e:cov` | Integration tests: the whole API against the test database |
| `npm run db:up` / `npm run db:down` | Start or stop the development database and Mailpit |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations |
| `npm run openapi` | Write `openapi.json`, the API contract for the frontend |
| `npm run super-user -- <email> [--off]` | Grant or remove Super User (database only, PRD §3.2); needs `npm run build` first |

## Notes

- The integration tests empty the tables of `TEST_DATABASE_URL` before each test. They refuse a database whose name does not end in `_test`, or that is the same as `DATABASE_URL`.
- `src/domain/` is a copy of `frontend/src/domain/`. A unit test fails when the two differ: change a rule in both.
- Errors are returned as `{ code, details }`, with the codes of `src/domain/errors.ts`.
- Public RSVP answers are limited per IP address and per phone (`RSVP_LIMIT_*` in `.env.example`). Behind a proxy, set `TRUST_PROXY_HOPS` so the limit sees each guest's own address.
- `test/contract-seed.ts` loads the frontend's demo dataset into the test database for the frontend's `npm run test:api`; it refuses any other database.
- `test/e2e-tools.ts` moves an event into the past or makes a Super User on the test database, for the frontend's browser tests; it refuses any other database.

## Email

Email is off by default (`EMAIL_MODE=off`, decision D88): nothing is sent, new accounts count as verified, and invitations take effect at sign-up. To try the email features locally:

```sh
npm run db:up        # also starts Mailpit
# in .env:
EMAIL_MODE=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=Event Planner <noreply@localhost>
npm run start:dev
```

Every email then appears at http://localhost:8025 and nothing leaves the machine. A Super User sees the settings on the System page and can send a test email there. In production, Amazon SES's SMTP endpoint and SMTP credentials are set in the server's environment (`PLAN.md` Phase 18), never in the repository.
