# Future features

Everything that has been considered and left out of the MVP, to be developed later. Nothing here is built or scheduled unless it is moved into a phase of `PLAN.md`.

Keep this file current: whenever a feature is left out of the MVP — by a scope decision, or because a mockup shows something that will not be built now — add it here in the same change. When a feature is brought into scope, remove it from this file and add it to `docs/PRD.md` and `PLAN.md`.

## Event Layout

| Feature | Notes | Source |
|---|---|---|
| Visual Arrangement editor | View and Edit modes (default View); tables on a canvas; drag and drop; chairs and occupancy; venue objects (divider/wall, steps, stage, bar); saved coordinates and shapes; overlap and conflict handling; mobile viewing. Planned as `PLAN.md` Phase 20. In the MVP the Table Arrangement tab is shown with a "Soon" badge and is disabled. | PRD §11.4; mockups `event_layout.png`, `event_layout_arrangement_mobile.png`; owner decision 2026-10-12 |
| Arrangement Preview panel | The read-only floor-plan preview and "Open Arrangement" button shown beside the tables list, and the mobile read-only floor plan with Fullscreen. | Mockups `event_layout.png`, `event_layout_arrangement_mobile.png`; owner decision 2026-10-12 |
| Additional venue objects | Food station, entrance, decorative plants. Shown in the Arrangement mockups but not in the PRD's object list. | Mockups |
| Per-seat assignment | Assigning attendees to individual chairs. | PRD §17; `PLAN.md` backlog |
| Splitting a party across tables | In the MVP a guest's whole party sits at one table. | PRD §11.2, §17 |
| Venue templates | Reusable venue layouts. | `PLAN.md` backlog |
| Table summary export | One row per table: Table Number, Capacity, Assigned, Remaining. The MVP exports the seating list only. | PRD §11.3 before 2026-10-13; owner decision 2026-10-13 (D70) |
| Adding several tables at once | For example ten tables of twelve chairs in one step. In the MVP tables are added one at a time. | Owner decision 2026-10-13 (D71) |
| Table names | A name beside the table number ("Family"), as drawn in `event_layout.png`. | Mockup; owner decision 2026-10-13 (D52) |

## Guests and RSVP

| Feature | Notes | Source |
|---|---|---|
| Individual attendee records | Names or details for each person in a party. In the MVP attendees are only counted. | PRD §17 |
| Guest-specific RSVP URLs | One link per guest. The MVP has one shared link per event. | PRD §17 |
| Translating organizer-written RSVP texts | A guest can switch the public RSVP page between English and Hebrew, but the welcome and response messages are shown as the organizer wrote them. Translating them, or letting the organizer write each in both languages, is not built. | Owner decision 2026-10-13 |
| More guest-facing languages | Languages beyond English and Hebrew on the public RSVP page. | PRD §17 |
| Choosing which details the phone guest cards show | On a phone the guest cards always show the same details; the column chooser applies to the desktop table only. | Owner decision 2026-10-13 |
| Default country per event | Reading and showing phone numbers by the event's country instead of always Israel, so an event held abroad can use local numbers. Needs a phone-number library with each country's rules. | Owner decision 2026-10-13 |
| Country selector for a phone number | A searchable country list in Add and Edit Guest, in import (per file) and on the public RSVP form, for a guest from a country other than the event's. | Owner decision 2026-10-13 |
| Switching the RSVP page off, or replacing its link | The page is active until the event starts and its link never changes. | Owner decision 2026-10-13 (D64) |
| Calendar entry that follows the event | The Google Calendar action keeps its own date and time once set; it does not move when the event's date is changed. | Owner decision 2026-10-13 (D60) |
| Add to Group on a phone | Selecting several guests exists only in the desktop table. | Owner decision 2026-10-13 (D66) |
| Configurable RSVP deadline | Closing RSVP earlier than the event start. | PRD §17; `PLAN.md` backlog |
| Proving phone ownership on the RSVP page | A code sent by SMS or WhatsApp before an answer is saved, so nobody can answer for a guest whose number they know. Needs a paid messaging provider. The MVP limits submissions per address and per phone instead. | Owner decision 2026-10-14 (D2) |
| CAPTCHA on the RSVP page | A check against automated submissions. Not needed while the rate limits hold. | Owner decision 2026-10-14 (D2) |

## Messaging

| Feature | Notes | Source |
|---|---|---|
| Emailing guests their invitation | Sending a guest the invitation by email, as the WhatsApp send does, with the same counting; the natural channel for business events (see Event types under Event management). The email provider exists since Phase 17 (D88), and the email design is set (D93). | Owner decision 2026-10-15 |
| WhatsApp Business API sending | Sending from the system, rather than opening WhatsApp for the organizer to send. | PRD §17 |
| Bulk sending | Sending to many guests in one action. | PRD §17 |
| Automated reminders | Scheduled follow-ups to guests who have not responded. | PRD §17 |
| Delivery, read and failure tracking | The MVP records only that a send was initiated. | PRD §7.1, §17 |
| Dragging the RSVP picture | Moving the background picture by dragging it in the preview and zooming with a pinch or the mouse wheel, on top of the Additional Options sliders (D96). | Owner request 2026-10-15 |
| Variables as chips inside the editor | The mockup draws each variable as a highlighted chip within the message text. In the MVP the editor is a plain text box. | Mockup `whatsapp_message.png`; Phase 8 |
| Test message to a saved number | Send Test Message opens WhatsApp with no recipient. Keeping the organizer's own number for one-click tests is not built. | Owner decision 2026-10-13 |

