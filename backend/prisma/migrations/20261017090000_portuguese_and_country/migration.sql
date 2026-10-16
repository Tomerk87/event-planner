-- Brazilian Portuguese for the guest-facing pages, and a country for each
-- event, by which local phone numbers are read (owner, 2026-10-16, D103).
-- Existing events are in Israel, as every number was read until now.
ALTER TYPE "RsvpLanguage" ADD VALUE 'pt';

CREATE TYPE "Country" AS ENUM ('IL', 'BR');

ALTER TABLE "Event" ADD COLUMN "country" "Country" NOT NULL DEFAULT 'IL';
