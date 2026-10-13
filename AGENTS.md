# Event Planner - Agent Instructions

## Purpose

This repository contains an Event Planner product for event organizers. The application manages events, guests, WhatsApp invitation flows, public RSVP, attendance analytics, tables/seating, exports, and event-level permissions.

These instructions are tool-agnostic. Any coding agent working in this repository should follow them, regardless of whether it is Claude Code, Codex, Cursor, Copilot, Gemini, or another agent.

## Source of truth

Before making changes:

1. Read this file completely.
2. Read `PLAN.md` completely.
3. Read relevant documentation under `docs/` before changing the related area.
4. Inspect the existing code before proposing or implementing changes.
5. Treat the approved product documentation as the source of truth for required behavior; use existing code, migrations, and tests to understand current implementation, not to override approved requirements.

If requirements conflict, stop and surface the conflict rather than silently choosing one.

## Working method

- Work from `PLAN.md` in order unless there is a clear technical dependency that requires a different order.
- `PLAN.md` is a living execution document. Update it as work progresses.
- Check off completed items only after validation passes.
- Add newly discovered implementation steps, risks, migrations, tests, or follow-up work directly to the appropriate section of `PLAN.md`.
- Do not delete completed history from `PLAN.md`. Preserve it as an execution record.
- If a task is larger than expected, split it into smaller explicit checklist items before implementing it.
- At the end of each meaningful unit of work, update `PLAN.md` with status and any newly discovered next steps.
- Do not skip tests or validation because a change appears small.

## Development strategy

- Follow a **frontend-first, mock-driven** implementation sequence, as specified in `PLAN.md`.
- First build the React frontend and reusable design system using the mapped desktop/mobile mockups and interactive mock services. The prototype must support realistic CRUD workflows, not merely static screens.
- Implement the real NestJS backend and PostgreSQL persistence after the frontend prototype has been reviewed, then integrate through typed service interfaces. A visually approved prototype is not a production-ready feature.
- Design the application for its eventual Docker deployment from the start, but defer full Docker Compose packaging until the integration/deployment stages specified in `PLAN.md`.
- Keep UI components independent of data source: no direct database calls, fetch calls, or browser-storage access from presentation components.
- Use domain types and service contracts early; implement mock and real API providers against the same contract. Do not assume all responses are instantaneous or successful.
- Do not build separate demo and production page trees; use shared UI and route behavior with dependency-injected services.
- Keep business rules testable independently of React and reuse rule definitions where practical without compromising backend authority.
- Mock services should simulate relevant validation, authorization, loading, errors, and lifecycle behavior. The backend later enforces these rules authoritatively.
- Implement and review each page against its mockups in desktop/mobile and English/Hebrew, not as a final translation-only pass.
- Do not skip ahead to backend or deployment work before completing the relevant plan gate without documenting and obtaining approval for any significant change of direction.

## Demo Mode implementation

Demo Mode is a **permanent public-facing MVP capability**, not disposable developer fixtures.

