ALTER TABLE `orders` ADD `isAmazon` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `amazonOrderNo` varchar(128);