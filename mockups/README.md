# Mockup Index

This directory contains the UI mockups that should be used as the primary visual reference when implementing the frontend.

Before implementing any page or tab:
1. Find the relevant entry below.
2. Review both desktop and mobile mockups where available.
3. Preserve the overall layout, spacing, visual hierarchy, controls, and page structure.
4. Adapt as needed for RTL/Hebrew, responsiveness, accessibility, and shared component consistency.
5. Do not invent a substantially different page structure when a matching mockup exists.
6. The event sidebar is the same on every event-level page: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions. Where a mockup's sidebar differs, this order applies.

## Homepage

Desktop:
- `homepage.png`

Mobile:
- `homepage_mobile.png`

## Dashboard

Desktop:
- `dashboard.png`

Mobile:
- `dashboard_mobile.png`

## Guests

Desktop:
- `guests.png`

Mobile:
- `guests_mobile.png`

## Event Layout

Desktop:
- `event_layout.png`

Mobile:

Tables tab:
- `event_layout_tables_mobile.png`

Arrangements tab:
- `event_layout_arrangement_mobile.png`

Notes:
- The desktop mockup contains the full Event Layout page.
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

## WhatsApp Message

Desktop:
- `whatsapp_message.png`

Mobile:

Message Editor tab:
- `whatsapp_message_editor_mobile.png`

Preview tab:
- `whatsapp_message_preview_mobile.png`

## Event Settings

Desktop:
- `event_settings.png`

Mobile:
- `event_settings_mobile.png`

## Permissions

Desktop:
- `permissions.png`

Mobile:
- `permissions_mobile.png`

Notes:
- The desktop mockup's sidebar is not the approved navigation: it shows entries (Budget, Vendors, Timeline, Photo Sharing) that are not built, and a different order. Use the order in `docs/PRD.md` section 4.2; see `docs/MOCKUP_NOTES.md`.

## Breakpoints

- Desktop mockups are 1448×1086 or 1536×1024.
- Mobile mockups are 941×1672 (portrait phone).
- There are no tablet mockups and no Hebrew/RTL mockups; adapt from the mapped images.

Differences between these mockups and the approved requirements are recorded in `docs/MOCKUP_NOTES.md`.