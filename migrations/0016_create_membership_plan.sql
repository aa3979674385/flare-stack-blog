-- VIP 会员套餐表
CREATE TABLE `membership_plan` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `price_cents` integer NOT NULL,
  `duration_days` integer DEFAULT 30 NOT NULL,
  `visible` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX `membership_plan_visible_idx` ON `membership_plan` (`visible`);
