# Mockup notes: scope and differences from the PRD

Recorded after reviewing all 19 images in `resources/mockups/` against `docs/PRD.md` (2026-10-12); the two landing-page images were added and reviewed on 2026-10-13. `resources/mockups/README.md` remains the authoritative page-to-image mapping; this file records where the images and the approved requirements disagree or leave gaps.

Rule applied throughout (`AGENTS.md`, owner decision 2026-10-12): the mockups were created after the PRD, so where a mockup differs from or adds to the PRD, the mockup is built. The PRD remains the source of truth for business rules and is updated in the same phase. Items marked **Decision needed** are ones this rule does not settle, because mockups contradict each other or do not show what an element does; they are listed in `docs/DOMAIN.md` and are not to be resolved by guessing. Items marked **Decided** record an owner decision.

## Visual Arrangement scope

Built in Phase 20 (D100, PRD §11.4). The Arrangement mockups are followed:

- `event_layout.png`: the Table Arrangement tab without the **Soon** badge. The **Arrangement Preview** and **Capacity Warnings** drawn there are not built (owner, 2026-10-16); the Selected Table card is beside the list on both tabs (D69).
- `event_layout_arrangement_mobile.png`: the phone's View Mode with its hint, Fullscreen, pinch to zoom, the red "!" on tables over capacity and the Selected Table card below the plan. The phone tab keeps the desktop's name, "Table Arrangement".
- Food Station, Entrance and plants, drawn in the mockups but not in the old PRD list, are built.
- Not drawn in any mockup: Edit mode (palette, panel, Save Layout, Cancel), the floor picture (owner, 2026-10-16), and the "Check the plan" warnings.
- Earlier decision, superseded 2026-10-16: the tab was shown with "Soon" and disabled, with no preview (2026-10-12).

## Differences that affect behavior or scope

### Navigation and shell

- **Decided (2026-10-12):** the event sidebar is identical on every event-level page: Dashboard, Guests, RSVP, Messages, Event Layout, Event Settings, Permissions. Permissions is hidden for Viewers. This order differs from the mockups, which show Messages before RSVP.
- `event_layout.png` and `permissions.png` show sidebar entries **Budget, Vendors, Timeline, Photo Sharing**, place Permissions directly after Event Layout, and label the last entry "Settings". The owner confirmed these two sidebars are wrong; the four extra entries are not built and are listed in `docs/FUTURE_FEATURES.md`.
- The event selector appears in the sidebar (`dashboard.png`, `guests.png`, `whatsapp_message.png`, `rsvp_settings.png`), in the top bar (`event_layout.png`, `permissions.png`), and in both at once (`event_settings.png`). **Decided (2026-10-12):** the selector is in the sidebar only.
- Every screen shows a **notification bell**, and `homepage.png` shows **Profile** and **Settings** account pages. The PRD defines no notifications, profile or account-settings features. **Decided (2026-10-12):** all three are left out of the MVP and listed in `docs/FUTURE_FEATURES.md`. **Changed (2026-10-15):** the bell is built (D95); its list is not drawn and uses the shared popover. Profile and Settings stay out.
- A **crown icon** appears beside the user avatar on mobile screens and on `permissions.png`. **Decided (2026-10-12):** it is the user's role in the current event, using the same icons as the Permissions role badges (crown for Owner, shield for Admin, people icon for Viewer). No icon is shown outside an event, so the crown on the homepage mockups is not reproduced. A Super User without a membership shows the crown.
- The **Try Demo** entry is on the landing page (`landing_page.png`, added 2026-10-13). No mockup shows the Demo Mode indicator, Reset Demo, or the demo role switcher required by PRD §12.

### Landing page

Built in Phase 4 from `landing_page.png` and `landing_page_mobile.png`. Owner-defined flows (2026-10-13): Landing → Sign Up → account created → My Events; Landing → Sign In → My Events; Landing → Try Demo → the populated demo.

