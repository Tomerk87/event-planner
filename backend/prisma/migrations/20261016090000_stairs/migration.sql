-- Steps are stairs between floor levels (owner, 2026-10-16); objects
-- already placed keep their kind under its new name.
ALTER TYPE "VenueObjectKind" RENAME VALUE 'STEPS' TO 'STAIRS';
