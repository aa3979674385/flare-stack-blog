-- 下载资源：将「说明」字段改造为「解压码」，并新增「收费时隐藏解压码」开关
-- 1) 列改名：description -> extract_code（保留已有数据）
ALTER TABLE post_resource RENAME COLUMN description TO extract_code;
-- 2) 新增开关列：0=不隐藏（默认），1=收费时隐藏解压码
ALTER TABLE post_resource ADD COLUMN hide_code_when_paid INTEGER NOT NULL DEFAULT 0;
