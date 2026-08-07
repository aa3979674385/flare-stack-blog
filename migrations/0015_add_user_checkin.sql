ALTER TABLE "user" ADD COLUMN "last_check_in_at" integer;
ALTER TABLE "user" ADD COLUMN "check_in_streak" integer DEFAULT 0 NOT NULL;
