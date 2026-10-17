-- A guest's Expected Attendees is the organizer's planning note; what a
-- guest confirms is limited by the event's Maximum Attendees per Guest,
-- checked by the server (owner, 2026-10-17, D104). The database keeps the
-- product's bounds: 1 to 10 people for an approval.
ALTER TABLE "Guest" DROP CONSTRAINT "Guest_confirmed_matches_status";

ALTER TABLE "Guest" ADD CONSTRAINT "Guest_confirmed_matches_status" CHECK (
  ("rsvpStatus" = 'APPROVED' AND "confirmedAttendees" BETWEEN 1 AND 10)
  OR ("rsvpStatus" = 'DECLINED' AND "confirmedAttendees" = 0)
  OR ("rsvpStatus" IN ('NO_RESPONSE', 'NOT_SURE') AND "confirmedAttendees" IS NULL)
);
