ALTER TABLE "admin_users"
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "allowed_sections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
