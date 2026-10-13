# Mockup notes: scope and differences from the PRD

Recorded after reviewing all 19 images in `mockups/` against `docs/PRD.md` (2026-10-12); the two landing-page images were added and reviewed on 2026-10-13. `mockups/README.md` remains the authoritative page-to-image mapping; this file records where the images and the approved requirements disagree or leave gaps.

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
- The **Try Demo** entry is on the landing page (`landing_page.png`, added 2026-10-13). No mockup shows the Demo Mode indicator, Reset Demo, or the demo role switcher required by PRD §12.

### Landing page

Built in Phase 4 from `landing_page.png` and `landing_page_mobile.png`. Owner-defined flows (2026-10-13): Landing → Sign Up → account created → My Events; Landing → Sign In → My Events; Landing → Try Demo → the populated demo.

- **Hero screenshot.** The mockup shows a different product: navigation "Overview, Guests, RSVPs, WhatsApp, Seating, Tables, Analytics", a "Share Event" button and statuses "Confirmed / Pending / Not Attending". None of that exists here. A decorative preview is drawn in the same position with this product's navigation names, status names and fictional figures. **Decided (2026-10-13):** the drawing stays; it is not replaced by a screenshot.
- **"How it works"** is a header link with no matching section. Not built; listed in `docs/FUTURE_FEATURES.md`. "Features" scrolls to the feature cards.
- **Wording adjusted to the MVP** (owner approved with the Phase 4 plan, 2026-10-13):

  | Mockup text | Built text | Why |
  |---|---|---|
  | "Send beautiful WhatsApp invitations and reminders directly from the app." | "Write your invitation once and open it in WhatsApp for each guest, ready to send." | The MVP opens WhatsApp for the organizer to send; reminders are out of scope (PRD §7.1, §17) |
  | "Design your seating plan, manage tables, and easily assign guests." | "Set up your tables and assign confirmed guests, with capacity checked for you." | The visual seating plan is deferred (PRD §11.4) |
  | "Track responses in real time and see who's coming, pending or not attending." | "One RSVP link per event. See who is coming, who is not sure and who declined." | Uses the product's own statuses; nothing is pushed in real time |
  | "…a fully populated event and real sample data." | "…fully populated events and fictional sample data." | Demo data is fictional by rule (`AGENTS.md`), and there are several demo events |

- The mockup text contains a typo ("res:ponses"), not copied.
- The headline's second line is a gradient in the mockup; it is built in the solid primary colour so its contrast can be verified.
- On a phone the mockup shows only a menu button; the menu holds Sign In, Sign Up and Try Demo.
- The Sign In and Sign Up **forms** have no mockup.

### Homepage / Events

- Event cards show a **cover image** per event. **Decided (2026-10-12):** until organizers can upload one, each card shows a generated cover — a gradient with an icon, chosen from the event's id, drawn in the browser. Uploading an image when creating an event and in Event Settings is listed in `docs/FUTURE_FEATURES.md`.
- Cards have a "⋯" menu whose contents are not shown. It is the only visible place for Duplicate/Delete, since `event_settings.png` has neither. Built with Open, Duplicate and Delete; the last two for an Owner (or Super User) only.
- Search, grid/list toggle and All/Upcoming/Past tabs are not in the PRD; treated as presentation of existing data. The chosen tab, search text and layout are kept in the page address.
- The mockups show only the grid on desktop and only the list on a phone. Both layouts are available at every width; the list uses the phone mockup's card.
- The phone mockup shows Create Event below the tabs; built as shown.
- Cards additionally show the user's role in the event (`PLAN.md` Phase 4), which the mockups omit.

### Dashboard

- **Recent Guest Activity** lists individual RSVP and send events. The PRD stores only the last-sent and last-response timestamps per guest, and puts audit history out of scope (§17). **Decided (2026-10-12/13):** the list is derived from the per-send message history and each guest's latest response; an organizer's manual change counts as the guest's latest response.
- The KPI cards omit **Seating Capacity** and **Unassigned Confirmed Attendees**, both required by PRD §10. Seating Capacity appears only in the Attendance vs Capacity chart; Unassigned Confirmed Attendees appears only in `event_settings.png`. **Decided (2026-10-13):** both are added as two more KPI cards in the same style, after Confirmed Attendees.
- The PRD warnings "table chairs above event maximum" and "confirmed attendees awaiting table assignment" are not illustrated. **Decided (2026-10-13):** they use the same style as the over-capacity warning the mockup does draw.
- The "View Event" button and the Quick Actions panel are not in the PRD. **Decided (2026-10-13):** the button is named **Event Settings** and opens the Event Settings page. Quick Actions are navigation shortcuts, built as drawn.
- The sample numbers are not internally consistent (for example "exceeds by 14 attendees (300 / 286)" beside 214 confirmed of 300). All dashboard values are derived from data per PRD §10, never copied from the image.