- **Hero screenshot.** The mockup shows a different product: navigation "Overview, Guests, RSVPs, WhatsApp, Seating, Tables, Analytics", a "Share Event" button and statuses "Confirmed / Pending / Not Attending". None of that exists here. A decorative preview is drawn in the same position with this product's navigation names, status names and fictional figures. **Decided (2026-10-13):** the drawing stays; it is not replaced by a screenshot.
- **"How it works"** is a header link with no matching section. Not built; listed in `docs/FUTURE_FEATURES.md`. "Features" scrolls to the feature cards.
- **Wording adjusted to the MVP** (owner approved with the Phase 4 plan, 2026-10-13):

  | Mockup text                                                                    | Built text                                                                          | Why                                                                                           |
  | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | "Send beautiful WhatsApp invitations and reminders directly from the app."     | "Write your invitation once and open it in WhatsApp for each guest, ready to send." | The MVP opens WhatsApp for the organizer to send; reminders are out of scope (PRD §7.1, §17)  |
  | "Design your seating plan, manage tables, and easily assign guests."           | "Set up your tables and assign confirmed guests, with capacity checked for you."    | The visual seating plan was deferred when written; it was built in Phase 20 (PRD §11.4, D100) |
  | "Track responses in real time and see who's coming, pending or not attending." | "One RSVP link per event. See who is coming, who is not sure and who declined."     | Uses the product's own statuses; nothing is pushed in real time                               |
  | "…a fully populated event and real sample data."                               | "…fully populated events and fictional sample data."                                | Demo data is fictional by rule (`AGENTS.md`), and there are several demo events               |

- The mockup text contains a typo ("res:ponses"), not copied.
- The headline's second line is a gradient in the mockup; it is built in the solid primary colour so its contrast can be verified.
- On a phone the mockup shows only a menu button; the menu holds Sign In, Sign Up and Try Demo.
- The Sign In and Sign Up **forms** have no mockup.

### Homepage / Events

- Event cards show a **cover image** per event. **Decided (2026-10-12):** until organizers can upload one, each card shows a generated cover — a gradient with an icon, chosen from the event's id, drawn in the browser. Since D76 an organizer can upload an event photo when creating an event and in Event Settings; the generated cover is used when there is none.
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
- A **Group** column (last, after Table) and an "All Groups" filter are added; the mockup has neither. Add Guest and Edit Guest gain a Group dropdown, which can create a group after a confirmation, and a Table field.
- Column headings are centred (the mockup starts them at the edge); number columns are centred as drawn.
- The column and field the mockup calls "Allowed" is named **Expected attendees**.
- The **Approved** card shows confirmed attendees (people), with "attendees" under the figure, not the number of invitations that approved.
- The **"⋯" menu** held Change RSVP and Delete until 2026-10-17; each row now offers **Edit** instead, Delete is in Edit Guest, and the RSVP answer changes in the list (D105): Status is a dropdown opened by one click (on desktop and on phone cards), and an approved guest's Confirmed count changes by double-click on desktop or a tap on a phone card. The Change RSVP dialog was removed. The **">" arrow** on the phone cards, and the guest's name on desktop, open a details panel, which offers Edit.
- The **WhatsApp button** on each row opens the message for that guest (built in Phase 8; it was shown disabled with a "Soon" hint before).
- The **Export** dropdown offers CSV and Excel.
- The KPI strip and the RSVP Status / Invitation Status / Table filters are not in the PRD; treated as presentation of existing data.
- The Unknown Guests tab is visible only as a tab header; its content has no mockup. Rejected responses are kept in a Rejected list, also without a mockup.

Found while building (Phase 6):

