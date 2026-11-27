# Mockup Index

This directory contains the UI mockups that should be used as the primary visual reference when implementing the frontend.

Before implementing any page or tab:
1. Find the relevant entry below.
2. Review both desktop and mobile mockups where available.
3. Preserve the overall layout, spacing, visual hierarchy, controls, and page structure.
4. Adapt as needed for RTL/Hebrew, responsiveness, accessibility, and shared component consistency.
5. Do not invent a substantially different page structure when a matching mockup exists.
6. The Profile and Settings entries on the homepage sidebar are not built in the MVP. The notification bell is built (D95); its list is not drawn. The event selector is in the sidebar only. Inside an event the avatar shows an icon for the user's role in that event (crown for Owner, shield for Admin, people icon for Viewer); outside an event it shows none.
7. The event sidebar is the same on every event-level page: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions. Where a mockup's sidebar differs, this order applies.

## Landing Page

Desktop:
- `landing_page.png`

Mobile:
- `landing_page_mobile.png`

Notes:
- This is what a visitor sees before signing in or opening the demo. Three flows start here: Sign Up → account created → My Events; Sign In → My Events; Try Demo → the populated demo.
- The product screenshot in the hero shows a different product (Overview, RSVPs, Seating, Analytics, Share Event). It is not copied: a decorative preview is drawn in its place with this product's navigation names and fictional figures.
- The "How it works" link has no section in the mockups and is not built (`docs/FUTURE_FEATURES.md`). "Features" scrolls to the feature cards.
- Three feature texts promise things the MVP does not do (reminders, sending from inside the app, designing a seating plan, "real sample data"). The wording is adjusted to what exists; see `docs/MOCKUP_NOTES.md`.
- There are no mockups for the Sign In and Sign Up forms; they are built from the shared components.

## Homepage

Desktop:
- `homepage.png`

Mobile:
- `homepage_mobile.png`

Notes:
- The mockup cards show a photo per event. Events have no photo yet, so each card shows a generated cover: a gradient with an icon, chosen from the event. Uploading a cover image is a future feature (`docs/FUTURE_FEATURES.md`).
- The "⋯" menu on a card holds Open, Duplicate and Delete. Duplicate and Delete are shown to an Owner only.
- Each card also shows the user's role in the event, which the mockups omit.

## Dashboard

Desktop:
- `dashboard.png`

Mobile:
- `dashboard_mobile.png`

Notes:
- The button drawn as "View Event" is named "Event Settings" and opens the Event Settings page.
- Two KPI cards are added to those drawn: Seating Capacity and Unassigned Confirmed Attendees, after Confirmed Attendees.
- Never copy the sample numbers; every figure is calculated from the event's data.

## Guests

Desktop:
- `guests.png`

Mobile:
- `guests_mobile.png`

Notes:
- A guest with no invitation sent and no response is labelled "Not Sent", not "Awaiting Response" as drawn.
- The sliders button beside the filters is a column chooser on the desktop table and is not shown on a phone. A "Clear filters" button is added beside it.
- Each row has an **Edit** button (close to the drawn pencil); Delete Guest is in Edit Guest. The RSVP answer is changed in the list: Status is a dropdown opened by one click, and an approved guest's Confirmed count changes by double-click (a tap on a phone card) (D105). The ">" arrow on a phone and the guest's name on desktop open a details panel.
- Row checkboxes offer Delete selected and Export selected.
- "Allowed" is named "Expected Attendees". The Approved card counts confirmed attendees (people).
- A Group column and filter are added, and Group and Table fields in the guest form. Column headings are centred.
- The WhatsApp button on each row opens a confirmation, then WhatsApp.
- See `docs/MOCKUP_NOTES.md` for the full list.

## Event Layout

Desktop:
- `event_layout.png`

Mobile:

Tables tab:
- `event_layout_tables_mobile.png`

Arrangements tab:
- `event_layout_arrangement_mobile.png`

Manage Guests dialog (desktop):
- `event_layout_manage_guests.png`

