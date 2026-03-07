ALTER TABLE `orders` ADD `isAlibaba` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `alibabaOrderNo` varchar(128);