-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('NO_RESPONSE', 'APPROVED', 'NOT_SURE', 'DECLINED');

-- CreateEnum
CREATE TYPE "RsvpLanguage" AS ENUM ('en', 'he');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('CIRCLE', 'RECTANGLE', 'SQUARE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isSuperUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "maxAttendees" INTEGER NOT NULL,
    "defaultAllowedAttendees" INTEGER NOT NULL,
    "rsvpLanguage" "RsvpLanguage" NOT NULL,
    "location" TEXT,
    "rsvpTitle" TEXT,
    "coverImageKey" TEXT,
    "rsvpSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMembership" (
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "EventRole" NOT NULL,

    CONSTRAINT "EventMembership_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "EventRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "invitationName" TEXT,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "allowedAttendees" INTEGER NOT NULL,
    "confirmedAttendees" INTEGER,
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'NO_RESPONSE',
    "invitationSentCount" INTEGER NOT NULL DEFAULT 0,
    "lastInvitationSentAt" TIMESTAMPTZ(3),
    "lastRsvpResponseAt" TIMESTAMPTZ(3),
    "tableId" UUID,
    "group" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnknownRsvp" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "rsvpStatus" "RsvpStatus" NOT NULL,
    "confirmedAttendees" INTEGER,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL,
    "rejectedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UnknownRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RsvpSettings" (
    "eventId" UUID NOT NULL,
    "welcomeMessage" TEXT NOT NULL,
    "approvedMessage" TEXT NOT NULL,
    "declinedMessage" TEXT NOT NULL,
    "notSureMessage" TEXT NOT NULL,
    "backgroundImageKey" TEXT,
    "overlayOpacity" INTEGER NOT NULL,
    "calendarEnabled" BOOLEAN NOT NULL,
    "calendarTitle" TEXT NOT NULL,
    "calendarDate" TEXT NOT NULL,
    "calendarTime" TEXT NOT NULL,
    "calendarLocation" TEXT NOT NULL,
    "youtubeEnabled" BOOLEAN NOT NULL,
    "youtubeUrl" TEXT NOT NULL,

    CONSTRAINT "RsvpSettings_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "eventId" UUID NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "MessageSend" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "sentById" UUID,
    "sentAt" TIMESTAMPTZ(3) NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "MessageSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTable" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "shape" "TableShape" NOT NULL,

    CONSTRAINT "EventTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_rsvpSlug_key" ON "Event"("rsvpSlug");

-- CreateIndex
CREATE INDEX "EventMembership_userId_idx" ON "EventMembership"("userId");

-- CreateIndex
CREATE INDEX "EventInvitation_email_idx" ON "EventInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_email_key" ON "EventInvitation"("eventId", "email");

-- CreateIndex
CREATE INDEX "Guest_eventId_deleted_idx" ON "Guest"("eventId", "deleted");

-- CreateIndex
CREATE INDEX "Guest_tableId_idx" ON "Guest"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_eventId_normalizedPhone_key" ON "Guest"("eventId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "UnknownRsvp_eventId_normalizedPhone_key" ON "UnknownRsvp"("eventId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "MessageSend_eventId_sentAt_idx" ON "MessageSend"("eventId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventTable_eventId_number_key" ON "EventTable"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "EventTable_id_eventId_key" ON "EventTable"("id", "eventId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMembership" ADD CONSTRAINT "EventMembership_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMembership" ADD CONSTRAINT "EventMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tableId_eventId_fkey" FOREIGN KEY ("tableId", "eventId") REFERENCES "EventTable"("id", "eventId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnknownRsvp" ADD CONSTRAINT "UnknownRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpSettings" ADD CONSTRAINT "RsvpSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTable" ADD CONSTRAINT "EventTable_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database holds itself (PRD sections 5, 6, 8 and 11).
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_maxAttendees_range" CHECK ("maxAttendees" BETWEEN 50 AND 3000),
  ADD CONSTRAINT "Event_defaultAllowedAttendees_range" CHECK ("defaultAllowedAttendees" BETWEEN 1 AND 10);

ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_allowedAttendees_range" CHECK ("allowedAttendees" BETWEEN 1 AND 10),
  ADD CONSTRAINT "Guest_invitationSentCount_nonnegative" CHECK ("invitationSentCount" >= 0),
  ADD CONSTRAINT "Guest_confirmed_matches_status" CHECK (
    ("rsvpStatus" = 'APPROVED' AND "confirmedAttendees" BETWEEN 1 AND "allowedAttendees")
    OR ("rsvpStatus" = 'DECLINED' AND "confirmedAttendees" = 0)
    OR ("rsvpStatus" IN ('NO_RESPONSE', 'NOT_SURE') AND "confirmedAttendees" IS NULL)
  ),
  ADD CONSTRAINT "Guest_table_only_when_approved" CHECK ("tableId" IS NULL OR ("rsvpStatus" = 'APPROVED' AND NOT "deleted")),
  ADD CONSTRAINT "Guest_group_length" CHECK ("group" IS NULL OR char_length("group") BETWEEN 1 AND 40);

ALTER TABLE "UnknownRsvp"
  ADD CONSTRAINT "UnknownRsvp_is_a_response" CHECK ("rsvpStatus" <> 'NO_RESPONSE'),
  ADD CONSTRAINT "UnknownRsvp_confirmed_matches_status" CHECK (
    ("rsvpStatus" = 'APPROVED' AND "confirmedAttendees" >= 1)
    OR ("rsvpStatus" = 'DECLINED' AND "confirmedAttendees" = 0)
    OR ("rsvpStatus" = 'NOT_SURE' AND "confirmedAttendees" IS NULL)
  );

ALTER TABLE "EventTable"
  ADD CONSTRAINT "EventTable_number_range" CHECK ("number" BETWEEN 1 AND 9999),
  ADD CONSTRAINT "EventTable_capacity_range" CHECK ("capacity" BETWEEN 1 AND 1000);

ALTER TABLE "RsvpSettings"
  ADD CONSTRAINT "RsvpSettings_overlayOpacity_range" CHECK ("overlayOpacity" BETWEEN 0 AND 100);