- Anyone must be able to launch Demo Mode without signing in. Keep the regular authenticated application separate.
- Reuse the **same frontend pages and components** for demo and real modes; choose a mock or API data provider at the application boundary.
- Use TypeScript service interfaces/contracts and separate mock provider implementations. Never hard-code sample guest/event arrays into page components.
- Generate realistic **fictional** event, guest, RSVP, invitation, table, permission, and dashboard data automatically. No manual data entry should be required to initialize a demo.
- Use a deterministic seed (and a fixed demo dataset version) and internally consistent relationships and computed values; include intentional edge cases (unknown guests, repeated sends, unassigned guests, seating conflicts, past events, and role differences).
- Generate guest parties and attendance totals within the documented constraints. Derive dashboard numbers from demo records rather than hard-coding aggregate values.
- Mock CRUD, RSVP, table assignment, permission behavior, imports/exports where feasible, and analytics should work interactively and apply the same domain rules used by the real app.
- Store demo state locally in the visitor's browser (localStorage or IndexedDB, according to actual size/requirements) and recover it on refresh. Isolate each browser profile; do not share demo mutations between visitors.
- Version the locally persisted demo dataset. On an incompatible data-model update, provide a safe reset or migration rather than silently crashing.
- Provide a prominent Demo Mode indicator and a **Reset Demo** action with confirmation. Reset restores the deterministic initial dataset.
- Keep the mock provider available after real APIs are implemented and deployed. A public demo must not require a user account or populate the real PostgreSQL database.
- WhatsApp sending works the same in Demo Mode as elsewhere (owner decision 2026-10-13): it opens the `https://wa.me/<number>?text=<message>` link from the user's own click. The generated demo guests are fictional and their numbers undialable, so the seeded data never reaches a real person, and a demo send changes only that browser's demo data, never a real guest counter. Do not make any other real-world external action from Demo Mode; disable or simulate other side effects.
- Demo roles are simulations only: never let them authorize backend actions or access real event/customer data. Server-side endpoints must not trust a client-supplied demo flag as authorization.
- Support exploring Viewer, Admin, and Owner states inside the demo without authenticating as real accounts; simulated role switching must only affect local demo authorization behavior.
- Demo state must never expose real personal information, credentials, production event data, or actual contact numbers.
- Support both English and Hebrew, LTR and RTL, desktop and mobile in Demo Mode.
- Make Demo Mode configurable per deployment; disabling it must not remove or change regular application features.
- Test demo initialization, mutations, refresh persistence, isolation, simulated side effects, and reset behavior.

## Product principles

- Keep the product simple and focused on the approved MVP.
- Do not add features that were not requested or documented.
- Prefer explicit domain rules over clever abstractions.
- Business rules must be enforced in the backend, not only hidden or disabled in the UI.
- Preserve historical event data accurately.
- Prefer reversible, migration-safe changes.
- Mobile and Hebrew/RTL support are first-class requirements, not later enhancements.
- Accessibility and keyboard usability should be considered in shared UI components.

## Core product behavior

### Events

- Users can belong to multiple events.
- Event access is controlled by event-level roles: `OWNER`, `ADMIN`, `VIEWER`.
- `SUPER_USER` is a system-level permission stored on the user, not an event role.
- Event creators become Owners.
- Past events are read-only through normal product flows and remain viewable/exportable.
- Event maximum attendees:
  - minimum: 50
  - default: 300
  - maximum: 3000

### Permissions

- Viewer: read-only event access and exports; cannot access the Permissions page or permission APIs.
- Admin: can modify event data, but cannot duplicate/delete an event. Can manage only Admin/Viewer permissions. Cannot modify their own permission.
- Owner: full event control, including duplicate/delete and permission management. Cannot modify their own permission.
- Super User: can access all events with Owner-equivalent event capabilities. Super User assignment is database-only for MVP.
- Every event must always retain at least one Owner.
- Authorization must be enforced server-side on every event-scoped operation.

### Guests

- A guest belongs to exactly one event.
- Phone number is unique per event after normalization.
- Guests are soft-deleted using `deleted = 1`.
- Re-adding a deleted guest with the same normalized phone restores and updates that record instead of creating a duplicate.
- `invitation_sent_count` starts at 0 and never decreases.
- Initiating a WhatsApp send from the system increments `invitation_sent_count` by 1.
- Dashboard Invitations Sent counts distinct guests with `invitation_sent_count > 0`, regardless of the actual counter value.
- Invitation Name is the name submitted by the guest through RSVP and must not overwrite organizer-controlled first/last name fields.

### RSVP

- There is one public RSVP URL per event, shared by all guests.
- Each event has a default RSVP language, set on RSVP Settings. A guest can switch the public RSVP page between English and Hebrew; texts the organizer wrote are shown as written.
- Public RSVP asks for name, phone number, number of attendees, and response. Number of attendees is always required; for Declined and Not Sure the submitted number is discarded.
- Known guests are matched by normalized phone number.
- Unmatched responses are stored as Unknown Guests for organizer review.
- RSVP states: `NO_RESPONSE`, `APPROVED`, `NOT_SURE`, `DECLINED`.
- Approved attendee count must be an integer from 1 through the guest's allowed-attendees limit.
- Declined means confirmed attendees = 0.
- Not Sure is not counted in expected/confirmed attendance.
- Guests may update RSVP until the event begins.
- Only Approved guests may be assigned to a table.

