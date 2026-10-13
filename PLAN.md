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
- **Mockups were created after the PRD.** Where a mockup differs from or adds to the PRD, build what the mockup shows; the PRD stays the source of truth for business rules and is updated in the same phase. Ask the owner when a mockup element's behavior is not evident.
- Features left out of the MVP are listed in `docs/FUTURE_FEATURES.md`; add to it whenever something is deferred.

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
- [x] Set up strict TypeScript, lint, formatting, unit/component test runner, and browser end-to-end testing strategy.
- [x] Set up frontend routing for Homepage/Events, Dashboard, Guests, Messages, RSVP Settings, Event Layout, Event Settings, Permissions, and public RSVP.
- [x] Create feature-oriented folders and typed domain model/service-contract locations.
- [x] Create local development startup scripts/README instructions.
- [x] Ensure the frontend can build static production assets.
- [x] Establish `.env.example` with a safe configuration switch for mock vs API providers (no secrets).

### Validation and exit criteria
- [x] `npm` scripts for dev, build, typecheck, lint and tests work.
- [x] App loads locally without NestJS, PostgreSQL or Docker.
- [x] Unimplemented routes have clear placeholders, not silent crashes.

---

## Phase 2 — Design system, mockups, responsive layout and i18n

**Goal:** establish one reusable visual language from the actual desktop/mobile mockups before creating feature pages.

### Checklist
- [x] Read `mockups/README.md`; inspect all supplied screen types to extract common patterns.
- [x] Define design tokens: colors, typography, borders, radius, spacing, responsive breakpoints and semantic statuses.
- [x] Create accessible reusable components: buttons, inputs, selects, tables, mobile cards, tabs, headers, dialogs, drawers, KPI cards, badges, notices, toasts, empty/loading/error states.
- [x] Implement responsive application shell, event selector/header, desktop navigation and mobile navigation. Event navigation is identical on every event page, in this order: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions (hidden for Viewers). The event selector is in the sidebar only. Do not build the notification bell, Profile or account Settings. Inside an event the avatar shows the user's role icon (crown Owner, shield Admin, people icon Viewer; Super User without membership shows the crown); no icon outside an event. Design and verify desktop and phone widths; tablets are not a separate target.
- [x] Add `i18next`/`react-i18next` with `en` and `he` translation resources and language persistence.
- [x] Move the hard-coded English strings left from Phase 1 (placeholder, not-found and error pages, event navigation labels) into translation resources.
- [x] Switch root `lang` and `dir` properly; use logical CSS properties and handle LTR phone/email/URL values inside RTL.
- [x] Add a fixed guest-facing RSVP language per event, distinct from the organizer UI language. Done as the `LocaleScope` primitive; the per-event language value arrives with the event model in Phase 3 and is applied to the public RSVP page in Phase 9.
- [x] Create reusable read-only/past-event and role-restricted UI primitives.
- [x] Build a representative layout/component showcase against the provided mockups.
- [x] Document any mockup gaps or conflicts; do not introduce unrelated visual patterns.

### Validation and exit criteria
- [x] Components render at desktop/mobile widths and in English LTR/Hebrew RTL.
- [x] Keyboard focus and labels work in common components.
- [x] UI foundation visually resembles the reference images.

---

## Phase 3 — Domain types, deterministic demo generator and mock services

**Goal:** build the interactive data engine once so every demo page uses consistent realistic data and behavior.

### Checklist
- [x] Define TypeScript contracts for User, Event, EventPermission, Guest, Unknown RSVP, RSVP Settings, WhatsApp Settings, Table, Assignment, analytics and relevant export models.
- [x] Define feature service interfaces for all CRUD and workflows, with Promise-based results and well-defined domain errors.
- [x] Build deterministic, seeded fictional dataset generator with coherent event dates, permissions, guests, RSVPs, counters, tables and assignments.
- [x] Include varied states: not sent, awaiting, approved, not sure, declined, unknown responses, repeated WhatsApp attempts, unassigned parties, full/over-capacity tables, past events.
- [x] Use synthetic non-routable contact details, not actual phone numbers or real user accounts.
- [x] Implement mock service provider behind typed contracts; keep it out of presentation components.
- [x] Implement browser persistence (localStorage or IndexedDB as appropriate) with schema/version migration or safe reset strategy.
- [x] Ensure multiple browser profiles independently mutate their own demo; do not use PostgreSQL for Demo Mode.
- [x] Implement Reset Demo with confirmation and repeatable initial state.
- [x] Implement mock create/update/soft-delete/restore, RSVP transitions, table assignment rules, derived metrics and permission checks.
- [x] Provide simulated WhatsApp send behavior without opening real recipient links or sending communications.
- [x] Simulate loading and error states deliberately; provide sample invalid/edge cases.
- [x] Add demo role-switching for Viewer/Admin/Owner and optionally Super User simulation, without granting real authorization.
- [x] Add provider selection at the app boundary; real API implementation will arrive later. Wire it to `parseDataProvider` in `frontend/src/services/providerConfig.ts`, which is defined and tested but not yet called.
- [x] Add basic fixture integrity and mock-service contract tests.
- [x] Add Playwright projects for a mobile viewport and for Hebrew/RTL once real UI exists (currently desktop Chromium only). Done in Phase 2: `desktop` and `mobile` projects; RTL covered by tests that switch the language.
- [x] Supply the application shell with real data from the services: current event and event list for the selector, and the user's role for the avatar icon and for hiding Permissions (the shell accepts these as props; real pages currently pass none).

### Validation and exit criteria
- [x] First Demo launch generates data without manual seeding.
- [x] Demo CRUD affects related views; refresh preserves changes; Reset recreates baseline. Proven at the service level (for example: adding a guest changes the dashboard figures, and both survive a reload) and on screen for what the frame shows. Create and edit screens arrive in Phases 4–10, where this is confirmed page by page.
- [x] Demo calculations and permissions follow approved product rules.
- [x] All demo side effects remain simulated and isolated.

---

## Phase 4 — Landing page, Homepage / Events and simulated authentication

**Goal:** make the first impression and event-selection flow fully interactive using mock services.

### Mockup mapping
- Landing page — desktop: `landing_page.png`; mobile: `landing_page_mobile.png` (added 2026-10-13).
- Homepage / My Events — desktop: `homepage.png`; mobile: `homepage_mobile.png`.

