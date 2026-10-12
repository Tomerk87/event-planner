# Event Planner — Implementation Plan

**Status:** Frontend-first POC plan  
**Approach:** Mockup-driven interactive frontend → UX acceptance → NestJS/PostgreSQL backend → API integration → Docker Compose/AWS deployment  
**Execution:** Living checklist maintained by the coding agent  
**Sources:** `AGENTS.md` (engineering rules), `docs/PRD.md` (product behavior), `mockups/README.md` (exact visual mapping)

## How to use this plan

1. Read `AGENTS.md`, the current active phase in `PLAN.md`, and the relevant sections of `docs/PRD.md` and `mockups/README.md` for the task at hand.
2. Inspect the current repository and **preserve already implemented work**. Do not blindly scaffold over existing files.
3. Work through phases in order. A dependency-driven exception requires a note in the progress log; do not silently switch to a backend-first approach.
4. Complete one small, testable checklist unit at a time. Add missing tasks, discovered edge cases, and refinements in the relevant phase.
5. Mark `[x]` only when the implementation **and its validation** are complete. Never mark tasks complete on intent alone.
6. Update this file after each meaningful implementation unit. Record tests run, failures/limitations, decisions, and next tasks.
7. Ask for user review at the **Phase 12 frontend UX gate**. The agent can prepare further tasks, but must not treat visual approval as implicit or proceed to large-scale backend implementation before that gate is resolved.
8. Work within the approved MVP. If requirements or mockups conflict, document the conflict and ask instead of inventing a different product behavior.
9. A page is not complete because it looks right: test interactions, loading/empty/error states, mobile, English/LTR, Hebrew/RTL, and role/past-event restrictions.
10. Keep `CLAUDE.md` a small redirect to `AGENTS.md`; do not duplicate instructions across the two files.

**Definition of done for each UI feature:** exact mockups reviewed, reusable UI implemented, mock service works, state updates and persists as appropriate, critical edge cases tested, English/Hebrew and desktop/mobile checked, and plan updated.

**Definition of done for each backend feature:** API contract satisfied, validation/business rules and authorization enforced on server, schema/migration correct, relevant automated tests pass, documentation and plan updated.

## Key architecture and scope guardrails

- React + TypeScript frontend; `i18next` + `react-i18next`; responsive English/LTR and Hebrew/RTL.
- **Frontend first**: implement browser-based mock providers, generated demo data, and working UI before building NestJS APIs.
- Shared typed domain models and service interfaces. Presentation components must not directly read/write browser storage or call backend APIs.
- Permanent **public Demo Mode**, no login required. Deterministic fictional data, isolated browser persistence, reset, no real external messaging, and no real database access.
- Real app later: Node.js/NestJS, PostgreSQL, Prisma; server-enforced permission and RSVP/seating rules.
- Defer full Docker Compose integration until later. Design for a **single small, low-resource AWS EC2 VM** from the start: static React build via Nginx, NestJS, local PostgreSQL persistent volume, upload storage abstraction.
- No Redis, Kubernetes, microservices, managed RDS, or background workers for the POC unless justified and approved.
- The **visual venue Arrangement editor** remains post-MVP as previously specified; the MVP includes Tables and seating. Preserve its mobile/desktop mockups for later. If full interactive Arrangement is desired earlier, record a scope decision before moving it.
- Mockup mapping lives in `mockups/README.md`. Never guess which tab's PNG to use when the mapping exists.

---

## Phase 0 — Documentation, design references and project decisions

**Goal:** establish an unambiguous foundation without implementing product backend or Docker services.

### Checklist
- [x] Confirm root `AGENTS.md`, `CLAUDE.md`, and `PLAN.md` exist; ensure Claude redirects to AGENTS.
- [x] Confirm `docs/PRD.md` exists and includes Demo Mode, event permissions, guests, RSVP, WhatsApp, tables, exports, and past-event behavior.
- [x] Confirm `mockups/README.md` indexes actual PNG filenames, pages, breakpoints, and tab variants.
- [x] Confirm all referenced PNG files exist. Note missing images explicitly rather than silently substituting designs.
- [x] Document MVP vs post-MVP visual Arrangement scope and any differences between PRD and mockups.
- [x] Record architecture decisions under `docs/` (React/TypeScript, NestJS, PostgreSQL, Prisma, i18next, mock/API providers, AWS single-VM constraints).
- [x] Document domain definitions and known open decisions without inventing requirements.
- [x] Establish expected repository structure; let scaffolding create `frontend/`, `backend/`, etc. when necessary.
- [x] Define code quality, tests, formatting and review workflow; create root `.gitignore` and safe `.env.example` when relevant.