## Event management

| Feature | Notes | Source |
|---|---|---|
| Budget | Sidebar entry shown in two mockups. No requirements written. | Mockups `event_layout.png`, `permissions.png`; PRD §17; owner decision 2026-10-12 |
| Vendors | Sidebar entry shown in two mockups. No requirements written. | Same |
| Timeline | Sidebar entry shown in two mockups. No requirements written. | Mockups `event_layout.png`, `permissions.png`; owner decision 2026-10-12 |
| Photo Sharing | Sidebar entry shown in two mockups. No requirements written. | Same |
| Payments and full event-production management | | PRD §17 |
| Reusable event templates | | PRD §17 |
| Exact event location with Google | Choosing the place with Google's address search in Event Settings (storing its place id, address and coordinates), and a small map on the RSVP page. Needs a Google Cloud project, an API key restricted to the app's domain and a billing account; best done with deployment, once the domain exists. Today the Google Maps and Waze links search for the location as typed (D97). | Owner question 2026-10-15 |
| Event types: personal and business | Each event gets a type. Personal events are weddings, birthdays and the like, as today. Business events are run for companies, where guests are usually invited by email rather than WhatsApp (see "Emailing guests their invitation" under Messaging). What the type changes beyond the invitation channel (texts, RSVP fields, defaults, cover) has no requirements yet. | Owner request 2026-10-15 |
| Duplicating an event with its guest list | In the MVP a duplicate copies the event's details, RSVP settings, message template and tables, without guests. | Owner decision 2026-10-12 |
| Recoverable event deletion | Restoring a deleted event within a period. In the MVP deletion is permanent. | Owner decision 2026-10-12 |

## Account and application shell

| Feature | Notes | Source |
|---|---|---|
| More notifications | The bell is built (D95) for access, roles and unknown RSVP answers. Not built: other triggers (each RSVP answer, invitations sent, event changes by others), choosing which notices to get, and sending them by email or as phone push notices. | Owner decision 2026-10-15 |
| Profile page | Sidebar entry on the homepage mockup. No requirements written. | Mockup `homepage.png`; owner decision 2026-10-12 |
| Account settings | Sidebar entry on the homepage mockup. No requirements written. | Mockup `homepage.png`; owner decision 2026-10-12 |
| "How it works" section | A header link on the landing page mockup with no matching section. | Mockups `landing_page.png`; Phase 4 plan approved 2026-10-13 |
| Account management | Changing one's name, email or password from the application. No requirements written. (Forgot password by email was built in Phase 17, D88.) | Phase 4 plan approved 2026-10-13 |
| Help, Privacy and Terms pages | The email mockup's footer links to them; they are left out of the emails until the pages exist (D93). Terms and Privacy are needed before real users. | Mockup `event_collaboration_email.png`; 2026-10-15 |
| Editable system settings page | Changing the email settings from the System page. The page is read-only by design: settings and secrets stay in the server configuration. | Owner decision 2026-10-15 (D91) |
| Dedicated tablet layouts | In the MVP only desktop and phone layouts are designed and verified; a tablet gets whichever fits its width. | PRD header and §13; owner decision 2026-10-12 |

## Permissions

| Feature | Notes | Source |
|---|---|---|
| Expiry of invitations | A pending invitation stays until it is used or cancelled. (Invitation emails and resending them were built in Phase 17 and are sent when email is on, D90.) | Owner decision 2026-10-13 (D4) |
| Assigning Super User in the interface | Database only in the MVP (`npm run super-user` in `backend/`). | PRD §3.2 |
| A demo event the demo user does not belong to | To show Super User access without a membership; covered by automated tests only. | Owner decision 2026-10-13 (P8) |

## Quality and review

| Item | Notes | Source |
|---|---|---|
| Review of the Hebrew texts by a Hebrew speaker | All Hebrew texts were written by the coding agent. The owner chose a side-by-side sheet (2026-10-15): `docs/hebrew-review.xlsx`, written by `npm run hebrew-review` in `frontend/`. Corrections are applied when the owner returns it. Tracked in `PLAN.md` Phase 17. | Owner decisions 2026-10-13 (D74) and 2026-10-15 |
| Checking that an uploaded picture is a real image | The server accepts a JPEG or PNG data address without reading the file's own signature. It always serves it as an image with `nosniff`, so a browser never runs it; checking the content is hardening for later. | Phase 17 security review |
| Design-system showcase page | The `/showcase` gallery of shared components was removed from the application. | Owner decision 2026-10-13 (D73) |

## Analytics and history

| Feature | Notes | Source |
|---|---|---|
| Advanced analytics | Beyond the Dashboard KPIs in PRD §10. | PRD §17 |
| Audit history | A record of who changed what. | PRD §17 |

## Demo Mode

| Feature | Notes | Source |
|---|---|---|
| Server-backed expiring demos | Only if browser-local Demo Mode proves insufficient. (The browser-local demo expires on its own since 2026-10-15: 3 days, or 12 hours without activity, D99.) | `PLAN.md` backlog |
