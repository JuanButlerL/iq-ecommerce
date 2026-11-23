-- CreateEnum
CREATE TYPE "ReferralCouponKind" AS ENUM ('FRIEND_DISCOUNT', 'REFERRER_CREDIT');

-- CreateEnum
CREATE TYPE "ReferralAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ReferralCreditStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REJECTED', 'VOIDED');

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "referral_account_id" UUID,
ADD COLUMN     "referral_kind" "ReferralCouponKind";

-- CreateTable
CREATE TABLE "referral_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "friend_discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "credit_amount_ars" INTEGER NOT NULL DEFAULT 5000,
    "credit_validity_days" INTEGER NOT NULL DEFAULT 90,
    "credit_hold_days" INTEGER NOT NULL DEFAULT 0,
    "require_manual_approval" BOOLEAN NOT NULL DEFAULT false,
    "share_message" TEXT NOT NULL DEFAULT '',
    "share_image_url" TEXT,
    "terms_text" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_accounts" (
    "id" UUID NOT NULL,
    "tax_id" TEXT NOT NULL,
    "first_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "ReferralAccountStatus" NOT NULL DEFAULT 'INVITED',
    "invited_by" TEXT,
    "activated_at" TIMESTAMP(3),
    "terms_accepted_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_login_tokens" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_credits" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "referred_order_id" UUID NOT NULL,
    "referred_tax_id" TEXT NOT NULL,
    "amount_ars" INTEGER NOT NULL,
    "status" "ReferralCreditStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "hold_until" TIMESTAMP(3),
    "available_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_credit_uses" (
    "id" UUID NOT NULL,
    "credit_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_ars" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_credit_uses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_accounts_tax_id_key" ON "referral_accounts"("tax_id");

-- CreateIndex
CREATE INDEX "referral_accounts_status_idx" ON "referral_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_login_tokens_token_hash_key" ON "referral_login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "referral_login_tokens_account_idx" ON "referral_login_tokens"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referral_credits_referred_order_id_key" ON "referral_credits"("referred_order_id");

-- CreateIndex
CREATE INDEX "referral_credits_account_status_idx" ON "referral_credits"("account_id", "status");

-- CreateIndex
CREATE INDEX "referral_credits_referred_tax_idx" ON "referral_credits"("referred_tax_id");

-- CreateIndex
CREATE INDEX "referral_credits_status_hold_idx" ON "referral_credits"("status", "hold_until");

-- CreateIndex
CREATE INDEX "referral_credit_uses_order_idx" ON "referral_credit_uses"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_credit_uses_credit_order_key" ON "referral_credit_uses"("credit_id", "order_id");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_idx" ON "rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_referral_account_kind_key" ON "coupons"("referral_account_id", "referral_kind");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_referral_account_id_fkey" FOREIGN KEY ("referral_account_id") REFERENCES "referral_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_login_tokens" ADD CONSTRAINT "referral_login_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "referral_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "referral_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_referred_order_id_fkey" FOREIGN KEY ("referred_order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_uses" ADD CONSTRAINT "referral_credit_uses_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "referral_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_uses" ADD CONSTRAINT "referral_credit_uses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

