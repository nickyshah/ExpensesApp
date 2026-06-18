import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { search } = req.query;
  const tags = await prisma.tag.findMany({
    where: search ? { name: { contains: search } } : undefined,
    orderBy: { name: 'asc' },
    take: search ? 20 : undefined,
  });
  res.json(tags);
}));

export default router;
