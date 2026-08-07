CREATE TABLE `point_transaction` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `type` text NOT NULL,
  `amount` integer NOT NULL,
  `balance_after` integer NOT NULL,
  `source` text DEFAULT 'other' NOT NULL,
  `ref_id` text,
  `operator_id` text,
  `reason` text,
  `created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX `point_txn_user_id_idx` ON `point_transaction` (`user_id`);
CREATE INDEX `point_txn_created_at_idx` ON `point_transaction` (`created_at`);
