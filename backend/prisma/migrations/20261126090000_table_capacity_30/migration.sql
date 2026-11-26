-- Chairs at one table: 1 to 30 (D109), down from 1 to 1000.
-- NOT VALID: tables saved before keep their chairs, so no stored event is
-- rewritten; a change to such a table must bring it within the new range.
ALTER TABLE "EventTable" DROP CONSTRAINT "EventTable_capacity_range";
ALTER TABLE "EventTable"
  ADD CONSTRAINT "EventTable_capacity_range" CHECK ("capacity" BETWEEN 1 AND 30) NOT VALID;
