# Event Planner V2.2 — B2B2B2C / Venue Collaboration

> **Hand-off specification for Claude Code.** The business arrangement is commonly called **B2B2C** (platform → venue business → event host/client → RSVP guest), while this filename preserves the product owner's requested **B2B2B2C** naming. Do not rename existing repository files solely to match this label.

**Status:** Proposed target requirements; **NOT** evidence that any V2.2 feature is implemented.  
**Date:** 2026-11-26  
**Authoritative baseline:** Existing repository code, tests, migrations and latest checked-in `docs/PRD.md`, `PLAN.md`, `AGENTS.md`, `docs/FUTURE_FEATURES.md`, `mockups/README.md`. The provided v1.2 PRD from 2026-10-17 is a *historical baseline*, not proof of the current source tree.  
**Companion:** `Event_Planner_V2.2_Venue_Product_Design.pdf`.  
**Goal:** Evolve the current individual event organizer product into a safe two-track product: (1) personal events and (2) venue-managed events that connect venues and clients to the same event.

---

# 0. Mandatory agent operating instructions

1. **Read `AGENTS.md`, `PLAN.md`, the current PRD, migrations and code before changing anything.** If files differ from this handoff, document the discrepancy; do not silently overwrite established rules. This document specifies desired behavior, not actual repository internals.
2. **Audit first, propose plan second, implement in bounded phases third.** Never make a speculative whole-repository rewrite.
3. Preserve existing personal B2C events, roles, guest import/export, RSVP, WhatsApp, seating, public demo, translations, accessibility, mobile UX and past-event behavior unless this document explicitly scopes a **venue-managed** override.
4. Treat the backend as the authorization source of truth. Apply permission checks to reads, writes, exports, bulk actions, files and nested resources. UI hiding is not security.
5. Write or update migration, integration and E2E tests for each delivered feature; retain tests for every legacy flow. No destructive migration or automatic data reset.
6. Document unresolved product decisions in a `V2.2_DECISIONS.md` or existing project decision log. Use the proposed defaults below if implementation can proceed safely; seek product-owner approval for privacy, billing and ownership ambiguities.
7. Update real PRD, implementation plan and future-feature list **after** validating the implementation. Mark proposed vs built and capture decision history. Do not label incomplete work done.
8. Avoid unsupported assumptions about ORM, router, database naming, auth provider, design system or component locations; discover the repository's actual patterns and reuse them.
9. Deliver phase-by-phase changelogs with files touched, migrations, passing checks, known limitations, and any manual deployment steps.
10. If required secrets or external providers are missing, feature-flag or mock them safely; never commit secrets or silently invoke real email, billing or WhatsApp side effects.

# 1. Product intent and scope

The venue organization pays or sponsors usage. It owns one or more physical spaces, reusable floor plans and table arrangements, and can create events from those templates. The event's invited **Client Lead** (couple/host) controls guests, RSVP pages, WhatsApp messages and guest-to-table seating. Venue staff control physical layout and capacity, and can read a limited operational guest/seating view. Each event has an **independent layout snapshot**: changes to reusable space templates cannot affect events already created.

**Do not develop a separate copy of the app.** Reuse shared event modules with management mode and capability-enforced operations. Keep current personal-event semantics and current B2C homepage for users without venue membership.

## 1.1 In scope (V2.2)

- Multi-organization model; each organization has staff and multiple spaces.
- Workspace switcher: Personal and member Venue organizations.
- Venue My Spaces list, create/edit/archive, layout template list and publishing.
- Multiple named reusable layout templates per venue space.
- Venue My Events page retaining All / Upcoming / Past filters.
- Venue event creation wizard, selected space/template snapshot clone.
- Venue-managed event client invitation (explicit acceptance after verified email).
- Domain-specific venue and client capabilities, field restrictions and least-privilege reads/exports.
- Event-specific layout edit by venue, guest-to-table assignment by client.
- Cross-role dashboard, notifications for disruptive changes, event readiness and conflicts.
- Reservation time and collision warning (not booking CRM).
- Trial/subscription entitlement plumbing and safe lapsed-subscription behavior.
- Demo venue fixture, localization (EN, HE/RTL, pt-BR), accessibility, mobile-friendly seating.
- Additive migration strategy, release flag, production-readiness testing.