### Validation and exit criteria
- [x] Instructions and requirements are consistent; conflicts are explicitly recorded.
- [x] Agent can map each planned page/tab to exact mockups.
- [x] No real customer data or secrets are committed.

---

## Phase 1 — Frontend scaffolding and development environment

**Goal:** run a local React + TypeScript application independently of backend, database and Docker.

### Checklist
- [x] Scaffold frontend using a lightweight React + TypeScript toolchain (prefer Vite unless existing code dictates otherwise).
- [ ] Set up strict TypeScript, lint, formatting, unit/component test runner, and browser end-to-end testing strategy.
- [ ] Set up frontend routing for Homepage/Events, Dashboard, Guests, Messages, RSVP Settings, Event Layout, Event Settings, Permissions, and public RSVP.
- [ ] Create feature-oriented folders and typed domain model/service-contract locations.
- [ ] Create local development startup scripts/README instructions.
- [ ] Ensure the frontend can build static production assets.
- [ ] Establish `.env.example` with a safe configuration switch for mock vs API providers (no secrets).

### Validation and exit criteria
- [ ] `npm` scripts for dev, build, typecheck, lint and tests work.
- [ ] App loads locally without NestJS, PostgreSQL or Docker.
- [ ] Unimplemented routes have clear placeholders, not silent crashes.

---

## Phase 2 — Design system, mockups, responsive layout and i18n

**Goal:** establish one reusable visual language from the actual desktop/mobile mockups before creating feature pages.

### Checklist
- [ ] Read `mockups/README.md`; inspect all supplied screen types to extract common patterns.
- [ ] Define design tokens: colors, typography, borders, radius, spacing, responsive breakpoints and semantic statuses.
- [ ] Create accessible reusable components: buttons, inputs, selects, tables, mobile cards, tabs, headers, dialogs, drawers, KPI cards, badges, notices, toasts, empty/loading/error states.
- [ ] Implement responsive application shell, event selector/header, desktop navigation and mobile navigation.
- [ ] Add `i18next`/`react-i18next` with `en` and `he` translation resources and language persistence.
- [ ] Switch root `lang` and `dir` properly; use logical CSS properties and handle LTR phone/email/URL values inside RTL.
- [ ] Add a fixed guest-facing RSVP language per event, distinct from the organizer UI language.
- [ ] Create reusable read-only/past-event and role-restricted UI primitives.
- [ ] Build a representative layout/component showcase against the provided mockups.
- [ ] Document any mockup gaps or conflicts; do not introduce unrelated visual patterns.

### Validation and exit criteria
- [ ] Components render at desktop/mobile widths and in English LTR/Hebrew RTL.
- [ ] Keyboard focus and labels work in common components.
- [ ] UI foundation visually resembles the reference images.

---

## Phase 3 — Domain types, deterministic demo generator and mock services

**Goal:** build the interactive data engine once so every demo page uses consistent realistic data and behavior.

### Checklist
- [ ] Define TypeScript contracts for User, Event, EventPermission, Guest, Unknown RSVP, RSVP Settings, WhatsApp Settings, Table, Assignment, analytics and relevant export models.
- [ ] Define feature service interfaces for all CRUD and workflows, with Promise-based results and well-defined domain errors.
- [ ] Build deterministic, seeded fictional dataset generator with coherent event dates, permissions, guests, RSVPs, counters, tables and assignments.
- [ ] Include varied states: not sent, awaiting, approved, not sure, declined, unknown responses, repeated WhatsApp attempts, unassigned parties, full/over-capacity tables, past events.
- [ ] Use synthetic non-routable contact details, not actual phone numbers or real user accounts.
- [ ] Implement mock service provider behind typed contracts; keep it out of presentation components.
- [ ] Implement browser persistence (localStorage or IndexedDB as appropriate) with schema/version migration or safe reset strategy.
- [ ] Ensure multiple browser profiles independently mutate their own demo; do not use PostgreSQL for Demo Mode.
- [ ] Implement Reset Demo with confirmation and repeatable initial state.
- [ ] Implement mock create/update/soft-delete/restore, RSVP transitions, table assignment rules, derived metrics and permission checks.
- [ ] Provide simulated WhatsApp send behavior without opening real recipient links or sending communications.
- [ ] Simulate loading and error states deliberately; provide sample invalid/edge cases.
- [ ] Add demo role-switching for Viewer/Admin/Owner and optionally Super User simulation, without granting real authorization.
- [ ] Add provider selection at the app boundary; real API implementation will arrive later.
- [ ] Add basic fixture integrity and mock-service contract tests.

