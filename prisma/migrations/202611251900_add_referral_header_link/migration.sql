-- AlterTable
ALTER TABLE "referral_settings" ADD COLUMN     "header_label" TEXT NOT NULL DEFAULT 'Referidos',
ADD COLUMN     "show_in_header" BOOLEAN NOT NULL DEFAULT false;