### Tables and seating

- Table numbers are unique within an event.
- Tables have a capacity and shape.
- Manual assignment that would exceed a table's capacity must be rejected.
- RSVP changes are authoritative: if a later RSVP increase causes an assigned table to exceed capacity, accept the RSVP and surface a seating conflict.
- Total configured chairs may be below or above the event maximum-attendees value. Save the configuration and show a warning; do not block it.
- Seating exports must support CSV and XLSX.

### Dashboard

Dashboard calculations must be derived consistently from persisted data.

At minimum:

- Total Guests: active guests only (`deleted = 0`).
- Invitations Sent: distinct active guests with `invitation_sent_count > 0`.
- Invitations Not Sent: active guests with `invitation_sent_count = 0`.
- Awaiting Response: invitation sent and RSVP status `NO_RESPONSE`.
- RSVP Approved: count of guests with `APPROVED`.
- RSVP Not Sure: count of guests with `NOT_SURE`.
- RSVP Declined: count of guests with `DECLINED`.
- Confirmed Attendees: sum of confirmed attendees for Approved guests only.
- Seating Capacity: sum of table capacities.
- Unassigned Confirmed Attendees: sum of Approved attendees without a table.

## Technical direction

- Frontend: React + TypeScript.
- Backend: Node.js + NestJS.
- Database: PostgreSQL.
- ORM and database migrations: Prisma.
- Frontend localization: `i18next` + `react-i18next`, with English (`en`) and Hebrew (`he`).
- POC deployment target: **one small, low-resource AWS EC2 instance** (or comparable VM), running all application services via Docker Compose.
- POC production topology: Nginx serving the static React build and reverse-proxying NestJS; NestJS backend; PostgreSQL with a persistent volume. Avoid a continuously running frontend development server in production.
- Build application images outside the low-memory host where practical, then pull and run the built images on the VM.
- No Kubernetes, microservices, Redis, message queues, managed RDS, or other always-on infrastructure without a measured requirement and explicit approval.
- Design for backup/restore, restart survival, and resource limits on a constrained VM; do not equate AWS Free Tier with permanently free hosting.
- Local frontend-first development may run without Docker. Full Docker Compose packaging and cloud deployment occur in the later plan phases.
- Keep frontend and backend concerns clearly separated.
- Define API contracts explicitly and keep generated/shared types synchronized if the repository adopts that pattern.
- Store uploaded assets through an abstraction that can support local development and object storage later; do not couple business logic directly to local filesystem paths.

If the repository has older technical decisions that conflict with the approved choices above, document the discrepancy and request a decision instead of silently replacing the approved stack.

## Repository structure

Prefer a clear top-level structure. Adapt to the existing repository rather than moving files unnecessarily.

Typical structure:

```text
/
  AGENTS.md
  CLAUDE.md
  PLAN.md
  mockups/
    README.md
  docs/
    PRD.md
  frontend/
  backend/
  scripts/
  docker-compose.yml
```

Add nested `AGENTS.md` files only when a subdirectory has important instructions that differ from the root. Nested instructions should extend, not duplicate, the root unnecessarily.

## Backend standards

- Keep controllers thin.
- Put business rules in application/domain services rather than controllers.
- Validate all external input.
- Enforce authorization on the backend for every event-scoped command/query.
- Prefer database constraints for invariants that the database can safely enforce.
- Use transactions for multi-record operations that must succeed or fail together.
- Keep migrations deterministic and reviewable.
- Do not expose internal stack traces or secrets through API responses.
- Use structured logging where practical.

## Frontend standards

- Use TypeScript strictly; avoid `any` unless there is a documented reason.
- Build reusable primitives for buttons, inputs, dialogs, alerts, badges, tables, mobile cards, and empty/loading/error states.
- Do not implement desktop-only tables and call them responsive. Provide deliberate mobile representations where required.
- Treat RTL as a layout mode. Test components in both `ltr` and `rtl`.
- Keep server state and UI state conceptually separate.
- Access guest/event/RSVP/table data through typed feature service interfaces, not directly through React components. Select demo/mock versus real API implementation at the application boundary.
- Use generated demo fixtures through the mock service; use browser storage only inside the demo persistence adapter.
- Do not reproduce authorization rules only in the frontend. Frontend permission checks are for UX; backend checks are authoritative.