### Validation and exit criteria
- [ ] First Demo launch generates data without manual seeding.
- [ ] Demo CRUD affects related views; refresh preserves changes; Reset recreates baseline.
- [ ] Demo calculations and permissions follow approved product rules.
- [ ] All demo side effects remain simulated and isolated.

---

## Phase 4 — Homepage / Events and simulated authentication

**Goal:** make the first impression and event-selection flow fully interactive using mock services.

### Mockup mapping
- Desktop: `homepage.png`; mobile: `homepage_mobile.png`.

### Checklist
- [ ] Build the Homepage/Events UI from the mapped mockups.
- [ ] Show event cards with event name, date/time, active/past state and accessible role where relevant.
- [ ] Provide prominent **Try Demo** entry without sign-in and clear Demo Mode indicator.
- [ ] Implement simulated sign-in/session and account UI for frontend prototyping; **never mistake it for secure production authentication**.
- [ ] Implement create/open/duplicate/delete event interactions in mock services subject to role and lifecycle rules.
- [ ] New event creator becomes Owner; support membership across multiple events.
- [ ] Implement past-event read-only interactions and export availability.
- [ ] Build appropriate empty/loading/error and mobile states.

### Validation and exit criteria
- [ ] Visitor can launch demo without credentials and open a prepopulated event.
- [ ] Event create/open and role restrictions function with mock data.
- [ ] Page visually reviewed against both homepage PNGs, LTR and RTL.

---

## Phase 5 — Dashboard interactive prototype

**Goal:** match Dashboard mockups while displaying computed statistics from demo state.

### Mockup mapping
- Desktop: `dashboard.png`; mobile: `dashboard_mobile.png`.

### Checklist
- [ ] Build responsive KPI-card layout consistent with mockups.
- [ ] Compute Total Guests (active only), Invitations Sent (distinct sent guests), Invitations Not Sent, Awaiting Response, RSVP Approved/Not Sure/Declined, Confirmed Attendees, Seating Capacity and Unassigned Confirmed Attendees.
- [ ] Exclude Not Sure from confirmed/expected attendees and all soft-deleted guests from guest counts.
- [ ] Add event maximum vs confirmed warning, chairs vs event maximum warning (either direction), and over-capacity table warning.
- [ ] Reflect changes to RSVP, messages and tables immediately via shared mock state.
- [ ] Add loading/empty/error presentations.

### Validation and exit criteria
- [ ] Five sends to one guest count as one Invitations Sent guest.
- [ ] Approved party counts vs approved attendee totals are clearly distinct.
- [ ] Mobile/desktop mockups and Hebrew/RTL validated.

---

## Phase 6 — Guests and Unknown Guests prototype

**Goal:** make both guest tabs functional with interactive data.

### Mockup mapping
- Desktop: `guests.png`; mobile: `guests_mobile.png`.
- Reuse visual language for Unknown Guests tab if separate mockup is unavailable.

### Checklist
- [ ] Build desktop guest table and dedicated mobile card/list layout.
- [ ] Implement guest create/edit/soft-delete, find/search, sort, and pagination as needed.
- [ ] Enforce event-scoped normalized phone uniqueness; re-add soft-deleted phone restores its record.
- [ ] Support First Name, Last Name, guest-entered Invitation Name, Allowed/Confirmed Attendees, RSVP status, Invitation Sent Count and Table.
- [ ] Implement authorized manual RSVP edits and appropriate assignment clearing/state changes.
- [ ] Provide editable Table selector for Approved guests; enforce mock table capacity rules.
- [ ] Implement Unknown Guests list and actions: review, add as guest, match/merge, reject.
- [ ] Prototype CSV/XLSX guest import with validation, mapping, preview, and error reporting.
- [ ] Implement guest CSV export; add XLSX guest export if adopted in MVP scope.
- [ ] Ensure Viewer may view/export but cannot modify.

### Validation and exit criteria
- [ ] Realistic guest CRUD, search, phone matching, restoration and Unknown Guest reconciliation work with mock data.
- [ ] Import handles invalid/duplicate rows safely; export opens correctly.
- [ ] Tab behavior, desktop/mobile and Hebrew/RTL validated.

---

## Phase 7 — Event Settings prototype

**Goal:** implement event settings interactions before wiring WhatsApp and RSVP pages.

### Mockup mapping
- Desktop: `event_settings.png`; mobile: `event_settings_mobile.png`.