## 1.2 Deferred

Booking CRM, contracts, invoices, catering/staff scheduling, venue website, vendor billing, automatic WhatsApp API, seat-by-seat assignments, splitting invitation parties, automatic synchronization/merge of template changes into existing events, cross-venue transfer, end-user custom role builder, multi-space events, advanced audit dashboard, production automated payments until commercial validation.

# 2. Product invariants (must never regress)

- Personal event role behavior remains as currently implemented: OWNER/ADMIN/VIEWER and SUPER_USER policy; do not reinterpret a personal OWNER as a venue CLIENT_LEAD.
- Existing RSVP remains one public event-level URL with normalized-phone identification and unknown-guest review unless newer checked-in PRD says otherwise.
- Existing WhatsApp opens prefilled `wa.me` and increments initiation counters; never claim delivery verification.
- Existing guest record represents an invitation party, not seat-level individuals. Approved party is assigned to one table.
- Manual seating over-capacity is rejected; RSVP-induced over-capacity is accepted and marked conflicted. Deleting a populated table unassigns guests after confirmation.
- Current past-event policy: event is read-only for operational edits when its start time arrives; public RSVP closes, authorized reads/exports still work. Flag for product validation but don't change as a side effect of B2B.
- Preserve existing Dashboard metric definitions and count units (guest records vs attendees vs chairs).
- Preserve demo browser-local isolation, reset and expiry; venue demo must be simulated without organization records in real DB.
- Preserve EN/HE/PT-BR, keyboard support and mobile adaptation; existing phone floor plan geometry editing remains view-only.
- Never silently mutate an event's layout after a space/template is updated.

# 3. Business vocabulary and entity boundaries

**User:** one login, potentially personal events and memberships of multiple venue organizations. **Organization:** the paying business/company, not a physical room. **Organization Member:** staff identity and organizational role. **Venue Space:** a hall/garden/room with address and people capacity. **Layout Template:** named, versioned reusable arrangement of a space. **Venue-managed Event:** standard Event associated with one organization/space and an independent event layout. **Client Lead:** invited person coordinating the occasion. **Client Collaborator:** editor or viewer delegated by lead. **Guest:** public RSVP invitation party; not necessarily a User account. **Event Access:** scoped rights for each side. **Snapshot:** immutable-at-creation copy; event is editable subsequently only by the appropriate side. **Source lineage:** pointers to original template revision for reference, never for rendering.

# 4. Proposed schema adaptation (inspect existing ORM before applying)

Use this as a **logical schema contract**, not ready-to-execute SQL.

```text
Organization
  id PK, name, status, default_locale, created_at, updated_at
OrganizationMembership
  id PK, organization_id FK, user_id FK, role ORG_OWNER|VENUE_MANAGER|VENUE_STAFF,
  state ACTIVE|INVITED|REVOKED, created_at
VenueSpace
  id PK, organization_id FK, name, address, max_people, timezone,
  status ACTIVE|ARCHIVED, metadata_json?, created_at, updated_at
SpaceLayoutTemplate
  id PK, space_id FK, name, latest_published_revision_id?, status
SpaceLayoutRevision
  id PK, template_id FK, revision_number, state DRAFT|PUBLISHED|ARCHIVED,
  immutable_layout_payload_or_normalized_rows, created_by, published_at
Event (extend existing)
  management_mode PERSONAL|VENUE_MANAGED DEFAULT PERSONAL,
  organization_id? FK, venue_space_id? FK, source_template_id? FK,
  source_template_revision_id? FK, venue_name_snapshot?, venue_address_snapshot?,
  venue_max_people_snapshot?, reserved_start_at?, reserved_end_at?, timezone existing,
  layout_revision_number existing or new
EventClientMembership
  id PK, event_id FK, user_id FK, role CLIENT_LEAD|CLIENT_EDITOR|CLIENT_VIEWER,
  state ACTIVE|REVOKED, unique(event_id,user_id)
EventClientInvitation
  id PK, event_id FK, email_normalized, role, token_hash, expires_at,
  status PENDING|ACCEPTED|REVOKED|EXPIRED, accepted_by?, accepted_at?, created_by
EventChangeLog
  id PK, event_id FK, actor_user_id?, action, domain, resource_id?, safe_summary,
  created_at, notified_at?
OrganizationSubscription
  id PK, organization_id FK, plan_code, status, trial_end?, period_end?,
  external_provider_customer_id?, external_provider_subscription_id?, limits_json
```

