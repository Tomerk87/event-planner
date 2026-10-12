# Event Planner — Product Requirements Document

**Version:** 1.1  
**Status:** Product baseline for POC/MVP development  
**Primary market:** Israel  
**Supported languages:** English and Hebrew  
**Supported devices:** Desktop, tablet, and mobile browsers  
**Implementation reference:** `AGENTS.md` and `PLAN.md`  
**Visual reference:** `mockups/README.md` and the mapped images in `mockups/`

## 1. Product vision

Event Planner is a responsive web application for people planning and managing invitation-based events. It supports weddings, celebrations, parties, and other types of events without assuming a wedding-specific workflow.

An organizer should be able to create an event, manage its guest list, initiate WhatsApp invitations, collect responses through one public event-level RSVP page, monitor attendance, assign approved guests to tables, and export operational information for the venue.

The product must also provide a **public, interactive Demo Mode** so visitors can explore realistic events without an account or manual data setup.

## 2. Goals and success criteria

- An organizer can complete the invitation-to-seating workflow within one product.
- Event and RSVP data produces coherent, trustworthy Dashboard numbers.
- Business rules remain consistent across different places where an action can occur.
- All essential MVP workflows work on desktop and mobile, with English/LTR and Hebrew/RTL interfaces.
- A visitor can immediately try the product using automatically generated fictional demo data, modify it, and reset it.
- Past events remain accessible for viewing and export but cannot be modified through normal product workflows.
- Access is scoped per event and enforced by the backend for authenticated use.

The POC targets a lightweight single-machine deployment; this is a delivery constraint, not a reduction in user-facing MVP behavior.

## 3. Users and access

### 3.1 Organizer accounts

Authenticated users see an Events homepage containing events they can access. Each event card shows at minimum the name and date, and opens that event. Users can have different roles in different events.

### 3.2 Roles

`SUPER_USER` is a **system-level** privilege configured in the database, not via event permissions UI. Each event has membership records with an event-level role of `OWNER`, `ADMIN`, or `VIEWER`.

| Capability | Viewer | Admin | Owner | Super User |
|---|:---:|:---:|:---:|:---:|
| View event pages and export data | Yes | Yes | Yes | Yes |
| Edit event operational data, guests, RSVP, messages and tables (active event) | No | Yes | Yes | Yes |
| Duplicate or delete an event | No | No | Yes | Yes |
| Open Permissions page or access its API | No | Yes | Yes | Yes |
| Grant/manage Viewer and Admin roles (except own role) | No | Yes | Yes | Yes |
| Grant/manage another user's Owner role | No | No | Yes | Yes |
| Modify/remove own event permission | No | No | No | N/A |

- Admins cannot edit/remove Owners or grant Owner access.
- Owners can manage other Owners but cannot modify their own event permission.
- Every event must retain at least one Owner.
- The event creator automatically becomes an Owner.
- Super Users have Owner-equivalent capabilities across all events without requiring individual event memberships; there is no UI for assigning Super User.
- Past-event read-only rules apply to operational modifications regardless of role.
- All restrictions must be enforced by the server, not only by hiding UI controls.

### 3.3 Permissions page

This is the final page in event navigation, after Event Settings. It contains a table showing at least **Name**, **Email**, **Permission Type**, and authorized actions. An authorized user can grant, change, and remove permitted event memberships. A user can belong to multiple events. Viewer cannot see this page or retrieve its data using backend APIs.

Inviting or granting access to an email without an existing account, account activation, and notification delivery have not yet been specified; agents should flag these as implementation decisions instead of inventing a broad invitation system.

## 4. Product information architecture

### 4.1 Account level

- Sign in / authentication
- Homepage / Events list
- Create event
- Open event
- Public Demo Mode entry without sign-in

### 4.2 Event level

1. Dashboard
2. Guests
3. WhatsApp Message / Messages
4. RSVP Settings
5. Event Layout
6. Event Settings
7. Permissions