Notes:
- The Name column of the tables list is not built: a table has a number, a capacity and a shape only.
- The desktop mockup contains the full Event Layout page.
- Status labels are Ready, Almost Full, Full (added) and Over Capacity. The KPI "Assigned Guests" is labelled "Assigned Attendees".
- Each table row has an **Edit** button (in place of the drawn "⋯" menu, D105); Delete Table is on the Selected Table card and in Edit Table.
- The Selected Table card shows the one chosen table at the same place on both tabs, beside the list or the plan on a wide screen and below it otherwise. Details in `docs/MOCKUP_NOTES.md`.
- The mobile UI separates the Tables and Arrangements views into dedicated tab mockups.
- `event_layout_manage_guests.png` was added on 2026-10-15, after the Manage Guests dialog was built (D68). It has not yet been compared with the built dialog; differences should be listed in `docs/MOCKUP_NOTES.md` and settled with the owner.
- The Table Arrangement tab is built (Phase 20, D100); the Arrangement Preview and Capacity Warnings are not (owner, 2026-10-16). `docs/MOCKUP_NOTES.md` lists what the tab adds to the mockups.
- The desktop mockup's sidebar is not the approved navigation; use the order in `docs/PRD.md` section 4.2.

## RSVP Settings

Desktop:
- `rsvp_settings.png`

Mobile:

Settings tab:
- `rsvp_settings_settings_mobile.png`

Preview tab:
- `rsvp_settings_preview_mobile.png`

Notes:
- The two-button bar at the bottom of both mobile mockups is drawn wider than the page. That is a mockup error. Build it aligned with the page content, with equal-width buttons, pinned to the bottom of the screen.

## WhatsApp Message

Desktop:
- `whatsapp_message.png`

Mobile:

Message Editor tab:
- `whatsapp_message_editor_mobile.png`

Preview tab:
- `whatsapp_message_preview_mobile.png`

Notes:
- The toolbar has Bold, Italic, Strikethrough and Emoji; Underline and Link are not built. Variables show as plain `{{name}}` text in the editor.
- Save Changes is also in the desktop header. Send Test Message opens WhatsApp with no recipient.
- The "⋯" menu on a sent message holds View message and Send again.
- The two-button bar at the bottom of both mobile mockups is drawn wider than the page. That is a mockup error. Build it aligned with the page content, with equal-width buttons, pinned to the bottom of the screen.

## Event Settings

Desktop:
- `event_settings.png`

Mobile:
- `event_settings_mobile.png`

Notes:
- The mobile mockup shows Save Changes beside the page title. On a phone it goes in the pinned bottom action bar instead, as on the other form pages.
- The RSVP Language selector is not built here; the language belongs to RSVP Settings. The "RSVP Settings" card keeps only the notice.
- An optional Location field is added under Event Name; it suggests places from Google Maps when the deployment has a Google key (D104).
- A Phone Number Country field (Israel or Brazil, D103) is added; the Timezone field can be searched by city or country (D104).
- "View Event Rules" opens a read-only dialog listing the event's rules.

## Permissions

Desktop:
- `permissions.png`

Mobile:
- `permissions_mobile.png`

Notes:
- The desktop mockup's sidebar is not the approved navigation: it shows entries (Budget, Vendors, Timeline, Photo Sharing) that are not built, and a different order. Use the order in `docs/PRD.md` section 4.2; see `docs/MOCKUP_NOTES.md`.
- Invite User, Change Role and Remove open dialogs that are not drawn. A pending invitation is shown as a member line with a "Pending" badge. The Actions heading is hidden. See `docs/MOCKUP_NOTES.md`.

## Emails

- `event_collaboration_email.png`

