CREATE TABLE `tutorials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`videoUrl` text NOT NULL,
	`type` enum('basic','advanced','ios') NOT NULL DEFAULT 'advanced',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `downloads` ADD `type` enum('basic','advanced','ios') DEFAULT 'advanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `keys` ADD `type` enum('basic','advanced','ios') DEFAULT 'advanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsBasic` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsAdvanced` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsIos` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `maxDevices` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isPremium` boolean DEFAULT false NOT NULL;