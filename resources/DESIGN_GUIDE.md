# Event Planner — Design Guide for mockups

**For:** the designer drawing new mockups (V2.2 venues and anything after it).
**Date:** 2026-11-27.

This guide describes the visual language **as it is built today**. The values are the real ones from the code (`frontend/src/styles/tokens.css` and the shared components in `frontend/src/shared/ui/`). If this guide and the code ever disagree, the code wins, and this guide should be corrected.

**What to design against:** the screenshots in `resources/screenshots/` show the product as it really looks. The older images in `resources/mockups/` were the first designs; where they differ from the screenshots, follow the screenshots.

---

## 1. The product in one paragraph

Event Planner helps people organize an event: a guest list, WhatsApp invitations, one public RSVP page per event, a dashboard of responses, a floor plan with tables and seating, and permissions for co-organizers. It works in **English, Hebrew (right-to-left) and Brazilian Portuguese**, on **desktop and phone**.

V2.2 adds **venues**: a venue owner sets up spaces and table layouts, creates events from them, and shares each event with a **client** (for example, the couple). The client runs guests, RSVP, messages and seating. The venue controls the room and the tables. See `v2_plannings/V2.2_MOCKUPS.md` for the screens to draw.

## 2. Design principles

1. **Calm and clear.** The background is a light grey-blue page with white cards. There is one strong accent color (indigo). The only dark area is the navy sidebar.
2. **Reuse before inventing.** A new screen should look like it was always part of the product: the same page header, cards, tables, dialogs and buttons. New colors or new kinds of components need a real reason.
3. **Numbers first.** Pages that summarize something open with a row of KPI cards (a label, a big number, a unit, a tinted icon).
4. **Explain, don't just disable.** Something a user can't change is shown as **plain text with a short note saying why** (e.g. "Maintained by Grand Garden Hall"), never as a greyed-out form field. This matters a lot in V2.2.
5. **Never rely on color alone.** Every status has text (and usually an icon) as well as a color.
6. **Phone is a real layout, not a shrunken desktop.** Tables become cards, the sidebar becomes a menu, and form pages get a pinned bottom bar.

## 3. Layout

### Screen sizes

| Name | Width | What changes |
|---|---|---|
| **Desktop** | 1024px and wider | Fixed navy sidebar on the left (the right in Hebrew), 248px wide |
| **Compact** | below 1024px | The sidebar becomes a drawer opened from a menu button in the top bar |
| **Phone** | below 768px | Data tables become stacked cards. Form pages get a bottom action bar. Some desktop tabs split into phone tabs (e.g. Settings / Preview) |

**Draw mockups at:**
- **Desktop:** 1440px wide.
- **Phone:** 390–412px wide.

Tablets are not designed separately: they get whichever of the two layouts fits.

### The application shell

```
┌──────────┬────────────────────────────────────────────────────────┐
│ ▣ Event  │  ☰      [Demo Mode] [Role ▾] [Reset]   🔔  👑 (AM) Name ▾│ ← top bar, 64px, white
│  Planner │────────────────────────────────────────────────────────│
│┌────────┐│  Page Title                         [Secondary] [Primary]
││ Event ▾││  One-line description of the page                      │
│└────────┘│                                                        │
│ ◉ Dash.. │  ┌KPI┐ ┌KPI┐ ┌KPI┐ ┌KPI┐ ┌KPI┐                          │
│ ○ Guests │  ┌ notice ─────┐ ┌ notice ─────┐                       │
│ ○ RSVP   │  ┌ card ──────────────────┐ ┌ card ──────────┐         │
│ ○ ...    │  │                        │ │                │         │
│          │  └────────────────────────┘ └────────────────┘         │
│ 🌐 Lang ▾│                                                        │
│ ← Back   │                                                        │
└──────────┴────────────────────────────────────────────────────────┘
  navy sidebar                 page content (max 1280px wide)
```

