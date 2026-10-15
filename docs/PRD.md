# Event Planner — Product Requirements Document

**Version:** 1.1  
**Status:** Product baseline for POC/MVP development  
**Primary market:** Israel  
**Supported languages:** English and Hebrew  
**Supported devices:** Desktop and mobile browsers (tablets receive the desktop or mobile layout that fits their width; dedicated tablet layouts are deferred)  
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

A visitor first sees a landing page with three ways in: **Sign Up** (create an account, then the Events homepage), **Sign In** (the Events homepage) and **Try Demo** (the populated demo, no account; section 12). A signed-out visitor who opens an application address is sent to the landing page.

Authenticated users see an Events homepage containing events they can access. Each event card shows at minimum the name and date, and opens that event; it also shows the time, maximum attendees, confirmed attendees against capacity, whether the event is upcoming or past, and the user's role. The list can be filtered (all, upcoming, past) and searched by name. Users can have different roles in different events. A new account has no events until it creates one or is given access to one.

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
- On a past event, permissions can be changed only by an Owner or a Super User. An Admin can still open the Permissions page and see who has access, but cannot invite, change or remove anyone.
- All restrictions must be enforced by the server, not only by hiding UI controls.

### 3.3 Permissions page

This is the final page in event navigation, after Event Settings. It contains a table showing at least **Name**, **Email**, **Permission Type**, and authorized actions. An authorized user can grant, change, and remove permitted event memberships. A user can belong to multiple events. Viewer cannot see this page or retrieve its data using backend APIs.

The page shows a short explanation of the roles, the number of Owners, Admins and Viewers, and the members list with a search by name or email and a role filter. The user's own line is marked "You" and offers no action.

**Invite User** asks for an email and a role (an Admin can offer only Admin and Viewer):

- An email that belongs to an account becomes a member at once.
- Any other email is kept as a **pending invitation**. It is listed with a "Pending" badge and no name, and becomes a membership with the invited role when an account is created with that email. No email is sent in the MVP; the organizer tells the person to sign up.
- A pending invitation's role can be changed and the invitation cancelled, under the same rules as a member's. It is not a membership: it gives no access, is not counted in the role figures and does not count as one of the event's Owners.
- An email that is already a member or already invited is refused. Accounts are never listed or searched, so the page does not reveal who has an account.
- Deleting an event removes its invitations; duplicating an event does not copy them.

Sending invitation emails, reminders and expiry of invitations are deferred (`docs/FUTURE_FEATURES.md`).

For the POC an email address is not verified at sign-up (owner decision 2026-10-14). Whoever signs up with an invited email receives that invitation's access. Email verification must be in place before real users (`PLAN.md` Phase 17).

## 4. Product information architecture

### 4.1 Account level

- Landing page
- Sign up and sign in
- Homepage / Events list
- Create event
- Open event
- Public Demo Mode entry without sign-in

### 4.2 Event level

1. Dashboard
2. Guests
3. RSVP (RSVP Settings)
4. Messages (WhatsApp Messages)
5. Event Layout
6. Event Settings
7. Permissions

The event navigation is identical on every event-level page and uses this order. The event selector, which shows the current event and switches between events, sits at the top of the sidebar. Permissions is not shown to Viewers. Entries that appear in some mockups but are not listed here (Budget, Vendors, Timeline, Photo Sharing) are not part of the MVP; see `docs/FUTURE_FEATURES.md`.

Inside an event, the user's avatar carries an icon for their role in that event, using the same icons as the role badges on the Permissions page: crown for Owner, shield for Admin, people icon for Viewer. A Super User without a membership in the event shows the Owner crown. No role icon is shown outside an event, including the Homepage.

The notification bell and the Profile and Settings entries that appear in the mockups are not part of the MVP; see `docs/FUTURE_FEATURES.md`.

On desktop the side menu can be collapsed to a strip of icons and expanded again; the choice is remembered in the browser.

