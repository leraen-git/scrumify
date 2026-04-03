const { PrismaClient } = require('../generated/prisma/client');

async function main() {
  const prisma = new PrismaClient({});
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "UserStory" ADD COLUMN IF NOT EXISTS "environment" TEXT');
    console.log('Migration: environment column ok');
  } catch (e) {
    console.warn('Migration skipped:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