### Checklist
- [ ] Build Event Settings based on mapped mockups.
- [ ] Support required name, date/time, event timezone, fixed guest-facing RSVP language.
- [ ] Enforce event max attendee integer minimum 50, default 300, maximum 3000.
- [ ] Support default allowed attendees per guest: range 1–10, default 5; allow guest-specific overrides.
- [ ] Warn but permit changes where configured table seats differ from maximum attendees.
- [ ] Ensure past events and Viewers cannot save changes; other applicable roles may edit.
- [ ] Persist edits in mock state across refresh.

### Validation and exit criteria
- [ ] All invalid bounds produce clear feedback; valid edits update other demo screens.
- [ ] Mockups validated desktop/mobile, English/Hebrew RTL.

---

## Phase 8 — WhatsApp Message editor and preview prototype

**Goal:** implement a complete template editor and safe simulated send workflow.

### Mockup mapping
- Desktop: `whatsapp_message.png`.
- Mobile Editor tab: `whatsapp_message_editor_mobile.png`.
- Mobile Preview tab: `whatsapp_message_preview_mobile.png`.

### Checklist
- [ ] Build desktop editor/preview layout and explicit mobile Editor and Preview tabs.
- [ ] Support configured message template and approved event/guest placeholders.
- [ ] Provide accurate preview substituting fictional guest/event values.
- [ ] Integrate WhatsApp action from Guests; in Demo Mode simulate initiation only.
- [ ] Increment guest `invitation_sent_count` exactly once per simulated action; update last send timestamp.
- [ ] Never decrement count; Dashboard Invitations Sent remains distinct per guest.
- [ ] Include appropriate failures, empty template and restricted role states.
- [ ] Ensure no real WhatsApp recipient is opened in Demo Mode.

### Validation and exit criteria
- [ ] Editor and preview stay synchronized; mobile tabs work.
- [ ] Send attempts update counters, Dashboard and Awaiting Response state correctly.
- [ ] English/Hebrew RTL and desktop/mobile mockups validated.

---

## Phase 9 — RSVP Settings and public RSVP prototype

**Goal:** allow demo visitors to configure and exercise the complete guest RSVP flow.

### Mockup mapping
- Desktop: `rsvp_settings.png`.
- Mobile Settings tab: `rsvp_settings_settings_mobile.png`.
- Mobile Preview tab: `rsvp_settings_preview_mobile.png`.
- The public RSVP experience may require additional visual guidance; follow the approved PRD and established design language.

### Checklist
- [ ] Build desktop RSVP settings and mobile Settings/Preview tabs.
- [ ] Configure Welcome, Approved, Declined, and Not Sure messages; background image and transparency/overlay.
- [ ] Create one shared RSVP URL/identifier per event, not per guest; simulate deep links in mock mode.
- [ ] Build public RSVP with guest name, phone, status selection and Approved attendee count.
- [ ] Match known guests via normalized phone; store submitted Invitation Name without overwriting organizer First/Last Name.
- [ ] Store unmatched responses as Unknown Guests.
- [ ] Approved: positive integer from 1 through allowed attendees; Declined: 0; Not Sure: no confirmed count.
- [ ] Allow guest changes until event starts; prevent changes once event is past.
- [ ] Remove existing table assignment on Approved → Declined/Not Sure.
- [ ] Accept Approved count increases even when resulting assignment becomes over capacity; display a conflict to organizer.
- [ ] Provide optional Google Calendar and YouTube post-approval actions as specified, simulated safely when necessary.
- [ ] Respect fixed event RSVP language independent of organizer UI language.
- [ ] Preview should update when settings change.

### Validation and exit criteria
- [ ] Known/unknown flows, invalid counts, repeat RSVP, past event lock and seating conflicts work.
- [ ] UI follows desktop/mobile mockups, including mobile tab separation, LTR and RTL.

---

## Phase 10 — Event Layout: Tables and seat assignment prototype

**Goal:** complete the MVP seating workflow with interactive tables and guest assignments.

### Mockup mapping
- Desktop: `event_layout.png`.
- Mobile Tables tab: `event_layout_tables_mobile.png`.
- Mobile Arrangements tab: `event_layout_arrangement_mobile.png` (visual guidance for future editor).