Use concise navigation labels that match the product's UI language.

The mockups were created after the PRD. Where a mapped mockup differs from or adds to the PRD, build what the mockup shows (layout, navigation, fields, panels, buttons). The PRD remains the source of truth for business rules (calculations, validation, permissions, RSVP and seating behavior, lifecycle), and is updated in the same phase so that it stays accurate. Where a mockup element's behavior is not evident, it is confirmed with the product owner rather than inferred.

## 5. Events and lifecycle

### 5.1 Create and edit event

| Field | Requirement |
|---|---|
| Event name | Required |
| Maximum attendees | Required integer; **minimum 50, default 300, maximum 3000** |
| Event date and time | Required |
| Time zone | Required; the event's date and time are expressed in it |
| RSVP language | The default language of the public RSVP page, English or Hebrew. Chosen when the event is created and changed on RSVP Settings; a guest can switch (section 8) |
| Default allowed attendees per guest | Default 5; event-configurable integer from 1 to 10 |
| Location | Optional; shown in the event selector and on the public RSVP page. Edited in Event Settings |
| RSVP title | Optional short title for the public RSVP page; the event name is used when empty |
| Event photo | Optional; JPG or PNG up to 5 MB, uploaded in Create Event and Event Settings and removable. Shown on the event card and in the event selector; a duplicate keeps it. Without one, a cover is generated for the event |

The event creator becomes an Owner. A new event must start in the future, and an existing event's date and time can only be changed to a time in the future. Changing the time zone keeps the date and time as typed. Changing the default allowed attendees affects only guests added afterwards. The application UI language can differ from the event's default guest-facing RSVP language.

Event Settings edits the name, location, maximum attendees, date, time, time zone and default allowed attendees. It shows a capacity summary with the Dashboard's figures and warnings, and a **View Event Rules** dialog listing the rules in this section. Leaving the page with unsaved changes asks for confirmation.

### 5.2 Past events

Once an event's date/time is reached (interpreted in its configured timezone), it becomes **read-only** through normal product flows. Users may view pages and download exports. They may not edit settings, guests, RSVP, messages, tables, seating, or other operational data; public RSVP submissions close at the event start. Permissions are the exception: an Owner or Super User can still change them, so that access to a finished event can be given or taken away (section 3.2). Apply these rules in the backend, not only the UI.

### 5.3 Duplication and deletion

Only Owners and Super Users may duplicate or delete events. Both are allowed on past events.

**Duplicate** creates a new event from an existing one, under a new name and a new start date and time (which must be in the future):

| Copied | Not copied |
|---|---|
| Event details (time zone, maximum attendees, default allowed attendees, RSVP language, location, RSVP title) | Guests and their RSVP responses |
| RSVP settings | Unknown RSVP responses |
| Message template | Sent-message history and invitation counters |
| Tables (number, capacity, shape), with nobody seated | Other members and their roles |

The person duplicating becomes the Owner of the new event, which gets its own public RSVP link.

**Delete** is permanent: the event and all its guests, responses, messages, tables and memberships are removed, and its public RSVP link stops working. The user confirms by typing the event's name. There is no recovery period in the MVP.

## 6. Guest management

### 6.1 Guest model

A Guest represents an invitation/party and may stand for multiple actual attendees. Each guest belongs to exactly one event.

| Field | Meaning |
|---|---|
| First name / Last name | Organizer-maintained identity |
| Invitation name | Guest-entered name on the RSVP form; may differ from the organizer's name |
| Phone number | Required; guest identifier within the event |
| Normalized phone | Internal matching and uniqueness value |
| Allowed attendees | Maximum attendees the invitation may approve. Shown to organizers as **Expected attendees** |
| Confirmed attendees | Actual approved count; see RSVP rules |
| RSVP status | `NO_RESPONSE`, `APPROVED`, `NOT_SURE`, `DECLINED` |
| Invitation sent count | Nonnegative, starts at `0`, increases on each system-initiated WhatsApp action |
| Last invitation sent at / Last RSVP response at | Operational timestamps |
| Table | Nullable assignment; only Approved guests are assignable |
| Group | Optional. The organizer's own grouping of guests (for example "Family"), up to 40 characters; unrelated to seating. A group exists while a guest uses it; a name differing only in capitals joins the existing group |
| Deleted | Soft-delete marker, default `0` |

