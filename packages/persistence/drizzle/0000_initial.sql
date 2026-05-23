CREATE TABLE `repair_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`step_run_id` text NOT NULL,
	`n` integer NOT NULL,
	`classification` text NOT NULL,
	`error_log` text NOT NULL,
	`screenshot_path` text,
	`dom_snapshot` text,
	`llm_input_script` text NOT NULL,
	`llm_output_script` text,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`step_run_id`) REFERENCES `step_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `repair_attempts_step_run_id_idx` ON `repair_attempts` (`step_run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_attempts_step_run_id_n_unique` ON `repair_attempts` (`step_run_id`,`n`);--> statement-breakpoint
CREATE TABLE `script_histories` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`script` text NOT NULL,
	`source` text NOT NULL,
	`source_repair_attempt_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_repair_attempt_id`) REFERENCES `repair_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `script_histories_step_id_idx` ON `script_histories` (`step_id`);--> statement-breakpoint
CREATE INDEX `script_histories_created_at_idx` ON `script_histories` (`created_at`);--> statement-breakpoint
CREATE TABLE `step_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`final_script` text,
	FOREIGN KEY (`suite_run_id`) REFERENCES `suite_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `step_runs_suite_run_id_idx` ON `step_runs` (`suite_run_id`);--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_id` text NOT NULL,
	`order` integer NOT NULL,
	`name` text NOT NULL,
	`script` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`suite_id`) REFERENCES `suites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `steps_suite_id_order_unique` ON `steps` (`suite_id`,`order`);--> statement-breakpoint
CREATE INDEX `steps_suite_id_idx` ON `steps` (`suite_id`);--> statement-breakpoint
CREATE TABLE `suite_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error` text,
	FOREIGN KEY (`suite_id`) REFERENCES `suites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `suite_runs_suite_id_idx` ON `suite_runs` (`suite_id`);--> statement-breakpoint
CREATE INDEX `suite_runs_started_at_idx` ON `suite_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `suites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