Use concise navigation labels that match the product's UI language. The referenced mockups determine visual composition; approved requirements determine behavior.

## 5. Events and lifecycle

### 5.1 Create and edit event

| Field | Requirement |
|---|---|
| Event name | Required |
| Maximum attendees | Required integer; **minimum 50, default 300, maximum 3000** |
| Event date and time | Required |
| RSVP language | Fixed per event: English or Hebrew |
| Default allowed attendees per guest | Default 5; event-configurable integer from 1 to 10 |

The event creator becomes an Owner. The application UI language can differ from the event's fixed guest-facing RSVP language.

### 5.2 Past events

Once an event's date/time is reached (interpreted in its configured timezone), it becomes **read-only** through normal product flows. Users may view pages and download exports. They may not edit settings, guests, RSVP, messages, tables, seating, or other operational data; public RSVP submissions close at the event start. Apply these rules in the backend, not only the UI.

### 5.3 Duplication and deletion

Only Owners and Super Users may duplicate or delete events. The precise duplication scope and event-deletion retention strategy require confirmation before implementation; do not silently assume which guests, RSVP records, permissions, or layout objects are copied.

## 6. Guest management

### 6.1 Guest model

A Guest represents an invitation/party and may stand for multiple actual attendees. Each guest belongs to exactly one event.

| Field | Meaning |
|---|---|
| First name / Last name | Organizer-maintained identity |
| Invitation name | Guest-entered name on the RSVP form; may differ from the organizer's name |
| Phone number | Required; guest identifier within the event |
| Normalized phone | Internal matching and uniqueness value |
| Allowed attendees | Maximum attendees the invitation may approve |
| Confirmed attendees | Actual approved count; see RSVP rules |
| RSVP status | `NO_RESPONSE`, `APPROVED`, `NOT_SURE`, `DECLINED` |
| Invitation sent count | Nonnegative, starts at `0`, increases on each system-initiated WhatsApp action |
| Last invitation sent at / Last RSVP response at | Operational timestamps |
| Table | Nullable assignment; only Approved guests are assignable |
| Deleted | Soft-delete marker, default `0` |

A normalized phone number is unique **within each event**. Initial normalization should handle Israeli phone formats, including local and `+972` forms, while leaving room for other countries.

### 6.2 Soft deletion and restoration

Deleting a guest sets `deleted = 1`. Deleted guests are absent from ordinary lists, analytics, and exports. If the same normalized phone is subsequently added within that event, update and reactivate the existing record (`deleted = 0`) rather than inserting a duplicate. Restoration must not accidentally surface stale seating information or invalid RSVP state; preserve historical data according to a deliberate implementation rule.

### 6.3 Guests screen

- Known Guests list with create, view, update, soft-delete, search, and sortable columns.
- Search by first name, last name, full name, Invitation Name, and phone number.
- Show attendee allowance, confirmed count, RSVP status, invitation counter, and Table Number (if assigned).
- Allow authorized users to manually update RSVP status, confirmed attendees, and table assignments subject to the same rules as public RSVP and Event Layout.
- Provide a WhatsApp action for each guest.
- Desktop table and intentionally adapted mobile list/card layout.
- CSV and XLSX import, with field mapping, preview, validation, duplicate detection, and error reporting.
- CSV guest export (XLSX guest export may use the same export infrastructure).
- Unknown Guests tab (see section 8).

## 7. WhatsApp messages and invitation counting

The organizer configures one reusable event-level WhatsApp message, with useful substitutions such as event name/date/time, guest name, and shared RSVP URL. The interface includes message editing and preview as represented in the mockups.

### 7.1 MVP send behavior

An authorized organizer selects a guest and invokes the WhatsApp button. The system prepares a recipient-specific WhatsApp deep link with a prefilled message and opens WhatsApp/WhatsApp Web.

