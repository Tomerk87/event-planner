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
| WhatsApp Business API sending | Sending from the system, rather than opening WhatsApp for the organizer to send. | PRD §17 |
| Bulk sending | Sending to many guests in one action. | PRD §17 |
| Automated reminders | Scheduled follow-ups to guests who have not responded. | PRD §17 |
| Delivery, read and failure tracking | The MVP records only that a send was initiated. | PRD §7.1, §17 |
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
| Duplicating an event with its guest list | In the MVP a duplicate copies the event's details, RSVP settings, message template and tables, without guests. | Owner decision 2026-10-12 |
| Recoverable event deletion | Restoring a deleted event within a period. In the MVP deletion is permanent. | Owner decision 2026-10-12 |

## Account and application shell

| Feature | Notes | Source |
|---|---|---|
| Notifications | The bell shown in the top bar of every mockup. No requirements written: what triggers a notification and where it is listed are undefined. | All mockups; owner decision 2026-10-12 |
| Profile page | Sidebar entry on the homepage mockup. No requirements written. | Mockup `homepage.png`; owner decision 2026-10-12 |
| Account settings | Sidebar entry on the homepage mockup. No requirements written. | Mockup `homepage.png`; owner decision 2026-10-12 |
| "How it works" section | A header link on the landing page mockup with no matching section. | Mockups `landing_page.png`; Phase 4 plan approved 2026-10-13 |
| Password reset and account management | No requirements written. Real sign-in arrives with the backend (`PLAN.md` Phase 14). | Phase 4 plan approved 2026-10-13 |
| Dedicated tablet layouts | In the MVP only desktop and phone layouts are designed and verified; a tablet gets whichever fits its width. | PRD header and §13; owner decision 2026-10-12 |

## Permissions

| Feature | Notes | Source |
|---|---|---|
| Invitation emails | Telling an invited person by email, with a link to sign up. In the MVP nothing is sent; the organizer tells them, and the invitation waits until they sign up. | Owner decision 2026-10-13 (D4) |
| Resending and expiry of invitations | A pending invitation stays until it is used or cancelled. | Owner decision 2026-10-13 (D4) |
| Assigning Super User in the interface | Database only in the MVP (`npm run super-user` in `backend/`). | PRD §3.2 |
| Email verification at sign-up | Required before real users; without it anyone can sign up with an invited email. Tracked in `PLAN.md` Phase 17. | Owner decision 2026-10-14 |
| Password reset | "Forgot password" by email. Needs an email provider. | Phase 14 scope |
| A demo event the demo user does not belong to | To show Super User access without a membership; covered by automated tests only. | Owner decision 2026-10-13 (P8) |

## Quality and review

| Item | Notes | Source |
|---|---|---|
| Review of the Hebrew texts by a Hebrew speaker | All Hebrew texts were written by the coding agent. The owner accepted them as they are for now. **Ask the owner again how to do the review when this is taken up** (the choices offered on 2026-10-13 were: a side-by-side sheet of English and Hebrew to correct, or going through the pages in Hebrew). Tracked in `PLAN.md` Phase 17. | Owner decision 2026-10-13 (D74) |
| Design-system showcase page | The `/showcase` gallery of shared components was removed from the application. | Owner decision 2026-10-13 (D73) |

## Analytics and history

| Feature | Notes | Source |
|---|---|---|
| Advanced analytics | Beyond the Dashboard KPIs in PRD §10. | PRD §17 |
| Audit history | A record of who changed what. | PRD §17 |

## Demo Mode

| Feature | Notes | Source |
|---|---|---|
| Server-backed expiring demos | Only if browser-local Demo Mode proves insufficient. | `PLAN.md` backlog |
