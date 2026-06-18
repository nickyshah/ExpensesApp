import express from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireFields, ValidationError } from '../utils/validators.js';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { type, includeArchived } = req.query;
  const where = {};
  if (type) where.type = type;
  if (!includeArchived) where.is_archived = 0;

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  });
  res.json(categories);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, type, icon, color } = req.body;
  requireFields(req.body, ['name', 'type']);
  if (!['income', 'expense'].includes(type)) throw new ValidationError('type must be income or expense');

  const maxOrder = await prisma.category.aggregate({
    where: { type },
    _max: { sort_order: true },
  });

  try {
    const cat = await prisma.category.create({
      data: {
        name,
        type,
        icon: icon || '🏷️',
        color: color || '#808080',
        is_default: 0,
        sort_order: (maxOrder._max.sort_order ?? -1) + 1,
      },
    });
    res.status(201).json(cat);
  } catch (e) {
    if (e.code === 'P2002') throw new ValidationError('A category with that name and type already exists');
    throw e;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const { name, icon, color, is_archived, sort_order } = req.body;
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(is_archived != null && { is_archived: Number(is_archived) }),
      ...(sort_order != null && { sort_order: Number(sort_order) }),
    },
  });
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (cat.is_default) throw new ValidationError('Cannot delete a default category. Archive it instead.');

  const [txCount, recurringCount, budgetCount] = await Promise.all([
    prisma.transaction.count({ where: { category_id: id } }),
    prisma.recurringBill.count({ where: { category_id: id } }),
    prisma.budget.count({ where: { category_id: id } }),
  ]);

  if (txCount + recurringCount + budgetCount > 0) {
    throw new ValidationError('Cannot delete a category that is in use. Archive it instead.');
  }

  await prisma.category.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
