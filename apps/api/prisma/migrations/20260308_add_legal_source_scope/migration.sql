-- CreateEnum
CREATE TYPE "LegalSourceScope" AS ENUM ('FEDERAL', 'AG', 'AL', 'AR', 'AI', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH');

-- AlterTable
ALTER TABLE "LegalSource" ADD COLUMN     "scope" "LegalSourceScope" NOT NULL DEFAULT 'FEDERAL';