### Checklist
- [ ] Build Event Layout navigation/tabs consistent with mockups.
- [ ] Implement Table CRUD, unique number per event, name, positive chair capacity and Circle/Rectangle/Square shape.
- [ ] Display table occupancy, remaining seats, assigned guest parties and conflicts.
- [ ] Assign **Approved guests only**; keep each party together in MVP.
- [ ] Block manual assignment exceeding capacity; allow overcapacity after RSVP count increases.
- [ ] Edit guest assignment from Tables and Guests with consistent mock service logic.
- [ ] Confirm deletion of populated tables and clear assignments without deleting guests.
- [ ] Warn rather than block when total chairs differ from event maximum capacity.
- [ ] Implement venue-ready detailed CSV/XLSX export and table summary export.
- [ ] Make a clear scope-safe Arrangements tab presentation if included in navigation; **do not claim the full drag/drop editor is implemented**.

### Validation and exit criteria
- [ ] Table rules, deletion, conflicts, assignments and exports work with demo state.
- [ ] Responsive Tables UI and relevant desktop/mobile visuals validated.
- [ ] Visual Arrangement full editor is explicitly tracked as a future phase.

---

## Phase 11 — Permissions UI and simulated authorization

**Goal:** exercise all roles and permission workflows in the demo before enforcing them in backend.

### Mockup mapping
- Desktop: `permissions.png`; mobile: `permissions_mobile.png`.
- Follow `docs/PRD.md` for navigation order and scope; the desktop mockup's sidebar shows out-of-scope entries (see `docs/MOCKUP_NOTES.md`).

### Checklist
- [ ] Build Permissions table with name, email, role and available actions, using shared visual design.
- [ ] Implement Viewer: no Permissions page/API equivalents, read/export only, no mutations or WhatsApp actions.
- [ ] Implement Admin: normal event editing; manage Viewer/Admin permissions but not Owners, self-permissions or event duplication/deletion.
- [ ] Implement Owner: full event control; manage others including Owners but not own permission.
- [ ] Implement Super User simulation: system-wide event access and Owner-equivalent actions, not assignable via event role UI.
- [ ] Preserve at least one Owner for each event.
- [ ] Support event-specific memberships; one user may have different roles across events.
- [ ] Add demo-only role switcher where helpful, visibly labeled as a simulation.
- [ ] Ensure past-event read-only rules override normal write privileges.

### Validation and exit criteria
- [ ] Full role/action matrix tested in mock layer; UI hides/restricts actions appropriately.
- [ ] Permissions cannot be modified by a Viewer or unauthorized Admin.
- [ ] English/Hebrew and desktop/mobile validated.

---

## Phase 12 — Frontend UX review and approval gate

**Goal:** finish a cohesive interactive prototype and obtain explicit acceptance before backend implementation.

### Checklist
- [ ] Walk through every mockup mapped in `mockups/README.md`; compare implemented pages/tabs and record differences.
- [ ] Review all core workflows on desktop and mobile, English/LTR and Hebrew/RTL.
- [ ] Check demo setup, deterministic reset, local persistence and independent visitor data.
- [ ] Check loading, empty, success, error, conflict, confirmation, disabled and read-only states.
- [ ] Validate keyboard, labels, focus management and readable text on images.
- [ ] Check all mock services adhere to service contracts and approved domain rules.
- [ ] Collect user feedback and iterate on the frontend until approved.
- [ ] Record accepted UI/interaction decisions and remaining nonblocking visual issues.
- [ ] **Request and record explicit user approval to proceed to the backend phase.**

### Validation and exit criteria
- [ ] Interactive frontend demonstrates the MVP without a backend.
- [ ] User has approved the frontend direction or explicitly authorized moving ahead with documented exceptions.

---

## Phase 13 — Backend foundation: NestJS, PostgreSQL and Prisma

**Goal:** establish real persistence and API architecture after frontend acceptance.

### Checklist
- [ ] Scaffold NestJS TypeScript backend independently of React UI.
- [ ] Set up PostgreSQL development database (local install or temporary DB-only container is acceptable; full Compose deployment remains later).
- [ ] Set up Prisma schema and deterministic migrations.
- [ ] Implement User, Event, EventPermission, Guest, Unknown RSVP, RSVP Config, Message Config and Table/Assignment entities.
- [ ] Define constraints: unique permission per user/event, unique normalized phone per event (including soft-delete restoration strategy), unique table number per event.
- [ ] Add validation for attendee bounds, status/count consistency, and role/ownership invariants.
- [ ] Implement environment configuration, error conventions, logging and health endpoint.
- [ ] Add upload storage abstraction for RSVP background assets, using local persistent storage initially.
- [ ] Align backend DTOs/contracts with frontend service interfaces; document API schema (e.g., OpenAPI).
- [ ] Add backend test and migration test setup.

### Validation and exit criteria
- [ ] Fresh database migrations work and schema tests pass.
- [ ] Health endpoint works; backend can access PostgreSQL.
- [ ] Backend can run independently of full Docker Compose packaging.