### Checklist
- [x] Build the landing page from the mapped mockups, with the three entry flows: Sign Up → account created → My Events; Sign In → My Events; Try Demo → the populated demo.
- [x] Build the Homepage/Events UI from the mapped mockups.
- [x] Show event cards with event name, date/time, active/past state and accessible role where relevant.
- [x] Provide prominent **Try Demo** entry without sign-in and clear Demo Mode indicator.
- [x] Implement simulated sign-up, sign-in/session and account UI for frontend prototyping; **never mistake it for secure production authentication**. Includes the user menu beside the avatar and Log out in the homepage sidebar. No password is stored or checked, and the forms say so.
- [x] Show the event cover as the thumbnail in the sidebar event selector. Covers are generated (a gradient with an icon) until image upload is built (`docs/FUTURE_FEATURES.md`).
- [x] Implement create/open/duplicate/delete event interactions in mock services subject to role and lifecycle rules (decision D3, `docs/DOMAIN.md`).
- [x] New event creator becomes Owner; support membership across multiple events.
- [x] Implement past-event read-only interactions and export availability. On this page: a past event is labelled Past, offers View Event, and opens read-only; it can still be duplicated or deleted by an Owner. Exports arrive with the pages that have them (Phases 6 and 10).
- [x] Build appropriate empty/loading/error and mobile states.

### Validation and exit criteria
- [x] Visitor can launch demo without credentials and open a prepopulated event.
- [x] Event create/open and role restrictions function with mock data.
- [x] Pages compared against the landing and homepage PNGs, desktop and phone, LTR and RTL, by the agent from screenshots. The owner's own visual review is still to come.

---

## Phase 5 — Dashboard interactive prototype

**Goal:** match Dashboard mockups while displaying computed statistics from demo state.

### Mockup mapping
- Desktop: `dashboard.png`; mobile: `dashboard_mobile.png`.

### Checklist
- [x] Build responsive KPI-card layout consistent with mockups.
- [x] Compute Total Guests (active only), Invitations Sent (distinct sent guests), Invitations Not Sent, Awaiting Response, RSVP Approved/Not Sure/Declined, Confirmed Attendees, Seating Capacity and Unassigned Confirmed Attendees.
- [x] Exclude Not Sure from confirmed/expected attendees and all soft-deleted guests from guest counts.
- [x] Add event maximum vs confirmed warning, chairs vs event maximum warning (either direction), and over-capacity table warning.
- [x] Reflect changes to RSVP, messages and tables immediately via shared mock state. Proven by tests that change data and reopen the Dashboard; the pages that make those changes on screen arrive in Phases 6, 8 and 10 and must refresh the event's data when they save.
- [x] Add loading/empty/error presentations.
- [x] Show Seating Capacity and Unassigned Confirmed Attendees as two more KPI cards after Confirmed Attendees (decision D28).
- [x] Name the header button "Event Settings" (drawn as "View Event") and open the Event Settings page; build the Quick Actions shortcuts as drawn (decision D12).
- [x] Show the warnings the mockup does not draw in the same style as its over-capacity warning (decision D29).
- [x] Build Recent Guest Activity from the message history and each guest's latest response (decisions D11, P5).

### Validation and exit criteria
- [x] Five sends to one guest count as one Invitations Sent guest.
- [x] Approved party counts vs approved attendee totals are clearly distinct.
- [x] Mobile/desktop mockups and Hebrew/RTL validated, by the agent from screenshots. The owner's own visual review is still to come.

---

## Phase 6 — Guests and Unknown Guests prototype

**Goal:** make both guest tabs functional with interactive data.

### Mockup mapping
- Desktop: `guests.png`; mobile: `guests_mobile.png`.
- Reuse visual language for Unknown Guests tab if separate mockup is unavailable.
- Decisions for the controls the mockups do not explain: D13, D14, D31–D36 in `docs/DOMAIN.md`.

### Checklist
- [x] Build desktop guest table and dedicated mobile card/list layout, with the KPI strip and the Guests / Unknown Guests tabs.
- [x] Implement guest create/edit/soft-delete, find/search, sort, the three filters (RSVP status, invitation status, table) and pagination with rows per page.
- [x] Enforce event-scoped normalized phone uniqueness; re-add soft-deleted phone restores its record.
- [x] Support First Name, Last Name, guest-entered Invitation Name, Allowed/Confirmed Attendees, RSVP status, Invitation Sent Count and Table.
- [x] Label a guest with no invitation sent and no response "Not Sent"; use "Awaiting Response" only after a send (D14).
- [x] Implement authorized manual RSVP edits and appropriate assignment clearing/state changes.
- [x] Provide editable Table selector for Approved guests; enforce mock table capacity rules.
- [x] Guest details panel, opened from the ">" arrow on a phone and the guest's name on desktop; "⋯" menu with Change RSVP and Delete (D33).
- [x] Bulk selection with Delete selected (confirmed) and Export selected (D13). On the desktop table; the phone cards have no checkboxes, as in the mobile mockup.
- [x] Column chooser on the desktop table: every column with a checkbox, Select all and Clear, Name and Phone always shown, choice remembered in the browser through the persistence adapter (D34).
- [x] Clear filters button (D35).
- [x] Show the per-row WhatsApp button disabled with a "Soon" hint (D36).
- [x] Implement Unknown Guests list and actions: review, add as guest, match/merge, reject. Rejected responses move to a Rejected list and can be restored (D31).
- [x] Prototype CSV/XLSX guest import with validation, mapping, preview, and error reporting.
- [x] Implement guest export as CSV and Excel, always with every field (D32).
- [x] Ensure Viewer may view/export but cannot modify.
- [x] Refresh the event's data after every change, so the Dashboard and the event list show it.

### Validation and exit criteria
- [x] Realistic guest CRUD, search, phone matching, restoration and Unknown Guest reconciliation work with mock data.
- [x] Import handles invalid/duplicate rows safely; export opens correctly.
- [x] Tab behavior, desktop/mobile and Hebrew/RTL validated, by the agent from screenshots and automated checks. The owner's own visual review is still to come.

---

## Phase 7 — Event Settings prototype

**Goal:** implement event settings interactions before wiring WhatsApp and RSVP pages.

### Mockup mapping
- Desktop: `event_settings.png`; mobile: `event_settings_mobile.png`.

