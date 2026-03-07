ALTER TABLE `customers` ADD `address` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `country` enum('domestic','overseas') DEFAULT 'domestic' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `orders` ADD `isNewCustomer` boolean DEFAULT false NOT NULL;