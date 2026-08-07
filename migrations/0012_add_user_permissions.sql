-- 管理员细粒度权限：在 user 表新增 permissions 列（JSON 数组字符串；NULL = 超级管理员）
ALTER TABLE "user" ADD COLUMN "permissions" text;
