-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestFulfilledWith" TEXT NOT NULL
);
