-- CreateEnum
CREATE TYPE "VenueObjectKind" AS ENUM ('WALL', 'STAGE', 'BAR', 'STEPS', 'FOOD_STATION', 'ENTRANCE', 'PLANT');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "floorImageKey" TEXT,
ADD COLUMN     "floorImageRotation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "floorImageTransparency" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "floorImageZoom" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "layoutVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomDepth" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "roomWidth" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable
ALTER TABLE "EventTable" ADD COLUMN     "rotation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "x" INTEGER,
ADD COLUMN     "y" INTEGER;

-- CreateTable
CREATE TABLE "VenueObject" (
    "eventId" UUID NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "VenueObjectKind" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL,
    "label" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "VenueObject_pkey" PRIMARY KEY ("eventId","id")
);

-- AddForeignKey
ALTER TABLE "VenueObject" ADD CONSTRAINT "VenueObject_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The same ranges as the domain rules (LAYOUT_LIMITS and FLOOR_IMAGE in
-- domain/layout.ts). That a centre is inside the room is checked by the
-- domain rules, since the room's size can change.
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_roomWidth_range" CHECK ("roomWidth" BETWEEN 300 AND 20000),
  ADD CONSTRAINT "Event_roomDepth_range" CHECK ("roomDepth" BETWEEN 300 AND 20000),
  ADD CONSTRAINT "Event_floorImageTransparency_range" CHECK ("floorImageTransparency" BETWEEN 0 AND 90),
  ADD CONSTRAINT "Event_floorImageZoom_range" CHECK ("floorImageZoom" BETWEEN 25 AND 400),
  ADD CONSTRAINT "Event_floorImageRotation_range" CHECK ("floorImageRotation" BETWEEN -180 AND 180);

ALTER TABLE "EventTable"
  ADD CONSTRAINT "EventTable_placed" CHECK (("x" IS NULL) = ("y" IS NULL)),
  ADD CONSTRAINT "EventTable_rotation_range" CHECK ("rotation" BETWEEN 0 AND 359);

ALTER TABLE "VenueObject"
  ADD CONSTRAINT "VenueObject_size_range" CHECK ("width" BETWEEN 20 AND 20000 AND "height" BETWEEN 20 AND 20000),
  ADD CONSTRAINT "VenueObject_rotation_range" CHECK ("rotation" BETWEEN 0 AND 359);
