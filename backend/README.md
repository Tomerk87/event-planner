# Event Planner API

NestJS 12, PostgreSQL 17 and Prisma 7. The frontend does not call it yet; that is `PLAN.md` Phase 16.

## Setup

```sh
cp .env.example .env
npm install          # also runs prisma generate
npm run db:up        # PostgreSQL in Docker: event_planner and event_planner_test
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
| `npm run db:up` / `npm run db:down` | Start or stop the development database |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations |
| `npm run openapi` | Write `openapi.json`, the API contract for the frontend |
| `npm run super-user -- <email> [--off]` | Grant or remove Super User (database only, PRD §3.2); needs `npm run build` first |

## Notes

- The integration tests empty the tables of `TEST_DATABASE_URL` before each test. They refuse a database whose name does not end in `_test`, or that is the same as `DATABASE_URL`.
- `src/domain/` is a copy of `frontend/src/domain/`. A unit test fails when the two differ: change a rule in both.
- Errors are returned as `{ code, details }`, with the codes of `src/domain/errors.ts`.
- Public RSVP answers are limited per IP address and per phone (`RSVP_LIMIT_*` in `.env.example`). Behind a proxy, set `TRUST_PROXY_HOPS` so the limit sees each guest's own address.
- There is no email verification yet (owner decision for the POC); see `PLAN.md` Phase 17.