### Checklist
- [x] Build Event Settings based on mapped mockups.
- [x] Support required name, date/time and event timezone, and an optional location (D39). The RSVP language is not edited here; it belongs to RSVP Settings (D19).
- [x] Enforce event max attendee integer minimum 50, default 300, maximum 3000.
- [x] Support default allowed attendees per guest: range 1–10, default 5; allow guest-specific overrides.
- [x] Warn but permit changes where configured table seats differ from maximum attendees.
- [x] Refuse moving the event's date and time into the past; keep the typed date and time when the time zone changes (D40).
- [x] Ensure past events and Viewers cannot save changes; other applicable roles may edit.
- [x] Persist edits in mock state across refresh.
- [x] "View Event Rules" opens a read-only rules dialog (D12). No Duplicate or Delete in the Danger Zone (D38).
- [x] Ask before leaving with unsaved changes, and only then (D41).
- [x] On a phone, put Save Changes in the pinned bottom action bar (`PageHeader` with `compactActions="bar"`), not beside the title as `event_settings_mobile.png` shows.

### Validation and exit criteria
- [x] All invalid bounds produce clear feedback; valid edits update other demo screens.
- [x] Mockups validated desktop/mobile, English/Hebrew RTL, by the agent from screenshots and automated checks. The owner's own visual review is still to come.

---

## Phase 8 — WhatsApp Message editor and preview prototype

**Goal:** implement a complete template editor and the WhatsApp send workflow.

### Mockup mapping
- Desktop: `whatsapp_message.png`.
- Mobile Editor tab: `whatsapp_message_editor_mobile.png`.
- Mobile Preview tab: `whatsapp_message_preview_mobile.png`.

### Checklist
- [x] Build desktop editor/preview layout and explicit mobile Editor and Preview tabs. On a phone the two actions of each tab go in the pinned bottom action bar, aligned with the content; do not reproduce the over-wide bar drawn in the mockups.
- [x] Support configured message template and approved event/guest placeholders; template limits and warnings (D48).
- [x] Formatting toolbar: Bold, Italic, Strikethrough, Emoji, as WhatsApp marks (D17); Reset to Default; Insert Variable.
- [x] Provide accurate preview substituting the chosen guest's values, or a sample guest's when the event has none.
- [x] Integrate WhatsApp action from Guests, with a confirmation showing the message (D47).
- [x] Open the real `wa.me` link on a send, in accounts and in the demo (D45, replacing "simulate in Demo Mode").
- [x] Increment guest `invitation_sent_count` exactly once per send; update last send timestamp.
- [x] Never decrement count; Dashboard Invitations Sent remains distinct per guest.
- [x] Send Test Message: WhatsApp with no recipient, nothing counted (D16).
- [x] Recent Sent Messages with View message and Send again (D46).
- [x] Include appropriate failures, empty template and restricted role states.
- [x] Enable the per-row WhatsApp button on the Guests page, which Phase 6 shows disabled (D36).

### Validation and exit criteria
- [x] Editor and preview stay synchronized; mobile tabs work.
- [x] Send attempts update counters, Dashboard and Awaiting Response state correctly.
- [x] English/Hebrew RTL and desktop/mobile mockups validated, by the agent from screenshots and automated checks. The owner's own visual review is still to come.

---

## Phase 9 — RSVP Settings and public RSVP prototype

**Goal:** allow demo visitors to configure and exercise the complete guest RSVP flow.

### Mockup mapping
- Desktop: `rsvp_settings.png`.
- Mobile Settings tab: `rsvp_settings_settings_mobile.png`.
- Mobile Preview tab: `rsvp_settings_preview_mobile.png`.
- The public RSVP experience may require additional visual guidance; follow the approved PRD and established design language.

### Checklist
- [ ] Build desktop RSVP settings and mobile Settings/Preview tabs. On a phone the two actions of each tab go in the pinned bottom action bar, aligned with the content; do not reproduce the over-wide bar drawn in the mockups.
- [ ] Configure Welcome, Approved, Declined, and Not Sure messages; background image and transparency/overlay.
- [ ] Create one shared RSVP URL/identifier per event, not per guest; simulate deep links in mock mode.
- [ ] Build public RSVP with guest name, phone, number of attendees and status selection. Number of attendees is always required; discard it for Declined and Not Sure.
- [ ] Match known guests via normalized phone; store submitted Invitation Name without overwriting organizer First/Last Name.
- [ ] Store unmatched responses as Unknown Guests.
- [ ] Approved: positive integer from 1 through allowed attendees; Declined: 0; Not Sure: no confirmed count.
- [ ] Allow guest changes until event starts; prevent changes once event is past.
- [ ] Remove existing table assignment on Approved → Declined/Not Sure.
- [ ] Accept Approved count increases even when resulting assignment becomes over capacity; display a conflict to organizer.
- [ ] Provide optional Google Calendar and YouTube post-approval actions as specified, simulated safely when necessary.
- [ ] RSVP Settings owns the event's default RSVP language (D19): add the selector there, and reword the create-event dialog's field as the default.
- [ ] Give the public RSVP page a guest language switch, English / Hebrew, independent of the organizer's UI language. Organizer-written messages are shown as written.
- [ ] Add the optional RSVP title to RSVP Settings (D39).
- [ ] Preview should update when settings change.
- [ ] Make the public RSVP link work for events of both browser-local workspaces (the demo and the preview accounts); the public page is outside any session.
- [ ] The public RSVP form reads a phone by the same rule as the rest of the product (decision D37): local Israeli forms accepted, a number from abroad needs `+` and its country code; say so beside the field.

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
- [ ] Show the Table Arrangement tab with a "Soon" badge, disabled and not selectable, on desktop and mobile. Do not build the Arrangement Preview panel. **Do not claim the full drag/drop editor is implemented**.

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
- [ ] Have the Hebrew translations reviewed by a Hebrew speaker; they were written by the coding agent.
- [ ] Decide whether the `/showcase` route stays reachable in the deployed application or is limited to development.
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
- [ ] Run the provider contract suite (`frontend/src/services/contracts/servicesContract.ts`) against the API provider.
- [ ] Select Demo mock provider or authenticated API provider at application boundary, not individually within components.
- [ ] Integrate authentication, events, permissions, Guests, Unknown Guests, Messages, RSVP, Dashboard and Tables.
- [ ] Replace development-only simulated sign-in with real auth on non-demo routes.
- [ ] Add request loading, validation error display, retries where appropriate and stale state handling.
- [ ] Verify counter/RSVP/assignment mutations update all related views.
- [ ] Ensure the WhatsApp deep-link action remains a user-initiated action, in the product and in the demo (D45).
- [ ] Ensure uploaded images work through storage API rather than assumptions about local browser paths.
- [ ] Verify Demo Mode remains public, isolated, resettable and functional with no database interaction.
- [ ] Add provider contract parity and integration tests.
- [ ] Replace the browser-local accounts workspace (`services/mock/mockBackend.ts`) with the API for Sign Up and Sign In; keep the demo workspace as it is. Remove the "Preview version" notice from the forms.

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
- [ ] E2E: Demo Mode initialized from fictional data, persisted, reset, independent from real DB; WhatsApp links open only from a user's click.
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
- [ ] Configure Nginx to fall back to `index.html` for client-side routes (for example `/events/:eventId/guests` and `/rsvp/:rsvpId`) so deep links and refreshes work.
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
- [ ] Split the frontend bundle by page (the main file is about 650 kB before compression).

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
- [ ] Confirm no demo interaction can alter real backend data, and that the generated demo guests' numbers are undialable (D23, D45).
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

