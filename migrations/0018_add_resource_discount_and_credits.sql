-- 0018: 下载资源支持双积分计价 + 会员折扣可配置
-- 新增「会员折扣系数」列（1-10，10=不打折）；旧的「会员五折」数据平滑迁移为 discount=5

ALTER TABLE "post_resource" ADD COLUMN "member_discount" integer DEFAULT 10 NOT NULL;

-- price_type 语义从 rmb/points 调整为 points/credits（SQLite 文本列无约束，实际值由代码层写入，无需 DDL 变更）
-- member_access 语义 half 废弃，改用 discount；将既有 half 行转为 discount=5（即五折）
UPDATE "post_resource" SET "member_access" = 'discount', "member_discount" = 5 WHERE "member_access" = 'half';
