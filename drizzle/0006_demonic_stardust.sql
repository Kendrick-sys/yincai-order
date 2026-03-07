ALTER TABLE `orders` ADD `customerType` enum('domestic','overseas') DEFAULT 'domestic' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customsDeclared` boolean DEFAULT false NOT NULL;