**Existing table/layout objects:** reuse current event tables, layout objects, background assets and guest assignments; cloning must create fresh event-local primary keys, remap relationships and copy geometry. Never have event guests foreign-key to template table IDs.

### Data constraints and indexes

- Uniqueness: `(organization_id, normalized_space_name)` if appropriate; `(template_id, revision_number)`; `(event_id, table_number)`; `(organization_id,user_id)`; `(event_id,user_id)` for active client membership; normalized pending invitation email per event.
- Foreign keys enforce organization/space/template provenance; validate nested ownership at service layer to prevent cross-tenant injections.
- `PERSONAL`: venue linkage nullable/absent. `VENUE_MANAGED`: org, space, snapshot and a valid client invitation/membership state are tracked; allow venue event to exist before a client accepts.
- Schema upgrades additive: create new tables and nullable event columns; backfill all existing events as `PERSONAL`; only after migration and tests add constraints appropriate to new records.
- Represent layout background images safely: prefer immutable object-key/version or asset copy so archiving master cannot break historical events.
- Consider soft archiving for organizations/spaces/templates. Do not cascade-delete venue-owned events or RSVP data on template/archive actions.
- Reservation intervals: store absolute instants and IANA zone; compare overlap including setup/cleanup buffers and DST transitions.

### Clone transaction algorithm

```text
begin transaction
  assert actor has venue.events.create for selected organization
  load space and a specific PUBLISHED immutable template revision with row locks/version checks
  validate revision belongs to the space and the space belongs to the organization
  validate event start/end/timezone and show/record any schedule override
  create event with management_mode=VENUE_MANAGED and copied space metadata
  clone event layout dimensions/background/object graph
  clone tables with fresh IDs preserving numbers/shapes/capacities/positions
  DO NOT clone guests/RSVP/seating/messaging history or client access
  save template provenance; issue new public RSVP URL per existing mechanism
  append safe creation log
commit
```

If any step fails, roll back the entire event creation. Retrying an API request should not create duplicate events unintentionally: use idempotency key or transactional unique request identifier.

# 5. Authorization model — implement before exposing features

## 5.1 Scopes

1. **Platform:** SUPER_USER as already implemented, with protected privileged support logging.
2. **Organization:** ORG_OWNER, VENUE_MANAGER, VENUE_STAFF; staff can only access member organization resources, and may be assigned only certain events.
3. **Event/client:** CLIENT_LEAD, CLIENT_EDITOR, CLIENT_VIEWER. These roles are only valid on venue-managed events.
4. **Personal event:** existing OWNER, ADMIN, VIEWER unchanged.

No permission should be granted solely because the user knows an `event_id` or `organization_id`.

## 5.2 Capability presets