## Internationalization implementation

- Use `i18next` with `react-i18next` for frontend localization unless the existing repository has already adopted another i18n solution.
- Initial locales: `en` and `he`.
- All user-facing strings must come from translation resources; do not hard-code English or Hebrew strings directly in components.
- Set the root document `lang` and `dir` attributes according to the active locale.
- Hebrew must use `dir="rtl"` and English must use `dir="ltr"`.
- Prefer CSS logical properties such as `margin-inline-start`, `padding-inline-end`, and `text-align: start/end` over left/right-specific styling.
- Components containing phone numbers, URLs, emails, or other inherently LTR values may explicitly use LTR direction inside an RTL page.
- Coding agents may generate initial English/Hebrew translation resources; libraries only resolve translations and do not translate automatically. Keep terminology editable and reviewable.
- The authenticated application's UI language is independent of the event's default guest-facing RSVP language.

## UI mockups and visual guidance

The project contains UI reference images in the root-level `mockups/` directory.

`mockups/README.md` is the authoritative mapping between product pages/tabs and their corresponding desktop/mobile mockup files.

Before implementing or modifying any user-facing page or tab:

1. Read `mockups/README.md`.
2. Identify the exact mockup(s) mapped to the page or tab being implemented.
3. Open and review all relevant desktop and mobile mockups before writing UI code.
4. If mobile has separate tab-specific mockups, implement those layouts explicitly. Do not assume that mobile is simply a scaled-down desktop version.
5. Treat the mapped mockups as the primary visual reference for:
   - page structure
   - tab structure
   - spacing
   - card layouts
   - typography hierarchy
   - colors
   - button placement
   - table/list presentation
   - form layout
   - navigation behavior
   - general visual style
6. Preserve the overall structure and interaction model shown in the mockups unless an approved product requirement requires different behavior.
7. The mockups are visual references, not pixel-perfect specifications. Adapt them when required for:
   - responsive behavior
   - Hebrew and RTL layouts
   - accessibility
   - browser/device differences
   - missing product states
   - authorization differences
   - consistency with shared design-system components
8. Do not invent a substantially different visual language or page structure when a mapped mockup exists.
   - Every data table follows the same guidelines on desktop (owner decision 2026-10-13): headings centred; number columns centred and text columns start-aligned; English headings in Title Case; the actions column last, pinned, with its heading hidden. Build tables with the shared `DataTable`; see `docs/ARCHITECTURE.md`.
9. Do not select a mockup based only on visual similarity when `mockups/README.md` provides an explicit mapping.
10. If desktop and mobile mockups differ structurally, treat that difference as intentional unless it clearly conflicts with an approved product requirement.
11. The mockups were created after the PRD. If a mapped mockup differs from or adds to the PRD:
   - build what the mockup shows (layout, navigation, fields, panels, buttons);
   - keep the PRD as the source of truth for business rules (calculations, validation, permissions, RSVP and seating behavior, lifecycle);
   - update `docs/PRD.md` in the same phase so it stays accurate;
   - if a mockup element's behavior is not evident, or mockups contradict each other, ask the product owner instead of guessing;
   - record the outcome in `docs/DOMAIN.md` and `docs/MOCKUP_NOTES.md`.
12. When implementing a page or state with no direct mockup:
   - reuse established patterns from the closest relevant mockups;
   - reuse existing shared components;
   - do not introduce a new visual language without need.
13. When a new mockup is added, update `mockups/README.md` so the mapping remains explicit.

Every UI implementation must be validated in:
- desktop LTR
- desktop RTL
- mobile LTR
- mobile RTL

## Database and migrations