- `invitation_sent_count` begins at `0` and **only increases**.
- Each system-initiated WhatsApp action increments the guest counter by exactly `1` and records its time.
- The MVP cannot verify whether WhatsApp's final Send action or delivery occurred; the counter therefore measures **send attempts initiated from Event Planner**, not verified deliveries.
- Repeated sends to one guest do **not** increase the distinct Invitations Sent Dashboard KPI more than once.
- Viewer cannot invoke message actions.

## 8. RSVP

### 8.1 One public link per event

Each event can generate **one public RSVP URL**, shared by every guest. No guest-specific RSVP tokens or authenticated guest accounts are required for the MVP.

The form requests the guest's **name, phone number, response, and number of attendees when approving**. The guest's submitted name populates Invitation Name, without overwriting organizer-maintained first and last name.

### 8.2 Identification

- Normalize entered phone number.
- If it matches an active guest in the event, update that guest's RSVP data.
- If no active guest matches, record the submission under Unknown Guests for organizer review rather than silently adding it to the known guest list.
- One phone cannot identify multiple guests in the same event.

Since this is a public form, phone matching is identification for the product workflow, **not proof of phone ownership**. The implementation must consider spam, abuse prevention, and reasonable privacy protections without inventing a mandatory verification feature not specified in the PRD.

### 8.3 Status and attendee rules

| RSVP status | Confirmed attendees | Other behavior |
|---|---|---|
| `NO_RESPONSE` | `null` | Initial state |
| `APPROVED` | Integer from `1` to guest's allowed maximum | Show Approved message and configured actions |
| `DECLINED` | `0` | Show Declined message; remove any seating assignment |
| `NOT_SURE` | `null` | Show Not Sure message; remove any seating assignment |

- Approved attendee counts cannot be zero, negative, fractional, or above that guest's allowance.
- The event default per-invitation allowance is 5 and configurable from 1 to 10; individual known guests can have an override within supported limits.
- Display a message advising guests who need more than their allowed count to contact the organizer / use another invitation as appropriate. Do not silently add guest records.
- Not Sure guests are **not** counted toward confirmed/expected attendance. The organizer may contact them and manually change their status.
- Guests may update responses until the event starts; the latest valid response is authoritative.
- If an Approved guest increases attendance and their existing table becomes over capacity, **accept the RSVP** and report a seating conflict rather than rejecting the response.
- For unknown guests, the permitted maximum before conversion into a known guest needs an explicit product decision; do not bypass attendee validation silently.

### 8.4 RSVP Settings page

The organizer can configure:

- Generate/copy public RSVP URL.
- Welcome text.
- Approved message.
- Declined message.
- Not Sure message.
- RSVP background image upload.
- Background overlay/transparency control.
- Optional Google Calendar action with title, date/time, and location.
- Optional YouTube link/action after approval.
- Mobile Settings and Preview tabs as mapped in `mockups/README.md`.

The public RSVP renders in the event's fixed RSVP language, English or Hebrew. There is no guest-side language switch in MVP.

## 9. Unknown Guests

Unknown Guests are RSVP submissions whose normalized phone did not match an active known guest. Their review list shows submitted name, phone, response, attendee count where relevant, and submission time.

Authorized organizers can:

- Review an unknown response.
- Add/convert it to a known guest, preserving response data.
- Match/merge it with a known guest, with deterministic duplicate resolution.
- Reject/remove an unknown record according to an approved retention policy.

Unknown responses do not automatically become known Guest records. Consequently, standard guest-based Dashboard metrics exclude them until resolved; the UI should keep unknown submissions visible for follow-up. Their separate impact on operational planning can be surfaced without silently altering defined KPIs.

## 10. Dashboard

All guest-based metrics include active guests only (`deleted = 0`). Dashboard values are calculated from actual guest/RSVP/table data, never separately edited numbers.