- **RSVP Status chart.** The mockup's four groups (100 + 43 + 4 + 21) do not add up to its 164 guests, because guests who were never invited are missing. A fifth group, "Not Sent", is added (decided 2026-10-13).
- **Chevrons on the warnings** imply they lead somewhere, without showing where. Each warning is built as a link to the page where it is fixed (confirmed 2026-10-13).
- **"View All"** on Recent Guest Activity opens the longer list in a dialog (confirmed 2026-10-13).
- With ten cards the KPI grid is five per row on a wide screen, where the mockup shows four; two per row on a phone as drawn.
- On a phone the mockup shows no header button; the Event Settings button is shown full-width under the title.
- No charting library is used; the ring and bars are drawn with SVG and CSS.

### Side menu

- The mockups draw a fixed side menu on desktop. **Decided (2026-10-13):** a button in the top bar collapses it to a strip of icons and expands it again; the choice is remembered in the browser.

### Guests

Decided 2026-10-13 unless noted.

- Rows have **selection checkboxes**. Selecting rows offers Delete selected (with confirmation) and Export selected. Bulk sending is out of scope (PRD §17).
- Guests with `invitation_sent_count = 0` and no response are badged "Awaiting Response" in the mockup. PRD §10 defines Awaiting Response as sent count above zero with `NO_RESPONSE`. Such guests are labelled **Not Sent**.
- The **sliders button** beside the filters has no label or drawn behaviour. It is a column chooser: a dropdown listing every column with a checkbox, with Select all and Clear; Name and Phone are always shown. It appears only with the desktop table, so the phone mockup's sliders button is not reproduced.
- A **Clear filters** button, not in the mockup, is added beside it.
- A **Group** column and an "All Groups" filter are added; the mockup has neither. Add Guest and Edit Guest gain Group and Table fields.
- Column headings are centred (the mockup starts them at the edge); number columns are centred as drawn.
- The column and field the mockup calls "Allowed" is named **Expected attendees**.
- The **Approved** card shows confirmed attendees (people), with "attendees" under the figure, not the number of invitations that approved.
- The **"⋯" menu** holds Change RSVP and Delete. The **">" arrow** on the phone cards, and the guest's name on desktop, open a details panel.
- The **WhatsApp button** on each row is shown disabled with a "Soon" hint until Phase 8.
- The **Export** dropdown offers CSV and Excel.
- The KPI strip and the RSVP Status / Invitation Status / Table filters are not in the PRD; treated as presentation of existing data.
- The Unknown Guests tab is visible only as a tab header; its content has no mockup. Rejected responses are kept in a Rejected list, also without a mockup.

Found while building (Phase 6):

- The desktop mockup shows no bar for selected rows; a bar with the count, Export selected, Delete selected and Clear selection appears above the table while rows are selected.
- The phone mockup shows the sliders button and no checkboxes; neither the column chooser nor selection exists on a phone.
- The Actions column stays pinned at the end of the table while the other columns scroll, so it is reachable in a narrow window.
- The table selector lists each table as "number · name (seats free)".
- Import has no mockup; it is a four-step dialog.

### WhatsApp Messages

- **Recent Sent Messages** lists each send with time, status "Opened WhatsApp" and a message preview. The PRD stores a counter and the last send time, not a per-send history. Built as shown; the per-send record is added to the PRD in Phase 8.
- **Send Test Message** is not in the PRD. **Decided (2026-10-13):** it opens WhatsApp with the previewed message and no recipient; nothing is counted.
- The desktop mockup has **no Save Changes button**; one is added to the header beside Send Test Message.
- The editor draws variables as highlighted chips inside the text. The editor is a plain text box, so variables appear as `{{first_name}}` text; they are inserted with the Insert Variable buttons.
- The **"⋯" menu** on each sent message holds View message and Send again.
- The phone preview is drawn in CSS: the guest's name and the message bubble, without the status bar and call icons of the mockup.
- The editor toolbar offers bold, italic, underline, link and emoji. WhatsApp has its own plain-text formatting markers and no underline. **Decided (2026-10-13):** Bold, Italic, Strikethrough and Emoji; Underline and Link are not built.
- The variable set shown is `first_name`, `last_name`, `event_name`, `event_date`, `event_time`, `rsvp_url`. PRD §7 gives these as examples; this set is taken as the approved list.

### RSVP Settings and public RSVP

