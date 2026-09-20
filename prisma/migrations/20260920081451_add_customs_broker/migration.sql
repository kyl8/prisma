/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Importer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Importer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Importer" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "customsbroker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT 'Não informada',

    CONSTRAINT "customsbroker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customsbroker_userId_key" ON "customsbroker"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Importer_userId_key" ON "Importer"("userId");

-- AddForeignKey
ALTER TABLE "Importer" ADD CONSTRAINT "Importer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customsbroker" ADD CONSTRAINT "customsbroker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