| KPI | Definition |
|---|---|
| Total Guests | Count of active Guest records (invitations/parties) |
| Invitations Sent | Count of distinct active guests where `invitation_sent_count > 0` |
| Invitations Not Sent | Count of active guests where `invitation_sent_count = 0` |
| Awaiting Response | Count with `invitation_sent_count > 0` and `rsvp_status = NO_RESPONSE` |
| RSVP Approved | Count of active guests with `APPROVED` |
| RSVP Not Sure | Count of active guests with `NOT_SURE` |
| RSVP Declined | Count of active guests with `DECLINED` |
| Confirmed Attendees | Sum of approved guests' confirmed attendee counts |
| Seating Capacity | Sum of table chair capacities |
| Unassigned Confirmed Attendees | Sum of approved attendee counts for guests with no table |

There is no separate ambiguous Expected Attendees KPI in MVP: the authoritative expected count is **Confirmed Attendees**, and Not Sure is excluded.

### 10.1 Warnings

- Confirmed attendees exceed event Maximum Attendees.
- Sum of table chairs is **above** event Maximum Attendees.
- Sum of table chairs is **below** event Maximum Attendees.
- A table exceeds its configured capacity due to an RSVP change.
- Confirmed attendees are awaiting table assignment (operational indicator).

Table-total mismatch is **nonblocking**, including when chairs exceed the event maximum.

## 11. Event Layout — Tables and seating

### 11.1 Tables

The organizer can create, view, update, and delete tables. Each table has a unique number within its event, a name, a capacity (number of chairs), and a shape: **circle, rectangle, or square**.

Tables display assigned/available chairs and guests. Authorized users can assign or unassign guests both from the Tables view and from the Table field in Guests.

### 11.2 Seating business rules

- Only **Approved** guests may be assigned.
- In the MVP, a guest's entire invitation party is assigned to **one table**; splitting across tables is not supported.
- A manual assignment that would exceed a table's remaining capacity is rejected with a clear error.
- A later RSVP increase that causes the existing assignment to exceed capacity is accepted, and the table is flagged as conflicted.
- Declined/Not Sure transition automatically clears a previous table assignment.
- Deleting a populated table requires confirmation and leaves affected guests unassigned; it never deletes guests.
- Event Maximum Attendees and the sum of chairs should ideally match, but a mismatch is allowed and produces a warning rather than a blocked save.

### 11.3 Seating export

Support **CSV and XLSX** exports for venue operations:

- Detailed rows: Table Number, Table Name, Guest First Name, Last Name, Invitation Name, Phone, Confirmed Attendees.
- Summary: Table Number, Name, Capacity, Assigned, Remaining.

Exports remain available after an event becomes Past.

### 11.4 Arrangement canvas scope

The visual venue blueprint/Arrangement editor is currently a **post-MVP feature** unless explicitly promoted into POC scope. The planned capability includes View and Edit modes (default View); tables on a canvas; drag/drop; chairs and occupancy; venue objects such as divider/wall, steps, stage, and bar; persistent coordinates and shapes; and overlap/conflict handling. Mobile viewing is required; full editing may be desktop/tablet-oriented.

The existing Arrangement mockups remain applicable visual guidance even while implementation is deferred.

## 12. Public Demo Mode — MVP requirement

Demo Mode is a **permanent user-facing product capability**, not a disposable development fixture.

### 12.1 Entry and scope

- Visitors can choose **Try Demo** without authenticating.
- Demo loads a prepopulated fictional event and allows visitors to explore the same pages/components as the real application.
- Demo visitors can perform simulated guest CRUD, RSVPs, WhatsApp actions, seating changes, and role-aware exploration of Permissions, with restrictions corresponding to the selected demo role.
- Demo Mode is clearly labeled and can be disabled by deployment configuration.

### 12.2 Generation and behavior

- Demo data is **generated automatically**, with no manual population required from the product owner.
- Generate realistic but fictional events, guests, invitation counters, RSVP distribution, unknown guests, tables, and permissions.
- Use a deterministic seed and internally consistent relationships so resets and tests are repeatable.
- Include representative edge cases: Not Sent, Awaiting Response, Approved, Declined, Not Sure, repeated sends, soft deletion, unknown RSVP, unassigned guests, at-capacity tables, and an RSVP-induced seating conflict.
- Demo data is interactive, not only static screenshots or fixed numbers.
- Demo actions follow the same relevant business rules as real operations, with safe simulated effects.

