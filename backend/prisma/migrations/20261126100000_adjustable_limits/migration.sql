-- Adjustable limits (D110): the limits are set by the server's settings
-- (TABLE_MAX_SEATS, EVENT_MAX_ATTENDEES_*, GUEST_MAX_ATTENDEES_*) and
-- enforced by the application. The database keeps only safety ranges, the
-- most a setting may allow (LIMIT_CEILINGS in src/domain/limits.ts), so a
-- raised setting is not refused here. Every stored row is within them.

-- Chairs at one table: up to 1000 (the setting's default is 30).
ALTER TABLE "EventTable" DROP CONSTRAINT "EventTable_capacity_range";
ALTER TABLE "EventTable"
  ADD CONSTRAINT "EventTable_capacity_range" CHECK ("capacity" BETWEEN 1 AND 1000);

-- An event's Maximum Attendees: up to 100,000 (defaults 50 to 3000).
ALTER TABLE "Event" DROP CONSTRAINT "Event_maxAttendees_range";
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_maxAttendees_range" CHECK ("maxAttendees" BETWEEN 1 AND 100000);

-- People one invitation may confirm: up to 100 (default highest 10).
ALTER TABLE "Event" DROP CONSTRAINT "Event_defaultAllowedAttendees_range";
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_defaultAllowedAttendees_range" CHECK ("defaultAllowedAttendees" BETWEEN 1 AND 100);

ALTER TABLE "Guest" DROP CONSTRAINT "Guest_allowedAttendees_range";
ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_allowedAttendees_range" CHECK ("allowedAttendees" BETWEEN 1 AND 100);

ALTER TABLE "Guest" DROP CONSTRAINT "Guest_confirmed_matches_status";
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_confirmed_matches_status" CHECK (
  ("rsvpStatus" = 'APPROVED' AND "confirmedAttendees" BETWEEN 1 AND 100)
  OR ("rsvpStatus" = 'DECLINED' AND "confirmedAttendees" = 0)
  OR ("rsvpStatus" IN ('NO_RESPONSE', 'NOT_SURE') AND "confirmedAttendees" IS NULL)
);