| Permission identifier (illustrative) | Venue owner/manager | Venue staff | Client lead | Client editor | Client viewer |
|---|---|---|---|---|---|
| org.manage / org.members.manage | Yes | No | No | No | No |
| space.manage / template.publish | Yes | No by default | No | No | No |
| event.venue.create / event.venue.delete | Yes | No by default | No | No | No |
| event.venue.update / schedule.update | Yes | Configurable preset | No | No | No |
| event.layout.geometry.write | Yes | Configurable preset | No | No | No |
| event.tables.definition.write | Yes | Configurable preset | No | No | No |
| event.guests.operational.read | Yes | If assigned | Yes | Yes | Yes |
| event.guests.full.read / write | No | No | Yes | Yes | View as authorized |
| event.rsvp.settings.write | No | No | Yes | Yes | No |
| event.whatsapp.template.write / send | No | No | Yes | Yes | No |
| event.seating.assign.write | No | No | Yes | Yes | No |
| event.client.members.manage | No (except controlled lead replacement) | No | Yes | No by default | No |
| event.venue.staff.assign | Yes | No | No | No | No |
| event.operational.export | Yes | If assigned | Yes | Yes | If allowed |
| event.guests.phone.export | No by default | No | Yes | Yes | No |

Use **backend policy guards** with centralized evaluators and tests; an API path like `/events/:id/tables/:tableId` must authorize the nested table against the event and management mode before reading/writing. Avoid making OrganizationMember an automatic personal event Owner. Backend must invalidate cached capability sessions on role revocation. Add explicit denial tests for cross-organization and direct API attacks.

## 5.3 Domain boundaries / field-level ownership

**Venue-owned:** space and source templates; event venue name/address/capacity; room geometry, images, venue objects, table numbers/shapes/capacities/positions; reservation timing. **Client-owned:** guest list fields, RSVP settings, WhatsApp template/send initiation, RSVP/manual status actions, guest seating assignments, client collaborators. **Shared read-only views:** attendance, table occupancy and issues with venue-safe field projections. **Derived system-owned:** dashboard counts and conflict indicators.

**Critical:** `seating:assign` must not authorize `tables:update`; existing table editor may currently combine these operations in one service. Split them into independent use cases and DTOs. Conversely table deletion should unassign affected client guests through an explicit authorized venue maintenance operation, not via a hidden general guest-editor permission.

## 5.4 Security cases

Test that client role cannot: send PATCH to venue settings, bypass disabled layout editor, import a table via bulk guest action, delete a table, change capacity in nested mutation, invite venue staff, download other organization exports, adjust subscription entitlements. Test venue role cannot: POST/PATCH guest/RSVP/message data, read message history/client-only notes/phones by default, export full guest workbook through alternate endpoints, modify client membership except controlled lead-removal path. Test revoked staff loses access instantly. All negative cases must return a consistent forbidden/not-found policy that does not leak other tenants' metadata.

# 6. Detailed workflows

## WF-01 Organization onboarding

Authenticated and verified user chooses Create Venue Organization → name/default locale → becomes ORG_OWNER → sees empty venue workspace and Create Space CTA. Error and retry if name invalid/duplicate according to chosen rule. Users may retain personal events and switch workspaces.

## WF-02 Space + template

Org owner creates physical space with required Name, Address, Maximum People and Time Zone. Open layout template editor based on current Event Layout components. Templates include room measurements, floor picture, venue objects and defined tables; may have multiple named configurations. Draft → preview warnings → Publish revision. A revision is immutable; editing a published template creates a newer revision. Archive is reversible (if possible) and never deletes event snapshots.

## WF-03 Venue event creation

Venue My Events → Create → Choose Space → Choose Published Layout → Event Name and date/time + reservation end → review capacity and tables, warnings about double booking → confirm → new event and independent layout. Create event even if no client email yet; show `Awaiting Client` setup state. If client email entered, create pending invitation. All/Upcoming/Past are available and filter venue events only.

## WF-04 Client acceptance

Venue manager enters client email. Send a **verified-email invitation with explicit accept**. Registered recipients sign in and accept; unregistered recipients register, verify email and accept. Use expiring, single-use, hashed tokens and revocable pending invites. Existing legacy personal-event access grants continue unchanged. If email sending unavailable, **do not auto-grant venue client access on unverified address**; enable venue feature only with verified-email service or approved secure admin-assisted verification. Invite and membership are separate records. Provide Invite Again and Revoke. No user-enumeration leaks.

