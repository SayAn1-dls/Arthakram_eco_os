CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`priority` text DEFAULT 'info' NOT NULL,
	`audience` text DEFAULT 'everyone' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`kind` text NOT NULL,
	`room_id` text,
	`recorded_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`event_id` text,
	`summary` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_event_idx` ON `audit_logs` (`event_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `awards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text,
	`title` text NOT NULL,
	`rank` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `club_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`answers` text NOT NULL,
	`dimension_scores` text NOT NULL,
	`results` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_members` (
	`club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`club_id`, `user_id`),
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`organization_id` text NOT NULL,
	`college_id` text,
	`category` text NOT NULL,
	`tagline` text,
	`description` text,
	`color` text DEFAULT '#F26A1B' NOT NULL,
	`contact_email` text,
	`fit_profile` text,
	`learnings` text DEFAULT '[]' NOT NULL,
	`activities` text DEFAULT '[]' NOT NULL,
	`career_paths` text DEFAULT '[]' NOT NULL,
	`first_steps` text DEFAULT '[]' NOT NULL,
	`traits` text DEFAULT '{}' NOT NULL,
	`is_recruiting` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_slug_unique` ON `clubs` (`slug`);--> statement-breakpoint
CREATE TABLE `colleges` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`description` text,
	`website` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `colleges_slug_unique` ON `colleges` (`slug`);--> statement-breakpoint
CREATE TABLE `document_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`edited_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`section` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_event_idx` ON `documents` (`event_id`);--> statement-breakpoint
CREATE TABLE `evaluation_scores` (
	`evaluation_id` text NOT NULL,
	`criterion_id` text NOT NULL,
	`score` real NOT NULL,
	`comment` text,
	PRIMARY KEY(`evaluation_id`, `criterion_id`),
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`criterion_id`) REFERENCES `rubric_criteria`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`round_id` text NOT NULL,
	`team_id` text NOT NULL,
	`judge_user_id` text NOT NULL,
	`rubric_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_score` real,
	`feedback` text,
	`private_notes` text,
	`submitted_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rubric_id`) REFERENCES `rubrics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_uq` ON `evaluations` (`round_id`,`team_id`,`judge_user_id`);--> statement-breakpoint
CREATE TABLE `event_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`submission_deadline` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`is_final` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`organization_id` text NOT NULL,
	`college_id` text,
	`club_id` text,
	`tagline` text,
	`description` text,
	`mode` text DEFAULT 'offline' NOT NULL,
	`venue` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`registration_deadline` integer,
	`team_size_min` integer DEFAULT 1 NOT NULL,
	`team_size_max` integer DEFAULT 4 NOT NULL,
	`eligibility` text,
	`rules` text,
	`prizes` text,
	`sponsors` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`contact_email` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`registration_open` integer DEFAULT false NOT NULL,
	`results_published` integer DEFAULT false NOT NULL,
	`results_verified_at` integer,
	`allow_judge_edit` integer DEFAULT false NOT NULL,
	`current_round_id` text,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_org_idx` ON `events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `events_club_idx` ON `events` (`club_id`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text,
	`role` text DEFAULT 'participant' NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`document_id` text,
	`submission_id` text,
	`uploaded_by_id` text,
	`original_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `judge_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`round_id` text NOT NULL,
	`team_id` text NOT NULL,
	`judge_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `judge_assignment_uq` ON `judge_assignments` (`round_id`,`team_id`,`judge_user_id`);--> statement-breakpoint
CREATE TABLE `learning_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` text,
	`cta_label` text DEFAULT 'Visit' NOT NULL,
	`kind` text DEFAULT 'guide' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mentor_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`headline` text NOT NULL,
	`bio` text,
	`industry` text,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`expertise` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`availability` text,
	`linkedin_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`mentor_id` text NOT NULL,
	`topic` text NOT NULL,
	`message` text,
	`work_type` text DEFAULT 'project' NOT NULL,
	`work_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text,
	`mentor_id` text NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`work_type` text DEFAULT 'project' NOT NULL,
	`scores` text DEFAULT '[]' NOT NULL,
	`strengths` text,
	`weaknesses` text,
	`improvements` text,
	`next_steps` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `mentor_requests`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mentor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`organizer` text NOT NULL,
	`category` text NOT NULL,
	`source` text DEFAULT 'external' NOT NULL,
	`source_url` text,
	`event_id` text,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`mode` text DEFAULT 'online' NOT NULL,
	`location` text,
	`prize` text,
	`eligibility` text,
	`deadline` integer,
	`starts_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'community' NOT NULL,
	`description` text,
	`website` text,
	`contact_email` text,
	`color` text DEFAULT '#F26A1B' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text,
	`is_team_lead` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`college` text,
	`checkin_token` text NOT NULL,
	`checked_in_at` integer,
	`checked_in_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_in_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_checkin_token_unique` ON `participants` (`checkin_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `participant_event_user_uq` ON `participants` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `participants_team_idx` ON `participants` (`team_id`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `problem_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`track` text,
	`description` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`token` text NOT NULL,
	`purpose` text NOT NULL,
	`label` text NOT NULL,
	`room_id` text,
	`round_id` text,
	`scans` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_codes_token_unique` ON `qr_codes` (`token`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`note` text,
	`granted_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`revoked_by_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ra_user_idx` ON `role_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `ra_scope_idx` ON `role_assignments` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`color` text DEFAULT '#F26A1B' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_key_unique` ON `roles` (`key`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`capacity` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rubric_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`rubric_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`instructions` text,
	`weight` real NOT NULL,
	`min_score` integer DEFAULT 0 NOT NULL,
	`max_score` integer DEFAULT 10 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`rubric_id`) REFERENCES `rubrics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rubrics` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`round_id` text,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saved_opportunities` (
	`user_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `opportunity_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schedule_items` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'session' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`location` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`college_id` text,
	`program` text,
	`year` integer,
	`bio` text,
	`interests` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`career_goals` text DEFAULT '[]' NOT NULL,
	`linkedin_url` text,
	`github_url` text,
	`portfolio_url` text,
	`weekly_hours` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`round_id` text NOT NULL,
	`team_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text,
	`description` text,
	`repo_url` text,
	`demo_url` text,
	`deck_url` text,
	`video_url` text,
	`docs_url` text,
	`submitted_at` integer,
	`submitted_by_id` text,
	`updated_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_round_team_uq` ON `submissions` (`round_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`room_id` text,
	`problem_statement_id` text,
	`mentor_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`problem_statement_id`) REFERENCES `problem_statements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mentor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `teams_event_idx` ON `teams` (`event_id`);--> statement-breakpoint
CREATE TABLE `timers` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`round_id` text,
	`label` text NOT NULL,
	`kind` text DEFAULT 'round' NOT NULL,
	`duration_sec` integer NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`started_at` integer,
	`elapsed_before_sec` integer DEFAULT 0 NOT NULL,
	`ended_at` integer,
	`visible_to_participants` integer DEFAULT true NOT NULL,
	`updated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`round_id`) REFERENCES `event_rounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`headline` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);