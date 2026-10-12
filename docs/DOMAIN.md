# Domain definitions and open decisions

A glossary of the terms used across the PRD, plan and code, followed by the decisions that are still open. Definitions summarize `docs/PRD.md`; if the two differ, the PRD wins and this file is corrected.

## Definitions

| Term | Definition |
|---|---|
| Event | The top-level unit an organizer manages. Has a name, date and time, timezone, maximum attendees (50–3000, default 300), a fixed RSVP language (`en` or `he`), and a default allowed-attendees value for new guests (1–10, default 5). |
| Past event | An event whose start date/time, interpreted in the event's timezone, has been reached. Read-only through normal flows for every role; viewing and exports remain available; public RSVP is closed. |
| Event role | A user's role in one event: `OWNER`, `ADMIN` or `VIEWER`. A user can hold different roles in different events. Every event keeps at least one Owner; the creator starts as Owner. |
| Super User | `SUPER_USER`, a system-level flag on the user, set only in the database. Gives Owner-equivalent capability on every event without a membership. Not an event role and not assignable in the UI. |
| Guest | One invitation, also called a party. It can stand for several people. Belongs to exactly one event. |
| Attendee | One person expected at the event. Attendees are counted, not stored as individual records. |
| Allowed attendees | The maximum number of attendees a guest may confirm. Starts from the event default and can be overridden per guest. |
| Confirmed attendees | The number a guest confirmed. `null` for `NO_RESPONSE` and `NOT_SURE`, `0` for `DECLINED`, and an integer from 1 to allowed attendees for `APPROVED`. |
| First name / Last name | The organizer's own name for the guest. Never overwritten by RSVP input. |
| Invitation name | The name the guest typed on the public RSVP form. |
| Normalized phone | The canonical form of a phone number used for matching and uniqueness. Unique per event. Must handle Israeli local and `+972` forms. |
| Soft delete | Deleting a guest sets `deleted = 1`. Deleted guests are excluded from lists, analytics and exports. Adding the same normalized phone again restores and updates that record. |
| Active guest | A guest with `deleted = 0`. |
| Invitation sent count | Per guest; starts at 0, increases by exactly 1 each time a WhatsApp send is initiated from the system, never decreases. Counts initiated attempts, not confirmed deliveries. |
| RSVP status | `NO_RESPONSE` (initial), `APPROVED`, `NOT_SURE`, `DECLINED`. |
| Awaiting Response | An active guest with invitation sent count above 0 and status `NO_RESPONSE`. |
| Public RSVP URL | One URL per event, shared by all guests. No per-guest tokens. |
| Known guest | A guest record in the event's list, matched on RSVP by normalized phone. |
| Unknown Guest | An RSVP submission whose normalized phone matched no active guest. Kept for organizer review; excluded from guest-based dashboard metrics until resolved. |
| Table | Belongs to one event. Has a number unique within the event, a name, a capacity in chairs, and a shape (circle, rectangle or square). |
| Assignment | The link between an Approved guest and one table. The whole party sits at one table. Cleared automatically when the guest moves to Declined or Not Sure. |
| Seating conflict | A table whose assigned confirmed attendees exceed its capacity. It can arise only from an RSVP change, because manual assignments beyond capacity are rejected. |
| Seating capacity | The sum of all table capacities in an event. It may differ from the event's maximum attendees in either direction; that produces a warning, never a blocked save. |
| Unassigned confirmed attendees | The sum of confirmed attendees for Approved guests with no table. |
| Demo Mode | The public, no-login mode that runs the same UI on generated fictional data stored in the visitor's browser. |
| Demo role | A simulated Viewer, Admin or Owner state inside Demo Mode. It changes local behavior only and confers no real access. |
| Mock provider / API provider | The two implementations of the frontend service contracts: browser-local for the prototype and Demo Mode, and HTTP against NestJS for the real app. |

## Open decisions

None of these are to be inferred. Each is raised with the product owner at or before the phase shown.

The open items below are ones the precedence rule (see Resolved decisions, R1) does not settle: the mockups either contradict each other or show an element without showing what it does.

### From PRD §18

