CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(64),
	`contact` varchar(64),
	`phone` varchar(32),
	`remarks` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orderModels` ADD `stickerImages` text;--> statement-breakpoint
ALTER TABLE `orderModels` ADD `silkPrintImages` text;--> statement-breakpoint
ALTER TABLE `orderModels` ADD `linerImages` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `deletedAt` timestamp;