Notes:
- The design of every email the server sends (D93), drawn for the invitation to collaborate on an event. Built in `backend/src/email/templates.ts`; the pictures are drawn in `frontend/scripts/email-images.ts`.
- Emails are sent only when email is turned on (D88); until Amazon SES is connected in Phase 18, they are caught locally by Mailpit (http://localhost:8025).
- The other emails (access given, verify email, reset password, test email) use the same layout: the Event Planner mark, a title, the message, one button, "Thanks, Event Planner" and the footer. The envelope picture and the Role and Date box appear only in emails about an event.
- "Hi Maya," greets by name only when the person has an account; an invitation to an address with no account says "Hi,".
- The message names who sent the invitation ("Riley Stone invited you to collaborate on …").
- Accept Invitation opens the sign-up form with the invited address filled in; signing up (and, with email on, verifying the address) turns the invitation into access (D89).
- The date is the event's day in the event's time zone, written in the email's language.
- The Help, Privacy and Terms links in the footer are not shown: those pages do not exist yet (`docs/FUTURE_FEATURES.md`).
- There is no Hebrew or Portuguese mockup; the Hebrew emails mirror it right to left, and the Portuguese ones follow it as drawn.

## V2.2 — Venues

The venue mockups (2026-11-27) are interactive HTML pages in `v2/html/`, one per screen. Each page adapts to the screen width:
- the phone layout below 768px;
- the sidebar as a drawer below 1024px.

Most pages have a "Mockup state" bar at the bottom that switches between the screen's states. **The bar is a mockup tool, not part of the product.**

The PNGs in `v2/` are screenshots of every state, taken with the bar hidden:
- **Naming:** `<file>_<state>.png` for desktop (1440px wide), and `<file>_<state>_mobile.png` for phone (390px wide).
- **Use them for comparison.** Open the HTML to see interaction and hover.

The screen numbers are those of `v2_plannings/V2.2_MOCKUPS.md`. The decisions behind these screens are D111–D118 in `docs/DOMAIN.md`; the differences from the rules are in `docs/MOCKUP_NOTES.md` ("V2.2 venue mockups").

| # | Screen | HTML (`v2/html/`) | States (PNG suffixes in `v2/`) |
|---|---|---|---|
| 1, 2 | Workspace switcher; Venue → My Events | `02_venue_events.html` | (default), `switcher_open` |
| 3 | Venue → My Spaces | `03_venue_spaces.html` | `spaces`, `empty_venue` |
| 4, 5 | Create / edit space dialog; Space details | `05_venue_space_details.html` | `layouts`, `no_layouts`, `archived_space`, `edit_space_dialog` |
| 6 | Layout template editor | `06_venue_layout_editor.html` | `420_chairs`, `384_chairs`, `400_chairs` (the chairs-vs-max-people warning) |
| 7 | Team | `07_venue_team.html` | `owner_view`, `manager_view` |
| 9 | Create venue event wizard | `09_venue_create_event.html` | `step_1`, `step_2`, `step_3`, `same_day`, `step_4`, `created` |
| 10 | Client card in a venue event | `10_venue_event_client.html` | `awaiting`, `sent`, `expired`, `joined`, `past` |
| 11 | Invitation email to the client | `11_venue_client_invitation_email.html` | (default) |
| 12 | Accept-invitation page | `12_venue_accept_invitation.html` | `signed_in_right_email`, `not_signed_in`, `signed_in_other_email`, `accepted`, `expired_link`, `revoked_link`, `already_used` |
| 13 | Client: "Managed by venue" on the event card and in the event | `13_client_venue_event_card.html` | (default) |
| 14 | Client: Event Settings with the venue section locked | `14_client_event_settings.html` | (default) |
| 15 | Permissions, split by side | `15_event_permissions.html` | `venue_owner`, `venue_owner_client_status_menu`, `client_lead`, `client_editor` |
| 16 | Client: Event Layout (map read-only, seating active) | `16_client_event_layout.html` | `map`, `tables`, `selected`, `manage_guests` |
| 17 | Venue: Guests (read-only, no phones) | `17_venue_event_guests.html` | `client_joined`, `awaiting_client` |
| 19 | Venue: Dashboard with warnings | `19_venue_event_dashboard.html` | `awaiting_client`, `client_joined`, `no_warnings` |
| 20 | Venue: delete an occupied table | `20_venue_delete_table_warning.html` | `table_7`, `warning`, `after_delete`, `empty_table` |
| 22 | Demo: choose a demo | `22_demo_choose.html` | `public_page`, `choose_a_demo`, `venue_picked`, `loading`, `event_demo`, `venue_demo` |
| 23 | Demo: venue/client switcher | `23_demo_venue_switcher.html` | `venue_my_events`, `venue_dashboard`, `client_my_events`, `client_dashboard`, `switcher_open` |
| 24 | Landing page: "For venues" | `24_landing_page_venues.html` | `top_of_page`, `for_venues_section`, `venue_demo_picked`, `loading`, `phone_menu` |

Not drawn, built from existing patterns as `V2.2_MOCKUPS.md` allows:
- **#8 Venue Settings:** organization name, default language, and the venue's contact email and phone shown to clients (D117).
- **#18 Venue: Event Layout:** the current page, with table and map editing; seating is view-only for the venue.
- **#21 the notice to the client:** the existing bell, plus a notice on the Dashboard.

The current product is in `resources/screenshots/`. The design rules are in `resources/DESIGN_GUIDE.md`.

## Breakpoints

- Desktop mockups are 1448×1086 or 1536×1024.
- Mobile mockups are 941×1672 (portrait phone).
- There are no Hebrew/RTL or Portuguese mockups; adapt from the mapped images.
- There are no tablet mockups. Tablet layouts are not designed for the MVP; a tablet gets the desktop or mobile layout that fits its width.

Differences between these mockups and the approved requirements are recorded in `docs/MOCKUP_NOTES.md`.