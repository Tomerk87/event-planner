# Mockup notes: scope and differences from the PRD

Recorded after reviewing all 19 images in `mockups/` against `docs/PRD.md` (2026-10-12). `mockups/README.md` remains the authoritative page-to-image mapping; this file records where the images and the approved requirements disagree or leave gaps.

Rule applied throughout (`AGENTS.md`, owner decision 2026-10-12): the mockups were created after the PRD, so where a mockup differs from or adds to the PRD, the mockup is built. The PRD remains the source of truth for business rules and is updated in the same phase. Items marked **Decision needed** are ones this rule does not settle, because mockups contradict each other or do not show what an element does; they are listed in `docs/DOMAIN.md` and are not to be resolved by guessing. Items marked **Decided** record an owner decision.

## Visual Arrangement scope

| | MVP | Post-MVP (Phase 20) |
|---|---|---|
| Tables: create, edit, delete, number, name, capacity, shape | Yes | |
| Assigning Approved guest parties to tables, capacity rules, conflicts | Yes | |
| Seating exports (CSV, XLSX) | Yes | |
| Arrangement canvas: placing tables, drag/drop, chairs, venue objects, View/Edit modes, persisted coordinates | | Yes |

How the mockups show it:

- `event_layout.png` labels the second tab "Table Arrangement" with a **Soon** badge, which matches the deferred scope. The same image also shows a working "Arrangement Preview" panel with an "Open Arrangement" button.
- `event_layout_arrangement_mobile.png` shows a functioning read-only Arrangement tab ("View Mode", "Fullscreen", pinch to zoom) with a Selected Table panel.
- The mockups include venue objects the PRD does not list (Food Station, Entrance, plants). PRD §11.4 lists divider/wall, steps, stage and bar.

**Decided (2026-10-12):** in the MVP the Table Arrangement tab is shown with the "Soon" badge and is disabled, on desktop and mobile. The Arrangement Preview panel and the mobile read-only floor plan are not built. The Arrangement mockups are kept as guidance for Phase 20, and the deferred pieces are listed in `docs/FUTURE_FEATURES.md`.

## Differences that affect behavior or scope

### Navigation and shell

- **Decided (2026-10-12):** the event sidebar is identical on every event-level page: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions. Permissions is hidden for Viewers. This order differs from the mockups, which show Messages before RSVP.
- `event_layout.png` and `permissions.png` show sidebar entries **Budget, Vendors, Timeline, Photo Sharing**, place Permissions directly after Event Layout, and label the last entry "Settings". The owner confirmed these two sidebars are wrong; the four extra entries are not built and are listed in `docs/FUTURE_FEATURES.md`.
- The event selector appears in the sidebar (`dashboard.png`, `guests.png`, `whatsapp_message.png`, `rsvp_settings.png`), in the top bar (`event_layout.png`, `permissions.png`), and in both at once (`event_settings.png`). **Decided (2026-10-12):** the selector is in the sidebar only.
- Every screen shows a **notification bell**, and `homepage.png` shows **Profile** and **Settings** account pages. The PRD defines no notifications, profile or account-settings features. **Decided (2026-10-12):** all three are left out of the MVP and listed in `docs/FUTURE_FEATURES.md`.
- A **crown icon** appears beside the user avatar on mobile screens and on `permissions.png`. **Decided (2026-10-12):** it is the user's role in the current event, using the same icons as the Permissions role badges (crown for Owner, shield for Admin, people icon for Viewer). No icon is shown outside an event, so the crown on the homepage mockups is not reproduced. A Super User without a membership shows the crown.
- No mockup shows the **Try Demo** entry, the Demo Mode indicator, Reset Demo, or the demo role switcher required by PRD §12.

### Homepage / Events

- Event cards show a **cover image** per event. The PRD has no event image field. Built as shown; the field is added to the PRD in Phase 4.
- Cards have a "⋯" menu whose contents are not shown. It is the only visible place for Duplicate/Delete, since `event_settings.png` has neither.
- Search, grid/list toggle and All/Upcoming/Past tabs are not in the PRD; treated as presentation of existing data.

### Dashboard

- **Recent Guest Activity** lists individual RSVP and send events. The PRD stores only the last-sent and last-response timestamps per guest, and puts audit history out of scope (§17). **Decision needed** on whether the feed is derived from those two timestamps or needs an activity record.
- The KPI cards omit **Seating Capacity** and **Unassigned Confirmed Attendees**, both required by PRD §10. Seating Capacity appears only in the Attendance vs Capacity chart; Unassigned Confirmed Attendees appears only in `event_settings.png`.
- The PRD warnings "table chairs above event maximum" and "confirmed attendees awaiting table assignment" are not illustrated.
- "View Event" button and the Quick Actions panel are not in the PRD; Quick Actions are navigation shortcuts. The target of "View Event" is undefined. **Decision needed.**
- The sample numbers are not internally consistent (for example "exceeds by 14 attendees (300 / 286)" beside 214 confirmed of 300). All dashboard values are derived from data per PRD §10, never copied from the image.

### Guests