- The desktop mockup shows no bar for selected rows; a bar with the count, Export selected, Delete selected and Clear selection appears above the table while rows are selected.
- The phone mockup shows the sliders button and no checkboxes; neither the column chooser nor selection exists on a phone.
- The Actions column stays pinned at the end of the table while the other columns scroll, so it is reachable in a narrow window.
- The table selector lists each table as "number (seats free)".
- Import has no mockup; it is a four-step dialog.
- **Edit Guest** was the first item of the "⋯" menu (owner, 2026-10-14, D81); since 2026-10-17 it is an **Edit** button on the row, close to the pencil drawn in `guests.png` (D105).

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
- An **RSVP Language selector** appears on both RSVP Settings and Event Settings. **Decided (2026-10-13):** RSVP Settings owns the event's default language, and each guest can switch the public page between English, Hebrew and Portuguese (D103). Event Settings has no language selector; its "RSVP Settings" card keeps only the "RSVP remains open" notice. Organizer-written texts are not translated.
- **QR code** button and "RSVP page is active" status are not in the PRD. Built as shown.
- The mockup states limits the PRD does not: 500 characters per message, and background image "1920 × 1080, JPG or PNG, up to 5MB". Adopted as requirements.
- The mobile preview has Welcome / Approved / Declined / Not Sure state tabs; the desktop preview shows only the welcome state. **Built (2026-10-13):** the four tabs are offered on desktop too.
- **Built differently (2026-10-13):** on desktop, Save Changes and Preview Public Page are in the page header, as on Event Settings and WhatsApp Messages, not in the Additional Settings card at the bottom. The calendar and YouTube fields appear only while their switch is on. The preview is drawn in a simple phone frame without a status bar. With no picture, the page has a plain dark background. The public form's date line shows the time as well as the date.
- **Preview Public Page** opens a full-size preview with unsaved changes on desktop and switches to the Preview tab on a phone; **Open Public Page** opens the saved page in a new tab (D63).

### Event Layout

- The mockup gives each table a **name** ("Family", "Friends"). **Decided (2026-10-13):** a table has only a number, a capacity and a shape; names are not built.

- Table status labels **Ready / Almost Full / Over Capacity** have no defined thresholds. In the mockup a full table (10 of 10) is "Ready" while 11 of 12 is "Almost Full". **Decided (2026-10-13, D22):** Over Capacity above the chairs; Full with no seat free, a label the mockup does not draw; Almost Full with 1 or 2 seats free; Ready otherwise. _Renamed (owner, 2026-11-25, D108): Ready is shown as **Available Seats**._
- "Assigned Guests" in the KPI row counts attendees (214), not guest parties. It is labelled **Assigned Attendees**.
- **Selected Table** is drawn under the Arrangement Preview on desktop and only in the Arrangement tab on a phone. It is built at the same place on both tabs: beside the list or the plan from 1280px, below it on narrower screens and phones, for the one table chosen by a click on its row or on the plan (D69, revised 2026-10-16). The panel's subtitle (the table's name) is not shown.
- **Manage Guests / View Guests** has nothing drawn behind it; it opens the dialog described in D68.
- The row **"…"** menu has no drawn contents; it held Delete Table until D105, when it became an **Edit** button (see below).
- **Export Tables** opens a menu of CSV and Excel and writes the seating list (D70).
- **Capacity Warnings** is not built (owner, 2026-10-16): a table over capacity shows it by its status and on the plan. The seating notice (chairs against confirmed attendees) and attendees awaiting a table, which the mockup does not draw, are cards of their own under the figures, exactly as on the Dashboard, on both tabs (owner, 2026-10-16).
- The search placeholder says "by number or name"; it searches by number.
- The phone tab is drawn as "Arrangement"; it is named "Table Arrangement", as on desktop.
- The list shows 10 tables a page with the product's pager, not the 8 and 5 drawn. The phone's ↑↓ button opens a sort menu; on desktop the column headings sort.
- Add Table and Edit Table have no mockup; they are a dialog with Table Number, Capacity and Shape.
- **Edit Table** was the first item of the row's "⋯" menu (owner, 2026-10-14, D82); since 2026-10-17 it is an **Edit** button on the row, and Delete Table is on the Selected Table card and in Edit Table (D105).
- The seating card is amber only when confirmed attendees outnumber the chairs; chairs below the event maximum with everyone seated is shown in green (D77).

### Event Settings

- A required **Timezone** field is shown. PRD §5.2 relies on an event timezone and `PLAN.md` Phase 7 includes it, but the PRD §5.1 field table omits it. Treated as required; the PRD table should be updated when Phase 7 is implemented.
- The **Danger Zone** contains only a read-only notice and a "View Event Rules" button whose target is undefined. Duplicate and Delete are not shown here. **Decided (2026-10-13):** the button opens a read-only dialog listing the event's rules; Duplicate and Delete stay in the event card menu only. _Renamed (owner, 2026-11-25, D108): the section is titled **Event Rules**, since it holds rules, not destructive actions._
- The mockup has no **Location** field, although an event has a location. **Decided (2026-10-13):** an optional Location field is added to General Information, under Event Name. It suggests places from Google Maps when the deployment has a Google key (D104).
- The mockup has no **Phone Number Country** field. **Added (D103):** Israel or Brazil, the country a number typed without a code is read as.
- The **Timezone** field can be searched by city or by country (D104).

