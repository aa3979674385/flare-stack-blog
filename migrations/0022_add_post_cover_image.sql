-- 0022: 文章封面图（cover_image）
-- 为 posts 表新增 cover_image 字段（可空文本）。
-- 前台列表/首页卡片优先读取该字段作为封面；留空时由后端在保存文章时
-- 自动从正文第一张尺寸足够的图片抓取写入，从而实现「没填封面自动取正文首图」的兜底。

ALTER TABLE "posts" ADD COLUMN "cover_image" text;