### 12.3 Persistence and isolation

- During the POC, demo data is stored in each visitor's own browser (`localStorage` or IndexedDB as appropriate).
- Changes survive ordinary browser refreshes in the same browser profile.
- Visitors do not share mutable data; other users' demo sessions cannot change a visitor's data.
- The visitor can use **Reset Demo** to restore the initial generated dataset, after confirmation.
- Demo datasets should be versioned so future application updates can migrate or reset incompatible browser-stored data safely.
- Demo Mode must not create records in the real PostgreSQL database or expose real customer information.

### 12.4 External side effects and security

- Demo WhatsApp actions are simulations only; do not attempt to message real phone numbers or open live links to fictional recipients.
- Do not send real emails, create real calendar events, or invoke other irreversible integrations from Demo Mode.
- Demo-generated names/phone numbers must be fictional and safe for demonstration.
- Demo roles are UI/workflow simulations and must not confer real backend access.
- Server authorization must never trust a client-declared demo flag.

### 12.5 Demo acceptance criteria

A new visitor can open Demo Mode without login, see a populated event, create/edit/delete demo guests, manipulate RSVP statuses, observe recalculated analytics, change seating where permitted, explore mobile and Hebrew/RTL screens, refresh without losing changes, and reset to the deterministic initial state. No action can alter another visitor's or a real customer's data.

## 13. Internationalization and mobile requirements

- Admin interface languages: English (`en`) and Hebrew (`he`), with a user-selectable interface language.
- Hebrew uses a first-class RTL layout; English uses LTR.
- The event's guest-facing RSVP language is configured separately and is fixed per event.
- Translate all user-facing copy, including validation errors, statuses, confirmation dialogs, empty states, and demo controls.
- Handle phone numbers, URLs, email addresses, dates, and other mixed-direction values intelligibly in Hebrew.
- All core pages and workflows must work on mobile. Desktop tables should be adapted into usable mobile patterns rather than simply shrunk.
- The mobile tab structure in the RSVP Settings, WhatsApp Message, and Event Layout mockups is intentional and should be followed.
- Follow accessible focus, label, contrast, and keyboard interaction practices.

## 14. Visual design and mockup mapping

`mockups/README.md` is the authoritative mapping for individual desktop and mobile reference images. The known mappings are:

| Page | Desktop | Mobile |
|---|---|---|
| Homepage / Events | `homepage.png` | `homepage_mobile.png` |
| Dashboard | `dashboard.png` | `dashboard_mobile.png` |
| Guests | `guests.png` | `guests_mobile.png` |
| Event Layout | `event_layout.png` | `event_layout_tables_mobile.png`; `event_layout_arrangement_mobile.png` |
| RSVP Settings | `rsvp_settings.png` | `rsvp_settings_settings_mobile.png`; `rsvp_settings_preview_mobile.png` |
| WhatsApp Message | `whatsapp_message.png` | `whatsapp_message_editor_mobile.png`; `whatsapp_message_preview_mobile.png` |
| Event Settings | `event_settings.png` | `event_settings_mobile.png` |

Where a direct mockup is unavailable (including Permissions, certain dialogs, public RSVP states, and Unknown Guests), use the established visual language and reusable components. Preserve mockups as the primary visual reference but adapt for function, accessibility, mobile, and RTL.

## 15. MVP functional acceptance scenarios