- Rows have **selection checkboxes**, implying bulk actions. The PRD defines none, and bulk sending is out of scope (§17). **Decision needed.**
- Guests with `invitation_sent_count = 0` and no response are badged "Awaiting Response" in the mockup. PRD §10 defines Awaiting Response as sent count above zero with `NO_RESPONSE`. A separate label is needed for not-yet-invited guests. **Decision needed** on the wording.
- The KPI strip and the RSVP Status / Invitation Status / Table filters are not in the PRD; treated as presentation of existing data.
- The Unknown Guests tab is visible only as a tab header; its content has no mockup.

### WhatsApp Messages

- **Recent Sent Messages** lists each send with time, status "Opened WhatsApp" and a message preview. The PRD stores a counter and the last send time, not a per-send history. Built as shown; the per-send record is added to the PRD in Phase 8.
- **Send Test Message** is not in the PRD. **Decision needed.**
- The editor toolbar offers bold, italic, underline, link and emoji. WhatsApp has its own plain-text formatting markers and no underline. **Decision needed** on which formatting controls are kept.
- The variable set shown is `first_name`, `last_name`, `event_name`, `event_date`, `event_time`, `rsvp_url`. PRD §7 gives these as examples; this set is taken as the approved list.

### RSVP Settings and public RSVP

- The public form shows **Number of attendees as a required field above the three response buttons**. **Decided (2026-10-12):** the field is always required, as drawn. For Declined and Not Sure the submitted number is discarded. PRD §8.1 has been updated.
- The RSVP page shows a **location** ("Tel Aviv, Israel") and a short **display title** ("Deborah & Tomer") that differs from the event name. The event header in other mockups also shows a location. The PRD has no event location or RSVP title field; location exists only inside the Google Calendar action. Built as shown; the fields are added to the PRD in Phase 7 / Phase 9.
- An **RSVP Language selector** appears on both RSVP Settings and Event Settings. The PRD calls the language "fixed per event" without saying when it becomes fixed or which page owns it. **Decision needed.**
- **QR code** button and "RSVP page is active" status are not in the PRD. Built as shown.
- The mockup states limits the PRD does not: 500 characters per message, and background image "1920 × 1080, JPG or PNG, up to 5MB". Adopted as requirements.
- The mobile preview has Welcome / Approved / Declined / Not Sure state tabs; the desktop preview shows only the welcome state.

### Event Layout

- Table status labels **Ready / Almost Full / Over Capacity** have no defined thresholds. In the mockup a full table (10 of 10) is "Ready" while 11 of 12 is "Almost Full". **Decision needed.**
- "Assigned Guests" in the KPI row counts attendees (214), not guest parties. Labels must make that distinction clear (`PLAN.md` Phase 5 exit criteria).

### Event Settings

- A required **Timezone** field is shown. PRD §5.2 relies on an event timezone and `PLAN.md` Phase 7 includes it, but the PRD §5.1 field table omits it. Treated as required; the PRD table should be updated when Phase 7 is implemented.
- The **Danger Zone** contains only a read-only notice and a "View Event Rules" button whose target is undefined. Duplicate and Delete are not shown here.

### Permissions

- **Invite User** corresponds to the unspecified invite flow (PRD §3.3, §18 item 4). **Decision needed** before Phase 11.
- The role explanation says "Viewer can only view the event". Per the PRD, Viewers can also export.

## Found while building the design system (Phase 2)

- **User menu.** The mockups draw a chevron beside the user name, implying a menu, but never show its contents. The shell shows the avatar, name and role icon without a menu; the menu arrives with sign-in and log-out in Phase 4.
- **Event selector thumbnail.** The mockups show the event's cover image in the selector. The shell shows a calendar icon until the cover image exists (Phase 4).
- **Homepage sidebar.** With Profile and Settings left out, the homepage sidebar holds only My Events and the language selector. Log out is added in Phase 4.
- **Typeface.** The mockups use an Inter-style typeface. The app asks for Inter and falls back to the system font; no font file is bundled.
- **Empty top bar.** Until a signed-in user exists (Phase 4), the desktop top bar on real pages is empty.

## Mockup content

The images use sample names, `example.com` email addresses, placeholder-style phone numbers (such as `050-123-4567`) and the domain `rsvp.eventplanner.com`. None of this is copied into the product. Demo data is generated separately under the rules in `AGENTS.md` (fictional names, non-routable contacts).

## Screens and states without a mockup

Built from the established visual language and shared components (`AGENTS.md`, UI mockups rule 12):

- Sign-in, create-event form, account menu
- Demo Mode entry, indicator, Reset Demo confirmation, demo role switcher
- Unknown Guests tab content and its review / convert / merge / reject actions
- Guest add/edit form, guest import flow (mapping, preview, errors), export menu
- Table add/edit form, assign-guests dialog, populated-table delete confirmation
- Change-role and remove-member dialogs on Permissions
- Public RSVP as a standalone page, including validation errors and the closed (past event) state
- Past-event read-only presentation and Viewer-restricted presentation of each page
- Loading, empty and error states
- Every Hebrew/RTL layout (all mockups are English/LTR)
- Tablet layouts: not designed or verified for the MVP (owner decision 2026-10-12); a tablet gets the desktop or phone layout that fits its width
