ALTER TABLE `orders` ADD `recipientName` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `recipientPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `recipientAddress` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `factoryShipNo` varchar(100);