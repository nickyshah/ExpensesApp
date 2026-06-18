import { prisma } from '../prisma.js';

export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value;
}

export async function setSetting(key, value) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