A normalized phone number is unique **within each event**. In the MVP a number written without `+` is read as an Israeli number, in any local or `+972` form; a number from another country is entered with `+` and its country code. A number that is local to another country is refused, not read as Israeli. Israeli numbers are shown in local form (`050-730-8828`) everywhere, including exports, however they were entered; foreign numbers are shown with their country code. The same rule applies to imported files and to the public RSVP form.

### 6.2 Soft deletion and restoration

Deleting a guest sets `deleted = 1`. Deleted guests are absent from ordinary lists, analytics, and exports. If the same normalized phone is subsequently added within that event, update and reactivate the existing record (`deleted = 0`) rather than inserting a duplicate. Restoration must not accidentally surface stale seating information or invalid RSVP state. The rule is: the restored guest takes the name, phone and allowed attendees just entered; the RSVP returns to No Response with no confirmed attendees, no invitation name and no table; the invitation-sent count and last-sent time are kept, because the counter never decreases. Soft-deleting a guest also frees their table seats.

### 6.3 Guests screen

- Known Guests list with create, view, update, soft-delete, search, and sortable columns.
- Search by first name, last name, full name, Invitation Name, group, and phone number. Filter by RSVP status, invitation status, table and group.
- Show group, attendee allowance, confirmed count, RSVP status, invitation counter, and Table Number (if assigned). Column headings are centred, and so are the number columns.
- Add Guest and Edit Guest include Group and Table. Group is a dropdown of the event's groups that can be searched by typing; a name that matches no group can be created, after a confirmation when the guest is saved. Table can be chosen only for an Approved guest, so it is greyed when adding a guest.
- Import accepts an optional Group column; exports include it.
- Allow authorized users to manually update RSVP status, confirmed attendees, and table assignments subject to the same rules as public RSVP and Event Layout.
- Provide a WhatsApp action for each guest.
- Desktop table and intentionally adapted mobile list/card layout.
- CSV and XLSX import, with field mapping, preview, validation, duplicate detection, and error reporting. Each imported row is checked like a guest added by hand. A row whose phone an active guest already has, or that repeats a phone from earlier in the file, is skipped and reported; an import never changes an existing guest. A phone belonging to a soft-deleted guest restores that guest (section 6.2). Up to 5,000 rows and 5 MB per file.
- Guest export as CSV and as Excel (XLSX). An export contains every field, whatever columns are visible on screen. Text that a spreadsheet would run as a formula is exported as plain text, because invitation names are typed by guests.
- Selecting rows offers three bulk actions: delete the selected guests (with confirmation), export the selected guests, and add them to a group (a guest who already has a group changes group; an empty choice removes them from their groups). Bulk sending is out of scope (section 17).
- On desktop, a column chooser lets the organizer show or hide table columns. Name and Phone are always shown. The choice is remembered in the browser. Clicking anywhere on a column's row toggles it, and the chooser stays open until a click outside it or Escape.
- Every dropdown in the product shares one design (the product's own list, not the browser's); the column chooser, with its checkboxes, is the exception.
- Every data table in the product follows the same guidelines on desktop: headings centred; number columns centred and text columns start-aligned; English headings in Title Case; the actions column last, pinned, with its heading hidden.
- A guest's details can be opened in a panel from the list.
- Status labels: a guest with no invitation sent and no response is shown as **Not Sent**; **Awaiting Response** is used only once an invitation has been sent.
- Unknown Guests tab (see section 8).

## 7. WhatsApp messages and invitation counting