---

## Phase 14 — Real authentication, events, permissions and guest APIs

**Goal:** replace the simulated core account/event/security workflows with secure backend services.

### Checklist
- [ ] Implement actual authentication/session handling and account API; no demo credentials accepted as real authentication.
- [ ] Implement Events list, creation, settings, duplicate and delete endpoints with explicit ownership rules.
- [ ] Automatically grant event creator Owner; enforce event max attendees 50–3000/default 300 and default guest allowance 1–10/default 5.
- [ ] Enforce past-event read-only rules on server; read/export still available.
- [ ] Implement event permission resolution including database-only system Super User.
- [ ] Implement role-scoped permissions list/grant/change/remove endpoints.
- [ ] Prevent self-permission edits, unauthorized Owner management and removing the final Owner.
- [ ] Implement Guests CRUD, normalized phone uniqueness, soft delete and restore-on-readd.
- [ ] Implement organizer manual RSVP edits and correct table assignment cleanup.
- [ ] Implement known/unknown matching foundation, guest searches/sorts/pagination and guest import/export APIs.
- [ ] Add authentication, authorization, soft-delete and validation integration tests.

### Validation and exit criteria
- [ ] Direct unauthorized API requests fail, regardless of frontend controls.
- [ ] Multi-event membership, own-role restrictions and restoration behavior pass tests.
- [ ] Demo Mode remains isolated and unaffected.

---

## Phase 15 — Real messaging, RSVP, analytics, tables and exports APIs

**Goal:** complete event operational APIs and business rules.

### Checklist
- [ ] Implement WhatsApp template settings, placeholder substitution and recorded initiation endpoint.
- [ ] Increment send counter exactly once per accepted initiation; record timestamp and clarify that initiation is not confirmed delivery.
- [ ] Implement one public RSVP URL per event and fixed language.
- [ ] Add known guest matching by normalized phone and Unknown RSVP storage/reconciliation APIs.
- [ ] Implement Approved/Declined/Not Sure validations and resubmission before event start; lock past events.
- [ ] Enforce RSVP changes and table assignment cleanup/conflict behavior transactionally.
- [ ] Add public endpoint privacy, abuse/rate-limit controls and safe error handling so phone lookups do not unnecessarily expose guest data.
- [ ] Implement table CRUD, approved-only assignments, manual capacity blocking, conflict reporting and event capacity warnings.
- [ ] Implement Dashboard metrics as derived backend queries, excluding soft-deleted guests and Not Sure from confirmed attendance.
- [ ] Implement CSV/XLSX guest and venue seating exports and validated import workflows.
- [ ] Add backend unit/integration tests for each key invariant and edge case.

### Validation and exit criteria
- [ ] API behavior matches mock provider contracts and PRD rules.
- [ ] Permission and past-event restrictions hold for public and authenticated endpoints.
- [ ] Dashboard totals, conflicts, imports and exports reconcile with persisted records.

---

## Phase 16 — Frontend-to-backend integration while retaining public Demo Mode

**Goal:** make the same React application work with either isolated browser demo data or real backend data.

### Checklist
- [ ] Implement API provider(s) against the existing typed frontend service interfaces.
- [ ] Select Demo mock provider or authenticated API provider at application boundary, not individually within components.
- [ ] Integrate authentication, events, permissions, Guests, Unknown Guests, Messages, RSVP, Dashboard and Tables.
- [ ] Replace development-only simulated sign-in with real auth on non-demo routes.
- [ ] Add request loading, validation error display, retries where appropriate and stale state handling.
- [ ] Verify counter/RSVP/assignment mutations update all related views.
- [ ] Ensure real WhatsApp deep-link action remains a user-initiated action; demo action remains simulated.
- [ ] Ensure uploaded images work through storage API rather than assumptions about local browser paths.
- [ ] Verify Demo Mode remains public, isolated, resettable and functional with no database interaction.
- [ ] Add provider contract parity and integration tests.

### Validation and exit criteria
- [ ] All MVP flows work against PostgreSQL-backed APIs.
- [ ] Switching between demo and authenticated real modes never leaks data or permissions.
- [ ] No duplication of page components between modes.

---

## Phase 17 — End-to-end testing, security and product hardening

**Goal:** validate the integrated product before packaging/deploying.

