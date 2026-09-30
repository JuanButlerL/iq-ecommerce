-- Additive only: new consent origin for the public newsletter page.
ALTER TYPE "NewsletterConsentSource" ADD VALUE IF NOT EXISTS 'NEWSLETTER_PAGE';
