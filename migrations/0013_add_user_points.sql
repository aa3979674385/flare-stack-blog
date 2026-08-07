-- 双积分：在 user 表新增普通积分(points) 与会员积分(credits) 两列（默认 0，不允许为负）
ALTER TABLE "user" ADD COLUMN "points" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN "credits" integer DEFAULT 0 NOT NULL;