## WF-05 Client planning

Client Lead sees venue-managed event card/badge, venue name, capacity and room preview, without edit buttons for venue-owned fields. They use current Guests, RSVP, WhatsApp, dashboard and seating features as usual. Client can assign/unassign approved invitation parties to precreated tables. On mobile, list-based seating stays usable even when canvas geometry editing is disabled.

## WF-06 Venue review and operations

Authorized venue team sees guest names, statuses, attendee counts, group where relevant, assigned table, unassigned confirmed attendees, chair availability and warnings. Default venue export excludes phone and template/message history. No controls for guest edits or RSVP page configuration. Operational actions on venue geometry get appropriate conflict previews and notification records.

## WF-07 Venue edits populated layout

When venue decreases capacity or deletes an occupied table: fetch current assignment counts → show affected parties/attendees and consequences → require explicit typed/checkbox confirmation as appropriate → transactionally apply venue edit and any necessary unassignments → store change log → enqueue in-app/client email notice → dashboard and seating update. No silent data loss. If optimistic version changed, reject and reload conflict rather than overwrite. Other venue edits should not rewrite any client guest record.

## WF-08 Event scheduling

Reservation has start/end plus optional buffers. Warn when it overlaps another reservation for the same space; manager may override and must record reason. Use event zone and UTC comparison. Show conflicts in creation and edit flows. Overlap is not a guaranteed booking prohibition in MVP.

## WF-09 Past events and template changes

Event start triggers current read-only semantics, not a new deletion rule. Venue source template can be edited/re-published and next events use latest selected published revision. Existing event layout, guest assignments, exports, and event metadata stay unchanged and readable. Archive template or space must not orphan the event view.

## WF-10 Subscription lifecycle

Organization may be TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELED. Integrate entitlement checks for creating spaces/templates/events, with a controlled grace period and transition policy. Existing clients must not abruptly lose access to their confirmed future event or public RSVP merely because venue renewal failed. Do not expose new subscription billing UI unless payment provider and policy are implemented. MVP pilot can use manual provisioning and flagged entitlements.

# 7. UI/UX specification

### Navigation

Authenticated header or sidebar workspace selector: Personal | [Venue Organization]. Venue navigation: Overview, My Spaces, My Events, Team, Organization Settings (Billing only for authorized admin). Personal navigation remains unchanged. Venue My Events preserves All/Upcoming/Past and search; filter by space and readiness if feasible. Venue event cards show event/space/client/date/capacity/readiness, avoiding client-private information in previews.

### Space details

Name, Address, Maximum People, Time Zone, archived state; tabs/panels General and Layout Templates. Template cards: name, revision, last published, table count, chair count, preview and actions Edit / Duplicate Template / Publish / Archive. Use current floor-plan editor and object library. Do not require every template's chair count to equal max people; show warning not block.

### Venue-managed Event Settings

Split **Venue Details (read-only for client)** and **Client Settings**. Event date/time, room/venue, address, max are venue-controlled. RSVP language, phone-country and per-guest limit remain client-side settings under existing product constraints. If a legacy field couples owner permissions and write rights, refactor DTO validation rather than using greyed-out fields alone.

### Event Layout

Venue tab: current Tables / Table Arrangement, geometry edit controls where authorized. Client tab: tables and room visible; Manage Guests / guest assignment enabled, create/delete/edit geometry disabled. Distinguish "Manage Seats" from "Edit Tables". On mobile client has table list and assign/unassign controls; room canvas view-only.

### Shared Dashboard

Use current KPI definitions. Add `Venue Managed by [name]` context and operational warnings: pending client acceptance; confirmed without table; over-capacity table; venue change since client last review; booking overlap. Venue view may display scoped operational dashboard with no client-only message editor links. Empty/first-use states should direct each actor to their next job.

