# Mockup Index

This directory contains the UI mockups that should be used as the primary visual reference when implementing the frontend.

Before implementing any page or tab:
1. Find the relevant entry below.
2. Review both desktop and mobile mockups where available.
3. Preserve the overall layout, spacing, visual hierarchy, controls, and page structure.
4. Adapt as needed for RTL/Hebrew, responsiveness, accessibility, and shared component consistency.
5. Do not invent a substantially different page structure when a matching mockup exists.
6. The notification bell, and the Profile and Settings entries on the homepage sidebar, are not built in the MVP. The event selector is in the sidebar only. Inside an event the avatar shows an icon for the user's role in that event (crown for Owner, shield for Admin, people icon for Viewer); outside an event it shows none.
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
- The "⋯" menu holds Edit Guest, Change RSVP and Delete; the drawn pencil is not shown (D81). The ">" arrow on a phone and the guest's name on desktop open a details panel.
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

Notes:
- The Name column of the tables list is not built: a table has a number, a capacity and a shape only.
- The desktop mockup contains the full Event Layout page.
- Status labels are Ready, Almost Full, Full (added) and Over Capacity. The KPI "Assigned Guests" is labelled "Assigned Attendees".
- The row's "⋯" menu holds Edit Table and Delete Table; the drawn pencil is not shown (D82).
- The Selected Table panel is shown beside the list on a wide screen only; elsewhere a table's guests open in a dialog. Details in `docs/MOCKUP_NOTES.md`.
- The mobile UI separates the Tables and Arrangements views into dedicated tab mockups.
- In the MVP the Table Arrangement tab is shown with a "Soon" badge and is disabled, and the Arrangement Preview panel is not built. The Arrangement mockups are guidance for the future editor (`docs/FUTURE_FEATURES.md`).
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
- An optional Location field is added under Event Name.
- "View Event Rules" opens a read-only dialog listing the event's rules.

## Permissions

Desktop:
- `permissions.png`

Mobile:
- `permissions_mobile.png`

Notes:
- The desktop mockup's sidebar is not the approved navigation: it shows entries (Budget, Vendors, Timeline, Photo Sharing) that are not built, and a different order. Use the order in `docs/PRD.md` section 4.2; see `docs/MOCKUP_NOTES.md`.
- Invite User, Change Role and Remove open dialogs that are not drawn. A pending invitation is shown as a member line with a "Pending" badge. The Actions heading is hidden. See `docs/MOCKUP_NOTES.md`.

## Breakpoints

- Desktop mockups are 1448×1086 or 1536×1024.
- Mobile mockups are 941×1672 (portrait phone).
- There are no Hebrew/RTL mockups; adapt from the mapped images.
- There are no tablet mockups. Tablet layouts are not designed for the MVP; a tablet gets the desktop or mobile layout that fits its width.

Differences between these mockups and the approved requirements are recorded in `docs/MOCKUP_NOTES.md`.