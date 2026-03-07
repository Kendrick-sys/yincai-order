ALTER TABLE `orders` ADD `is1688` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `alibaba1688OrderNo` varchar(128);