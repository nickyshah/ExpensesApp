import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { prisma, dbPath } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { exportTransactionsCSV, importTransactionsCSV } from '../services/csvService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/export/csv', asyncHandler(async (req, res) => {
  const csv = await exportTransactionsCSV();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-app-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

router.post('/import/csv', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const text = req.file.buffer.toString('utf-8');
  const result = await importTransactionsCSV(text);
  res.json(result);
}));

router.get('/backup', asyncHandler(async (req, res) => {
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database file not found' });

  await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL)');

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-app-backup-${new Date().toISOString().slice(0, 10)}.db"`);
  fs.createReadStream(dbPath).pipe(res);
}));

router.get('/export/json', asyncHandler(async (req, res) => {
  const [accounts, categories, tags, transaction_tags, transactions, recurring_bills, budgets, budget_templates] = await Promise.all([
    prisma.account.findMany(),
    prisma.category.findMany(),
    prisma.tag.findMany(),
    prisma.transactionTag.findMany(),
    prisma.transaction.findMany(),
    prisma.recurringBill.findMany(),
    prisma.budget.findMany(),
    prisma.budgetTemplate.findMany(),
  ]);

  const data = {
    accounts,
    categories,
    tags,
    transaction_tags,
    transactions,
    recurring_bills,
    budgets,
    budget_templates,
    exported_at: new Date().toISOString(),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-app-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));

export default router;
