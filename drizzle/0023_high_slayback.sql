CREATE TABLE `cost_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotName` varchar(128) NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(64) NOT NULL DEFAULT '',
	`itemCount` int NOT NULL DEFAULT 0,
	`data` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_snapshots_id` PRIMARY KEY(`id`)
);
