CREATE TABLE `orderModels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`modelName` varchar(128),
	`modelCode` varchar(64),
	`quantity` varchar(64),
	`topCover` text,
	`bottomCover` text,
	`accessories` text,
	`needSticker` boolean NOT NULL DEFAULT true,
	`stickerSource` varchar(64),
	`stickerDesc` text,
	`needSilkPrint` boolean NOT NULL DEFAULT true,
	`silkPrintDesc` text,
	`needLiner` boolean NOT NULL DEFAULT true,
	`topLiner` text,
	`bottomLiner` text,
	`needCarton` boolean NOT NULL DEFAULT true,
	`innerBox` text,
	`outerBox` text,
	`modelRemarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orderModels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('draft','submitted','in_production','completed','cancelled') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `quantity`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `topCover`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `bottomCover`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `plasticParts`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `metalParts`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stickerSource`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stickerDesc`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stickerQty`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `silkPrintDesc`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `topLiner`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `bottomLiner`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `topLiner2`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `bottomLiner2`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `innerBox`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `outerBox`;