- The public form shows **Number of attendees as a required field above the three response buttons**. **Decided (2026-10-12):** the field is always required, as drawn. For Declined and Not Sure the submitted number is discarded. PRD §8.1 has been updated.
- The RSVP page shows a **location** ("Tel Aviv, Israel") and a short **display title** ("Deborah & Tomer") that differs from the event name. The event header in other mockups also shows a location. The PRD has no event location or RSVP title field; location exists only inside the Google Calendar action. Built as shown; the fields are added to the PRD in Phase 7 / Phase 9.
- An **RSVP Language selector** appears on both RSVP Settings and Event Settings. **Decided (2026-10-13):** RSVP Settings owns the event's default language, and each guest can switch the public page between English and Hebrew. Event Settings has no language selector; its "RSVP Settings" card keeps only the "RSVP remains open" notice. Organizer-written texts are not translated.
- **QR code** button and "RSVP page is active" status are not in the PRD. Built as shown.
- The mockup states limits the PRD does not: 500 characters per message, and background image "1920 × 1080, JPG or PNG, up to 5MB". Adopted as requirements.
- The mobile preview has Welcome / Approved / Declined / Not Sure state tabs; the desktop preview shows only the welcome state.

### Event Layout

- The mockup gives each table a **name** ("Family", "Friends"). **Decided (2026-10-13):** a table has only a number, a capacity and a shape; names are not built.

- Table status labels **Ready / Almost Full / Over Capacity** have no defined thresholds. In the mockup a full table (10 of 10) is "Ready" while 11 of 12 is "Almost Full". **Decision needed.**
- "Assigned Guests" in the KPI row counts attendees (214), not guest parties. Labels must make that distinction clear (`PLAN.md` Phase 5 exit criteria).

### Event Settings

- A required **Timezone** field is shown. PRD §5.2 relies on an event timezone and `PLAN.md` Phase 7 includes it, but the PRD §5.1 field table omits it. Treated as required; the PRD table should be updated when Phase 7 is implemented.
- The **Danger Zone** contains only a read-only notice and a "View Event Rules" button whose target is undefined. Duplicate and Delete are not shown here. **Decided (2026-10-13):** the button opens a read-only dialog listing the event's rules; Duplicate and Delete stay in the event card menu only.
- The mockup has no **Location** field, although an event has a location. **Decided (2026-10-13):** an optional Location field is added to General Information, under Event Name.

### Permissions

- **Invite User** corresponds to the unspecified invite flow (PRD §3.3, §18 item 4). **Decision needed** before Phase 11.
- The role explanation says "Viewer can only view the event". Per the PRD, Viewers can also export.

## Found while building the design system (Phase 2)

- **User menu.** The mockups draw a chevron beside the user name, implying a menu, but never show its contents. Since Phase 4 it holds Log out.
- **Event selector thumbnail.** The mockups show the event's cover image in the selector. Since Phase 4 it shows the event's generated cover.
- **Homepage sidebar.** With Profile and Settings left out, the homepage sidebar holds My Events, the language selector and, since Phase 4, Log out.
- **Typeface.** The mockups use an Inter-style typeface. The app asks for Inter and falls back to the system font; no font file is bundled.

## Phone bottom action bar

- `whatsapp_message_editor_mobile.png`, `whatsapp_message_preview_mobile.png`, `rsvp_settings_settings_mobile.png` and `rsvp_settings_preview_mobile.png` draw a two-button bar at the bottom that is wider than the page content. The owner confirmed this is a mockup error (2026-10-12); the proportions are not reproduced.
- **Decided (2026-10-12):** the bar's edges line up with the page content and its buttons share the width equally. It stays pinned to the bottom of the screen while the page scrolls. The primary action is on the inline-end side, so it mirrors in Hebrew.
- **Decided (2026-10-12):** on a phone, every form page that is saved uses this bar: Event Settings, WhatsApp Messages and RSVP Settings. `event_settings_mobile.png` shows Save Changes beside the page title; the bottom bar is used there instead, for consistency. List pages keep their create and export buttons where their own mockups show them. Desktop layouts are unchanged.

## Mockup content

The images use sample names, `example.com` email addresses, placeholder-style phone numbers (such as `050-123-4567`) and the domain `rsvp.eventplanner.com`. None of this is copied into the product. Demo data is generated separately under the rules in `AGENTS.md` (fictional names, non-routable contacts).

## Screens and states without a mockup

Built from the established visual language and shared components (`AGENTS.md`, UI mockups rule 12):

- Sign-in and sign-up forms, create-event form, duplicate-event and delete-event dialogs, account menu
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