### Permissions

- **Invite User** opens a dialog with an email and a role. An email with no account becomes a pending invitation (D4); the mockups draw no pending line, so it reuses the member line with a "Pending" badge and "No account yet" in place of the name.
- The role explanation says "Viewer can only view the event". Per the PRD, Viewers can also export, and the note says so. It also says an Admin cannot change an Owner.
- The **Actions** heading is drawn; it is hidden, as in every data table (D55).
- **Change Role** and the bin have nothing drawn behind them; each opens a dialog (D72). On a phone they are the two icon buttons drawn.
- The role cards draw the icon before the figure; the shared KPI card puts it after, as on the other pages. On a phone the three cards stay on one row, as drawn, with the icon above the figure.
- Role badge colours: Owner amber (the crown's colour in the top bar), Admin indigo, Viewer grey; the mockup draws the Owner badge violet.
- Not drawn and added: the read-only note for an Admin of a past event, the note shown while a demo role is simulated, the empty search result, and the state for a Viewer who types the address.

### Emails

- The email mockup (`event_collaboration_email.png`) draws the invitation; the same layout is used for every email the server sends (D93).
- The greeting uses the person's name only when they have an account; an invitation to an address with no account says "Hi,".
- The message also names the person who sent the invitation.
- **Accept Invitation** opens sign-up with the invited address filled in. There is no separate "accept" step: signing up (and verifying the address when email is on) gives the access (D89).
- The footer's **Help**, **Privacy** and **Terms** links are not shown, since those pages do not exist.
- The pictures (mark, envelope, Role and Date icons, lock) are redrawn to match and sent inside the email, since email programs block pictures from the web and do not show SVG.

### Tabs

- The Guests (Guests / Unknown Guests) and My Events (All / Upcoming / Past) tabs are drawn as underlined tabs. They use the segmented buttons of Event Layout instead, so a row of tabs never scrolls sideways on a phone, in Hebrew either (D98).

## V2.2 venue mockups

Reviewed 2026-11-27: the 19 HTML pages in `resources/mockups/v2/html/` against `v2_plannings/V2.2_MOCKUPS.md` and decisions D111–D118. Every screen on the list is covered, apart from #8, #18 and #21, which are built from existing patterns as the list allows. Rule R1 applies: build what the mockups show; the decisions and the PRD (§20) set the rules.

- **The "Mockup state" bar** at the bottom of most pages switches between drawn states. It is a mockup tool and is not built.
- **Combined screens:** #1 (the workspace switcher) is drawn inside `02_venue_events.html`, and #4 (the create/edit space dialog) inside `05_venue_space_details.html`.
- **Decided (2026-11-27), the event name and photo:** #9 step 3 says the client "sees these details but can't change them", which would include the name, while #14 lets the client edit the name and photo. The owner chose #14 (D113): the venue sets the first name, then the name and photo are the client's. The step-3 wording is built as covering only the date, time, space and maximum people.
- **Not built, the PDF seating export:** #17 offers Excel or PDF for the venue's seating export. PDF export is a future feature (`docs/FUTURE_FEATURES.md`), so the venue gets the existing CSV and Excel formats, still without phone numbers (D118).
- **Adopted, the venue's contact details:** the client's "Need a change? Contact the venue" note (#13, #14, #16) shows a contact email and phone. They come from Venue Settings (#8), which therefore holds them (D117).
- **Drafts removed:** three early versions of #2 (`01_venue_events.html`, `venue_events_mobile.html`, `venue_events_mobile_and_desktop.html`) were deleted; `02_venue_events.html` replaces them.
- **Phone width, #3 and #5:** a hidden "For information" tooltip sticks out past the right edge at 390px. This is a mockup quirk; the built page has no sideways scroll.
- **Languages:** all mockups are English; Hebrew and Portuguese follow the existing rules (`AGENTS.md`, `resources/DESIGN_GUIDE.md` §9).
- **Team (#7), not built: the "Events Created" column.** The product doesn't record who created an event, so the column is left out (Phase 25b). The Owner's and Managers' counts, the pending invitations, search and role filter are built.
- **My Spaces and space details (#3, #5):**
  - Add Layout and Edit (a layout) open the layout editor (Phase 26); Create Event from This Layout opens the wizard at its details step (Phase 27).
  - The layout preview draws the room, its objects and the tables' outlines, without each chair.
- **The layout template editor (#6), not built:**
  - **Export Tables:** a template has no guests, so there is no seating list to export. Exporting the tables themselves is the table summary export, already in `docs/FUTURE_FEATURES.md`.
  - **"by <name>" after Last edited:** the product doesn't record who edited.
- **The create-event wizard (#9):**
  - **Step 3 wording (D113):** built as "Your client sees the date, time and place but can't change them"; the name hint says the client can change it later.
  - **Not built, booked-day dots in the calendar:** the date is the browser's own date field, as on the personal event form, which can't mark days. The same-day warning appears as soon as a date is picked instead.
  - **Not built, choosing the generated cover's colour:** the event's cover photo field is reused; without a photo the event keeps its generated cover, as everywhere else.
  - **The done screen** (no mockup): the event's name, the invitation waiting for the client's email (or how to invite later), Back to My Events and Create Another.
  - The demo sends no email; the review says so beside "An invitation will be emailed to the client".
- **The client card and accept page (#10, #12), Phase 28:**
  - **Where the card is:** #10 draws it on the event's Permissions page. The venue can't open its events' pages until Phase 29, so it has its own page for now (`/venues/:organizationId/events/:eventId`), opened from the event card, with the same three sections. Phase 29 moves it into the event.
  - **The demo link:** the demo sends no email, so the card shows the open link ("Open Invitation Link"). The real service never returns it.
  - **Accepting in the demo:** the demo has one account, so the accept page shows the real "different email" state, plus a demo-only "Accept as the Client" (until the venue/client switcher, Phase 31). The accepted page then offers "Back to <venue>".
  - **Not yet, Open Event and the Next Steps links:** the client opens the event in Phase 29; the steps are shown without links until then.
  - **Signed out:** the page asks to sign in or create an account, without the event's details; showing them needs the backend's public read of a link.
  - **Added, a venue member can't accept:** the two sides stay apart (D113), so a venue member with the invited address is told to use another account.
  - **Revoke** is the red icon button beside Invite a Different Client, with a confirmation.
- **The venue's side of the event (#15, #17, #18, #19), Phase 29a:**
  - **The client card moved** into the event's Permissions page, as #15 draws it; the Phase 28 address now opens it there.
  - **Dashboard warnings (#19):** one section, as drawn. Not built: the expandable per-table rows ("12 people seated on 10 chairs") with Hide/Details; each warning shows its lines instead.
  - **Guests (#17):** not built, "Last change by the client: today, 14:20" (the product doesn't record who changed the list). The status column keeps the product's statuses, so "Not Sent" appears where #17 shows only answered and "Awaiting Response" guests.
  - **Event Settings for the venue** (no mockup): the existing page, where the venue's fields (date, time, zone, place, maximum) are editable and the client's (name, photo, guest settings) are shown read-only.
  - **Event Layout for the venue (#18, no mockup):** the existing page; tables and the map are editable, and seating is view-only (no Assign).
  - **The demo's role switcher** is hidden on a venue event, where roles come from the venue.
- **The space dialog (#4):** the photo field is the event photo field, with the label "Space Photo" and the space's initials as the placeholder.

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
- Invite User dialog and the pending-invitation line on Permissions
- Unknown Guests tab content and its review / convert / merge / reject actions
- Guest add/edit form, guest import flow (mapping, preview, errors), export menu
- The Status dropdown and Confirmed editor in the guest list and on phone cards (D105)
- Location suggestions from Google Maps (D104)
- Table add/edit form, assign-guests dialog, populated-table delete confirmation
- Change-role and remove-member dialogs on Permissions
- Public RSVP as a standalone page, including validation errors and the closed (past event) state
- Past-event read-only presentation and Viewer-restricted presentation of each page
- Loading, empty and error states
- Every Hebrew/RTL and Portuguese layout (all mockups are English/LTR)
- Tablet layouts: not designed or verified for the MVP (owner decision 2026-10-12); a tablet gets the desktop or phone layout that fits its width
