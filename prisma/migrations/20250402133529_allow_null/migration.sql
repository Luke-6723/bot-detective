-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestFulfilledWith" TEXT
);
INSERT INTO "new_Request" ("id", "messageId", "request", "requestFulfilledWith", "userId") SELECT "id", "messageId", "request", "requestFulfilledWith", "userId" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