The organizer configures one reusable event-level WhatsApp message, with useful substitutions such as event name/date/time, guest name, and shared RSVP URL. The interface includes message editing and preview as represented in the mockups. The supported variables are `first_name`, `last_name`, `event_name`, `event_date`, `event_time` and `rsvp_url`. Each send initiated from the system is also recorded individually (time, guest and the message as sent), which is what the Recent Sent Messages list shows.

### 7.1 MVP send behavior

An authorized organizer selects a guest and invokes the WhatsApp button, on the Guests page or with **Send again** in Recent Sent Messages. The system shows the message for that guest and, on confirmation, opens `https://wa.me/<number>?text=<message>`: the number is the guest's full international number, digits only, and the message is percent-encoded. WhatsApp or WhatsApp Web opens with the message ready; the organizer presses Send there.

- `invitation_sent_count` begins at `0` and **only increases**.
- Each system-initiated WhatsApp action increments the guest counter by exactly `1` and records its time.
- The MVP cannot verify whether WhatsApp's final Send action or delivery occurred; the counter therefore measures **send attempts initiated from Event Planner**, not verified deliveries.
- Repeated sends to one guest do **not** increase the distinct Invitations Sent Dashboard KPI more than once.
- Viewer cannot invoke message actions.
- The send is counted when WhatsApp is opened. A cancelled confirmation counts nothing.

### 7.2 Template editor

- The template is plain text, up to 1,000 characters, and cannot be saved empty. A template without `{{rsvp_url}}` can be saved but shows a warning. A placeholder that is not a supported variable is sent as written and is pointed out.
- Formatting uses WhatsApp's own marks: `*bold*`, `_italic_`, `~strikethrough~`. The toolbar offers these and a small set of emoji; the preview shows the result. There is no underline or link button: WhatsApp has no underline and turns addresses into links by itself.
- The preview shows the message for a chosen guest, or for a sample guest when the event has none. Dates and times in a message are written in the event's default RSVP language and time zone.
- **Send Test Message** opens WhatsApp with the previewed message and no recipient, so the organizer chooses one. It is not counted or recorded.
- **Recent Sent Messages** lists sends newest first, ten per page, with **View message** and **Send again**.

## 8. RSVP

### 8.1 One public link per event

Each event can generate **one public RSVP URL**, shared by every guest. No guest-specific RSVP tokens or authenticated guest accounts are required for the MVP.

The form requests the guest's **name, phone number, number of attendees, and response**. Number of attendees is **always required**, whichever response the guest chooses. When the response is Declined or Not Sure the submitted number is discarded and the stored values follow section 8.3. The guest's submitted name populates Invitation Name, without overwriting organizer-maintained first and last name.

### 8.2 Identification

- Normalize entered phone number.
- If it matches an active guest in the event, update that guest's RSVP data.
- If no active guest matches, record the submission under Unknown Guests for organizer review rather than silently adding it to the known guest list.
- One phone cannot identify multiple guests in the same event.

Since this is a public form, phone matching is identification for the product workflow, **not proof of phone ownership**. The implementation must consider spam, abuse prevention, and reasonable privacy protections without inventing a mandatory verification feature not specified in the PRD.

Abuse safeguards (decision D2):

- At most **10 submissions per 10 minutes from one IP address**, and **3 accepted submissions per 10 minutes for one phone number** of an event. A refused submission saves nothing and asks the guest to try again in a few minutes. A submission refused for another reason does not count towards the phone's limit. Both values are server settings.
- The response to a submission is the same whether or not the phone belongs to a guest, and the page never shows stored guest details. The one difference a guest can see is the attendee limit when the count is too high: a guest's own allowance, or the event default for an unknown phone.
- There is no CAPTCHA and no phone verification. Someone who knows a guest's phone number can answer for that guest; the organizer sees the latest answer and can correct it.

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
- An unknown responder may approve up to the event's default allowed attendees. A second submission from the same unknown phone replaces the first.