### Checklist
- [ ] E2E: real sign-in → event creation → Owner membership → invite users with roles.
- [ ] E2E: Admin/Viewer/Owner permissions and attempted forbidden API calls.
- [ ] E2E: Guests CRUD, soft-delete/restore, duplicates and import/export.
- [ ] E2E: WhatsApp initiation counters and correct distinct Dashboard metric.
- [ ] E2E: public RSVP known/unknown, attendee bounds, Not Sure and Declined.
- [ ] E2E: RSVP changes, table assignment restrictions, seating conflicts and exports.
- [ ] E2E: past events read-only with view/export still supported.
- [ ] E2E: Demo Mode initialized from fictional data, persisted, reset, independent from real DB and without real WhatsApp side effects.
- [ ] Run English/Hebrew, LTR/RTL and desktop/mobile smoke tests.
- [ ] Run unit/integration suites and meet the coverage threshold specified in `AGENTS.md` where measurable.
- [ ] Review security of public RSVP, file uploads, permissions, CORS, authentication, configuration and sensitive logs.
- [ ] Measure performance with representative events up to 3000 attendees and multiple simultaneous RSVP submissions.
- [ ] Validate frontend and backend production builds.

### Validation and exit criteria
- [ ] Critical E2E paths and regression tests pass.
- [ ] Known limitations documented; no blocking security or data integrity defects.

---

## Phase 18 — Docker Compose and low-resource AWS POC deployment

**Goal:** package and deploy the proven application on a small single VM, rather than designing a large cloud architecture.

### Checklist
- [ ] Build optimized production frontend static assets outside the target VM where practical.
- [ ] Build production NestJS container image outside the target VM where practical.
- [ ] Configure Nginx to serve React static files and reverse-proxy backend/public RSVP routes.
- [ ] Create Docker Compose stack for Nginx, NestJS and PostgreSQL; no production frontend dev server.
- [ ] Configure persistent PostgreSQL volume and safe upload storage volume.
- [ ] Add health checks, startup dependencies, restart policies and conservative resource settings.
- [ ] Configure deployment-time environment variables/secrets without committing credentials.
- [ ] Configure domain/DNS and HTTPS if exposing publicly; document TLS renewal approach.
- [ ] Define and rehearse database backup/restore and uploads backup.
- [ ] Test full stack locally with fresh volumes/migrations.
- [ ] Deploy to chosen single EC2/VM host; measure idle memory, peak usage, disk and practical POC concurrency.
- [ ] Verify redeploy/restart does not lose real PostgreSQL or uploaded asset data.
- [ ] Document deployment, rollback, logs, and low-cost/free-tier billing cautions.

### Validation and exit criteria
- [ ] Entire stack works on chosen small VM within observed resource limits.
- [ ] HTTPS routes, public RSVP and authenticated app work.
- [ ] Persistent data survives container restarts and application image updates.

---

## Phase 19 — Public Demo Mode release validation and handoff

**Goal:** ensure the deployed public demo remains a safe, complete experience for anyone trying the application.

### Checklist
- [ ] Confirm Try Demo is reachable without account creation in deployed frontend.
- [ ] Confirm demo data appears automatically and supports interactive guest, RSVP, message, seating and permission exploration.
- [ ] Confirm demo mutations persist across browser refresh and Reset restores baseline.
- [ ] Confirm different browsers/profiles do not share demo mutations.
- [ ] Confirm no demo interaction can alter real backend data or contact real WhatsApp recipients.
- [ ] Confirm demo works even if a real backend session is unavailable, subject to static frontend hosting being accessible.
- [ ] Test mobile/desktop and English/Hebrew/RTL in the deployed app.
- [ ] Confirm demo deployment feature flag can hide demo entry when configured without changing real app behavior.
- [ ] Finalize concise `README.md`, deployment docs, and update `PLAN.md` with deferred tasks.

### Validation and exit criteria
- [ ] Public demo and real app can be demonstrated independently.
- [ ] MVP POC is ready for stakeholder/user testing.

---

## Phase 20 — Post-MVP: visual venue Arrangement editor

**Goal:** add the persisted editable blueprint after MVP stability, unless scope is explicitly changed.

### Checklist
- [ ] Confirm the editor's scope and review `event_layout.png` and `event_layout_arrangement_mobile.png`.
- [ ] Design persisted layout schema/coordinate system and scale/rotation conventions.
- [ ] Support View and Edit modes, defaulting to View.
- [ ] Add placement of existing tables and table creation synchronized with Tables.
- [ ] Add walls/lines, steps, stage and bar objects with drag/drop and relevant resizing.
- [ ] Implement overlap/geometry checks and user feedback.
- [ ] Render table chairs, assigned/empty status and capacity conflicts.
- [ ] Persist and reload changes reliably via mock and real providers.
- [ ] Support mobile viewing; define editing support explicitly for phone/tablet.
- [ ] Add geometry, persistence, permission and responsive tests.