`docs/FUTURE_FEATURES.md` is the full, maintained list of features left out of the MVP. The items below are the ones this plan tracks directly.

- [ ] WhatsApp Business API, actual delivery/read/failure tracking and automated reminders.
- [ ] RSVP configurable deadline before event start.
- [ ] Individual attendee identities and split groups across tables.
- [ ] Per-seat assignment and venue templates.
- [ ] Translation of organizer-written RSVP texts, guest-facing languages beyond English and Hebrew, and guest-specific invitation URLs.
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

```text
2026-10-12 — Phase 1 — completed the remaining checklist items and exit criteria.
Done:
- Strict TypeScript made explicit (`strict`, `noUncheckedIndexedAccess`); kept oxlint; added Prettier, Vitest + React Testing Library + jsdom, Playwright (Chromium) and React Router.
- npm scripts: dev, build, preview, typecheck, lint, format, format:check, test, test:watch, test:e2e.
- Routes for Homepage/Events, the seven event pages, public RSVP, a not-found page and a route error page; each page is a placeholder. Route table documented in docs/ARCHITECTURE.md.
- Folders: src/app, src/features/*, src/domain, src/services, src/shared, src/test, e2e.
- frontend/.env.example with VITE_DATA_PROVIDER (mock | api) and a validated parser; root README.md with setup and commands.
Validation (all run from frontend/, no backend, database or Docker running): `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm test` 22 passed (route placeholders, redirect, not-found, error page, provider config); `npm run test:e2e` 4 passed in Chromium against the dev server; `npm run build` emitted dist/.
Mockups reviewed: none (placeholders only, no product UI).
Follow-ups/risks (added as checklist items in the phases named):
- Placeholder, not-found, error and navigation strings are hard-coded English until i18n (Phase 2).
- `parseDataProvider` is not called by the app yet; provider selection is wired in Phase 3.
- Playwright covers desktop Chromium only; mobile viewport and RTL projects come with real UI (Phase 3 item).
- Client-side routes need an `index.html` fallback in Nginx (Phase 18).
- The event navigation is unstyled plain links, replaced by the real shell in Phase 2.
- Work was done on branch `phase_1_completion`, created from `main`; nothing committed.
Next: Phase 2 — needs owner decisions D7–D9 (docs/DOMAIN.md) before the application shell is built.
```

```text
2026-10-12 — Owner decisions recorded (no phase item completed)
Decisions:
- Mockups were created after the PRD: where they differ from or add to it, build the mockup; the PRD stays the source of truth for business rules and is updated in the same phase.
- Event navigation, identical on all event pages: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions (hidden for Viewers). Budget, Vendors, Timeline and Photo Sharing are not built.
- Arrangement: tab shown as "Soon" and disabled; no Arrangement Preview panel.
- Public RSVP: number of attendees always required; discarded for Declined and Not Sure.
- New docs/FUTURE_FEATURES.md lists everything left out of the MVP and is kept current.
Changed: AGENTS.md, docs/PRD.md (sections 4.2, 8.1, 11.4, 17, 18, 19), docs/DOMAIN.md (D6, D10, D15, D18, D20, D21 resolved; R1–R3 added), docs/MOCKUP_NOTES.md, mockups/README.md, docs/ARCHITECTURE.md, Phases 2, 9 and 10 of this plan, and the placeholder navigation order in frontend/src/app/EventLayout.tsx.
Validation: after the navigation change, from frontend/: `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm test` 22 passed; `npm run test:e2e` 4 passed. Searched the docs for the superseded wording; none left.
Follow-ups/risks: still open before Phase 2 — D7 (event selector placement), D8 (notification bell, Profile, account Settings), D9 (crown icon).
Next: Phase 2.
```

```text
2026-10-12 — Phase 2 owner decisions recorded (no phase item completed)
Decisions: D7 event selector in the sidebar only; D8 notification bell, Profile and account Settings left out of the MVP; D9 avatar icon shows the role in the current event (crown Owner, shield Admin, people icon Viewer), none outside an event, Super User shows the crown; D24 tablet layouts not designed or verified for the MVP.
Changed: docs/DOMAIN.md, docs/FUTURE_FEATURES.md, docs/PRD.md (header, sections 4.2 and 13), docs/MOCKUP_NOTES.md, mockups/README.md, Phase 2 shell item in this plan.
Validation: documentation only, no code changed. Checked that docs/DOMAIN.md has no open decision needed by Phase 2 and searched the docs for wording that contradicts the outcomes.
Follow-ups/risks: none blocking Phase 2. Open decisions D11–D14, D16, D17, D19, D22 and D23 belong to Phase 3 and later.
Next: Phase 2.
```