### Permissions

Separate Venue Team (organization) from Event Client Team. Users should never see a combined unrestricted roles dropdown. Client Lead invites CLIENT_EDITOR or CLIENT_VIEWER only. Venue Org Owner invites staff and a Client Lead. If a client lead must be replaced, require controlled workflow and log it. Self-removal cannot leave event without a designated lead unless venue takes an explicit recovery action.

### Translation/accessibility

All new labels, warnings, dialogs and emails in en/he/pt-BR; RTL correct but floor-plan remains left-to-right spatially as already defined. Ensure semantics of editable vs locked fields are text-readable; no reliance on icon-only locks or color. Support keyboard navigation and 320px mobile width within existing design system constraints.

# 8. API and service contracts (adapt names to actual repo)

Prefer extending existing service modules. These are **example routes**, not commands to fabricate parallel controllers if equivalent routes exist.

```text
POST   /organizations
GET    /organizations                # memberships only
GET    /organizations/:orgId
PATCH  /organizations/:orgId         # org admin
GET    /organizations/:orgId/members
POST   /organizations/:orgId/members/invite
PATCH  /organizations/:orgId/members/:memberId
GET    /organizations/:orgId/spaces
POST   /organizations/:orgId/spaces
GET    /organizations/:orgId/spaces/:spaceId
PATCH  /organizations/:orgId/spaces/:spaceId
POST   /organizations/:orgId/spaces/:spaceId/archive
GET    /organizations/:orgId/spaces/:spaceId/templates
POST   /organizations/:orgId/spaces/:spaceId/templates
POST   /organizations/:orgId/spaces/:spaceId/templates/:templateId/publish
GET    /organizations/:orgId/events?status=all|upcoming|past
POST   /organizations/:orgId/events   # clone selected published revision
POST   /events/:eventId/client-invitations
POST   /client-invitations/:token/accept
POST   /client-invitations/:id/revoke
GET    /events/:eventId/venue-overview
GET    /events/:eventId/venue-guest-manifest
PATCH  /events/:eventId/venue-details
PATCH  /events/:eventId/layout        # geometry permission + version
POST   /events/:eventId/seating-assignments  # client seating permission
GET    /organizations/:orgId/entitlements
```

**DTOs:** distinct venue writable DTO vs client writable DTO; never mass-assign event fields from a generic request object. For every endpoint specify actor scope, tenant query predicate, validation, success/error contracts, transaction semantics, concurrency/version, audit/notification side effects and tests. For read APIs define venue-safe guest projections independent of full client guest DTOs. Paginate lists; support consistent search/filter without cross-tenant leakage.

# 9. Concurrency, consistency, and notifications

- Continue current optimistic concurrency for floor-plan saves and extend to venue event geometry where needed.
- Table deletion/unassignment must be atomic; if notification enqueue fails, use outbox or retry queue without rolling back already committed event changes unless repo architecture dictates an equivalent reliable pattern.
- Store a minimal EventChangeLog for destructive table edits, capacity and schedule changes, guest export by venue, permission changes and staff revocation. Do not log full message contents or entire guest personal data.
- Notify client on changed venue date/address/capacity, populated table deletion, overcapacity induced by venue; notify venue on unresolved seating conflicts. Reuse existing notification bell if possible.
- Event data projections and KPIs must be derived from authoritative records; do not introduce independent mutable counts.

# 10. Privacy and data-handling requirements

Default venue operational read: guest display name, RSVP status, approved attendee count, assigned table and non-sensitive group only if required. **Hide raw phone numbers from venue and venue exports by default**; do not expose RSVP template authoring text, message history, private remarks, client access lists beyond necessary metadata. Any exception must be deliberately permissioned, logged and documented. Ensure access revocation invalidates sessions/caches; protect exports and file URLs. Obtain legal review for contractual controller/processor obligations, privacy notices, retention and cross-border handling (Israel/Brazil), rather than encoding a legal conclusion into roles.