### Validation and exit criteria
- [ ] Floor plans remain consistent with seating data and survive reloads.

---

## Deferred / future backlog

- [ ] WhatsApp Business API, actual delivery/read/failure tracking and automated reminders.
- [ ] RSVP configurable deadline before event start.
- [ ] Individual attendee identities and split groups across tables.
- [ ] Per-seat assignment and venue templates.
- [ ] Multi-language guest-facing RSVP within one event and guest-specific invitation URLs.
- [ ] Advanced analytics, audit history, reusable event templates.
- [ ] Server-backed expiring demos only if browser-local Demo Mode proves insufficient.

## Agent progress log

Append concise entries after significant units. Keep completed checkboxes and recorded decisions intact.

```text
YYYY-MM-DD — Phase N — completed task / summary
Validation: commands and tests actually executed (or why not)
Mockups reviewed: exact files when UI is involved
Follow-ups/risks: new tasks or none
Next: earliest pending task
```

```text
2026-10-12 — Phase 1 — Scaffolded `frontend/` with Vite 8 `react-ts` template (React 19, TypeScript 6, npm); trimmed template demo content to a single placeholder heading.
Validation: `npm run build` (tsc -b + vite build) passed; `npm run lint` (oxlint) passed; `npm run dev` served `/` and `/src/App.tsx` with HTTP 200 (checked with curl, not opened in a browser).
Mockups reviewed: none (no product UI implemented).
Follow-ups/risks:
- Phase 0 checklist is still unchecked; Phase 1 was started ahead of it on user direction. Phase 0 items remain to be verified.
- The current Vite template ships oxlint (`.oxlintrc.json`), not ESLint; decide in the next Phase 1 item whether to keep it.
- `frontend/src/App.tsx` has a hard-coded placeholder string "Event Planner"; replace when i18n lands in Phase 2.
- `frontend/README.md` is still the Vite template text; replace in the Phase 1 README item.
- `mockups/permissions.png` and `mockups/permissions_mobile.png` exist but are not indexed in `mockups/README.md`, and `docs/PRD.md` says Permissions has no direct mockup; resolve in Phase 0 / before Phase 11.
Next: Phase 1 — strict TypeScript, lint, formatting, test runner and e2e strategy.
```

```text
2026-10-12 — Phase 0 — completed all checklist items and exit criteria.
Done:
- Confirmed AGENTS.md, CLAUDE.md (redirects to AGENTS.md), PLAN.md and docs/PRD.md exist; PRD covers Demo Mode, permissions, guests, RSVP, WhatsApp, tables, exports and past events.
- Added docs/ARCHITECTURE.md (decisions, undecided choices, repository structure), docs/DOMAIN.md (glossary, open decisions D1–D24), docs/MOCKUP_NOTES.md (Arrangement scope, PRD-vs-mockup differences, screens with no mockup), docs/DEVELOPMENT.md (quality, testing and review workflow).
- Indexed permissions.png / permissions_mobile.png and added a breakpoints note in mockups/README.md; added the Permissions row to PRD §14 and a mockup mapping to Phase 11. This resolves the unindexed-mockup follow-up from the previous entry.
- Added root .gitignore.
Validation: script check that every PNG named in mockups/README.md, docs/PRD.md and PLAN.md exists (none missing) and every PNG on disk is indexed (none unindexed after the README update); all 19 mockups opened and reviewed; pattern scan of tracked text files for secrets and env/key files (none found).
Mockups reviewed: all 19 files in mockups/.
Follow-ups/risks:
- No behavioral conflict found between AGENTS.md, PLAN.md and docs/PRD.md. The mockups differ from the PRD in several places; these are recorded in docs/MOCKUP_NOTES.md and the ones needing an owner decision are D6–D22 in docs/DOMAIN.md. D7–D9 are needed by Phase 2.
- PRD §5.1 field table omits the event timezone that PRD §5.2 and Phase 7 rely on; update the PRD table in Phase 7.
- `.env.example` not created yet: nothing reads environment configuration until the Phase 1 item that establishes it.
- Mockup sample content (names, phone-style numbers) was taken to be placeholder data; owner to confirm none of it is real personal information.
- An empty, untracked `skills/` directory exists in the repository root; purpose unknown, left untouched.
Next: Phase 1 — strict TypeScript, lint, formatting, test runner and e2e strategy.
```

**Do not claim a phase is complete merely because files were written or a screenshot looks correct.**
