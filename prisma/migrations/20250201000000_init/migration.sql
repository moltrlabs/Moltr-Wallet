-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "fromTagId" TEXT NOT NULL,
    "toTagId" TEXT NOT NULL,
    "amountLamports" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_fromTagId_fkey" FOREIGN KEY ("fromTagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_toTagId_fkey" FOREIGN KEY ("toTagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_username_key" ON "Tag"("username");

-- CreateIndex
CREATE INDEX "Receipt_fromTagId_idx" ON "Receipt"("fromTagId");

-- CreateIndex
CREATE INDEX "Receipt_toTagId_idx" ON "Receipt"("toTagId");