- **Sidebar** (navy gradient `#0F1535` → `#151C47`, 248px):
  - the logo at the top;
  - inside an event, an **event selector** card (the event's cover thumbnail, its name and a chevron);
  - the navigation items: icon + label, with the active item on a raised navy background;
  - the language selector and "Back to My Events" pinned at the bottom.
- **Event navigation order (always):** Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions.
- **Top bar** (64px, white, bottom border):
  - on the left: the menu button;
  - on the right: the notification bell with a count, a role icon (inside an event), and the avatar with the user's name and a chevron;
  - in the demo: a "Demo Mode" badge, a role switcher and a Reset Demo button.
- **Page content:**
  - side padding of about 32px on desktop and 16px on phone;
  - at most 1280px wide;
  - sections stacked with 20–24px gaps.
- **Page header:** the H1 title (32px bold; 28px on phone) with a muted one-line description under it. The page's main actions sit on the right, with the primary action furthest right.

### Phone shell
- The top bar holds: the menu button, the logo mark, the bell, the role icon and the avatar initials.
- The menu opens a full-height navy **drawer** with the same items as the sidebar.
- **Bottom action bar** on form pages (Event Settings, Messages, RSVP Settings): it's pinned to the bottom with a light shadow above it. It holds two buttons of equal width, lined up with the page's content edges, with the primary action on the right (the left in Hebrew).
- **Lists become cards.** Each card has:
  - an avatar or initials;
  - the name in bold, with the secondary line muted;
  - a status badge in the corner;
  - key figures in a row;
  - actions at the bottom.

## 4. Color

All colors are tokens. Use these values and don't introduce new ones without asking.

### Base

| Token | Hex | Use |
|---|---|---|
| Page background | `#F6F7FB` | Behind everything |
| Surface | `#FFFFFF` | Cards, dialogs, top bar, inputs |
| Surface muted | `#F8F9FC` | Inner panels, table header rows |
| Border | `#E5E8F0` | Card and input borders, dividers |
| Border strong | `#CFD4E2` | Hover and emphasis borders |
| Text | `#0F1433` | Headings and main text |
| Text muted | `#5B6480` | Descriptions, labels, secondary text |
| Text subtle | `#626B85` | Captions, units under numbers |
| Overlay | `#0F1433` at 55% | Behind dialogs |

### Brand (indigo)

| Token | Hex | Use |
|---|---|---|
| Primary | `#4F46E5` | Primary buttons, active tab, links, selected states |
| Primary hover | `#4338CA` | |
| Primary soft | `#EEF0FF` | Soft buttons, icon circles, info backgrounds |
| Primary border | `#C9CDFB` | Secondary button border, info card border |

### Sidebar (navy)

| Token | Hex |
|---|---|
| Sidebar background | `#0F1535` → `#151C47` (gradient) |
| Raised item (active / event card) | `#1B2350` |
| Border | `#262E5C` |
| Text | `#F1F3FB` |
| Muted text | `#B4BBD6` |

### Status tones

Each tone has text, soft background and border values.

| Tone | Text | Soft bg | Border | Meaning |
|---|---|---|---|---|
| **Success** | `#15803D` | `#E6F7EC` | `#BDE5CB` | Approved, saved, available |
| **Warning** | `#B45309` | `#FFF4E3` | `#F8D8A4` | Needs attention: not enough seats, not sure |
| **Danger** | `#C81E1E` | `#FDECEC` | `#F6C4C4` | Declined, over capacity, delete, errors |
| **Info** | `#4338CA` | `#EEF0FF` | `#C9CDFB` | Neutral information, tips |
| **Neutral** | `#475069` | `#ECEFF5` | `#D9DEEA` | Not sent, no table, inactive |

### Meaning that never changes

- **Approved** = green (success).
- **Declined** = red (danger).
- **Not Sure** = amber (warning).
- **Awaiting Response** = indigo/grey with a clock icon.
- **Not Sent** = neutral.
- **Owner role** = amber crown `#D97706`.
- **Chart segments:** approved `#22C55E`, declined `#EF4444`, not sure `#F59E0B`, awaiting `#94A3B8`, not invited `#CBD5E1`, seating `#A5B4FC`. A chart always shows its numbers as text too.

### Special areas (keep as they are)

- **WhatsApp preview:** chat background `#EFE7DD`, bubble `#D9FDD3`, inside a dark phone frame `#111827`.
- **Public RSVP page:** white text over a darkened photo or plain dark navy, on a translucent panel. Its answer buttons are full-width with soft tone colors (green, red, amber).

## 5. Typography

- **Typeface:** **Inter**. In Hebrew, the system's Hebrew font (e.g. Noto Sans Hebrew) is used automatically.
- **Line height:** 1.5 for text, 1.2 for headings.

| Role | Size | Weight |
|---|---|---|
| Page title (H1) | 32px (28px on phone) | Bold 700 |
| KPI number | 24px | Bold 700 |
| Card title | 18px | Semibold 600 |
| Body | 16px | Regular 400 |
| Labels, table text, descriptions | 14px | Medium 500 (labels), Regular (text) |
| Captions, units, badges, helper text | 12px | Regular; badges Semibold |

- **Buttons:** 14px semibold (16px on the large size).
- **English headings and table headers:** Title Case ("Seating Capacity"). Body text and helper text use sentence case.

## 6. Spacing, corners, shadows

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40px. Use only these.
  - inside cards: 20px (16px on phone);
  - between cards: 16–24px;
  - label to field: 8px.
- **Corners:**
  - 6px: small items, chips inside controls;
  - **10px:** buttons, inputs, tabs;
  - **14px:** cards, dialogs;
  - pill: badges, counters.
- **Borders:** 1px.
- **Shadows:**
  - cards: very soft, `0 1px 2px` at 6%;
  - dialogs and menus: `0 8px 24px` at 12%;
  - the phone bottom bar: a soft shadow upward.
- **Focus:** a 2px indigo ring with a 2px white gap, on everything a keyboard can reach.

## 7. Icons

- **Lucide** (lucide.dev): outline icons, 2px stroke, rounded ends. Don't mix in other icon sets.
- **Sizes:**
  - 18px inside buttons;
  - 20px in navigation;
  - about 22px inside the 48px tinted circles of KPI cards.
- **KPI icons** sit in a soft circle of their tone color (e.g. green circle + green check for "RSVP Approved").
- **Role icons:** crown = Owner (amber), shield = Admin, people = Viewer.

## 8. Components

Use these as they are. The screenshot names show where each one appears.

### Buttons
- **Heights:** 44px by default; small is 36px; large is 52px.
- **Shape and text:** 10px corners, semibold label, optional icon before the label.

| Variant | Look | Use |
|---|---|---|
| **Primary** | Indigo fill, white text | The page's main action. **One per area** |
| **Secondary** | White fill, indigo text, light indigo border | Other actions (Export, Preview, Edit) |
| **Soft** | Light indigo fill, indigo text | Low-emphasis actions inside cards |
| **Ghost** | No fill, muted text | Tertiary actions, "Cancel" |
| **Danger** | Red fill, white text | Confirming a delete |
| **Icon button** | 36px square | Row actions; a danger icon button is soft red |

Disabled buttons are faded, as in the faded "Save Changes" on `09_rsvp_settings_*`.

### Form fields
- **Label** above (14px medium), the field (44px tall, white, 1px border, 10px corners), and **helper text** below (12px muted).
- **Errors:** a red border with red helper text that says how to fix it.
- **Text areas** show a character counter on the right of the label row ("122/500").
- **Dropdowns** always use the product's own list design, a white panel with a soft shadow, never the browser's native dropdown.
- **Toggles:** switches with a label and a muted description line. Checkboxes are used in lists and confirmations.

### Cards
- **Look:** white, 1px border, 14px corners, very soft shadow, 20px padding.
- **Header:** a card title (18px semibold) with an optional muted description, and actions on the right.
- **KPI card:** the label (14px muted) on top, the big number (24px bold), a unit underneath (12px: "invitations", "people", "chairs"), and a tinted icon circle on the right.
- **Notice card:** soft tone background, tone border, an icon, a bold tone-colored title, a muted body line, and an optional chevron when it links somewhere (e.g. "Not enough seats" on the Dashboard).

### Tabs
- **Segmented tabs:** a light rounded container, with the selected tab as a filled indigo pill. They switch main views on a page (e.g. Table Arrangement / Tables; Welcome / Approved / Declined / Not Sure).
- **Underline tabs:** the selected tab is indigo text with a bottom line. Used for sub-views (e.g. Guests / Unknown Guests).
- **Counts:** shown as a small pill inside the tab ("Guests 159").
- **Phones:** tabs never scroll sideways, so every tab must fit (keep labels short).

### Data tables (desktop)
- Header row on a muted background, 14px text, headers **centered**.
- Number columns are centered; text columns are aligned to the start.
- The **actions column is last**, pinned to the edge, and its header is hidden.
- Pagination under the table: "Rows per page" on one side, page numbers on the other.
- On phone, every table becomes cards (see §3).

### Badges (status pills)
- Pill shape, 12px semibold text, soft tone background, tone text, optional small icon.
- Examples: "✓ Approved", "◷ Awaiting Response", "✕ Declined", "No table".

### Dialogs
- **Look:** white, 14px corners, a title row with a close (✕) button, the body, and a footer with the buttons on the right (primary last).
- **Widths:** 512px for normal dialogs, 800px for large ones (e.g. guest import).
- **On phone:** dialogs fill the screen width and pin their footer.
- **Destructive dialogs:**
  - say exactly what will happen ("3 guest parties will become unassigned");
  - ask for a confirmation checkbox when data is affected;
  - confirm with a Danger button.

### Other
- **Toasts:** a short confirmation in the bottom corner, on the right (the left in Hebrew), above the phone bottom bar ("The event was created.").
- **Empty states:** an icon, one sentence, and one primary action.
- **Loading:** skeleton or spinner.
- **Error states:** what went wrong + "Try again".
- **Avatar:** a circle with initials on light indigo.
- **Event cover:** the event's photo, or a generated colorful cover, on event cards and in the event selector.
- **Floor plan:**
  - a light grid room;
  - tables drawn with chairs around them: indigo chairs when taken, white when free;
  - red with a "!" when over capacity;
  - venue objects (stage, bar, food station, entrance…) as labeled soft rectangles;
  - zoom controls at the top right.

## 9. Hebrew (RTL) and Portuguese

- In **Hebrew the whole layout mirrors**: the sidebar moves to the right, the primary action moves to the left, and chevrons and arrows flip. Draw mockups in English (left-to-right); the mirroring is built from them. For a complex new screen, one Hebrew version helps.
- **The floor plan does not mirror.** A room is a physical place, so the map stays the same in every language.
- **Phone numbers, emails and links** always read left-to-right, even inside Hebrew text.
- **Plan for longer text:** Portuguese labels are often about 30% longer than English. Leave room in buttons, tabs and table headers, and avoid designs that only work with very short words.

## 10. Accessibility

- Text contrast is at least WCAG AA. The token colors above already pass; don't put muted text on tinted backgrounds.
- Touch targets are at least 44px tall on phone.
- Every icon-only button has a text label for screen readers. Draw a tooltip when its meaning isn't obvious.
- Status is never color-only: always text, and preferably an icon too.
- Locked or "managed by someone else" information is written as text, not shown only as a lock icon.

## 11. Content in mockups

- Use **fictional** names, `example.com` emails and obviously fake phone numbers (e.g. `050-000-0000`). Never use real people or real numbers.
- Use the demo's tone: "Maya & Daniel's Wedding", "Seaside Hall, Tel Aviv". For venues, something like "Grand Garden Hall" with spaces "Main Hall" and "Garden".
- Keep the product's words: **Guests, RSVP, Messages, Event Layout, Event Settings, Permissions, Tables, Table Arrangement, Confirmed Attendees, Seating Capacity**.
  - A **guest** is an invitation party (a family or couple), not a single person.
  - **Attendees** are people.
  - **Seats/chairs** belong to tables.

## 12. V2.2: how the venue screens should feel

- **Same product, new workspace.**
  - Venue screens use the same shell, cards and tables.
  - The only new element in the shell is the **workspace switcher** at the top of the sidebar, styled like the event selector card: "Personal" / "Grand Garden Hall".
  - Inside the venue workspace, the sidebar lists My Events, My Spaces, Team and Settings.
- **"Managed by venue" badge:** use the **Info** tone (indigo soft) with a building icon (e.g. Lucide `building-2`). It appears on event cards and on the event's Dashboard for the client.
- **Locked venue details** (client view):
  - a card titled "Venue details", with label → value pairs as text;
  - an Info notice with a building icon: "Maintained by <Venue>. Contact them to change it.";
  - no input boxes.
- **What the client can't do with the map:** the client sees the map with no Edit Layout, Add Table or delete controls. Seating ("Manage Guests") stays fully visible and active, and a small muted line explains "The room and tables are arranged by <Venue>".
- **What the venue sees on Guests:** no phone column, no add, import or delete, and no WhatsApp buttons. A notice says "The guest list is managed by the client".
- **Status badges for venue events:**
  - *Awaiting client:* Warning, clock icon;
  - *Invitation sent:* Info, mail icon;
  - *Client joined:* Success, check icon;
  - *Past:* Neutral.
- **Space cards** follow the event card style: a cover image, name, address, and key figures ("450 people · 50 tables · 3 layouts").
- **Wizard** (create a venue event):
  - a step indicator across the top (numbered circles joined by a line, the current step in indigo, finished steps with a check);
  - one card per step;
  - Back (secondary) and Next (primary) at the bottom right, or in the phone bottom bar.

## 13. What to deliver

- **Format:** PNG (or a link to the design file). One image per screen, per size:
  - desktop at 1440px wide;
  - phone at 390–412px;
  - full page height.
- **Names:** `<screen>[_<tab or step>].png` for desktop, adding `_mobile` for phone, as listed in `v2_plannings/V2.2_MOCKUPS.md` (e.g. `venue_spaces.png`, `venue_spaces_mobile.png`).
- **Language:** English, left-to-right. Optional: one Hebrew version of the wizard and one of a venue list page.
- **States worth drawing when they matter:** empty (no spaces or events yet), error, and the destructive confirmation dialogs. Normal loading states don't need mockups.

---

## Files to give the designer

**Must have**
1. `resources/DESIGN_GUIDE.md`: this file.
2. `v2_plannings/V2.2_MOCKUPS.md`: the list of screens to draw, what each must show, priorities and file names.
3. `resources/screenshots/` (all 60 images): how every current page looks, desktop and phone.

**Helpful context**

4. `v2_plannings/V2.2_IMPLEMENTATION_PLAN.md`. The designer only needs these sections:
   - §1: what venues and clients can do;
   - §3: the decisions;
   - §3a: the venue roles;
   - §4: what is in and out of scope.
5. `resources/mockups/`: the original designs. Mostly superseded by the screenshots, but useful for the intended style.

**Not needed:** `AGENTS.md`, `PLAN.md`, `docs/`, the hosting plan, and the code.
