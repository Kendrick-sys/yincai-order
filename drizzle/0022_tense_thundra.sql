CREATE TABLE `yifeng_cost_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model` varchar(128) NOT NULL,
	`material` varchar(64) NOT NULL DEFAULT '',
	`boxPrice` varchar(32) NOT NULL DEFAULT '0',
	`puPrice` varchar(32) NOT NULL DEFAULT '0',
	`evaPrice` varchar(32) NOT NULL DEFAULT '0',
	`linerMoldFee` varchar(32) NOT NULL DEFAULT '0',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yifeng_cost_items_id` PRIMARY KEY(`id`)
);
