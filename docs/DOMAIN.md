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
| D2 | Public RSVP abuse prevention: rate limits or extra verification | Phase 15 |
| D4 | Permission invite flow for an email with no account | Phase 11 |

### Raised by the mockup review

Details for each are in `docs/MOCKUP_NOTES.md`.

| # | Decision | Needed by |
|---|---|---|
| D12 | Target of the Event Settings "View Event Rules" button (the Dashboard half was resolved 2026-10-13) | Phase 7 |
| D16 | "Send Test Message": include or omit, and what it does | Phase 8 |
| D17 | Message editor formatting controls | Phase 8 |
| D19 | RSVP language: which page owns it and at what point it becomes fixed | Phase 7 |
| D22 | Thresholds for table status labels (Ready / Almost Full / Over Capacity) | Phase 10 |

### Defaults applied in Phase 3, to confirm

The approved documents do not settle these. Each was given the most conservative reading so that the rules could be built; say if any should change.

| # | Default applied | Where it matters |
|---|---|---|
| P1 | Permissions can still be managed on a past event. PRD section 5.2 lists the operational data that becomes read-only and does not include permissions | Phase 11 |
| P4 | A table's capacity can be lowered below its current occupancy; the table is then shown as over capacity | Phase 10 |
| P7 | The RSVP language can be changed when editing an event, until D19 is decided | Phase 7 |
| P8 | A simulated demo role applies to every event the demo user can reach, not only the one being viewed | Phase 11 |


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
| R4 | **Phone bottom action bar:** aligned with the page content, buttons of equal width, pinned to the bottom of the screen while the page scrolls. The wider bar drawn in four phone mockups is a mockup error and is not reproduced. | 2026-10-12 |
| R5 | **Bottom bar on every phone form page:** Event Settings, WhatsApp Messages and RSVP Settings all use it, including Event Settings, whose phone mockup shows Save at the top. List pages and desktop layouts are unchanged. | 2026-10-12 |
| D1 | **Unknown RSVP limit:** an unknown responder may approve up to the event's default allowed attendees. | 2026-10-12 |
| D5 | **Restored guest:** No Response, no table, name and allowance from the new entry, invitation counter kept. | 2026-10-12 |
| D11 | **Recent Guest Activity** is derived from the per-send message history and each guest's latest response; no separate activity record. | 2026-10-12 |
| D23 | **Demo phone numbers** are Israeli-style but undialable (`+972 00-…`). Phone validation checks length and digits, not the operator prefix. | 2026-10-12 |
| D24 | **Tablet layouts** are not designed or verified for the MVP. A tablet gets whichever of the desktop or phone layouts fits its width (listed in `docs/FUTURE_FEATURES.md`). | 2026-10-12 |
| D3 | **Duplicate event:** Owner or Super User only. Copies the event's details, RSVP settings, message template and tables (with nobody seated). Does not copy guests, responses, unknown responses, sent messages or other members. The person duplicating becomes the copy's Owner and gives it a new name and date. Allowed on a past event. **Delete event:** Owner or Super User only; permanent; removes the event and everything in it; confirmed by typing the event's name. Allowed on a past event. | 2026-10-12 |
| D10 | **Event cover:** until image upload exists, each event shows a cover generated in the browser (a gradient with an icon, chosen from the event's id). | 2026-10-12 |
| D25 | **Entry flows:** Landing → Sign Up → account created → My Events; Landing → Sign In → My Events; Landing → Try Demo → the populated demo. A signed-out visitor who opens an application address is sent to the landing page; a visitor with a session who opens the landing page goes to My Events. | 2026-10-13 |
| D26 | **Accounts before the backend exist only in the browser.** Sign-up and sign-in are simulated: accounts and their events are kept in the visitor's browser, in a workspace separate from the demo, and the two never share data. A password is asked for but never stored or checked, and the forms say so. This is not authentication and guards nothing real; it is replaced in Phase 14/16. | 2026-10-13 |
| D27 | **A new or duplicated event must start in the future.** From its start an event is read-only, so one created in the past could not be set up. | 2026-10-13 |
| D12 (Dashboard) | The Dashboard button drawn as "View Event" is named **Event Settings** and opens the Event Settings page. | 2026-10-13 |
| P5 | Confirmed: an organizer's manual RSVP change counts as the guest's latest response in Recent Guest Activity. | 2026-10-13 |
| D28 | **Dashboard KPI cards** include Seating Capacity and Unassigned Confirmed Attendees as two more cards, in the mockup's card style, after Confirmed Attendees. | 2026-10-13 |
| D29 | **Dashboard warnings** the mockup does not draw (table chairs above or below the event maximum, confirmed attendees awaiting a table) use the same style as the mockup's over-capacity warning. | 2026-10-13 |
| D30 | **Landing page preview** stays a drawing; it is not replaced by a screenshot of the Dashboard. | 2026-10-13 |
| D13 | **Bulk selection on the Guests table:** selecting rows offers Delete selected (with confirmation) and Export selected. Bulk WhatsApp sending stays out of scope. | 2026-10-13 |
| D14 / P9 | A guest with no invitation sent and no response is labelled **Not Sent**, on the Guests page and in the Dashboard's RSVP Status chart. "Awaiting Response" is used only for guests who were sent an invitation. | 2026-10-13 |
| P2 | Confirmed: a guest needs a first name; the last name is optional. | 2026-10-13 |
| P3 | Confirmed: a guest's allowed attendees cannot be lowered below a count they have already confirmed. | 2026-10-13 |
| P6 | Confirmed: converting or merging an unknown response is refused if its attendee count exceeds the guest's allowance; the organizer raises the allowance first. | 2026-10-13 |
| P10 | Confirmed: **View All** on Recent Guest Activity opens a dialog with the 50 most recent entries; the card shows the newest five. | 2026-10-13 |
| P11 | Confirmed: each Dashboard warning is a link — "Event over capacity" opens Event Settings; the seating, table and awaiting-table warnings open Event Layout. | 2026-10-13 |
| P12 | Changed by the owner: activity times are shown in the **viewer's own time zone**, as "Today" or "Yesterday" by the viewer's calendar, otherwise with the date. The event's own date and time are still shown in the event's time zone. | 2026-10-13 |
| P13 | Confirmed: each Dashboard KPI card says what its figure counts — invitations, people or chairs. | 2026-10-13 |
| D31 | **Rejected unknown responses are kept.** Rejecting moves the response to a Rejected list, from which it can be restored to the review list. | 2026-10-13 |
| D32 | **Guest export** offers CSV and Excel (XLSX). An export always contains every field, whatever columns are visible. | 2026-10-13 |
| D33 | **Guest row actions:** the ">" arrow on a phone and the guest's name on desktop open a details panel; the "⋯" menu holds Change RSVP and Delete; the pencil opens the edit form. | 2026-10-13 |
| D34 | **Column chooser:** the sliders button beside the Guests filters is a dropdown listing every column with a checkbox, with Select all and Clear. Name and Phone are always shown, as are the selection and Actions columns. All columns are shown by default. The choice is remembered in the browser and applies to every event. Hiding the sorted column returns sorting to Name. Desktop table only; hidden on a phone. | 2026-10-13 |
| D35 | **Clear filters:** a button beside the column chooser resets the search and the three filter dropdowns. It leaves the column choice and sorting alone and is shown only when something is filtered. | 2026-10-13 |
| D36 | **The per-row WhatsApp button** on the Guests page is shown disabled with a "Soon" hint until the message page is built in Phase 8. | 2026-10-13 |