### 8.4 RSVP Settings page

The organizer can configure:

- The public RSVP URL, which every event has from creation: copy it, or show it as a QR code that can be downloaded. The page is active until the event starts and closed afterwards; there is no off switch.
- RSVP title (optional; the event name is used when empty).
- Welcome text, Approved, Declined and Not Sure messages, up to 500 characters each. An empty message shows a standard text in the guest's language.
- RSVP background image (JPG or PNG, up to 5 MB) and a darkening overlay from 0 to 100%.
- Optional Google Calendar action with its own title, date, time and location, starting from the event's values. The entry lasts three hours.
- Optional YouTube link after approval. Only `https` addresses on `youtube.com` or `youtu.be` are accepted.
- The default RSVP language.
- A live preview of the public page, including unsaved changes, for each of its four states.
- Mobile Settings and Preview tabs as mapped in `mockups/README.md`.

On the public page the three response buttons send the answer directly. The guest then sees the matching message and can change the answer until the event starts. After an approval the calendar and YouTube actions open the real pages in a new tab. A link that matches no event shows a plain "not available" page.

The public RSVP opens in the event's default RSVP language, English or Hebrew, set on RSVP Settings. A guest can switch the page to the other language. Texts the organizer wrote (the welcome and response messages) are shown as written in either language; translating them is deferred (section 17).

## 9. Unknown Guests

Unknown Guests are RSVP submissions whose normalized phone did not match an active known guest. Their review list shows submitted name, phone, response, attendee count where relevant, and submission time.

Authorized organizers can:

- Review an unknown response.
- Add/convert it to a known guest, preserving response data.
- Match/merge it with a known guest, with deterministic duplicate resolution.
- Reject an unknown record. A rejected record leaves the review list and is kept in a Rejected list, from which it can be restored.

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

All ten figures are shown as KPI cards, each stating what it counts: invitations (guest records), people (attendees) or chairs.

The RSVP Status chart places every active guest in exactly one group — Approved, Declined, Not Sure, Awaiting Response, or not yet invited (no invitation sent and no response) — so the groups add up to Total Guests. The last group is labelled Not Sent.

The Recent Guest Activity list is derived from existing records: every recorded send, and each guest's latest RSVP response. No separate activity record is kept, so a guest who changed their answer appears once, with the latest answer. A response changed by an organizer counts as the guest's latest response. Activity times are shown in the viewer's own time zone.

The Dashboard has an **Event Settings** button that opens the Event Settings page, and a Quick Actions panel of shortcuts to other pages of the event.

### 10.1 Warnings

- Confirmed attendees exceed event Maximum Attendees.
- **Not enough seats:** confirmed attendees exceed the sum of table chairs. Shown as a warning (amber).
- Sum of table chairs is **above** or **below** event Maximum Attendees while every confirmed attendee has a seat: shown as information (green), not as a warning.
- A table exceeds its configured capacity due to an RSVP change.
- Confirmed attendees are awaiting table assignment (operational indicator).

Table-total mismatch is **nonblocking**, including when chairs exceed the event maximum.

## 11. Event Layout — Tables and seating

### 11.1 Tables

The organizer can create, view, update, and delete tables. Each table has a unique number within its event, a capacity (number of chairs), and a shape: **circle, rectangle, or square**.

Tables display assigned/available chairs and guests. Authorized users can assign or unassign guests both from the Tables view and from the Table field in Guests.

Each table carries a status from its free seats: **Over Capacity** (more attendees seated than chairs), **Full** (no seat free), **Almost Full** (1 or 2 seats free), **Ready** (otherwise).

A table's capacity may be lowered below the attendees already seated; the table is then Over Capacity.

### 11.2 Seating business rules