| # | Decision | Needed by |
|---|---|---|
| D1 | Maximum attendee count an unknown responder may submit before organizer review | Phase 9 |
| D2 | Public RSVP abuse prevention: rate limits or extra verification | Phase 15 |
| D3 | Event duplication scope (which records are copied) and deleted-event retention | Phase 4 |
| D4 | Permission invite flow for an email with no account | Phase 11 |
| D5 | Which RSVP and seating values survive when a soft-deleted guest is restored | Phase 6 |

### Raised by the mockup review

Details for each are in `docs/MOCKUP_NOTES.md`.

| # | Decision | Needed by |
|---|---|---|
| D11 | Dashboard Recent Guest Activity: derive from last-sent/last-response timestamps or add an activity record | Phase 5 |
| D12 | Target of the Dashboard "View Event" button and the Event Settings "View Event Rules" button | Phase 5 / Phase 7 |
| D13 | Bulk selection on the Guests table: which bulk actions, if any | Phase 6 |
| D14 | Display label for a guest with no invitation sent and no response | Phase 6 |
| D16 | "Send Test Message": include or omit, and what it does | Phase 8 |
| D17 | Message editor formatting controls | Phase 8 |
| D19 | RSVP language: which page owns it and at what point it becomes fixed | Phase 7 |
| D22 | Thresholds for table status labels (Ready / Almost Full / Over Capacity) | Phase 10 |

### Other

| # | Decision | Needed by |
|---|---|---|
| D23 | Phone number range used for generated demo guests, so that numbers are realistic in format but cannot reach a real person | Phase 3 |

## Resolved decisions

Move a row here, with the date and the outcome, when a decision is made. Update the PRD at the same time when the outcome changes product behavior (PRD §19).

| # | Outcome | Date |
|---|---|---|
| R1 | **Precedence rule.** The mockups were created after the PRD. Where a mockup differs from or adds to the PRD, build what the mockup shows; the PRD stays the source of truth for business rules and is updated in the same phase. | 2026-10-12 |
| R2 | **Event navigation** is identical on every event-level page, in this order: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions. Permissions is hidden for Viewers. Budget, Vendors, Timeline and Photo Sharing are not built (listed in `docs/FUTURE_FEATURES.md`). | 2026-10-12 |
| R3 | **Public RSVP form:** number of attendees is always required before any response. For Declined and Not Sure the submitted number is discarded; stored values stay `0` and `null`. | 2026-10-12 |
| D6 | **Arrangement** stays deferred. The Table Arrangement tab is shown with a "Soon" badge and is disabled. The Arrangement Preview panel is not shown. | 2026-10-12 |
| D7 | **Event selector** is in the sidebar, under the logo, on every event-level page. It is not shown in the top bar. | 2026-10-12 |
| D8 | **Notification bell, Profile and account Settings** are left out of the MVP (listed in `docs/FUTURE_FEATURES.md`). | 2026-10-12 |
| D9 | **Avatar role icon** shows the user's role in the current event, using the same icons as the role badges on the Permissions page: crown for Owner, shield for Admin, people icon for Viewer. No icon is shown outside an event, including the homepage. A Super User without a membership shows the Owner crown. | 2026-10-12 |
| D10 | **Event cover image:** built as the mockup shows (by R1). Add the field to the PRD in Phase 4. | 2026-10-12 |
| D15 | **Per-send message history:** built as the mockup shows (by R1). Add the record to the PRD in Phase 8. | 2026-10-12 |
| D18 | **Event location and RSVP display title:** built as the mockups show (by R1). Add the fields to the PRD in Phase 7 / Phase 9. | 2026-10-12 |
| D20 | **QR code for the RSVP link:** built as the mockup shows (by R1). | 2026-10-12 |
| D21 | **Limits:** 500 characters per RSVP message; background image JPG or PNG up to 5MB, as the mockup states (by R1). | 2026-10-12 |
| D24 | **Tablet layouts** are not designed or verified for the MVP. A tablet gets whichever of the desktop or phone layouts fits its width (listed in `docs/FUTURE_FEATURES.md`). | 2026-10-12 |
