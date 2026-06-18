import { prisma } from './prisma.js';

const PALETTE = ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#e6e6e6'];

const EXPENSE_CATEGORIES = [
  ['Groceries', '🛒', PALETTE[1]],
  ['Fuel', '⛽', PALETTE[2]],
  ['Rent', '🏠', PALETTE[0]],
  ['Utilities', '💡', PALETTE[3]],
  ['Transport', '🚌', PALETTE[1]],
  ['Dining Out', '🍽️', PALETTE[0]],
  ['Coffee', '☕', PALETTE[2]],
  ['Subscriptions', '📺', PALETTE[1]],
  ['Entertainment', '🎬', PALETTE[0]],
  ['Health', '💊', PALETTE[2]],
  ['Insurance', '🛡️', PALETTE[1]],
  ['Phone & Internet', '📱', PALETTE[0]],
  ['Shopping', '🛍️', PALETTE[2]],
  ['Personal Care', '🧴', PALETTE[3]],
  ['Education', '📚', PALETTE[1]],
  ['Gifts & Donations', '🎁', PALETTE[2]],
  ['Pets', '🐾', PALETTE[0]],
  ['Travel', '✈️', PALETTE[1]],
  ['Home & Garden', '🪴', PALETTE[2]],
  ['Other', '📦', PALETTE[4]],
];

const INCOME_CATEGORIES = [
  ['Salary', '💼', PALETTE[1]],
  ['Bonus', '🎉', PALETTE[0]],
  ['Interest', '🏦', PALETTE[2]],
  ['Investment', '📈', PALETTE[1]],
  ['Gift', '🎁', PALETTE[3]],
  ['Refund', '↩️', PALETTE[2]],
  ['Side Hustle', '🧰', PALETTE[0]],
  ['Other Income', '💰', PALETTE[4]],
];

export async function seed() {
  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    await prisma.account.createMany({
      data: [
        { name: 'Bank', type: 'bank', icon: '🏦', opening_balance: 0, sort_order: 0 },
        { name: 'Cash', type: 'cash', icon: '💵', opening_balance: 0, sort_order: 1 },
      ],
    });
  }

  const catCount = await prisma.category.count();
  if (catCount === 0) {
    await prisma.category.createMany({
      data: [
        ...EXPENSE_CATEGORIES.map(([name, icon, color], i) => ({
          name, type: 'expense', icon, color, is_default: 1, sort_order: i,
        })),
        ...INCOME_CATEGORIES.map(([name, icon, color], i) => ({
          name, type: 'income', icon, color, is_default: 1, sort_order: i,
        })),
      ],
    });
  }

  const settingsDefaults = {
    pin_enabled: '0',
    pin_hash: '',
    theme: 'system',
    currency: 'AUD',
    locale: 'en-AU',
  };

  for (const [key, value] of Object.entries(settingsDefaults)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}
