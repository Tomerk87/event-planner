# domain

Domain types (`models.ts`) and business rules that do not depend on React or on a data source: phone normalization by the event's country (Israel, Brazil), event validation and time, accounts, permissions and member lists, guests, groups and guest lists, guest import and CSV, RSVP and RSVP settings, seating and table lists, the floor plan's geometry (`layout.ts`), dashboard metrics, message rendering and export rows. `backend/src/domain` is a copy, checked by a test. Errors use the shared codes in `errors.ts`. Definitions are in `docs/DOMAIN.md`.
