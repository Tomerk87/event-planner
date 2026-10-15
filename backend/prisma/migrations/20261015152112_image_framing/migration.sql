-- AlterTable
ALTER TABLE "RsvpSettings" ADD COLUMN     "imagePositionX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "imagePositionY" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "imageZoom" INTEGER NOT NULL DEFAULT 100;

-- The same ranges as the domain rules (IMAGE_FRAMING in domain/rsvpSettings.ts).
ALTER TABLE "RsvpSettings"
  ADD CONSTRAINT "RsvpSettings_imageZoom_range" CHECK ("imageZoom" BETWEEN 100 AND 300),
  ADD CONSTRAINT "RsvpSettings_imagePositionX_range" CHECK ("imagePositionX" BETWEEN 0 AND 100),
  ADD CONSTRAINT "RsvpSettings_imagePositionY_range" CHECK ("imagePositionY" BETWEEN 0 AND 100);