- Never edit an already-applied production migration in place; add a new migration.
- Preserve soft-delete semantics for guests.
- Use normalized phone values for guest uniqueness and RSVP lookup.
- Ensure event-scoped uniqueness where required, including guest phone and table number.
- Avoid destructive schema changes without an explicit migration path.
- PostgreSQL is the persistent data store for real users; public demo data stays in browser-isolated mock storage and must never be silently synchronized into the real database.
- Prisma migrations should be reproducible from a clean database; do not use ad hoc schema changes in deployed environments.

## Testing requirements

- Changes are not complete until relevant tests pass.
- Target at least 80% unit/integration test coverage on relevant application logic; do not use the metric as a substitute for testing critical flows.

Expected layers:

- Unit tests for domain/business rules.
- Backend integration tests for API, persistence, and authorization.
- Frontend component tests for important UI behavior.
- End-to-end tests for critical product flows.

Critical flows requiring strong coverage include:

- authentication
- event creation
- permission enforcement
- guest create/edit/delete/restore
- phone normalization and duplicate prevention
- WhatsApp send counter behavior
- RSVP known/unknown matching
- RSVP status transitions
- attendee-count validation
- table assignment/capacity behavior
- RSVP-induced seating conflicts
- past-event read-only enforcement
- CSV/XLSX import/export
- English/Hebrew and RTL smoke coverage
- deterministic demo generation, reset, isolation, and persistence across refresh
- WhatsApp links are opened only by an explicit user click and never by the data layer; no other external side effects in Demo Mode
- mock/API provider contract consistency
- single-VM Docker deployment and persistent data after restart

When fixing a bug, add or update a regression test whenever practical.

## Security

- Never commit secrets, tokens, passwords, or production credentials.
- Keep secrets in environment variables or the repository's approved secret mechanism.
- Treat all public RSVP input and file imports as untrusted input.
- Validate uploaded file type, size, and parsed content.
- Avoid trusting user-supplied IDs without checking event membership and permissions.
- Treat demo state as untrusted browser-controlled data; a demo-mode flag is never a security credential.
- Use fictional names and non-routable/example contacts in generated demo data; avoid accidental delivery to real recipients.
- Ensure public demo access cannot read or mutate real PostgreSQL event data.
- Public Demo Mode should not call privileged or authenticated production data endpoints, regardless of local browser state.
- Protect public RSVP against basic abuse (input validation, request throttling, and no unnecessary disclosure of guest records).

## Code quality

- Use current stable libraries and idiomatic approaches supported by the repository.
- Keep solutions simple. Do not over-engineer.
- Avoid speculative abstractions and unused extensibility layers.
- Prefer clear naming over comments that restate code.
- Do not leave commented-out code or dead branches behind.
- Do not add unrelated refactors to a focused feature unless they are required for correctness.
- When something fails, identify the root cause before changing code. Do not guess and patch repeatedly.

## Documentation

- Keep `README.md` concise and focused on setup and common commands.
- Put durable product/architecture documentation in `docs/`.
- Update documentation when behavior, setup, schema, API contracts, or architecture changes.
- Keep `PLAN.md` synchronized with implementation progress.
- Keep product requirements in `docs/PRD.md`, implementation rules in `AGENTS.md`, execution steps in `PLAN.md`, and exact screen-to-image mappings in `mockups/README.md`.
- Keep `docs/FUTURE_FEATURES.md` as the list of everything left out of the MVP. Whenever a feature is left out (by a scope decision, or because a mockup shows something that is not being built now), add it there in the same change.
- If the files conflict, flag the disagreement instead of silently overriding an approved product requirement.

## Completion protocol

Before declaring a plan item complete:

1. Implement the smallest complete change.
2. Run relevant formatting/linting/type-checking.
3. Run relevant tests.
4. Run broader regression tests when the change affects shared behavior.
5. When UI is affected:
   - compare the result against the mapped mockups;
   - validate desktop and mobile layouts;
   - validate English/LTR and Hebrew/RTL behavior;
   - verify Demo Mode still uses the same shared UI when relevant.
6. Update documentation if behavior or architecture changed.
7. Update `PLAN.md`:
   - check off completed work
   - record validation performed
   - add newly discovered work
8. Summarize what changed, what was validated, and what remains.

Do not mark work complete merely because code was written.
