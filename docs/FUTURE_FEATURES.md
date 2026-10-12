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

## Guests and RSVP

| Feature | Notes | Source |
|---|---|---|
| Individual attendee records | Names or details for each person in a party. In the MVP attendees are only counted. | PRD §17 |
| Guest-specific RSVP URLs | One link per guest. The MVP has one shared link per event. | PRD §17 |
| Guest-selectable RSVP language | More than one guest-facing language within an event. | PRD §17 |
| Configurable RSVP deadline | Closing RSVP earlier than the event start. | PRD §17; `PLAN.md` backlog |

## Messaging

| Feature | Notes | Source |
|---|---|---|
| WhatsApp Business API sending | Sending from the system, rather than opening WhatsApp for the organizer to send. | PRD §17 |
| Bulk sending | Sending to many guests in one action. | PRD §17 |
| Automated reminders | Scheduled follow-ups to guests who have not responded. | PRD §17 |
| Delivery, read and failure tracking | The MVP records only that a send was initiated. | PRD §7.1, §17 |

## Event management

| Feature | Notes | Source |
|---|---|---|
| Budget | Sidebar entry shown in two mockups. No requirements written. | Mockups `event_layout.png`, `permissions.png`; PRD §17; owner decision 2026-10-12 |
| Vendors | Sidebar entry shown in two mockups. No requirements written. | Same |
| Timeline | Sidebar entry shown in two mockups. No requirements written. | Mockups `event_layout.png`, `permissions.png`; owner decision 2026-10-12 |
| Photo Sharing | Sidebar entry shown in two mockups. No requirements written. | Same |
| Payments and full event-production management | | PRD §17 |
| Reusable event templates | | PRD §17 |
| Event cover image upload | Uploading a photo for an event when creating it and in Event Settings; shown on the event card and in the event selector. In the MVP each event shows a generated cover (a gradient with an icon). | Mockups `homepage.png`, `homepage_mobile.png`; owner decision 2026-10-12 |
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

## Analytics and history

| Feature | Notes | Source |
|---|---|---|
| Advanced analytics | Beyond the Dashboard KPIs in PRD §10. | PRD §17 |
| Audit history | A record of who changed what. | PRD §17 |

## Demo Mode

| Feature | Notes | Source |
|---|---|---|
| Server-backed expiring demos | Only if browser-local Demo Mode proves insufficient. | `PLAN.md` backlog |
