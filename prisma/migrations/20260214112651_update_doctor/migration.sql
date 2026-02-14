/*
  Warnings:

  - The `specialization` column on the `doctors` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Specialization" AS ENUM ('CARDIOLOGY', 'DERMATOLOGY', 'PEDIATRICS', 'NEUROLOGY', 'ORTHOPEDICS', 'PSYCHIATRY', 'GENERAL_PRACTICE', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'ONCOLOGY');

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "specialization",
ADD COLUMN     "specialization" "Specialization";

-- CreateIndex
CREATE INDEX "doctors_specialization_idx" ON "doctors"("specialization");