1. **Events:** A signed-in user creates an event with validated fields and receives Owner access; the event appears on their Homepage.
2. **Permissions:** Owner grants Admin/Viewer; Admin cannot grant Owner or delete event; Viewer cannot modify content or access Permissions API; last Owner cannot be removed.
3. **Guests:** Authorized organizer imports CSV/XLSX, searches and sorts, soft-deletes a guest, and restores the same record by re-adding its phone.
4. **WhatsApp:** Clicking the guest action prepares a message and increments the counter once per initiated attempt; five attempts still count as one distinct invited guest in analytics.
5. **Known RSVP:** Guest submits name/phone and Approved with a valid count; system matches the number and saves Invitation Name and attendee quantity.
6. **Unknown RSVP:** Unmatched submission appears in Unknown Guests and can be reconciled without silent creation of a normal guest.
7. **Status change:** Decline sets attendees to zero; Not Sure contributes none; change away from Approved removes table assignment.
8. **Seating:** Only Approved guests can be assigned; manual overcapacity is blocked; RSVP-induced overcapacity is accepted and flagged.
9. **Capacity:** Chair count may be higher/lower than event maximum; save succeeds and warning appears. Confirmed attendance over event maximum also generates a warning.
10. **Exports:** Venue-ready CSV/XLSX seating export correctly reflects assignments; exports work on Past events.
11. **Lifecycle:** At event start the event and its public RSVP become read-only/unavailable for modification, while viewing/export remains possible.
12. **Languages and devices:** Core organizer and RSVP flows are usable in English/LTR and Hebrew/RTL, on desktop and mobile.
13. **Public demo:** Visitor without an account can explore an interactive fictional event, change and reset data, and cannot trigger real-world side effects or access customer records.

## 16. Quality, security, and operational requirements

- Backend-enforced validation and authorization for real authenticated operations.
- Transactional updates where RSVP/seating/permissions operations affect multiple records.
- Input validation, safe handling of CSV/XLSX imports and image uploads, and rate/abuse safeguards for public endpoints.
- Correct phone-number normalization and event-level uniqueness.
- No production secrets committed to source control.
- Responsive performance for events with up to 3,000 attendees; avoid unnecessary heavyweight infrastructure.
- Maintain test coverage and end-to-end scenarios per `AGENTS.md` and `PLAN.md`.
- POC can be deployed to one low-resource VM using static React assets, NestJS, PostgreSQL, and persistent volumes; production Docker packaging is scheduled after frontend/backend integration under the frontend-first execution plan.
- Ensure backup/restore and restart persistence are considered before opening real-user data collection.

## 17. Out of scope or deferred

Unless separately approved for the POC:

- Visual Arrangement canvas editor (the planned post-MVP phase).
- Automated WhatsApp Business API delivery, bulk sending, reminders, and delivery/read tracking.
- Guest-specific RSVP URLs or multi-language guest choice within one event.
- Individual attendee entities, group splitting, and seat-level assignment.
- Vendor, budget, payment, and full event-production management.
- Advanced analytics, audit history, reusable event templates, and configurable early RSVP deadlines.

## 18. Decisions that still need confirmation

These do not block creation of the PRD, but should be resolved at the relevant implementation stage rather than inferred:

1. **Unknown RSVP attendee limit:** What maximum applies to an unknown responder before organizer review?
2. **Public RSVP abuse prevention:** What rate limits or additional verification are appropriate without creating an unnecessarily difficult guest experience?
3. **Event duplication/deletion semantics:** Which records are copied and how long deleted events remain recoverable?
4. **Permission invite flow:** What happens when an organizer grants access to an email not yet registered?
5. **Deleted guest restoration:** Which prior RSVP and seating values should be preserved, cleared, or reviewed on restoration?
6. **Visual Arrangement in POC:** Keep deferred, or explicitly promote to POC scope?

## 19. Document ownership and change control

- `docs/PRD.md` (this document) defines **product behavior and acceptance expectations**.
- `AGENTS.md` defines coding-agent rules and technical constraints.
- `PLAN.md` defines implementation sequencing, validation gates, and a living progress log.
- `mockups/README.md` maps screens/tabs to their reference images.

If technical implementation uncovers a conflict or unspecified product behavior, record the decision and update this PRD rather than silently changing functionality. Keep completed plan steps and implementation notes in `PLAN.md`, not here.
