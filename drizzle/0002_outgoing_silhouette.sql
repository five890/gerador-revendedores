ALTER TABLE `users` DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('moderator','reseller','client','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `loginMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `lastSignedIn` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;