- Only **Approved** guests may be assigned.
- In the MVP, a guest's entire invitation party is assigned to **one table**; splitting across tables is not supported.
- A manual assignment that would exceed a table's remaining capacity is rejected with a clear error.
- A later RSVP increase that causes the existing assignment to exceed capacity is accepted, and the table is flagged as conflicted.
- Declined/Not Sure transition automatically clears a previous table assignment.
- Deleting a populated table requires confirmation and leaves affected guests unassigned; it never deletes guests.
- Event Maximum Attendees and the sum of chairs should ideally match, but a mismatch is allowed and produces a warning rather than a blocked save.

### 11.3 Seating export

Support **CSV and XLSX** exports of the seating list for venue operations: one row per seated party, ordered by table number, with First Name, Last Name, Invitation Name, Phone (as dialled locally), Number of Attendees (confirmed) and Table Number.

A per-table summary export is deferred (`docs/FUTURE_FEATURES.md`).

Exports remain available after an event becomes Past.

### 11.4 Arrangement canvas scope

The visual venue blueprint/Arrangement editor is currently a **post-MVP feature** unless explicitly promoted into POC scope. The planned capability includes View and Edit modes (default View); tables on a canvas; drag/drop; chairs and occupancy; venue objects such as divider/wall, steps, stage, and bar; persistent coordinates and shapes; and overlap/conflict handling. Mobile viewing is required; full editing may be desktop/tablet-oriented.

The existing Arrangement mockups remain applicable visual guidance even while implementation is deferred.

In the MVP the Event Layout page shows the **Table Arrangement** tab with a "Soon" badge, disabled and not selectable. The Arrangement Preview panel shown in the mockups is not displayed.

## 12. Public Demo Mode — MVP requirement

Demo Mode is a **permanent user-facing product capability**, not a disposable development fixture.

### 12.1 Entry and scope

- Visitors can choose **Try Demo** on the landing page without authenticating. Leaving the demo (Log out) returns to the landing page and keeps the visitor's demo data.
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

- Demo WhatsApp actions open the same WhatsApp link as the product (owner decision 2026-10-13). The generated demo guests have fictional, undialable numbers, so WhatsApp reports that the number is not on WhatsApp.
- Do not send real emails, create real calendar events, or invoke other irreversible integrations from Demo Mode.
- Demo-generated names/phone numbers must be fictional and safe for demonstration.
- Demo roles are UI/workflow simulations and must not confer real backend access.
- Server authorization must never trust a client-declared demo flag.

### 12.5 Demo acceptance criteria

A new visitor can open Demo Mode without login, see a populated event, create/edit/delete demo guests, manipulate RSVP statuses, observe recalculated analytics, change seating where permitted, explore mobile and Hebrew/RTL screens, refresh without losing changes, and reset to the deterministic initial state. No action can alter another visitor's or a real customer's data.

## 13. Internationalization and mobile requirements

- Admin interface languages: English (`en`) and Hebrew (`he`), with a user-selectable interface language.
- Hebrew uses a first-class RTL layout; English uses LTR.
- The event's default guest-facing RSVP language is configured separately, on RSVP Settings; each guest can switch the public RSVP page between the two languages.
- Translate all user-facing copy, including validation errors, statuses, confirmation dialogs, empty states, and demo controls.
- Handle phone numbers, URLs, email addresses, dates, and other mixed-direction values intelligibly in Hebrew.
- All core pages and workflows must work on mobile. Desktop tables should be adapted into usable mobile patterns rather than simply shrunk.
- On a phone, form pages that are saved (Event Settings, WhatsApp Messages, RSVP Settings) show their actions in a bar pinned to the bottom of the screen. The bar is aligned with the page content, its buttons share the width equally, and it never covers the end of the page.
- Desktop and phone layouts are designed and verified for the MVP. Tablets are not a separate target: they receive whichever of the two layouts fits their width.
- The mobile tab structure in the RSVP Settings, WhatsApp Message, and Event Layout mockups is intentional and should be followed.
- Follow accessible focus, label, contrast, and keyboard interaction practices.