# 11. Feature flags, migration and rollout

**Flags:** `venueOrganizationsEnabled`, `venueClientInvitesEnabled`, `venueBillingEnabled` (names illustrative). Default false outside pilot until migrations and guards are verified. Guard backend routes and frontend navigation consistently; do not rely on a client-side flag for security.

**Migration sequence:**

1. Snapshot database backup; capture deployment version; inventory existing event data and migrations.
2. Add organization/space/template tables, indices and nullable linkage columns.
3. Backfill existing event `management_mode=PERSONAL` and prove no change in legacy event access.
4. Deploy centralized policy layer preserving old B2C authorization before new UI.
5. Implement clone transaction and tests with fixtures.
6. Add invitation verification/acceptance and venue operations behind feature flags.
7. Add scoped UI, notifications, demo fixtures, localization, and subscription entitlements.
8. Enable for internal/test organization; verify old personal events unaffected.
9. Pilot limited venues, monitor errors/denials, have a documented disable plan.
10. Expand only after security, privacy, migration and usability sign-off.

**Rollback:** disable venue features and stop new venue writes; preserve newly created venue data; revert service paths if safe. Do **not** drop new tables or attempt blind down-migration in production. Restore from tested backups only under an incident plan.

# 12. Test plan and acceptance criteria

## 12.1 Regression checks

- Existing personal event create/edit/duplicate/delete, OWNER/ADMIN/VIEWER and SUPER_USER rules.
- RSVP public phone match, unknown guests, rates, guest statuses/counts and event-start cutoff.
- WhatsApp `wa.me` handoff, attempt counting, templates and non-delivery guarantee.
- Guest CSV/XLSX import/export, soft delete/restore, searching, group, bulk operations.
- Seating rules, table deletion unassignment, layout editor save conflicts, old event exports.
- Browser demo isolation/expiry/reset, three languages and RTL, mobile.

## 12.2 New E2E scenarios (must pass)

| ID | Actor | Scenario / expected outcome |
|---|---|---|
| V22-01 | User | Creates venue org while retaining all personal events |
| V22-02 | Venue owner | Creates multiple spaces and published layout revisions |
| V22-03 | Venue owner | Creates event with new table IDs and no guests/seating |
| V22-04 | Venue owner | Edits published template; existing events unchanged |
| V22-05 | Other org staff | Cannot list/open/guess resources of unrelated organization |
| V22-06 | Venue owner | Invites client; invite remains pending until verified acceptance |
| V22-07 | Client lead | Can import guests and edit RSVP/WhatsApp settings |
| V22-08 | Client lead | Can assign approved guests to existing event tables |
| V22-09 | Client lead | Cannot PATCH capacity/address/table geometry directly |
| V22-10 | Venue manager | Can edit table geometry, cannot edit guest/RSVP/message data |
| V22-11 | Venue manager | Sees correct operational projection; full guest phone export denied |
| V22-12 | Venue manager | Deleting occupied table warns, unassigns atomically and notifies client |
| V22-13 | Both | Layout conflict after concurrent edits rejected safely |
| V22-14 | Venue owner | Duplicate booking yields warning and logged override |
| V22-15 | Client | Historical event layout remains readable after source template archived |
| V22-16 | Subscriber | Lapse blocks new venue events without immediately disabling upcoming client RSVP |
| V22-17 | Staff | Revocation prevents subsequent event and file access |
| V22-18 | Demo visitor | Simulated venue-client flow has no real persistent side effects |
| V22-19 | Any | New flows work in English, Hebrew RTL and pt-BR |
| V22-20 | Personal owner | Existing event works identically before/after release |

## 12.3 Property-based / negative tests

