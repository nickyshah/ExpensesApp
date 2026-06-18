import { seed } from '../src/lib/server/seed.js';
import { prisma } from '../src/lib/server/prisma.js';

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