```text
2026-10-12 — Phase 2 — completed all checklist items and exit criteria, in three passes (build, review and fix, final validation).
Done:
- Design tokens (colors, typography, spacing, radius, borders, shadows, semantic statuses, documented breakpoints) in frontend/src/styles/tokens.css.
- Shared components in frontend/src/shared/ui: Button, IconButton, ButtonLink, TextField, TextArea, SelectField, Badge, Card, KpiCard, KpiGrid, Notice, Tabs (underline and segmented, disabled "Soon" tab), PageHeader, DataTable with phone cards, Dialog, Drawer, toasts, Empty/Loading/Error states, Avatar, RoleIcon, LtrText.
- Application shell: dark sidebar with event selector, event navigation in the approved order, language selector and Back to My Events; top bar with avatar, name and role icon; drawer navigation behind a menu button below 1024px; skip link.
- i18next with English and Hebrew resources (168 keys each, type-checked), language remembered across reloads, root lang/dir switching, LocaleScope for guest-facing content.
- Read-only primitives: access rules in src/domain/access.ts, ReadOnlyNotice, ReadOnlyBadge, EditGate.
- Phase 1 hard-coded strings moved to translation resources.
- Showcase page at /showcase.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm test` 90 passed; `npm run test:e2e` 19 passed, 1 skipped by design (desktop-only sidebar position test on the mobile project), across desktop and mobile projects, covering RTL switching and persistence, sidebar side in both directions, no horizontal overflow, dialog focus and Escape, table-to-cards, and hidden editing controls for Viewer and past events; `npm run build` emitted dist/. Screenshots of the showcase, an event page, the homepage, the mobile drawer and a dialog were captured in desktop LTR, desktop RTL, mobile LTR and mobile RTL and compared by the agent with the mockups.
Mockups reviewed: all 19 (for the shell, sidebar, top bar, KPI cards, badges, notices, tabs, tables, mobile cards and form fields).
Fixed during review: Back arrow not mirrored in Hebrew; KPI cards stacked one per row on phones where the mockups show two.
Follow-ups/risks (added as checklist items in the phases named):
- Real pages show the frame without event selector, user or role, because no data exists yet; only /showcase shows them, with sample values (Phase 3 item).
- User menu, Log out and selector cover thumbnail are not built (Phase 4 items).
- Hebrew translations were written by the agent and need a Hebrew speaker's review; /showcase reachability in production is undecided (Phase 12 items).
- The interface language is stored in localStorage outside the demo persistence adapter; isolated in src/i18n/languageStorage.ts and recorded in docs/ARCHITECTURE.md.
- Visual comparison with the mockups was done by the agent from screenshots; the owner has not yet reviewed it.
- Work is on branch phase_2_completion; nothing committed.
Next: Phase 3 — needs owner decision D23 (phone-number range for generated demo guests).
```

```text
2026-10-12 — Phase 2 follow-up — fixed fourteen items found in a review of the Phase 2 code.
Bugs fixed:
- Dialog and drawer close handler ran twice; it now runs exactly once, and not at all when the parent closes the dialog.
- User name was removed from assistive technology on narrow screens; it is now only visually hidden.
- Required fields were announced twice; the duplicate hidden text is removed.
- Showcase welcome message did not follow a language switch.
- Mobile drawer stayed open over the desktop layout after widening the window.
Rule gaps closed:
- Accessibility is now measured: axe runs in the end-to-end suite on the homepage, an event page, the showcase (plain, dialog open, Viewer of a past event, toasts shown, drawer open), public RSVP and not-found, in English and Hebrew, on desktop and phone. Its first run found real colour-contrast failures (danger badges and notice titles, subtle grey text); `--color-danger`, `--color-danger-hover` and `--color-text-subtle` were darkened in tokens.css to pass.
- Coverage is now measured with an 80% threshold, and tests were added for components that had none.
- Each page sets the browser tab title, and focus moves to the main content after navigation.
- Error toasts stay until dismissed.
Improvements:
- DataTable renders only the table or only the cards, chosen by screen width.
- Shell colours moved into design tokens.
- Navigation entries stay highlighted on pages beneath them.
- Event selector closes on a click or focus move outside it.
- Number, date and time formatting helpers per language, with an explicit time zone.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 134 passed, coverage 94.41% statements, 92.09% branches, 90.62% functions, 94.19% lines; `npm run test:e2e` 53 passed, 3 skipped by design (one desktop-only and two phone-only tests on the other project), with zero axe violations; `npm run build` emitted dist/. Fresh screenshots in desktop/phone and English/Hebrew reviewed by the agent after the colour changes.
Mockups reviewed: none newly; colour changes compared against the earlier screenshots.
Follow-ups/risks:
- The danger red is slightly darker than in the mockups, by necessity for contrast; the owner has not yet reviewed it.
- axe detects only what a tool can; no manual screen-reader pass has been done.
- Lowest-covered file is the showcase page (about 68% lines), which is a demonstration page; App.tsx is exercised only by the end-to-end tests.
- Work is on branch phase_2_completion; nothing committed.
Next: Phase 3 — needs owner decision D23 (phone-number range for generated demo guests).
```

```text
2026-10-12 — Phase 2 addition — phone bottom action bar.
Decisions (owner): the two-button bottom bar in four phone mockups is drawn wider than the page and is a mockup error; the bar is aligned with the page content with equal-width buttons, stays pinned to the bottom of the screen, and is used on every phone form page that is saved, including Event Settings.
Done: BottomActionBar component; PageHeader option compactActions="bar" that moves header actions into the bar below 1024px; space reserved at the end of the page so the bar never covers content, focused fields or toasts; demonstrated on /showcase; decisions recorded in docs/MOCKUP_NOTES.md, docs/DOMAIN.md (R4, R5), docs/PRD.md section 13, mockups/README.md and Phases 7, 8 and 9 of this plan.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 142 passed, coverage 94.43% statements, 91.66% branches, 90.85% functions, 94.22% lines; `npm run test:e2e` 62 passed, 12 skipped by design (tests that apply to only one of the two layouts), zero axe violations; `npm run build` succeeded. End-to-end checks on the phone project: bar edges match the content cards in English and Hebrew, buttons equal width, primary action on the right in English and left in Hebrew, bar stays in place while scrolling, does not cover the page end, toasts sit above it, fits a 320px-wide phone, single allowed action spans the full width. Phone screenshots in English and Hebrew reviewed by the agent.
Mockups reviewed: whatsapp_message_editor_mobile.png, whatsapp_message_preview_mobile.png, rsvp_settings_settings_mobile.png, rsvp_settings_preview_mobile.png, event_settings_mobile.png.
Follow-ups/risks: the bar is built for widths below 1024px only; it has not been tried on a real phone with an on-screen keyboard open. Work is on branch phase_2_bottom_action_bar, created from main; nothing committed.
Next: Phase 3 — needs owner decision D23 (phone-number range for generated demo guests).
```

```text
2026-10-12 — Phase 3 — completed all checklist items and exit criteria.
Decisions (owner): D23 demo phones are Israeli-style but undialable (+972 00-…); D5 a restored guest returns as No Response with no table and keeps the invitation counter; D1 an unknown responder may approve up to the event default; D11 Recent Guest Activity is derived from existing records.
Done:
- Domain layer (frontend/src/domain): models, shared error codes, and rules for phone normalization, event validation and time zones, the permission matrix, guests (create, edit, soft-delete, restore), RSVP, seating, dashboard metrics and warnings, recent activity, message rendering and export rows.
- Service contracts for session, events, guests, unknown guests, RSVP, messages, tables, permissions, dashboard and demo control; a reusable contract test suite.
- Seeded demo generator: six events (four upcoming, two past, one in Hebrew), 424 guests, the demo user as Owner, Admin and Viewer in different events, and every required state present. Stored size about 374 KB.
- Mock provider enforcing the rules in the data layer, with browser persistence, dataset versioning, reset, simulated role (Owner, Admin, Viewer, Super User), simulated WhatsApp send, and simulated delay and failure through the address (?demoDelay=, ?demoFail=).
- Provider chosen once at the application boundary; `api` shows a not-available page.
- Application frame now shows real data: event selector, user, role icon, Permissions only for Owner and Admin. Demo Mode badge, role switcher and Reset Demo with confirmation, in English and Hebrew. Placeholder pages show the read-only notice for Viewers and past events.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 429 passed, coverage 97.41% statements, 92.39% branches, 96.62% functions, 97.37% lines; `npm run test:e2e` 94 passed, 12 skipped by design (tests that apply to only one of the two layouts), zero axe violations; `npm run build` succeeded. Checked by hand with a script: the `api` provider shows the not-available page and writes nothing to browser storage. Screenshots of the frame with demo data and the reset dialog, desktop and phone, English and Hebrew, reviewed by the agent.
Found and fixed during validation: the top bar overflowed a 320px-wide phone once the demo badge was added; loading and error pages had no main heading and dialogs opened from the top bar nested landmarks (both reported by the accessibility check).
Mockups reviewed: none newly (no product page built). The demo controls have no mockup and reuse existing components.
Follow-ups/risks:
- Eight defaults were applied where the documents are silent; they are listed as P1–P8 in docs/DOMAIN.md for the owner to confirm.
- Exit criterion "Demo CRUD affects related views" is proven at the service level; on-screen proof follows with the pages in Phases 4–10.
- Event duplicate and delete (D3) and inviting an unregistered email (D4) are not in the service contracts yet.
- Events have a cover image field but the demo sets none; Phase 4 decides what is shown.
- The demo's names and Hebrew sample texts were written by the agent.
- Work is on branch phase_3_completion, created from main; nothing committed.
Next: Phase 4 — needs owner decisions D3 (what duplicating and deleting an event do) and D10's follow-up (what cover images the demo events show).
```

```text
2026-10-13 — Phase 4 complete.
Decisions (owner): D3 — duplicate copies details, RSVP settings, message template and tables, without guests; delete is Owner-only and permanent, confirmed by typing the name. Event covers are generated until image upload is built. Landing-page mockups added, with three entry flows (sign up, sign in, try demo). Recorded in docs/DOMAIN.md (D3, D10, D25–D27), docs/PRD.md and docs/MOCKUP_NOTES.md.
Done:
- Landing page (/), simulated Sign Up (/signup) and Sign In (/signin), session that survives reloads, route guards, Log out in the user menu and the homepage sidebar.
- Two browser-local workspaces that never share data: the generated demo, and accounts created by sign-up (start with no events). Reset Demo affects the demo only. No password is stored or checked.
- My Events (/events, moved from /): event cards with generated cover, status, date, time, maximum attendees, role, confirmed/capacity bar; All/Upcoming/Past tabs with counts, search, grid and list layouts (kept in the address); Create, Duplicate and Delete dialogs; empty, no-match, loading and error states.
- Service contracts: events.duplicate, events.remove, auth (sign up, sign in, enter demo, sign out). New rule: a new or duplicated event must start in the future.
- Shared components: Menu, EventCover; Button/ButtonLink gained a large size, a soft variant and a trailing icon.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 530 passed, coverage 97.94% statements, 93.57% branches, 97.3% functions, 97.91% lines; `npm run test:e2e` 133 passed, 13 skipped by design (tests that apply to only one of the two screen sizes), zero accessibility violations on the landing page, both forms, My Events in both layouts, the card menu and each dialog, in English and Hebrew; `npm run build` succeeds.
Mockups reviewed: landing_page.png, landing_page_mobile.png, homepage.png, homepage_mobile.png, compared with screenshots at desktop and phone widths in English and Hebrew.
Differences from the mockups, by decision: generated covers instead of photos; the landing hero shows a drawn preview of this product instead of the mockup's screenshot of a different one; "How it works" link left out; three feature texts reworded to what the MVP does; cards also show the user's role.
Follow-ups/risks:
- The owner has not yet reviewed the pages visually, nor the Hebrew wording, which the agent wrote.
- Sign-up and sign-in are a simulation. Anyone using the same browser can open any preview account by its email.
- The public RSVP page cannot yet find events of the accounts workspace (added to Phase 9).
- P1–P8 in docs/DOMAIN.md still await the owner's confirmation; P5 is needed in Phase 5.
- Work is on branch phase_4_completion, created from phase_3_completion (not yet merged to main when this phase started); nothing committed.
Next: Phase 5 — Dashboard. Needs owner decision D12 (where the Dashboard's "View Event" button leads) and confirmation of default P5 (docs/DOMAIN.md).
```

```text
2026-10-13 — Phase 4 follow-ups and Phase 5 decisions.
Decisions (owner): the Dashboard's "View Event" button is named "Event Settings" and opens Event Settings (D12, Dashboard half); Seating Capacity and Unassigned Confirmed Attendees are two more KPI cards (D28); warnings without a mockup use the over-capacity warning's style (D29); an organizer's manual RSVP change counts as the guest's latest response (P5 confirmed); the landing page keeps its drawn preview (D30). Recorded in docs/DOMAIN.md, docs/PRD.md section 10, docs/MOCKUP_NOTES.md and mockups/README.md; Phase 5 checklist updated.
Done: the design-system showcase now shows the Menu component and the generated event covers, which Phase 4 had left out.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 531 passed, coverage 97.94% statements, 93.57% branches; `npm run test:e2e` 137 passed, 13 skipped by design, zero accessibility violations including the showcase with the menu open, in English and Hebrew; `npm run build` succeeds.
Follow-ups/risks:
- The owner's visual review of the Phase 4 pages and of the Hebrew wording is still to come.
- phase_3_completion and phase_4_completion are not merged to main; this work is on branch phase_4_followups, created from phase_4_completion; nothing committed.
Next: Phase 5 — Dashboard. No open decisions remain for it.
```

```text
2026-10-13 — Phase 5 complete (two passes: build, then review and fix).
Done:
- Dashboard page: ten KPI cards, each saying what it counts (invitations, people or chairs); warnings as links to the page where each is fixed; RSVP Status ring with a table of counts and shares; Attendance vs Capacity bars against the event maximum; Recent Guest Activity (five newest, View All for the rest); Quick Actions; Event Settings button. Loading, error-with-retry and no-guests states. English and Hebrew, desktop and phone.
- Rule added: computeRsvpBreakdown puts every active guest in exactly one of five groups, with whole percentages that add up to 100.
- Second pass fixed: an icon style clash that stretched some activity and quick-action icons; the tables warning shown in the wrong colour; "208 / 300" mirrored in Hebrew; the full activity dialog could not be scrolled from the keyboard (found by the accessibility check; Dialog gained a scrollableContent option); 16 guests in the main demo event shared a full name with another guest.
- Demo dataset is now version 2 (guest names unique within an event). Browsers holding version 1 regenerate the demo once and show the "demo was updated" notice. Preview accounts now have their own version number and are not affected.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 570 passed, coverage 97.96% statements, 93.57% branches, 97.3% functions, 97.92% lines; `npm run test:e2e` 168 passed, 14 skipped by design, zero accessibility violations on the Dashboard of three events and its dialog, in English and Hebrew; `npm run build` succeeds. One end-to-end check was flaky (it measured page width before the layout settled after a resize) and was corrected to wait.
Mockups reviewed: dashboard.png, dashboard_mobile.png, compared with screenshots at desktop and phone widths in English and Hebrew.
Differences from the mockups: by decision — Event Settings button, two more KPI cards, extra warnings. Applied by the agent and listed for confirmation as P9–P13 in docs/DOMAIN.md — a fifth RSVP group "Not Invited Yet"; what View All does; where each warning leads; activity times in the event's time zone; a unit under each KPI figure.
Follow-ups/risks:
- P9–P13 await the owner's confirmation. P9 (the "Not Invited Yet" label) is the same question as D14 for the Guests page.
- A new event with no tables shows the "seating below capacity" warning, as the PRD defines it.
- Charts are drawn with plain SVG and CSS; no chart library was added.
- Work is on branch phase_5_completion; nothing committed.
Next: Phase 6 — Guests and Unknown Guests. Needs owner decisions D13 (bulk selection) and D14 (label for a guest not yet invited), and confirmation of defaults P2, P3 and P6.
```

```text
2026-10-13 — Phase 5 follow-ups and Phase 6 decisions.
Decisions (owner): Guests — bulk delete and export of selected rows (D13); label "Not Sent" for a guest not yet invited (D14); rejected unknown responses are kept in a restorable Rejected list (D31); export as CSV and Excel (D32); details panel and row menu (D33); the sliders button is a column chooser with Name and Phone always shown, remembered in the browser, desktop only (D34); a Clear filters button (D35); the per-row WhatsApp button is disabled until Phase 8 (D36). Defaults P2, P3, P6, P10, P11 and P13 confirmed. P12 changed: activity times use the viewer's own time zone. Recorded in docs/DOMAIN.md, docs/PRD.md, docs/MOCKUP_NOTES.md, mockups/README.md and docs/FUTURE_FEATURES.md; the Phase 6 checklist was rewritten to match.
Done: Dashboard chart group renamed from "Not Invited Yet" to "Not Sent"; Recent Guest Activity times now follow the viewer's time zone.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 571 passed, coverage 97.96% statements, 93.58% branches; `npm run test:e2e` 168 passed, 14 skipped by design; `npm run build` succeeds.
Follow-ups/risks:
- The owner's visual review of the Dashboard and its Hebrew wording is still to come.
- Phase 6 needs additions to the service contracts (rejected unknown responses, bulk delete, a stored column preference) and a library for reading and writing CSV and Excel files, to be chosen and recorded when it starts.
- Work is on branch phase_5_followups, created from phase_5_completion; nothing committed.
Next: Phase 6 — Guests and Unknown Guests. No open decisions remain for it.
```

```text
2026-10-13 — Phase 6 complete (two passes: build, then review and fix).
Done:
- Guests page: KPI strip, Guests and Unknown Guests tabs, search (names, invitation name, phone in any format), three filters, sortable columns, paging with rows per page, all kept in the page address; desktop table and phone cards; add, edit and delete guests; manual RSVP change; table selector for Approved guests with capacity enforced; details panel; row menu; bulk delete and export of selected rows; column chooser remembered per browser; Clear filters; WhatsApp button shown disabled.
- Import from CSV and Excel in four steps (choose, match columns, preview, result) with a downloadable template and a downloadable list of skipped rows. Export to CSV and Excel with every field.
- Unknown Guests: add as guest, match to a guest, reject into a Rejected list, restore.
- Rules added in domain/: guest display status, list search/filter/sort, paging, CSV reading and writing with formula safety, import planning. Service contracts gained guests.removeMany, guests.importMany, unknownGuests.listRejected and restore, and a preferences service.
- Shared components: Checkbox, Pagination, Popover; DataTable gained sorting, selection and a pinned column; Dialog gained a wide option; KpiGrid a dense option. All in the showcase.
- Libraries: read-excel-file and write-excel-file (MIT), loaded only when a file is imported or exported.
- Demo dataset is version 3 (unknown responses gained a rejected state; one rejected response in the main event). Browsers regenerate the demo once.
Second pass found and fixed: changing two filters in quick succession could drop the first from the address (new shared useQueryParams hook, also applied to My Events); a row's menu opened underneath the next row's buttons and could not be clicked with a mouse; the column checkboxes did not respond until the choice was stored; the table was wider than the page and hid its Table column; six KPI cards wrapped to two rows; the rows-per-page control was unreadable; the import preview was too narrow to show each row's result; page numbers overflowed a 320px-wide phone.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 734 passed, coverage 96.64% statements, 91.19% branches, 95.98% functions, 96.64% lines; `npm run test:e2e` 202 passed, 18 skipped by design, including real CSV and Excel uploads, downloads whose content is read back, and zero accessibility violations on both tabs, the dialogs and each import step, in English and Hebrew; `npm run build` succeeds.
Mockups reviewed: guests.png, guests_mobile.png, compared with screenshots at desktop and phone widths in English and Hebrew.
Differences from the mockups, by decision: D13, D14, D31–D36. Applied by the agent and listed for confirmation as P14–P18 in docs/DOMAIN.md.
Follow-ups/risks:
- P14–P18 await the owner's confirmation.
- The import preview cannot tell that a row will restore a deleted guest, because deleted guests are not sent to the page; such rows are shown as new and counted as restored in the result.
- The demo phone numbers are longer than real ones, so the desktop table is tight at 1448px; the Actions column stays pinned while the rest scrolls on narrower windows.
- The main JavaScript file is about 650 kB before compression; splitting it by page is worth doing before deployment (Phase 18).
- Work is on branch phase_6_completion; nothing committed.
Next: Phase 7 — Event Settings. Needs owner decisions D19 (which page owns the RSVP language and when it becomes fixed) and D12's second half (the "View Event Rules" button).
```

```text
2026-10-13 — Phase 6 follow-up — phone numbers.
Decision (owner): Israel first for the MVP. A number without + is read as Israeli; foreign numbers need + and the country code. Israeli numbers are always shown in local form, 050-730-8828. No country selector and no country per event for now (D37; both added to docs/FUTURE_FEATURES.md).
Done: formatPhone added; guests and unknown responses store the shown form, so the table, cards, details, import preview and both export formats agree; Edit Guest opens with the local form. A number local to another country (a French 06…, for example) is now refused instead of being silently stored as Israeli. Demo numbers regenerated in local form (000-001-0005, still undialable); demo dataset version 4, so browsers regenerate the demo once. Hint under the phone field and a line in the import instructions.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 762 passed, coverage 96.68% statements, 91.13% branches; `npm run test:e2e` 202 passed, 18 skipped by design; `npm run build` succeeds.
Follow-ups/risks:
- An event held outside Israel is awkward by decision: every guest, and every guest answering the RSVP form, must use +.
- Preview accounts created before this change show their numbers as typed until each guest is next saved.
- Foreign numbers are shown with the country code set apart but not otherwise grouped.
- Work is on branch phase_6_followups, created from phase_6_completion; nothing committed.
Next: Phase 7 — Event Settings. Needs owner decisions D19 and the "View Event Rules" button.
```

```text
2026-10-13 — Phase 7 — Event Settings.
Decisions (owner): the guest RSVP language belongs to RSVP Settings and each guest can switch the public page between English and Hebrew; organizer-written texts are not translated (D19, replaces "fixed per event"). Event Settings has no language selector. View Event Rules opens a rules dialog (D12). No Duplicate/Delete in the Danger Zone (D38). Location is edited here (D39). A date in the past is refused, a time-zone change keeps the typed time, defaults do not alter existing guests (D40). Leaving asks only when there are unsaved changes (D41). P14–P18 confirmed.
Done: Event Settings page (General Information, Guest Defaults, RSVP notice, Capacity Summary with the Dashboard's figures and warnings, Danger Zone, rules dialog, unsaved-changes prompt); Save in the header on desktop and in the bottom bar on a phone; read-only for a Viewer and a past event. events.update refuses a past date. Form validation and messages shared with the create-event dialog. AGENTS.md, PRD, DOMAIN, MOCKUP_NOTES, mockups/README and FUTURE_FEATURES updated; Phase 9 checklist gained the default-language selector, the guest language switch and the RSVP title.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 783 passed, coverage 96.54% statements, 91.19% branches; `npm run test:e2e` 218 passed, 18 skipped by design; `npm run build` succeeds. Desktop and phone, English and Hebrew, checked from screenshots against both mockups.
Follow-ups/risks:
- Until Phase 9 the RSVP language can only be chosen when creating an event.
- The Capacity Summary shows saved figures, not what is being typed.
- The Danger Zone notice uses the shared warning style rather than the mockup's white box.
- Owner's own visual review and Hebrew wording review still to come.
- Work is on branch phase_7_completion; nothing committed.
Next: Phase 8 — WhatsApp Message editor. Needs owner decisions D16 (Send Test Message) and D17 (formatting controls).
```

```text
2026-10-13 — Phase 7 follow-up — owner review fixes.
Decisions (owner): a guest's allowed attendees is shown as "Expected attendees" (D42); the Guests page's Approved card counts confirmed attendees (D43); the desktop side menu collapses to icons and the choice is remembered (D44).
Done: wording changed on the Guests table, cards, form, details, import and export, in English and Hebrew; imports accept the old and new headings. Approved card shows people with "attendees" under the figure. Burger button in the desktop top bar collapses the side menu to an icon strip; links keep their names and gain tooltips; preference stored through PreferencesService. Phone drawer unchanged.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 788 passed, coverage 96.57% statements, 91.37% branches; `npm run test:e2e` 219 passed, 19 skipped by design; `npm run build` succeeds. Collapsed menu and Guests page checked from desktop screenshots in English and Hebrew.
Follow-ups/risks:
- Collapsed, the event selector and language selector are hidden until the menu is expanded.
- The Approved card and the "Approved" filter count different things (people and invitations).
- Nothing committed; branch phase_7_completion.
Next: Phase 8 — WhatsApp Message editor. Needs owner decisions D16 and D17.
```

```text
2026-10-13 — Phase 8 — WhatsApp Messages.
Decisions (owner): real WhatsApp sending everywhere, including the demo, through https://wa.me/<number>?text=<message> (D45; AGENTS.md rule changed). Send Test Message opens WhatsApp with no recipient (D16). Toolbar: Bold, Italic, Strikethrough, Emoji (D17). Sent-message menu: View message, Send again (D46). Defaults applied and recorded: confirmation before a send, counted when WhatsApp opens (D47); template limits, desktop Save button, unsaved-changes prompt (D48).
Done: Messages page (template editor with toolbar, Insert Variable, Reset to Default, warnings; live phone preview for a chosen or sample guest; Recent Sent Messages, ten per page); phone Editor/Preview tabs with the bottom action bar; send confirmation dialog used by the Guests row button and by Send again; message rules in domain/messages.ts (link building, validation, formatting, preview parsing); service contract extended (preview with link, variable values, default template, sends with guest details). Unsaved-changes prompt moved to shared code. Documents updated.
Validation: from frontend/ — `npm run typecheck`, `npm run lint`, `npm run format:check` clean; `npm run test:coverage` 825 passed, coverage 96.52% statements, 91.11% branches; `npm run test:e2e` 237 passed, 21 skipped by design; `npm run build` succeeds. Desktop English, phone English editor and phone Hebrew preview checked from screenshots.
Follow-ups/risks:
- Send Test Message sends what the preview shows, including unsaved edits (the stated default was the saved template; this keeps test and preview identical).
- A demo visitor can add a guest with a real number and open WhatsApp to it; it is their own click and their own WhatsApp.
- If recording a send fails after WhatsApp opened, the send is not counted and an error is shown.
- Variables are plain text in the editor, not chips; the phone preview is simpler than the mockup's.
- WhatsApp was never actually opened in tests (window.open is replaced); the owner should try one real send.
- Nothing committed; branch phase_8_implementation.
Next: Phase 9 — RSVP Settings and public RSVP. Includes the default-language selector, the guest language switch and the RSVP title (D19, D39).
```

**Do not claim a phase is complete merely because files were written or a screenshot looks correct.**