- Clone preserves values but never retains template object IDs as event table IDs.
- Tenant scoping must hold for every API, export, nested foreign key, and file.
- Authorization invariants hold across all capability × actor × management mode combinations.
- Invitation cannot be claimed by an unverified wrong-email user, replayed, or accepted after expiry/revocation.
- Capacity computations use attendees vs chairs accurately and remain consistent after conflicting edits.
- Time-zone conversion handles DST boundary and overlapping buffers.
- File/archive lifecycle does not break old snapshot images.

# 13. Implementation milestones and definition of done

| Phase | Deliverables | Must pass before proceeding |
|---|---|---|
| 0 Audit | Repo map, baseline comparison, decisions, file-level plan | Product owner approves gaps; legacy test baseline |
| 1 Foundations | Organizations, memberships, policy layer, additive migration, workspace UI shell | Cross-tenant and B2C regression tests |
| 2 Spaces | Spaces, templates, publish revisions, editor reuse, asset lifecycle | Snapshot/immutability and permission tests |
| 3 Venue events | Event creation clone, reservation rules, client invite accept, roles | Client/venue E2E and negative API tests |
| 4 Shared operations | Two-sided event UI, scoped exports, warnings, notifications | Full usability, RTL/mobile/security gates |
| 5 Pilot | Demo scenario, entitlements, monitoring, backups, runbooks, feature-flag rollout | Live pilot readiness and privacy approval |

After each phase: update PLAN with actual status, run tests/lint/typecheck/migration checks, report limitations, do not merge failing critical security tests. Add an incremental PRD amendment recording implementation decisions and flag status.

# 14. Open product decisions — do not guess silently

| ID | Question | Proposed default |
|---|---|---|
| DEC-01 | Can venue edit event-specific layout after client invitation? | Yes, with warning, log, notice |
| DEC-02 | Who owns date/time? | Venue, client read-only |
| DEC-03 | Can venue see guest phones? | No by default |
| DEC-04 | Can client change table positions? | No, only assignments |
| DEC-05 | What if client leaves venue? | Support-assisted export/transition, no auto-delete |
| DEC-06 | What if venue subscription lapses? | No new events; preserve existing event/RSVP during grace |
| DEC-07 | Full booking system? | No; reservation conflict warning only |
| DEC-08 | Automatic template sync? | No; event snapshots independent |
| DEC-09 | Multiple layout templates per space? | Yes |
| DEC-10 | Client invite model? | Verified email + explicit accept |
| DEC-11 | Past event edits? | Preserve baseline event-start freeze pending pilot feedback |
| DEC-12 | Billing provider / price tiers? | TBD after pilot, manual provisioning initially |
| DEC-13 | Venue data retention? | TBD through privacy/legal review; no destructive assumptions |
| DEC-14 | Existing personal event linked to venue later? | Deferred |
| DEC-15 | Venue staff scope? | Assigned events by default, org managers all org events |
| DEC-16 | Venue client own collaborators? | Lead can invite editor/viewer only |

# 15. Exact first response requested from Claude Code

**Before writing code**, return:

1. Actual repository architecture and dependency map (app structure, ORM/schema, API, auth, role guards, routes, demo providers, i18n, tests).
2. Differences between this proposed target and current checked-in PRD / implemented behavior.
3. A table mapping each V2.2 requirement to existing components to reuse, required new code, and migration impact.
4. A threat model covering tenant isolation, guest privacy, invitation impersonation, exports, role escalation and client/venue split.
5. A phased implementation plan with exact repository file paths, test cases, feature flags and rollback strategy.
6. Decisions/blockers needing owner approval, with your recommended default.

**Then implement only the first approved phase.** Do not implement the entire V2.2 redesign in one unchecked operation. Keep builds green and provide verified outputs at each phase.

---

## Success definition

**A venue creates a room and reusable table layout, clones it into an independent event, invites a verified client, and both parties operate in the same event without being able to modify each other's domain. Every template change preserves existing events, every access is backend-authorized, every critical cross-role modification is recoverable/auditable, and all existing personal-event workflows remain intact.**