## 14. Visual design and mockup mapping

`mockups/README.md` is the authoritative mapping for individual desktop and mobile reference images. The known mappings are:

| Page | Desktop | Mobile |
|---|---|---|
| Landing page | `landing_page.png` | `landing_page_mobile.png` |
| Homepage / Events | `homepage.png` | `homepage_mobile.png` |
| Dashboard | `dashboard.png` | `dashboard_mobile.png` |
| Guests | `guests.png` | `guests_mobile.png` |
| Event Layout | `event_layout.png` | `event_layout_tables_mobile.png`; `event_layout_arrangement_mobile.png` |
| RSVP Settings | `rsvp_settings.png` | `rsvp_settings_settings_mobile.png`; `rsvp_settings_preview_mobile.png` |
| WhatsApp Message | `whatsapp_message.png` | `whatsapp_message_editor_mobile.png`; `whatsapp_message_preview_mobile.png` |
| Event Settings | `event_settings.png` | `event_settings_mobile.png` |
| Permissions | `permissions.png` | `permissions_mobile.png` |

Where a direct mockup is unavailable (including certain dialogs, public RSVP states, and Unknown Guests), use the established visual language and reusable components. Preserve mockups as the primary visual reference but adapt for function, accessibility, mobile, and RTL.

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

`docs/FUTURE_FEATURES.md` is the maintained list of everything left out of the MVP, including items shown in mockups that are not being built. Unless separately approved for the POC:

- Visual Arrangement canvas editor (the planned post-MVP phase).
- Automated WhatsApp Business API delivery, bulk sending, reminders, and delivery/read tracking.
- Guest-specific RSVP URLs, guest-facing languages beyond English and Hebrew, and translation of organizer-written RSVP texts.
- Individual attendee entities, group splitting, and seat-level assignment.
- Vendor, budget, payment, and full event-production management.
- Advanced analytics, audit history, reusable event templates, and configurable early RSVP deadlines.

## 18. Decisions that still need confirmation

These do not block creation of the PRD, but should be resolved at the relevant implementation stage rather than inferred:

1. ~~**Unknown RSVP attendee limit:** What maximum applies to an unknown responder before organizer review?~~ Resolved 2026-10-12: the event's default allowed attendees (section 8.3).
2. ~~**Public RSVP abuse prevention:** What rate limits or additional verification are appropriate without creating an unnecessarily difficult guest experience?~~ Resolved 2026-10-14: rate limits only (section 8.2).
3. ~~**Event duplication/deletion semantics:** Which records are copied and how long deleted events remain recoverable?~~ Resolved 2026-10-12: section 5.3.
4. ~~**Permission invite flow:** What happens when an organizer grants access to an email not yet registered?~~ Resolved 2026-10-13: a pending invitation that becomes a membership at sign-up (section 3.3).
5. ~~**Deleted guest restoration:** Which prior RSVP and seating values should be preserved, cleared, or reviewed on restoration?~~ Resolved 2026-10-12: fresh RSVP, no table, invitation counter kept (section 6.2).
6. ~~**Visual Arrangement in POC:** Keep deferred, or explicitly promote to POC scope?~~ Resolved 2026-10-12: stays deferred. The tab is shown as "Soon" and disabled, with no preview panel (section 11.4).

## 19. Document ownership and change control

- `docs/PRD.md` (this document) defines **product behavior and acceptance expectations**.
- `AGENTS.md` defines coding-agent rules and technical constraints.
- `PLAN.md` defines implementation sequencing, validation gates, and a living progress log.
- `mockups/README.md` maps screens/tabs to their reference images.
- `docs/FUTURE_FEATURES.md` lists features left out of the MVP.

If technical implementation uncovers a conflict or unspecified product behavior, record the decision and update this PRD rather than silently changing functionality. Keep completed plan steps and implementation notes in `PLAN.md`, not here.
