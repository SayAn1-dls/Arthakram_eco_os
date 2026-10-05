CREATE INDEX `announcements_event_idx` ON `announcements` (`event_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `club_members_user_idx` ON `club_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `evaluations_team_idx` ON `evaluations` (`team_id`);--> statement-breakpoint
CREATE INDEX `evaluations_judge_idx` ON `evaluations` (`judge_user_id`);--> statement-breakpoint
CREATE INDEX `judge_assignments_judge_idx` ON `judge_assignments` (`judge_user_id`);--> statement-breakpoint
CREATE INDEX `mentor_requests_mentor_idx` ON `mentor_requests` (`mentor_id`);--> statement-breakpoint
CREATE INDEX `mentor_requests_student_idx` ON `mentor_requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `participants_user_idx` ON `participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `submissions_team_idx` ON `submissions` (`team_id`);--> statement-breakpoint
CREATE INDEX `timers_event_idx` ON `timers` (`event_id`);