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
| Allowed attendees | The maximum number of attendees a guest may confirm. Starts from the event default and can be overridden per guest. Shown on the Guests page, in the guest form, and in imports and exports as **Expected attendees**. |
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
| Table | Belongs to one event. Has a number unique within the event, a capacity in chairs, and a shape (circle, rectangle or square). A table has no name. |
| Group | An optional label on a guest, chosen by the organizer to organize the list (for example "Family"). Unrelated to seating. |
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
| D22 | Thresholds for table status labels (Ready / Almost Full / Over Capacity) | Phase 10 |

### Defaults applied in Phase 3, to confirm

The approved documents do not settle these. Each was given the most conservative reading so that the rules could be built; say if any should change.

| # | Default applied | Where it matters |
|---|---|---|
| P1 | Permissions can still be managed on a past event. PRD section 5.2 lists the operational data that becomes read-only and does not include permissions | Phase 11 |
| P4 | A table's capacity can be lowered below its current occupancy; the table is then shown as over capacity | Phase 10 |
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
| D23 | **Demo phone numbers** are in a range no Israeli number uses: they start `00` after the leading zero and are shown as `000-001-0005`, so they cannot be dialled. Phone validation checks the shape of a number, not whether an operator has assigned it; the `00` range is accepted for this reason only. | 2026-10-12, reworded 2026-10-13 |
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
| D37 | **Phone numbers, Israel first.** A number without `+` is read as Israeli; a number from another country is entered with `+` and its country code. Israeli numbers are always shown in local form, `050-730-8828` (landlines `03-123-4567`), however they were typed or imported; foreign numbers are shown with their code, `+1 2125550123`. A number that is local to another country is refused rather than read as Israeli. A default country per event and a country selector are deferred (`docs/FUTURE_FEATURES.md`). | 2026-10-13 |
| D19 / P7 | **Guest RSVP language.** RSVP Settings owns the event's default language for the public RSVP page; it is first chosen when the event is created. Each guest can switch the page between English and Hebrew. Texts the organizer wrote are shown as written in either language; translating them is deferred (`docs/FUTURE_FEATURES.md`). Event Settings has no language selector. This replaces "fixed per event, no guest-side switch". | 2026-10-13 |
| D12 (Event Settings) | **View Event Rules** opens a read-only dialog listing the event's rules. | 2026-10-13 |
| D38 | **Danger Zone** is built as the mockup shows: Duplicate and Delete are not added there and stay in the event card menu. | 2026-10-13 |
| D39 | **Location** is edited on Event Settings, as an optional field in General Information. The RSVP title is edited on RSVP Settings (Phase 9). | 2026-10-13 |
| D40 | **Editing an event:** its date and time can only be moved to a time in the future. Changing the time zone keeps the date and time as typed. Changing the default allowed attendees affects only guests added afterwards. Lowering the maximum below the confirmed count is allowed and shows the over-capacity warning. | 2026-10-13 |
| D41 | **Unsaved changes:** leaving Event Settings asks for confirmation only when something was changed and not saved. | 2026-10-13 |
| P14 | Confirmed: when a phone whose unknown response was rejected submits the RSVP form again, the response is updated and returns to the review list. | 2026-10-13 |
| P15 | Confirmed: row selection and its bulk actions exist on the desktop table only. | 2026-10-13 |
| P16 | Confirmed: import rules — a single "Name" column is the first name; a phone already used by an active guest or earlier in the file is skipped and reported, never overwritten; a blank allowed-attendees value takes the event's default; limits of 5,000 rows and 5 MB; a nine-digit number starting with 5 gets back its leading zero. | 2026-10-13 |
| P17 | Confirmed: an organizer can set a guest's RSVP back to "No response". Rows per page offers 10, 25, 50 and 100. | 2026-10-13 |
| P18 | Confirmed: an exported cell that a spreadsheet would run as a formula is written as plain text. | 2026-10-13 |
| D42 | **"Expected attendees"** is the name shown for a guest's allowed attendees: Guests table and cards, Add/Edit Guest, details panel, import and export. The rule is unchanged (it is the most the guest can confirm). Imports accept the old "Allowed attendees" heading too. Event Settings keeps "Default Maximum Attendees per Guest". | 2026-10-13 |
| D43 | **The Guests page's Approved card** shows confirmed attendees (people), labelled "attendees"; the other cards in the strip count invitations. | 2026-10-13 |
| D44 | **Collapsible side menu:** on desktop a button in the top bar reduces the side menu to a strip of icons and restores it. Collapsed, the event selector and language selector are hidden until it is expanded. The choice is remembered in the browser. The phone drawer is unchanged. | 2026-10-13 |
| D45 | **Real WhatsApp sending, everywhere.** The WhatsApp button opens `https://wa.me/<number>?text=<message>` (full international number, digits only; message percent-encoded), in signed-up accounts and in the demo. The demo's generated guests keep undialable numbers. This replaces the earlier rule that Demo Mode only simulates a send; `AGENTS.md` was changed accordingly. | 2026-10-13 |
| D16 | **Send Test Message** opens WhatsApp with the previewed message and no recipient; the organizer picks one. Not counted, not recorded. | 2026-10-13 |
| D17 | **Formatting controls:** Bold, Italic, Strikethrough and Emoji, written as WhatsApp's own marks. No Underline and no Link button. | 2026-10-13 |
| D46 | **Recent Sent Messages "⋯" menu:** View message, and Send again (hidden for Viewers, past events and deleted guests). | 2026-10-13 |
| D47 | **Sending a message:** a confirmation shows the message first. The send is counted when WhatsApp is opened; a cancelled confirmation counts nothing. Owners and Admins only, on upcoming events. | 2026-10-13 |
| D48 | **Message template rules:** up to 1,000 characters; cannot be saved empty; a template without `{{rsvp_url}}` saves with a warning. Save Changes is added to the desktop header, which the desktop mockup lacks. Leaving with unsaved changes asks first. | 2026-10-13 |
| D49 | **Field and column labels use Title Case** in English ("Expected Attendees", "First Name", "Time Zone"), in tables, forms, dialogs titles and export headings. Sentences, hints and error messages stay in sentence case. The create-event dialog's field is "Expected Attendees per Guest". | 2026-10-13 |
| D50 | *Replaced by D51 and D52 the same day.* **Guests table layout:** every column, including the number columns, is aligned to the start, so a heading sits directly above its values in English and in Hebrew. The Table selector is wide enough to read a table's name; a guest's own table shows as "number · name", and the other choices also show their free seats. | 2026-10-13 |
| D51 | **Table alignment:** every column heading is centred, in every table. Number columns (Expected Attendees, Confirmed, Invitations Sent, Table) have their values centred, as in `guests.png`; text columns keep their values at the start. | 2026-10-13 |
| D52 | **A table has no name.** It has a number, a capacity and a shape. The name is removed from the data, the demo, the exports and the future Event Layout page, although `event_layout.png` draws one. The Guests "Table" column and selectors show the number. | 2026-10-13 |
| D53 | **Groups.** A guest can optionally belong to one group, typed in the guest form with the event's existing groups suggested; no screen manages groups, and a group exists while a guest uses it. Up to 40 characters; a name differing only in capitals joins the existing group. Guests page: a Group column, an "All Groups" filter (with "No Group"), search and sorting by group, the group in Guest Details, an optional Group column on import and a Group column in exports. Unrelated to seating. | 2026-10-13 |
| D54 | **Group and Table in the guest form.** Add Guest and Edit Guest have both fields. The seating rule is unchanged: Table can be chosen only for an Approved guest and is greyed otherwise, so always when adding. | 2026-10-13 |
| D55 | **Table guidelines apply to every data table** on desktop: headings centred; number columns centred and text columns start-aligned; English headings in Title Case; the actions column last, pinned, with its heading hidden. Applied to Guests, Unknown Guests, Recent Sent Messages and the import preview; the tables still to come (Event Layout, Permissions) follow them. The Dashboard's RSVP legend is a chart key, not a data table, and is left as it is. | 2026-10-13 |
| D56 | **Group picker.** In Add Guest and Edit Guest, Group is a dropdown of the event's groups that is searched by typing; text matching no group offers *Create "Name"*, and "No Group" clears it. Saving a guest with a group that does not exist yet asks for confirmation first; Cancel returns to the form with everything kept. A name differing only in capitals joins the existing group without asking. Import creates groups without asking. Amends D53. | 2026-10-13 |
| D57 | **Column chooser behaviour.** The whole row of a column toggles it. The chooser closes only on a click outside it, on Escape, or on its own button. The Group column comes after Table. | 2026-10-13 |
| D58 | **One dropdown design.** Every dropdown in the product looks and behaves like the Group picker in the guest form, without the create row: the Guests filters and the Table selector in each row, Rows per page, the Table field in the guest form, "Preview for" on WhatsApp Messages, the time zone and language fields, the import column matching, the language selector and the demo role selector. The column chooser keeps its own design, because it has checkboxes. | 2026-10-13 |
| D59 | **"Preview for" is searchable.** On WhatsApp Messages the guest to preview is found by typing part of the name, as in the Group picker; the list narrows as you type, and text that matches nobody says so. A dropdown can be made searchable where its list is long. | 2026-10-13 |
