CREATE TABLE `admin_log` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text NOT NULL,
  `admin_name` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text,
  `target_name` text,
  `detail` text,
  `created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX `admin_log_created_at_idx` ON `admin_log` (`created_at`);
